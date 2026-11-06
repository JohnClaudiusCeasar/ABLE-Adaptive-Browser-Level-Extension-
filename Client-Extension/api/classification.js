/**
 * ABLE Extension - Domain Classification
 *
 * Handles domain classification via server API and offline cache.
 */

const OFFLINE_CACHE_KEY = "able:domain_policies";
const OFFLINE_CACHE_TIMESTAMP_KEY = "able:domain_policies_timestamp";
const OFFLINE_CACHE_REFRESHED_AT_KEY = "able:domain_policies_refreshed_at";
const OFFLINE_CACHE_ENVELOPE_KEY = "able:domain_policies_envelope";

const domainCache = new Map();
const CACHE_TTL = 60 * 1000;

// The signed policy feed carries every domain, so it is refreshed on its own
// cadence instead of on every live classification.
const OFFLINE_CACHE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function getCacheTtl() {
  return ABLERuntimeSettings.get("sync.cache_ttl_ms", CACHE_TTL);
}

/**
 * Refresh the signed offline cache, but no more often than the refresh
 * interval so a short classification TTL does not pull the full policy
 * feed on every navigation.
 */
async function refreshOfflineCacheIfStale() {
  try {
    const stored = await chrome.storage.local.get(OFFLINE_CACHE_REFRESHED_AT_KEY);
    const lastRefresh = stored[OFFLINE_CACHE_REFRESHED_AT_KEY] || 0;
    if (Date.now() - lastRefresh < OFFLINE_CACHE_REFRESH_INTERVAL_MS) return null;
  } catch {}

  return refreshOfflineCache();
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
      [OFFLINE_CACHE_REFRESHED_AT_KEY]: Date.now(),
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
    const cached = await ABLESecurity.readSignedOfflineCache(OFFLINE_CACHE_KEY);
    if (!cached) return { policies: [], recommendations: [], timestamp: 0 };

    var policies = Array.isArray(cached)
      ? cached
      : (cached.policies && Array.isArray(cached.policies) ? cached.policies : []);
    var recommendations = (!Array.isArray(cached) && Array.isArray(cached.recommendations))
      ? cached.recommendations
      : [];

    const tsResult = await chrome.storage.local.get(OFFLINE_CACHE_TIMESTAMP_KEY);
    return {
      policies: policies,
      recommendations: recommendations,
      timestamp: tsResult[OFFLINE_CACHE_TIMESTAMP_KEY] || cached.issued_at || 0,
    };
  } catch (error) {
    console.warn("ABLE: Failed to read offline cache:", error);
    return { policies: [], recommendations: [], timestamp: 0 };
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

/**
 * Recommendation helpers.
 *
 * The signed feed carries the admin-curated list as
 * [{ category, domain }, ...]. When a category has no manual entries the
 * server falls back to whitelisted domains; the offline path mirrors that
 * rule from the cached policies.
 */

function normalizeCategory(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isExcludedRecommendationCategory(category) {
  var key = normalizeCategory(category);

  return key !== "" && ABLE_RECOMMENDATION_EXCLUDED_CATEGORIES.indexOf(key) !== -1;
}

function normalizeDomain(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/^www\./, "") : "";
}

function isRelatedDomain(candidate, domain) {
  var a = normalizeDomain(candidate);
  var b = normalizeDomain(domain);

  if (!a || !b) return false;

  return a === b || b.endsWith("." + a) || a.endsWith("." + b);
}

/**
 * Normalize, exclude the visited domain and its relatives, dedupe, sort, cap.
 */
function filterRecommendationDomains(domains, excludeDomain, limit) {
  var max = typeof limit === "number" && limit > 0
    ? Math.min(limit, 20)
    : ABLE_RECOMMENDATIONS_LIMIT;

  var seen = {};
  var recommendations = [];

  (Array.isArray(domains) ? domains : []).forEach(function (value) {
    var domain = normalizeDomain(value);
    if (!domain || seen[domain] || isRelatedDomain(domain, excludeDomain)) return;

    seen[domain] = true;
    recommendations.push(domain);
  });

  recommendations.sort(function (a, b) { return a.localeCompare(b); });

  return recommendations.slice(0, max);
}

/**
 * The admin-curated list for a category.
 */
function filterRecommendations(entries, category, excludeDomain, limit) {
  var key = normalizeCategory(category);

  // No category means there is nothing to recommend against; the warning
  // falls back to its legacy single-paragraph form. Gambling and Adult are
  // never recommended.
  if (!key || isExcludedRecommendationCategory(key)) return [];

  var domains = [];

  (Array.isArray(entries) ? entries : []).forEach(function (entry) {
    if (!entry || typeof entry !== "object") return;
    if (normalizeCategory(entry.category) !== key) return;
    if (typeof entry.domain === "string") domains.push(entry.domain);
  });

  return filterRecommendationDomains(domains, excludeDomain, limit);
}

/**
 * The server's fallback source: whitelisted policies in the same category.
 */
function filterWhitelistedPolicies(policies, category, excludeDomain, limit) {
  var key = normalizeCategory(category);
  if (!key || isExcludedRecommendationCategory(key)) return [];

  var domains = [];

  (Array.isArray(policies) ? policies : []).forEach(function (policy) {
    if (!policy || policy.policy !== "whitelisted" || policy.block_access) return;
    if (normalizeCategory(policy.category) !== key) return;
    if (typeof policy.domain === "string") domains.push(policy.domain);
  });

  return filterRecommendationDomains(domains, excludeDomain, limit);
}

async function getRecommendationsFromCache(category, excludeDomain, limit) {
  try {
    var cached = await getOfflineCache();

    var manual = filterRecommendations(cached.recommendations, category, excludeDomain, limit);
    if (manual.length > 0) return manual;

    return filterWhitelistedPolicies(cached.policies, category, excludeDomain, limit);
  } catch (error) {
    console.warn("ABLE: Failed to build recommendations from the offline cache:", error);
    return [];
  }
}

async function classifyDomainViaServer(url, signals) {
  try {
    const response = await ABLESecurity.secureFetch(
      `${SERVER_URL}/api/classify-domain`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ url: url, signals: signals || null }),
      }
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

function collectSignals(url) {
  try {
    if (typeof globalThis !== "undefined" && globalThis.ABLEPageSignals) {
      return globalThis.ABLEPageSignals.collectPageSignals();
    }
  } catch (e) {}
  try {
    if (typeof document !== "undefined") {
      return { url: url, title: (document.title || "").slice(0, 200), meta: {}, headings: [], excerpt: "" };
    }
  } catch (e) {}
  return null;
}

async function getDomainClassification(url, signals) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    const cached = domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < getCacheTtl()) {
      return cached.data;
    }

    const serverResult = await classifyDomainViaServer(url, signals || collectSignals(url));
    if (serverResult) {
      domainCache.set(domain, {
        data: serverResult,
        timestamp: Date.now(),
      });
      refreshOfflineCacheIfStale();
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
          block_access: !!cachedResult.block_access,
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
    refreshOfflineCacheIfStale,
    getOfflineCache,
    clearOfflineCache,
    filterRecommendations,
    filterWhitelistedPolicies,
    getRecommendationsFromCache,
  };
}
