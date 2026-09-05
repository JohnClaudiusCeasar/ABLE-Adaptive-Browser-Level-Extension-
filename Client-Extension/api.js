// API client for querying the ABLE server for domain classification.
// SERVER_URL is defined in config.js (loaded before this file) as the
// single source of truth shared with security.js's ALLOWED_ORIGINS.

// Cache for domain classifications to minimize API calls
const domainCache = new Map();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Effective cache TTL from signed runtime settings, falling back to CACHE_TTL.
 */
function getCacheTtl() {
  return ABLERuntimeSettings.get("sync.cache_ttl_ms", CACHE_TTL);
}

// Storage key for offline policy cache (signed envelope format)
const OFFLINE_CACHE_KEY = "able:domain_policies";
const OFFLINE_CACHE_TIMESTAMP_KEY = "able:domain_policies_timestamp";
const OFFLINE_CACHE_ENVELOPE_KEY = "able:domain_policies_envelope";

// Storage key for risk patterns cache (signed envelope format)
const RISK_PATTERNS_KEY = "able:risk_patterns";
const RISK_PATTERNS_TIMESTAMP_KEY = "able:risk_patterns_timestamp";
const RISK_PATTERNS_ENVELOPE_KEY = "able:risk_patterns_envelope";

// Risk patterns sync interval (24 hours)
const RISK_PATTERNS_SYNC_INTERVAL = 24 * 60 * 60 * 1000;

function getRiskPatternsSyncIntervalMs() {
  const minutes = ABLERuntimeSettings.get("sync.risk_patterns_interval_minutes", 1440);
  return minutes * 60 * 1000;
}

// In-memory cache for risk patterns to avoid repeated fetch failures on rapid scans
let riskPatternsMemoryCache = null;
let riskPatternsMemoryCacheTimestamp = 0;
const RISK_PATTERNS_MEMORY_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all domain policies from the server and store them in chrome.storage.local
 * as a signed envelope. Returns the verified payload, or null if the server
 * is unreachable or returns an unverifiable payload.
 */
async function refreshOfflineCache() {
  try {
    const envelope = await fetchSignedEnvelope(`${SERVER_URL}/api/domain-policies/signed`);
    if (!envelope) return null;

    const ok = await ABLESecurity.verifySignedCache(envelope);
    if (!ok) {
      console.warn("ABLE: Server-returned domain policies failed signature verification.");
      return null;
    }

    const payload = envelope.payload || {};
    const policies = payload.policies || [];

    await chrome.storage.local.set({
      [OFFLINE_CACHE_KEY]: policies, // legacy mirror, unused by read path
      [OFFLINE_CACHE_TIMESTAMP_KEY]: payload.issued_at || Date.now(),
      [OFFLINE_CACHE_ENVELOPE_KEY]: envelope,
    });

    console.log(`ABLE: Offline cache updated with ${policies.length} verified domain policies.`);
    return policies;
  } catch (error) {
    console.warn("ABLE: Failed to refresh offline cache:", error.message);
    return null;
  }
}

/**
 * Fetch a signed envelope from the server. Returns the parsed JSON object
 * with { payload, signature, key_version }, or null on failure.
 */
async function fetchSignedEnvelope(url) {
  try {
    const response = await ABLESecurity.secureFetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("ABLE: Failed to fetch signed envelope:", error.message);
    return null;
  }
}

/**
 * Retrieve the offline cache from chrome.storage.local.
 * Reads the signed envelope and verifies it before returning policies.
 */
async function getOfflineCache() {
  try {
    const policies = await ABLESecurity.readSignedOfflineCache(OFFLINE_CACHE_KEY);
    if (!policies) return { policies: [], timestamp: 0 };

    const tsResult = await chrome.storage.local.get(OFFLINE_CACHE_TIMESTAMP_KEY);
    return {
      policies: Array.isArray(policies) ? policies : [],
      timestamp: tsResult[OFFLINE_CACHE_TIMESTAMP_KEY] || 0,
    };
  } catch (error) {
    console.warn("ABLE: Failed to read offline cache:", error);
    return { policies: [], timestamp: 0 };
  }
}

/**
 * Classify a domain using the offline cached policies only.
 */
function classifyFromCache(domain, cachedPolicies) {
  // Exact match
  const exactMatch = cachedPolicies.find(p => p.domain === domain);
  if (exactMatch) return exactMatch;

  // Subdomain match (e.g., docs.google.com matches google.com)
  const subdomainMatch = cachedPolicies.find(p => domain.endsWith("." + p.domain));
  if (subdomainMatch) return subdomainMatch;

  return null;
}

