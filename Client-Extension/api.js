// API client for querying the ABLE server for domain classification
const SERVER_URL = "http://localhost:8000";

// Cache for domain classifications to minimize API calls
const domainCache = new Map();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Storage key for offline policy cache
const OFFLINE_CACHE_KEY = "able:domain_policies";
const OFFLINE_CACHE_TIMESTAMP_KEY = "able:domain_policies_timestamp";

/**
 * Fetch all domain policies from the server and store them in chrome.storage.local
 * for offline/fallback use. This is called when the server is online.
 */
async function refreshOfflineCache() {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/domain-policies`,
      { method: "GET", headers: { "Accept": "application/json" } }
    );

    if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

    const data = await response.json();

    if (data.policies && Array.isArray(data.policies)) {
      await chrome.storage.local.set({
        [OFFLINE_CACHE_KEY]: data.policies,
        [OFFLINE_CACHE_TIMESTAMP_KEY]: Date.now(),
      });
      console.log(`ABLE: Offline cache updated with ${data.count} domain policies.`);
    }

    return data.policies || [];
  } catch (error) {
    console.warn("ABLE: Failed to refresh offline cache:", error.message);
    return null;
  }
}

/**
 * Retrieve the offline cache from chrome.storage.local.
 */
async function getOfflineCache() {
  try {
    const result = await chrome.storage.local.get([OFFLINE_CACHE_KEY, OFFLINE_CACHE_TIMESTAMP_KEY]);
    return {
      policies: result[OFFLINE_CACHE_KEY] || [],
      timestamp: result[OFFLINE_CACHE_TIMESTAMP_KEY] || 0,
    };
  } catch {
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
    await chrome.storage.local.remove([OFFLINE_CACHE_KEY, OFFLINE_CACHE_TIMESTAMP_KEY]);
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
    const response = await fetch(
      `${SERVER_URL}/api/classify-domain?url=${encodeURIComponent(url)}`,
      { method: "GET", headers: { "Accept": "application/json" } }
    );

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("ABLE server unreachable, falling back to offline cache:", error.message);
    return null;
  }
}

/**
 * Get classification for a domain, using:
 * 1. In-memory cache (fastest)
 * 2. Server API (if online)
 * 3. Offline cache (chrome.storage.local, last saved data)
 * 4. Hardcoded config (last resort fallback)
 */
async function getDomainClassification(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    // Step 1: Check in-memory cache first
    const cached = domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

    // Step 3: Server unavailable — try offline cache from chrome.storage
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
 * Format: 'ABLE-' + 8 random alphanumeric characters (uppercase)
 */
async function getOrCreateUserId() {
  const USER_ID_KEY = 'able:user_id';

  try {
    const result = await chrome.storage.local.get(USER_ID_KEY);
    if (result[USER_ID_KEY]) {
      return result[USER_ID_KEY];
    }
  } catch (error) {
    console.warn('Failed to retrieve user ID:', error);
  }

  // Generate new ID: 'ABLE-' + random alphanumeric (8 chars)
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
  const userId = `ABLE-${randomPart}`;

  try {
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  } catch (error) {
    console.warn('Failed to store user ID:', error);
  }

  return userId;
}

/**
 * Log a domain visit to the server.
 * This is a fire-and-forget POST — no response processing needed.
 */
async function logDomainVisit(domain, status, source) {
  const userId = await getOrCreateUserId();

  try {
    const response = await fetch(`${SERVER_URL}/api/log-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ domain, status, source, user_id: userId }),
    });

    if (!response.ok) {
      console.warn("ABLE: Failed to log domain visit:", response.status);
    }
  } catch (error) {
    // Silently fail — logging visits is non-critical
  }
}
