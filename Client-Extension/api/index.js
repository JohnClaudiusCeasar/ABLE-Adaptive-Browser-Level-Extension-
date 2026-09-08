/**
 * ABLE Extension - API Index
 *
 * Re-exports all API modules for backward compatibility.
 * This is the main entry point for API functionality.
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

// Re-export all API functions to global namespace for backward compatibility
if (typeof globalThis !== "undefined") {
  globalThis.fetchSignedEnvelope = fetchSignedEnvelope;
  globalThis.getDomainClassification = ABLEClassification.getDomainClassification;
  globalThis.getRiskPatterns = ABLEARiskPatterns.getRiskPatterns;
  globalThis.refreshRiskPatternsCache = ABLEARiskPatterns.refreshRiskPatternsCache;
  globalThis.logDomainVisit = ABLELogging.logDomainVisit;
  globalThis.logEgressEvent = ABLELogging.logEgressEvent;
  globalThis.getOrCreateUserId = ABLELogging.getOrCreateUserId;
  globalThis.logExtensionLifecycle = ABLELogging.logExtensionLifecycle;
  globalThis.processVisitLogQueue = ABLELogging.processVisitLogQueue;
  globalThis.processEgressLogQueue = ABLELogging.processEgressLogQueue;
}