/**
 * Clear the offline cache (called when admin is online and data may have changed).
 */
async function clearOfflineCache() {
  try {
    await chrome.storage.local.remove([
      OFFLINE_CACHE_KEY,
      OFFLINE_CACHE_TIMESTAMP_KEY,
      OFFLINE_CACHE_ENVELOPE_KEY,
    ]);
    console.log("ABLE: Offline cache cleared.");
  } catch (error) {
    console.warn("ABLE: Failed to clear offline cache:", error.message);
  }
}

/**
 * Classify a domain by querying the ABLE server API.
 */
async function classifyDomainViaServer(url) {
  try {
    const response = await ABLESecurity.secureFetch(
      `${SERVER_URL}/api/classify-domain?url=${encodeURIComponent(url)}`,
      { method: "GET", headers: { "Accept": "application/json" } }
    );

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("ABLE server unreachable or refused, falling back to offline cache:", error.message);
    return null;
  }
}

/**
 * Get classification for a domain, using:
 * 1. In-memory cache (fastest)
 * 2. Server API (if online)
 * 3. Offline cache (chrome.storage.local, last saved data, signed)
 * 4. Hardcoded config (last resort fallback)
 */
async function getDomainClassification(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    // Step 1: Check in-memory cache first
    const cached = domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < getCacheTtl()) {
      return cached.data;
    }

    // Step 2: Try server
    const serverResult = await classifyDomainViaServer(url);
    if (serverResult) {
      // Cache the result in memory
      domainCache.set(domain, {
        data: serverResult,
        timestamp: Date.now(),
      });

      // Also refresh the offline cache in the background (non-blocking)
      refreshOfflineCache();

      return serverResult;
    }

    // Step 3: Server unavailable — try offline cache from chrome.storage (verified)
    const { policies } = await getOfflineCache();
    if (policies.length > 0) {
      const cachedResult = classifyFromCache(domain, policies);
      if (cachedResult) {
        return {
          status: cachedResult.domain_status,
          domain: domain,
          category: cachedResult.category,
          policy: cachedResult.policy,
          risk_score: cachedResult.risk_score,
          source: "offline_cache",
        };
      }
    }

    // Step 4: Nothing available — return null (caller will use local config fallback)
    return null;
  } catch (error) {
    console.error("Error in getDomainClassification:", error);
    return null;
  }
}

/**
 * Generate or retrieve a persistent sanitized User ID.
 * Uses crypto.getRandomValues via ABLESecurity.generateSecureUserId().
 * Stored value is validated on read; corrupt or malformed IDs are regenerated.
 */
async function getOrCreateUserId() {
  const USER_ID_KEY = 'able:user_id';

  try {
    const result = await chrome.storage.local.get(USER_ID_KEY);
    const stored = result[USER_ID_KEY];
    if (stored && ABLESecurity.isValidUserId(stored)) {
      return stored;
    }
    if (stored) {
      console.warn("ABLE: Stored user ID malformed, regenerating.");
    }
  } catch (error) {
    console.warn('Failed to retrieve user ID:', error);
  }

  const userId = await ABLESecurity.generateSecureUserId();

  try {
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  } catch (error) {
    console.warn('Failed to store user ID:', error);
  }

  return userId;
}

/**
 * Log an extension lifecycle event (install/update/uninstall) to the server.
 * Called from background.js during onInstalled. Uninstall is handled via
 * setUninstallURL which opens a GET endpoint.
 */
async function logExtensionLifecycle({ userId, extensionId, event, version }) {
  try {
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/extension/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        extension_id: extensionId,
        event: event,
        version: version,
      }),
    });

    if (!response.ok) {
      console.warn("ABLE: Failed to log extension lifecycle event:", response.status);
    }
  } catch (error) {
    // Silently fail — logging lifecycle is non-critical
  }
}

/**
 * Pending visit log queue — stores visit events that couldn't be sent
 * to the server (e.g., network unreachable) so they can be retried later.
 */
const PENDING_VISITS_KEY = "able:pending_visits";

/**
 * Queue a visit log entry for later retry when the server is unreachable.
 */
