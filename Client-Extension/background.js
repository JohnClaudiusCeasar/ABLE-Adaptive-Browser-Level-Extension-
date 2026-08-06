self.importScripts("config.js", "api.js");

const RISK_PATTERNS_ALARM = "risk-patterns-sync";

chrome.runtime.onInstalled.addListener(async () => {
  // Sync risk patterns when extension is installed or updated
  await refreshRiskPatternsCache();

  // Set up periodic sync every 24 hours
  chrome.alarms.create(RISK_PATTERNS_ALARM, { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === RISK_PATTERNS_ALARM) {
    await refreshRiskPatternsCache();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "classifyDomain") {
    handleClassifyDomain(message.url, sendResponse);
    return true;
  }
  if (message.type === "logVisit") {
    logDomainVisit(message.domain, message.status, message.source)
      .then((visitCount) => sendResponse({ success: true, visit_count: visitCount }))
      .catch(() => sendResponse({ success: false, visit_count: null }));
    return true;
  }
  if (message.type === "getRiskPatterns") {
    getRiskPatterns()
      .then((patterns) => sendResponse({ success: true, patterns }))
      .catch(() => sendResponse({ success: false, patterns: [] }));
    return true;
  }
  if (message.type === "logEgress") {
    logEgressEvent(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
  return true;
});

async function handleClassifyDomain(url, sendResponse) {
  try {
    // Try server classification first (includes offline cache fallback)
    const serverResult = await getDomainClassification(url);

    if (serverResult) {
      // Server or offline cache responded successfully
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
      // No classification available from server or cache — return default unlisted
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      const defaultResult = getDefaultClassification(domain);
      const messages = getStatusMessage(defaultResult.status, defaultResult.domain, defaultResult.category, defaultResult.alternatives);
      sendResponse({
        ...defaultResult,
        title: messages.title,
        message: messages.message,
        source: "default",
      });
    }
  } catch (error) {
    console.error("Error classifying domain:", error);
    // Error fallback — return default unlisted
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      const defaultResult = getDefaultClassification(domain);
      const messages = getStatusMessage(defaultResult.status, defaultResult.domain, defaultResult.category, defaultResult.alternatives);
      sendResponse({
        ...defaultResult,
        title: messages.title,
        message: messages.message,
        source: "error",
      });
    } catch {
      const messages = getStatusMessage("unlisted", "unknown", null, []);
      sendResponse({
        status: "unlisted",
        domain: "unknown",
        category: null,
        alternatives: [],
        policy: "under_review",
        risk_score: 0,
        title: messages.title,
        message: messages.message,
        source: "error",
      });
    }
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