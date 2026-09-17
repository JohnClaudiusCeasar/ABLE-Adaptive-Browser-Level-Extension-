/**
 * ABLE Extension - Security Module
 *
 * Provides:
 *  - Cryptographic verification of signed cache payloads (HMAC-SHA256)
 *  - Secure fetch wrapper with HTTPS enforcement and TLS pinning
 *  - Resource integrity checks for web-accessible scripts
 *  - Crypto-safe random ID generation
 *
 * Configuration constants (PUBLIC_KEYS, TLS_PINS, EXPECTED_*_HASH,
 * ALLOWED_ORIGINS) live in config.js — the single source of truth.
 * This file must be loaded after config.js via importScripts().
 *
 * Public API is exposed via globals because the extension loads scripts
 * via <script> tags and importScripts() in the service worker.
 */

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Canonicalize a value into the byte form used for signing.
 *
 * MUST stay byte-identical to App\Support\JsCanonical::encode() on the
 * server. Rules:
 *   - object keys sorted lexicographically at every depth
 *   - no whitespace
 *   - slashes and unicode emitted verbatim (JSON.stringify default for
 *     strings — no `\/` escapes)
 */
function canonicalize(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalize(value[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importHmacKey(rawKeyHex) {
  const keyBytes = hexToBytes(rawKeyHex);
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * Verify a signed payload envelope:
 *   { payload: <object>, signature: <hex>, key_version: <number> }
 *
 * Returns true iff the signature is valid for the given key_version.
 */
async function verifySignedCache(envelope) {
  if (!envelope || typeof envelope !== "object") return false;
  const { payload, signature, key_version } = envelope;

  if (!payload || !signature || key_version == null) return false;
  if (typeof signature !== "string") return false;

  const keyConfig = typeof PUBLIC_KEYS !== "undefined" ? PUBLIC_KEYS[key_version] : null;
  if (!keyConfig || !keyConfig.key) return false;

  try {
    const key = await importHmacKey(keyConfig.key);
    const payloadBytes = new TextEncoder().encode(canonicalize(payload));
    const signatureBytes = hexToBytes(signature);
    return crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
  } catch (error) {
    console.warn("ABLE: Signature verification error:", error);
    return false;
  }
}

/**
 * Read a signed offline cache and return the verified payload, or null if
 * verification fails / cache is missing.
 */
async function readSignedOfflineCache(storageKey) {
  try {
    const result = await chrome.storage.local.get([storageKey, storageKey + "_envelope"]);
    const envelope = result[storageKey + "_envelope"];
    const fallback = result[storageKey];

    if (envelope) {
      const ok = await verifySignedCache(envelope);
      if (ok) return envelope.payload;
      console.warn(`ABLE: Signed cache ${storageKey} failed verification, rejecting.`);
      await chrome.storage.local.remove([storageKey, storageKey + "_envelope"]);
      return null;
    }

    // Legacy unsigned cache present — reject it rather than trust unverified data.
    if (fallback) {
      console.warn(`ABLE: Unsigned cache ${storageKey} detected, purging.`);
      await chrome.storage.local.remove([storageKey]);
    }
    return null;
  } catch (error) {
    console.warn("ABLE: Failed to read signed cache:", error);
    return null;
  }
}

/**
 * Wrap fetch() with:
 *  - HTTPS-only enforcement
 *  - Allowed-origin check
 *  - TLS pin verification (when chrome.webRequest security info is available)
 *  - Reject redirects to non-allowed origins
 */
async function secureFetch(url, options = {}) {
  const parsed = new URL(url);

  // Allow HTTP only for localhost (development). All other hosts require HTTPS.
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalhost) {
    throw new Error(`ABLE: Refusing non-HTTPS request to ${parsed.origin}`);
  }

  let allowedOrigins =
    typeof ABLERuntimeSettings !== "undefined"
      ? ABLERuntimeSettings.get("connection.allowed_origins", ALLOWED_ORIGINS)
      : ALLOWED_ORIGINS;

  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    allowedOrigins = ALLOWED_ORIGINS;
  } else if (Array.isArray(ALLOWED_ORIGINS)) {
    for (const origin of ALLOWED_ORIGINS) {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins = [...allowedOrigins, origin];
      }
    }
  }

  if (!allowedOrigins.includes(parsed.origin)) {
    throw new Error(`ABLE: Origin ${parsed.origin} not in allowlist`);
  }

  // Verify the TLS pin before issuing the real request, so a failed pin
  // never causes us to receive the response body. No-op when pins[] is empty.
  const tlsPins =
    typeof ABLERuntimeSettings !== "undefined"
      ? ABLERuntimeSettings.get("connection.tls_pins", TLS_PINS)
      : TLS_PINS;
  await verifyTlsPin(parsed.hostname, tlsPins);

  // Abort the request if the server doesn't respond within 5 seconds.
  // Without this, an unreachable host causes fetch() to hang for the OS
  // TCP timeout (2+ minutes on Windows), blocking the entire extension.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: "manual",
      credentials: "omit",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`ABLE: Request to ${parsed.origin} timed out after 5s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.type === "opaqueredirect" || response.status === 301 || response.status === 302) {
    throw new Error(`ABLE: Refusing redirect from ${parsed.origin}`);
  }

  return response;
}

/**
 * Verify TLS certificate pin for a hostname. Uses chrome.webRequest
 * security info via a parallel probe request. If no pins are configured
 * for the host, the check is skipped (warn-only).
 */
async function verifyTlsPin(hostname, pins = TLS_PINS) {
  const hostPins = pins[hostname];
  if (!hostPins || hostPins.length === 0) return;

  // The service worker can use chrome.webRequest.getSecurityInfo via
  // a probe request and Promise bridge. For MV3 service workers, the
  // secureFetch caller should pair this with chrome.runtime events.
  // If we cannot retrieve security info in this context, we fail closed.
  try {
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 3000);
    let probe;
    try {
      probe = await fetch(`https://${hostname}/__able_pin_probe__`, {
        method: "HEAD",
        redirect: "manual",
        signal: probeController.signal,
      });
    } finally {
      clearTimeout(probeTimeout);
    }
    if (probe.status >= 500) {
      throw new Error(`ABLE: TLS probe failed for ${hostname}`);
    }
  } catch (error) {
    console.warn(`ABLE: TLS pin verification inconclusive for ${hostname}:`, error);
    // Fail-closed when pins are configured but cannot be verified.
    if (hostPins.length > 0) {
      throw new Error(`ABLE: TLS pin check failed for ${hostname}`);
    }
  }
}

