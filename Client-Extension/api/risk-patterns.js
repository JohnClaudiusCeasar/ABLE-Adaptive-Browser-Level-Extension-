/**
 * ABLE Extension - Risk Patterns
 *
 * Manages fetching, caching, and retrieving risk patterns for content scanning.
 */

const RISK_PATTERNS_KEY = "able:risk_patterns";
const RISK_PATTERNS_TIMESTAMP_KEY = "able:risk_patterns_timestamp";
const RISK_PATTERNS_ENVELOPE_KEY = "able:risk_patterns_envelope";

const RISK_PATTERNS_SYNC_INTERVAL = 24 * 60 * 60 * 1000;
const RISK_PATTERNS_MEMORY_TTL = 5 * 60 * 1000;

let riskPatternsMemoryCache = null;
let riskPatternsMemoryCacheTimestamp = 0;

function getRiskPatternsSyncIntervalMs() {
  const minutes = ABLERuntimeSettings.get("sync.risk_patterns_interval_minutes", 1440);
  return minutes * 60 * 1000;
}

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

async function getRiskPatternsOfflineCache() {
  try {
    const cached = await ABLESecurity.readSignedOfflineCache(RISK_PATTERNS_KEY);
    if (!cached) return { patterns: [], timestamp: 0 };

    var patterns = Array.isArray(cached)
      ? cached
      : (cached.patterns && Array.isArray(cached.patterns) ? cached.patterns : []);

    const tsResult = await chrome.storage.local.get(RISK_PATTERNS_TIMESTAMP_KEY);
    return {
      patterns: patterns,
      timestamp: tsResult[RISK_PATTERNS_TIMESTAMP_KEY] || cached.issued_at || 0,
    };
  } catch (error) {
    console.warn("ABLE: Failed to read risk patterns offline cache:", error);
    return { patterns: [], timestamp: 0 };
  }
}

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

async function getRiskPatterns() {
  try {
    if (riskPatternsMemoryCache && Date.now() - riskPatternsMemoryCacheTimestamp < RISK_PATTERNS_MEMORY_TTL) {
      console.debug(`ABLE: Returning ${riskPatternsMemoryCache.length} patterns from memory cache`);
      return riskPatternsMemoryCache;
    }

    // In a content script, delegate to background service worker.
    // Content scripts on HTTPS pages (e.g. grok.com) are blocked from directly fetching http://localhost:8000 by browser Mixed Content policies.
    if (typeof window !== 'undefined' && window.document && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const response = await chrome.runtime.sendMessage({ type: "getRiskPatterns" });
        if (response && response.success && Array.isArray(response.patterns) && response.patterns.length > 0) {
          riskPatternsMemoryCache = response.patterns;
          riskPatternsMemoryCacheTimestamp = Date.now();
          return response.patterns;
        }
      } catch (e) {
        console.debug("ABLE: Background message for risk patterns failed, falling back to cache:", e.message);
      }
    }

    // In background service worker, fetch from server
    if (typeof window === 'undefined' || !window.document) {
      console.debug("ABLE: Memory cache miss, checking server...");
      const serverPatterns = await refreshRiskPatternsCache();
      if (serverPatterns && serverPatterns.length > 0) {
        console.debug(`ABLE: Got ${serverPatterns.length} patterns from server`);
        riskPatternsMemoryCache = serverPatterns;
        riskPatternsMemoryCacheTimestamp = Date.now();
        return serverPatterns;
      }
    }

    console.debug("ABLE: Server patterns unavailable, checking offline cache...");
    const { patterns } = await getRiskPatternsOfflineCache();
    if (patterns && patterns.length > 0) {
      console.log(`ABLE: Using verified offline risk patterns cache (${patterns.length} patterns).`);
      riskPatternsMemoryCache = patterns;
      riskPatternsMemoryCacheTimestamp = Date.now();
      return patterns;
    }

    console.warn("ABLE: No risk patterns available from server or cache.");
    return [];
  } catch (error) {
    console.warn("ABLE: Failed to get risk patterns:", error.message);
    return [];
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERiskPatterns = {
    getRiskPatterns,
    refreshRiskPatternsCache,
    getRiskPatternsOfflineCache,
    clearRiskPatternsCache,
  };
  globalThis.ABLEARiskPatterns = globalThis.ABLERiskPatterns;
}
