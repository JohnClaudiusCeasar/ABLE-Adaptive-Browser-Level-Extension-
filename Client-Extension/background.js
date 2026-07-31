self.importScripts("config.js", "api.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "classifyDomain") {
    handleClassifyDomain(message.url, sendResponse);
    return true;
  }
  if (message.type === "logVisit") {
    // Fire-and-forget: log the domain visit to the server
    logDomainVisit(message.domain, message.status, message.source);
    sendResponse({ success: true });
    return true;
  }
  return true;
});

async function handleClassifyDomain(url, sendResponse) {
  try {
    // Try server classification first
    const serverResult = await getDomainClassification(url);

    if (serverResult) {
      // Server responded successfully — we're online.
      // Clear the offline cache since we don't need it when online.
      clearOfflineCache();

      const messages = getStatusMessage(serverResult.status, serverResult.domain, serverResult.category, []);
      sendResponse({
        status: serverResult.status,
        domain: serverResult.domain,
        category: serverResult.category,
        alternatives: [],
        risk_score: serverResult.risk_score,
        policy: serverResult.policy,
        source: serverResult.source,
        title: messages.title,
        message: messages.message,
      });
    } else {
      // Server is unreachable — try the offline cache (last saved data from when admin was online)
      const offlineResult = await classifyFromOfflineCache(url);

      if (offlineResult) {
        const messages = getStatusMessage(offlineResult.status, offlineResult.domain, offlineResult.category, []);
        sendResponse({
          ...offlineResult,
          title: messages.title,
          message: messages.message,
          source: "offline_cache",
        });
      } else {
        // Last resort: fall back to hardcoded local config
        const result = classifyDomain(url);
        const messages = getStatusMessage(result.status, result.domain, result.category, result.alternatives);
        sendResponse({
          ...result,
          title: messages.title,
          message: messages.message,
          source: "local_fallback",
        });
      }
    }
  } catch (error) {
    console.error("Error classifying domain:", error);
    // Ultimate fallback to local
    const result = classifyDomain(url);
    const messages = getStatusMessage(result.status, result.domain, result.category, result.alternatives);
    sendResponse({
      ...result,
      title: messages.title,
      message: messages.message,
      source: "local_fallback",
    });
  }
}

/**
 * Classify a domain using the offline cache stored in chrome.storage.local.
 * This cache was last saved when the admin server was online.
 */
async function classifyFromOfflineCache(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");

    const { policies } = await getOfflineCache();
    if (policies.length === 0) return null;

    // Exact match
    const exactMatch = policies.find(p => p.domain === domain);
    if (exactMatch) {
      return {
        status: exactMatch.domain_status,
        domain: domain,
        category: exactMatch.category,
        policy: exactMatch.policy,
        risk_score: exactMatch.risk_score,
      };
    }

    // Subdomain match (e.g., docs.google.com matches google.com)
    const subdomainMatch = policies.find(p => domain.endsWith("." + p.domain));
    if (subdomainMatch) {
      return {
        status: subdomainMatch.domain_status,
        domain: domain,
        category: subdomainMatch.category,
        policy: subdomainMatch.policy,
        risk_score: subdomainMatch.risk_score,
      };
    }

    return null;
  } catch (error) {
    console.error("Error in classifyFromOfflineCache:", error);
    return null;
  }
}