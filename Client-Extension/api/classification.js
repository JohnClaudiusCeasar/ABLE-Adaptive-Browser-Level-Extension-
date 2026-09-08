/**
 * ABLE Extension - Domain Classification
 *
 * Handles domain classification via server API and offline cache.
 */

const OFFLINE_CACHE_KEY = "able:domain_policies";
const OFFLINE_CACHE_TIMESTAMP_KEY = "able:domain_policies_timestamp";
const OFFLINE_CACHE_ENVELOPE_KEY = "able:domain_policies_envelope";

const domainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheTtl() {
  return ABLERuntimeSettings.get("sync.cache_ttl_ms", CACHE_TTL);
}

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
      [OFFLINE_CACHE_KEY]: policies,
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

function classifyFromCache(domain, cachedPolicies) {
  const exactMatch = cachedPolicies.find(p => p.domain === domain);
  if (exactMatch) return exactMatch;

  const subdomainMatch = cachedPolicies.find(p => domain.endsWith("." + p.domain));
  if (subdomainMatch) return subdomainMatch;

  return null;
}

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

async function getDomainClassification(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    const cached = domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < getCacheTtl()) {
      return cached.data;
    }

    const serverResult = await classifyDomainViaServer(url);
    if (serverResult) {
      domainCache.set(domain, {
        data: serverResult,
        timestamp: Date.now(),
      });
      refreshOfflineCache();
      return serverResult;
    }

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

    return null;
  } catch (error) {
    console.error("Error in getDomainClassification:", error);
    return null;
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEClassification = {
    getDomainClassification,
    classifyDomainViaServer,
    classifyFromCache,
    refreshOfflineCache,
    getOfflineCache,
    clearOfflineCache,
  };
}