async function queueVisitLog(domain, status, source, userId, visitedAt) {
  try {
    const result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    const queue = result[PENDING_VISITS_KEY] || [];
    queue.push({
      domain,
      status,
      source,
      user_id: userId,
      visited_at: visitedAt,
      enqueued_at: Date.now(),
    });
    await chrome.storage.local.set({ [PENDING_VISITS_KEY]: queue });
  } catch {
    // Silently fail — queueing is best-effort
  }
}

/**
 * Attempt to flush pending visit logs to the server.
 * Respects rate-limit backoff. Successfully sent entries are removed;
 * failures remain in the queue for the next attempt.
 */
async function processVisitLogQueue() {
  try {
    if (await isEndpointCoolingDown("log-visit")) return;

    const result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    const queue = result[PENDING_VISITS_KEY] || [];
    if (queue.length === 0) return;

    const remaining = [];

    for (const entry of queue) {
      try {
        const response = await ABLESecurity.secureFetch(
          `${SERVER_URL}/api/log-visit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              domain: entry.domain,
              status: entry.status,
              source: entry.source,
              user_id: entry.user_id,
              visited_at: entry.visited_at,
            }),
          }
        );

        if (response.status === 429) {
          await recordRateLimitBackoff("log-visit", response);
          console.warn("ABLE: log-visit queue retry rate-limited by server, backing off.");
          remaining.push(entry);
          break; // stop — rate limited, retry next attempt
        }

        if (!response.ok) {
          console.warn("ABLE: Failed to flush queued visit log:", response.status);
          remaining.push(entry);
        }
        // Success — don't re-queue
      } catch {
        remaining.push(entry);
      }
    }

    await chrome.storage.local.set({ [PENDING_VISITS_KEY]: remaining });
  } catch {
    // Silently fail — best-effort retry
  }
}

/**
 * Pending egress log queue — stores egress events that couldn't be sent
 * to the server (e.g., network unreachable, rate-limited) so they can
 * be retried later.
 */
const PENDING_EGRESS_KEY = "able:pending_egress";

/**
 * Queue an egress event for later retry when the server is unreachable.
 */
async function queueEgressEvent(event) {
  try {
    const result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    const queue = result[PENDING_EGRESS_KEY] || [];
    queue.push({
      ...event,
      enqueued_at: Date.now(),
    });
    await chrome.storage.local.set({ [PENDING_EGRESS_KEY]: queue });
  } catch {
    // Silently fail — queueing is best-effort
  }
}

/**
 * Attempt to flush pending egress events to the server.
 * Respects rate-limit backoff. Successfully sent entries are removed;
 * failures remain in the queue for the next attempt.
 */
async function processEgressLogQueue() {
  try {
    if (await isEndpointCoolingDown("log-egress")) return;

    const result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    const queue = result[PENDING_EGRESS_KEY] || [];
    if (queue.length === 0) return;

    const remaining = [];

    for (const entry of queue) {
      try {
        const response = await ABLESecurity.secureFetch(
          `${SERVER_URL}/api/log-egress`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              domain: entry.domain,
              user_id: entry.user_id,
              file_name: entry.file_name,
              file_size: entry.file_size,
              risk_score: entry.risk_score,
              action: entry.action,
              user_action: entry.user_action,
              occurred_at: entry.occurred_at,
            }),
          }
        );

        if (response.status === 429) {
          await recordRateLimitBackoff("log-egress", response);
          console.warn("ABLE: log-egress queue retry rate-limited by server, backing off.");
          remaining.push(entry);
          break; // stop — rate limited, retry next attempt
        }

        if (!response.ok) {
          console.warn("ABLE: Failed to flush queued egress event:", response.status);
          remaining.push(entry);
        }
        // Success — don't re-queue
      } catch {
        remaining.push(entry);
      }
    }

    await chrome.storage.local.set({ [PENDING_EGRESS_KEY]: remaining });
  } catch {
    // Silently fail — best-effort retry
  }
}

/**
 * Log a domain visit to the server.
 * Honors Retry-After on 429 responses by suppressing further visit logs
 * to this endpoint for the indicated backoff window.
 * If the server is unreachable, queues the visit for later retry.
 */
async function logDomainVisit(domain, status, source, timestamp) {
  // Best-effort: retry any previously queued visits
  await processVisitLogQueue();

  if (await isEndpointCoolingDown("log-visit")) return null;

  const userId = await getOrCreateUserId();

  try {
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ domain, status, source, user_id: userId, visited_at: timestamp }),
    });

    if (response.status === 429) {
      await recordRateLimitBackoff("log-visit", response);
      console.warn("ABLE: log-visit rate-limited by server, backing off.");
      return null;
    }

    if (!response.ok) {
      console.warn("ABLE: Failed to log domain visit:", response.status);
      await queueVisitLog(domain, status, source, userId, timestamp);
      return null;
    }

    const data = await response.json();
    return data.visit_count ?? null;
  } catch (error) {
    // Server unreachable — queue for later retry
    await queueVisitLog(domain, status, source, userId, timestamp);
    return null;
  }
}

/**
 * Log an egress event to the server.
 * Called when user interacts with the file upload intercept modal, or
 * when a file is uploaded to a safe domain.
 * Honors Retry-After on 429 responses. Enforces a per-user daily cap
 * to prevent log flooding in case of misconfiguration.
 * If the server is unreachable, queues the event for later retry.
 */
async function logEgressEvent({ domain, fileName, fileSize, riskScore, action, userAction, timestamp }) {
  // Best-effort: retry any previously queued egress events
  await processEgressLogQueue();

  const userId = await getOrCreateUserId();

  const payload = {
    domain,
    user_id: userId,
    file_name: fileName,
    file_size: fileSize,
    risk_score: riskScore,
    action,
    user_action: userAction,
    occurred_at: timestamp,
  };

  // Queue instead of dropping when rate-limited or daily cap reached
  if (await isEndpointCoolingDown("log-egress")) {
    await queueEgressEvent(payload);
    return;
  }
  if (await isDailyEgressCapReached()) {
    await queueEgressEvent(payload);
    return;
  }

  try {
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-egress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      await recordRateLimitBackoff("log-egress", response);
      console.warn("ABLE: log-egress rate-limited by server, backing off.");
      await queueEgressEvent(payload);
      return;
    }

    if (!response.ok) {
      console.warn("ABLE: Failed to log egress event:", response.status);
      await queueEgressEvent(payload);
      return;
    }

    await incrementDailyEgressCount(action);
  } catch (error) {
    // Server unreachable — queue for later retry
    await queueEgressEvent(payload);
  }
}

/**
 * Rate-limit state — keyed by endpoint name, value is the timestamp
 * after which requests may resume.
 */
const RATE_LIMIT_KEY = "able:rate_limit";

async function isEndpointCoolingDown(endpoint) {
  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_KEY);
    const map = result[RATE_LIMIT_KEY] || {};
    const until = map[endpoint] || 0;
    return Date.now() < until;
  } catch {
    return false;
  }
}

async function recordRateLimitBackoff(endpoint, response) {
  let retryAfterMs = ABLERuntimeSettings.get("logging.rate_limit_default_backoff_ms", 60000);
  try {
    const header = response.headers.get("Retry-After");
    if (header) {
      const seconds = parseInt(header, 10);
      if (!Number.isNaN(seconds)) retryAfterMs = seconds * 1000;
    }
  } catch {
    // fall through with default
  }
  // Cap retry-after to 10 minutes to avoid indefinite blocking.
  retryAfterMs = Math.min(retryAfterMs, 10 * 60 * 1000);

  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_KEY);
    const map = result[RATE_LIMIT_KEY] || {};
    map[endpoint] = Date.now() + retryAfterMs;
    await chrome.storage.session.set({ [RATE_LIMIT_KEY]: map });
  } catch {
    // ignore — best-effort
  }
}

/**
 * Daily egress cap — prevents a misconfigured extension or runaway
 * page from flooding the server with egress logs.
 */
const DAILY_EGRESS_CAP = 500;
const DAILY_EGRESS_COUNT_KEY = "able:daily_egress_count";
const DAILY_EGRESS_DATE_KEY = "able:daily_egress_date";

function getDailyEgressCap() {
  return ABLERuntimeSettings.get("logging.daily_egress_cap", DAILY_EGRESS_CAP);
}

async function isDailyEgressCapReached() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await chrome.storage.session.get([DAILY_EGRESS_COUNT_KEY, DAILY_EGRESS_DATE_KEY]);
    if (result[DAILY_EGRESS_DATE_KEY] !== today) return false;
    return (result[DAILY_EGRESS_COUNT_KEY] || 0) >= getDailyEgressCap();
  } catch {
    return false;
  }
}

async function incrementDailyEgressCount(action) {
  // Only count high-risk events (proceeded/denied) toward the daily cap.
  // Safe domain "allowed" events are low-impact and shouldn't be capped.
  if (action === 'allowed') return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await chrome.storage.session.get([DAILY_EGRESS_COUNT_KEY, DAILY_EGRESS_DATE_KEY]);
    const current = result[DAILY_EGRESS_DATE_KEY] === today
      ? (result[DAILY_EGRESS_COUNT_KEY] || 0) + 1
      : 1;
    await chrome.storage.session.set({
      [DAILY_EGRESS_COUNT_KEY]: current,
      [DAILY_EGRESS_DATE_KEY]: today,
    });
  } catch {
    // ignore — best-effort
  }
}

/**
 * Fetch risk patterns from the server and store them in chrome.storage.local
 * as a signed envelope. Returns the verified pattern array, or null on failure.
 */
async function refreshRiskPatternsCache() {
  try {
    const envelope = await fetchSignedEnvelope(`${SERVER_URL}/api/risk-patterns/signed`);
    if (!envelope) return null;

    const ok = await ABLESecurity.verifySignedCache(envelope);
    if (!ok) {
      console.warn("ABLE: Server-returned risk patterns failed signature verification.");
      return null;
    }

    const payload = envelope.payload || {};
    const patterns = payload.patterns || [];

    await chrome.storage.local.set({
      [RISK_PATTERNS_KEY]: patterns,
      [RISK_PATTERNS_TIMESTAMP_KEY]: payload.issued_at || Date.now(),
      [RISK_PATTERNS_ENVELOPE_KEY]: envelope,
    });

    console.log(`ABLE: Risk patterns cache updated with ${patterns.length} verified patterns.`);
    return patterns;
  } catch (error) {
    console.warn("ABLE: Failed to refresh risk patterns cache:", error.message);
    return null;
  }
}

/**
 * Retrieve the risk patterns offline cache from chrome.storage.local.
 * Reads the signed envelope and verifies it before returning patterns.
 */
async function getRiskPatternsOfflineCache() {
  try {
    const patterns = await ABLESecurity.readSignedOfflineCache(RISK_PATTERNS_KEY);
    if (!patterns) return { patterns: [], timestamp: 0 };

    const tsResult = await chrome.storage.local.get(RISK_PATTERNS_TIMESTAMP_KEY);
    return {
      patterns: Array.isArray(patterns) ? patterns : [],
      timestamp: tsResult[RISK_PATTERNS_TIMESTAMP_KEY] || 0,
    };
  } catch (error) {
    console.warn("ABLE: Failed to read risk patterns offline cache:", error);
    return { patterns: [], timestamp: 0 };
  }
}

/**
 * Clear the risk patterns cache (called when admin is online and data may have changed).
 */
async function clearRiskPatternsCache() {
  try {
    await chrome.storage.local.remove([
      RISK_PATTERNS_KEY,
      RISK_PATTERNS_TIMESTAMP_KEY,
      RISK_PATTERNS_ENVELOPE_KEY,
    ]);
    console.log("ABLE: Risk patterns cache cleared.");
  } catch (error) {
    console.warn("ABLE: Failed to clear risk patterns cache:", error.message);
  }
}

/**
 * Get risk patterns, using:
 * 1. In-memory cache (fastest, avoids repeated fetch failures on rapid scans)
 * 2. Server API (if online) — also refreshes offline cache
 * 3. Offline cache (chrome.storage.local, last saved data, signed)
 */
async function getRiskPatterns() {
  try {
    // Step 1: Check in-memory cache first
    if (riskPatternsMemoryCache && Date.now() - riskPatternsMemoryCacheTimestamp < RISK_PATTERNS_MEMORY_TTL) {
      return riskPatternsMemoryCache;
    }

    // Step 2: Try server first (refreshRiskPatternsCache already stores to chrome.storage.local)
    const serverPatterns = await refreshRiskPatternsCache();
    if (serverPatterns) {
      riskPatternsMemoryCache = serverPatterns;
      riskPatternsMemoryCacheTimestamp = Date.now();
      return serverPatterns;
    }

    // Step 3: Server unavailable — try verified offline cache
    const { patterns } = await getRiskPatternsOfflineCache();
    if (patterns.length > 0) {
      console.log(`ABLE: Using verified offline risk patterns cache (${patterns.length} patterns).`);
      riskPatternsMemoryCache = patterns;
      riskPatternsMemoryCacheTimestamp = Date.now();
      return patterns;
    }

    // Step 4: No patterns available
    console.warn("ABLE: No risk patterns available from server or cache.");
    return [];
  } catch (error) {
    console.warn("ABLE: Failed to get risk patterns:", error.message);
    return [];
  }
}