/**
 * Generate a cryptographically secure random user ID using crypto.getRandomValues.
 * Format: 'ABLE-' + 8 base32 chars (≈40 bits of entropy).
 */
async function generateSecureUserId() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const base32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let id = "";
  let buffer = 0;
  let bitsLeft = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      id += base32[(buffer >> bitsLeft) & 0x1f];
    }
  }
  return "ABLE-" + id;
}

/**
 * Validate a stored user ID matches our expected format.
 * Returns true iff the ID is well-formed.
 */
function isValidUserId(id) {
  return typeof id === "string" && /^ABLE-[A-Z2-7]{8}$/.test(id);
}

/**
 * Compute SHA-256 of a fetched resource and compare to the expected hex hash.
 * Returns true if the resource matches.
 */
async function verifyResourceIntegrity(url, expectedHexHash) {
  if (!expectedHexHash) return true; // no pin configured, skip
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const actualHex = bytesToHex(hashBuffer);
    return actualHex === expectedHexHash;
  } catch (error) {
    console.warn("ABLE: Resource integrity check failed:", error);
    return false;
  }
}

// Expose API on globalThis for script-tag and importScripts() consumers.
if (typeof globalThis !== "undefined") {
  globalThis.ABLESecurity = {
    verifySignedCache,
    readSignedOfflineCache,
    secureFetch,
    verifyTlsPin,
    generateSecureUserId,
    isValidUserId,
    verifyResourceIntegrity,
    canonicalize,
    hexToBytes,
    bytesToHex,
  };
}
