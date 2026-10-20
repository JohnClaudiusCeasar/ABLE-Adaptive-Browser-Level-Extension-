/**
 * ABLE Extension - Runtime Settings
 *
 * Loads a signed runtime configuration from the ABLE admin server and makes it
 * available to the rest of the extension. `config.js` remains the fallback for
 * development and offline first-boot, but any value present in the verified
 * server payload wins.
 *
 * The server payload is an HMAC-signed envelope:
 *   { payload: { settings: {...}, issued_at }, signature, key_version }
 *
 * It is verified with the public key bundled in config.js via
 * ABLESecurity.verifySignedCache() before being trusted.
 */

const RUNTIME_SETTINGS_STORAGE_KEY = "able:runtime_settings";
const RUNTIME_SETTINGS_TIMESTAMP_KEY = "able:runtime_settings_timestamp";
const RUNTIME_SETTINGS_ENVELOPE_KEY = "able:runtime_settings_envelope";
const RUNTIME_SETTINGS_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function buildDefaults() {
  return {
    "behavior.risk_threshold":
      typeof ABLE_RISK_THRESHOLD !== "undefined" ? ABLE_RISK_THRESHOLD : 85,
    "behavior.modal_short_cooldown_ms":
      typeof ABLE_MODAL_SHORT_COOLDOWN_MS !== "undefined" ? ABLE_MODAL_SHORT_COOLDOWN_MS : 35000,
    "behavior.modal_stagger_cooldown_ms":
      typeof ABLE_MODAL_STAGGER_COOLDOWN_MS !== "undefined" ? ABLE_MODAL_STAGGER_COOLDOWN_MS : 300000,
    "behavior.session_consent_enabled":
      typeof ABLE_SESSION_CONSENT_ENABLED !== "undefined" ? ABLE_SESSION_CONSENT_ENABLED : true,
    "sync.cache_ttl_ms":
      typeof ABLE_CACHE_TTL !== "undefined" ? ABLE_CACHE_TTL : 60000,
    "sync.risk_patterns_interval_minutes":
      typeof ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES !== "undefined"
        ? ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES
        : 1440,
    "sync.visit_log_flush_interval_minutes":
      typeof ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES !== "undefined"
        ? ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES
        : 5,
    "sync.egress_log_flush_interval_minutes":
      typeof ABLE_EGRESS_LOG_FLUSH_INTERVAL_MINUTES !== "undefined"
        ? ABLE_EGRESS_LOG_FLUSH_INTERVAL_MINUTES
        : 5,
    "connection.allowed_origins":
      typeof ALLOWED_ORIGINS !== "undefined" ? ALLOWED_ORIGINS : [],
    "connection.tls_pins":
      typeof TLS_PINS !== "undefined" ? TLS_PINS : {},
    "logging.rate_limit_default_backoff_ms":
      typeof ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS !== "undefined"
        ? ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS
        : 60000,
    "logging.daily_egress_cap":
      typeof ABLE_DAILY_EGRESS_CAP !== "undefined" ? ABLE_DAILY_EGRESS_CAP : 500,
    "logging.visit_debounce_ms":
      typeof ABLE_VISIT_DEBOUNCE_MS !== "undefined" ? ABLE_VISIT_DEBOUNCE_MS : 5000,
    "logging.skip_search_results":
      typeof ABLE_SKIP_SEARCH_RESULTS !== "undefined" ? ABLE_SKIP_SEARCH_RESULTS : true,
    "excluded_domains":
      typeof EXCLUDED_DOMAINS !== "undefined" ? EXCLUDED_DOMAINS : [],
    // Integrity pins for the web-accessible assets. The build-time constants
    // are the default; a signed server payload can carry a newer pin for a
    // newer build so installed extensions do not have to be reinstalled.
    // Every asset in INTEGRITY_ASSET_KEYS needs an entry here, otherwise
    // sanitize() drops the signed pin and the auto-heal never reaches it.
    "integrity.expected_inject_hash":
      typeof EXPECTED_INJECT_HASH !== "undefined" ? EXPECTED_INJECT_HASH : "",
    "integrity.expected_content_css_hash":
      typeof EXPECTED_CONTENT_CSS_HASH !== "undefined" ? EXPECTED_CONTENT_CSS_HASH : "",
    "integrity.expected_synthetic_names_hash":
      typeof EXPECTED_SYNTHETIC_NAMES_HASH !== "undefined" ? EXPECTED_SYNTHETIC_NAMES_HASH : "",
    "integrity.expected_file_extractor_hash":
      typeof EXPECTED_FILE_EXTRACTOR_HASH !== "undefined" ? EXPECTED_FILE_EXTRACTOR_HASH : "",
    "integrity.expected_network_interceptor_hash":
      typeof EXPECTED_NETWORK_INTERCEPTOR_HASH !== "undefined" ? EXPECTED_NETWORK_INTERCEPTOR_HASH : "",
    "integrity.expected_file_tracker_hash":
      typeof EXPECTED_FILE_TRACKER_HASH !== "undefined" ? EXPECTED_FILE_TRACKER_HASH : "",
  };
}

