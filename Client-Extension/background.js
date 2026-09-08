self.importScripts(
  "config.js",
  "core/security.js",
  "core/runtime-settings.js",
  "api/rate-limiter.js",
  "api/classification.js",
  "api/risk-patterns.js",
  "api/logging.js",
  "api/index.js"
);

const RISK_PATTERNS_ALARM = "risk-patterns-sync";
const VISIT_LOG_ALARM = "visit-log-flush";
const EGRESS_LOG_ALARM = "egress-log-flush";
const SETTINGS_ALARM = "settings-sync";

chrome.runtime.onInstalled.addListener(async (details) => {
  // Load runtime settings before any other work so sync intervals are current.
  await ABLERuntimeSettings.initialize();

  // Sync risk patterns when extension is installed or updated
  await refreshRiskPatternsCache();

  // Set up periodic sync every 24 hours
  const riskInterval = ABLERuntimeSettings.get("sync.risk_patterns_interval_minutes", 1440);
  const visitInterval = ABLERuntimeSettings.get("sync.visit_log_flush_interval_minutes", 5);
  const egressInterval = ABLERuntimeSettings.get("sync.egress_log_flush_interval_minutes", 5);
  chrome.alarms.create(RISK_PATTERNS_ALARM, { periodInMinutes: riskInterval });
  chrome.alarms.create(VISIT_LOG_ALARM, { periodInMinutes: visitInterval });
  chrome.alarms.create(EGRESS_LOG_ALARM, { periodInMinutes: egressInterval });
  chrome.alarms.create(SETTINGS_ALARM, { periodInMinutes: 30 });

  // Set up uninstall URL for lifecycle tracking
  try {
    const userId = await getOrCreateUserId();
    const extensionId = chrome.runtime.id;
    chrome.runtime.setUninstallURL(
      `${SERVER_URL}/api/extension/uninstall?user_id=${encodeURIComponent(userId)}&extension_id=${encodeURIComponent(extensionId)}`
    );

    // Log install/update events
    const event = details.reason === 'install' ? 'installed' : 'updated';
    const manifest = chrome.runtime.getManifest();
    logExtensionLifecycle({
      userId: userId,
      extensionId: extensionId,
      event: event,
      version: manifest.version,
    });
  } catch (error) {
    console.warn('ABLE: Failed to set up lifecycle tracking:', error);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === RISK_PATTERNS_ALARM) {
    await refreshRiskPatternsCache();
  } else if (alarm.name === VISIT_LOG_ALARM) {
    await processVisitLogQueue();
  } else if (alarm.name === EGRESS_LOG_ALARM) {
    await processEgressLogQueue();
  } else if (alarm.name === SETTINGS_ALARM) {
    await ABLERuntimeSettings.load();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ABLERuntimeSettings.initialize();
  processVisitLogQueue();
  processEgressLogQueue();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // SECURITY: Reject messages from any sender that isn't this extension.
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === "classifyDomain") {
    handleClassifyDomain(message.url, sendResponse);
    return true;
  }
  if (message.type === "logVisit") {
    logDomainVisit(message.domain, message.status, message.source, message.timestamp)
      .then((visitCount) => sendResponse({ success: true, visit_count: visitCount }))
      .catch(() => sendResponse({ success: false, visit_count: null }));
    return true;
  }
  if (message.type === "getRiskPatterns") {
    console.debug("ABLE: Background received getRiskPatterns request");
    getRiskPatterns()
      .then((patterns) => {
        console.debug(`ABLE: Background returning ${patterns.length} risk patterns`);
        sendResponse({ success: true, patterns });
      })
      .catch((err) => {
        console.warn("ABLE: Background getRiskPatterns failed:", err);
        sendResponse({ success: false, patterns: [] });
      });
    return true;
  }
  if (message.type === "logEgress") {
    logEgressEvent(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
  if (message.type === "verifyIntegrity") {
    ABLESecurity.verifyResourceIntegrity(message.url, message.hash)
      .then((ok) => sendResponse({ success: true, ok }))
      .catch(() => sendResponse({ success: true, ok: false }));
    return true;
  }
  return false;
});

async function handleClassifyDomain(url, sendResponse) {
  try {
    // Try server classification first (includes offline cache fallback)
    const serverResult = await getDomainClassification(url);

    if (serverResult) {
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
