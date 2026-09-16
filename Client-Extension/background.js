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

var RISK_PATTERNS_ALARM = "risk-patterns-sync";
var VISIT_LOG_ALARM = "visit-log-flush";
var EGRESS_LOG_ALARM = "egress-log-flush";
var SETTINGS_ALARM = "settings-sync";

chrome.runtime.onInstalled.addListener(async function (details) {
  await ABLERuntimeSettings.initialize();

  await refreshRiskPatternsCache();

  var riskInterval = ABLERuntimeSettings.get("sync.risk_patterns_interval_minutes", 1440);
  var visitInterval = ABLERuntimeSettings.get("sync.visit_log_flush_interval_minutes", 5);
  var egressInterval = ABLERuntimeSettings.get("sync.egress_log_flush_interval_minutes", 5);
  chrome.alarms.create(RISK_PATTERNS_ALARM, { periodInMinutes: riskInterval });
  chrome.alarms.create(VISIT_LOG_ALARM, { periodInMinutes: visitInterval });
  chrome.alarms.create(EGRESS_LOG_ALARM, { periodInMinutes: egressInterval });
  chrome.alarms.create(SETTINGS_ALARM, { periodInMinutes: 30 });

  try {
    var userId = await getOrCreateUserId();
    var extensionId = chrome.runtime.id;
    chrome.runtime.setUninstallURL(
      `${SERVER_URL}/api/extension/uninstall?user_id=${encodeURIComponent(userId)}&extension_id=${encodeURIComponent(extensionId)}`
    );

    var event = details.reason === 'install' ? 'installed' : 'updated';
    var manifest = chrome.runtime.getManifest();
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

chrome.alarms.onAlarm.addListener(async function (alarm) {
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

chrome.runtime.onStartup.addListener(function () {
  ABLERuntimeSettings.initialize();
  refreshRiskPatternsCache();
  processVisitLogQueue();
  processEgressLogQueue();
});

function isExcludedHostname(hostname) {
  try {
    var domain = hostname.toLowerCase().replace(/^www\./, "");
    var excluded = ABLERuntimeSettings.get("excluded_domains", EXCLUDED_DOMAINS);
    return excluded.some(function (e) { return domain === e || domain.endsWith("." + e); });
  } catch {
    return false;
  }
}

async function auditNavigation(url, transitionType) {
  try {
    var urlObj = new URL(url);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return;
    if (isExcludedHostname(urlObj.hostname)) return;

    var domain = urlObj.hostname.toLowerCase().replace(/^www\./, "");
    var debounceKey = "able:last_visit:" + domain;
    var debounceMs = ABLERuntimeSettings.get("logging.visit_debounce_ms", 5000);
    try {
      var stored = await chrome.storage.session.get(debounceKey);
      if (stored[debounceKey] && Date.now() - stored[debounceKey] < debounceMs) return;
      await chrome.storage.session.set({ [debounceKey]: Date.now() });
    } catch {}

    var classification = await getDomainClassification(url);
    var status = classification ? classification.status : "unlisted";
    var source = "navigation" + (transitionType ? ":" + transitionType : "");
    await logDomainVisit(domain, status, source, Date.now());
  } catch (error) {
    console.warn("ABLE: Navigation audit failed:", error);
  }
}

if (typeof chrome !== "undefined" && chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(function (details) {
    if (details.frameId !== 0) return;
    auditNavigation(details.url, details.transitionType);
  });

  chrome.webNavigation.onHistoryStateUpdated.addListener(function (details) {
    if (details.frameId !== 0) return;
    auditNavigation(details.url, details.transitionType || "spa");
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === "classifyDomain") {
    handleClassifyDomain(message.url, sendResponse, message.signals);
    return true;
  }
  if (message.type === "logVisit") {
    logDomainVisit(message.domain, message.status, message.source, message.timestamp)
      .then(function (result) { sendResponse({ success: true, visit_count: result?.visit_count ?? null, duplicate: result?.duplicate ?? false }); })
      .catch(function () { sendResponse({ success: false, visit_count: null, duplicate: false }); });
    return true;
  }
  if (message.type === "getRiskPatterns") {
    getRiskPatterns()
      .then(function (patterns) { sendResponse({ success: true, patterns: patterns }); })
      .catch(function (err) { sendResponse({ success: false, patterns: [] }); });
    return true;
  }
  if (message.type === "logEgress") {
    logEgressEvent(message.payload)
      .then(function () { sendResponse({ success: true }); })
      .catch(function () { sendResponse({ success: false }); });
    return true;
  }
  if (message.type === "verifyIntegrity") {
    ABLESecurity.verifyResourceIntegrity(message.url, message.hash)
      .then(function (ok) { sendResponse({ success: true, ok: ok }); })
      .catch(function () { sendResponse({ success: true, ok: false }); });
    return true;
  }
  if (message.type === "flushEgressQueue") {
    processEgressLogQueue().then(function () {
      sendResponse({ success: true });
    }).catch(function () {
      sendResponse({ success: false });
    });
    return true;
  }
  return false;
});

async function handleClassifyDomain(url, sendResponse, signals) {
  try {
    var serverResult = await getDomainClassification(url, signals);

    if (serverResult) {
      var messages = getStatusMessage(serverResult.status, serverResult.domain, serverResult.category, []);
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
      var urlObj = new URL(url);
      var domain = urlObj.hostname.replace(/^www\./, "");
      var defaultResult = getDefaultClassification(domain);
      var messages = getStatusMessage(defaultResult.status, defaultResult.domain, defaultResult.category, defaultResult.alternatives);
      sendResponse({
        ...defaultResult,
        title: messages.title,
        message: messages.message,
        source: "default",
      });
    }
  } catch (error) {
    console.error("Error classifying domain:", error);
    try {
      var urlObj2 = new URL(url);
      var domain2 = urlObj2.hostname.replace(/^www\./, "");
      var defaultResult2 = getDefaultClassification(domain2);
      var messages2 = getStatusMessage(defaultResult2.status, defaultResult2.domain, defaultResult2.category, defaultResult2.alternatives);
      sendResponse({
        ...defaultResult2,
        title: messages2.title,
        message: messages2.message,
        source: "error",
      });
    } catch {
      var messages3 = getStatusMessage("unlisted", "unknown", null, []);
      sendResponse({
        status: "unlisted",
        domain: "unknown",
        category: null,
        alternatives: [],
        policy: "under_review",
        risk_score: 70,
        title: messages3.title,
        message: messages3.message,
        source: "error",
      });
    }
  }
}

async function classifyFromOfflineCache(url) {
  try {
    var urlObj = new URL(url);
    var hostname = urlObj.hostname.toLowerCase();
    var domain = hostname.replace(/^www\./, "");

    var _a = await getOfflineCache(), policies = _a.policies;
    if (policies.length === 0) return null;

    var exactMatch = policies.find(function (p) { return p.domain === domain; });
    if (exactMatch) {
      return {
        status: exactMatch.domain_status,
        domain: domain,
        category: exactMatch.category,
        policy: exactMatch.policy,
        risk_score: exactMatch.risk_score,
      };
    }

    var subdomainMatch = policies.find(function (p) { return domain.endsWith("." + p.domain); });
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