function sanitize(settings) {
  const defaults = buildDefaults();
  const result = {};

  for (const key of Object.keys(defaults)) {
    const value = settings[key];

    if (key.startsWith("integrity.")) {
      // A signed pin replaces the build-time default. Anything that is not a
      // well-formed SHA-256 — including a server that publishes no pin — keeps
      // the build-time default, so the extension always holds a trusted pin.
      result[key] =
        typeof value === "string" && /^[0-9a-f]{64}$/i.test(value)
          ? value.toLowerCase()
          : defaults[key];
      continue;
    }

    if (value === undefined) {
      result[key] = defaults[key];
      continue;
    }

    const expected = defaults[key];
    if (Array.isArray(expected)) {
      const filtered = Array.isArray(value) ? value.filter((v) => typeof v === "string") : expected;
      result[key] = (key === "connection.allowed_origins" && filtered.length === 0) ? expected : filtered;
    } else if (typeof expected === "boolean") {
      result[key] = typeof value === "boolean" ? value : expected;
    } else if (typeof expected === "number") {
      result[key] = typeof value === "number" ? value : expected;
    } else {
      result[key] = value;
    }
  }

  return result;
}

const ABLERuntimeSettings = {
  defaults: buildDefaults(),
  current: buildDefaults(),

  async load() {
    try {
      const envelope = await this.fetchEnvelope();

      if (!envelope) return this.current;

      const ok = await ABLESecurity.verifySignedCache(envelope);
      if (!ok) {
        console.warn("ABLE: Runtime settings failed signature verification, keeping defaults.");
        return this.current;
      }

      const payload = envelope.payload || {};
      const settings = sanitize(payload.settings || {});

      this.current = settings;

      try {
        await chrome.storage.local.set({
          [RUNTIME_SETTINGS_STORAGE_KEY]: settings,
          [RUNTIME_SETTINGS_TIMESTAMP_KEY]: payload.issued_at || Date.now(),
          // Keep the envelope so the persisted copy can be re-verified later.
          // Without it a locally forged setting could be restored and trusted.
          [RUNTIME_SETTINGS_ENVELOPE_KEY]: envelope,
        });
      } catch (error) {
        console.warn("ABLE: Failed to persist runtime settings:", error.message);
      }

      return this.current;
    } catch (error) {
      console.warn("ABLE: Failed to load runtime settings:", error.message);
      return this.current;
    }
  },

  async initialize() {
    await this.restorePersisted();
    await this.load();
    return this.current;
  },

  async restorePersisted() {
    try {
      const result = await chrome.storage.local.get([
        RUNTIME_SETTINGS_STORAGE_KEY,
        RUNTIME_SETTINGS_TIMESTAMP_KEY,
        RUNTIME_SETTINGS_ENVELOPE_KEY,
      ]);

      const stored = result[RUNTIME_SETTINGS_STORAGE_KEY];
      const envelope = result[RUNTIME_SETTINGS_ENVELOPE_KEY];
      const timestamp = result[RUNTIME_SETTINGS_TIMESTAMP_KEY] || 0;

      if (!stored || Date.now() - timestamp >= RUNTIME_SETTINGS_REFRESH_INTERVAL) {
        return;
      }

      // The persisted copy is only trusted when the envelope it came from
      // still verifies. This keeps the settings usable offline without
      // letting a locally forged value become a trusted integrity pin.
      if (!envelope) {
        console.warn("ABLE: Persisted runtime settings have no envelope, ignoring them.");
        return;
      }

      const ok = await ABLESecurity.verifySignedCache(envelope);
      if (!ok) {
        console.warn("ABLE: Persisted runtime settings failed signature verification, ignoring them.");
        await chrome.storage.local.remove([
          RUNTIME_SETTINGS_STORAGE_KEY,
          RUNTIME_SETTINGS_TIMESTAMP_KEY,
          RUNTIME_SETTINGS_ENVELOPE_KEY,
        ]);
        return;
      }

      const payload = envelope.payload || {};
      this.current = sanitize(payload.settings || {});
    } catch (error) {
      console.warn("ABLE: Failed to restore persisted runtime settings:", error.message);
    }
  },

  async fetchEnvelope() {
    try {
      const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/extension/config`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn("ABLE: Runtime settings fetch failed:", error.message);
      return null;
    }
  },

  get(path, fallback) {
    if (path && path in this.current) {
      return this.current[path];
    }

    if (path && path in this.defaults) {
      return this.defaults[path];
    }

    return fallback;
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.ABLERuntimeSettings = ABLERuntimeSettings;
}
