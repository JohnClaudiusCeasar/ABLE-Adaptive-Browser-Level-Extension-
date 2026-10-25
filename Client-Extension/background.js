self.importScripts(
  "config.js",
  "core/storage.js",
  "core/security.js",
  "core/runtime-settings.js",
  "core/synthetic-names.js",
  "core/file-identity.js",
  "api/rate-limiter.js",
  "api/classification.js",
  "api/risk-patterns.js",
  "api/scoring.js",
  "api/logging.js",
  "api/index.js"
);

var RISK_PATTERNS_ALARM = "risk-patterns-sync";
var VISIT_LOG_ALARM = "visit-log-flush";
var EGRESS_LOG_ALARM = "egress-log-flush";
var SETTINGS_ALARM = "settings-sync";
var POLICY_ALARM = "policy-sync";

// Extension page that hosts the greeting modal. It is the guaranteed
// delivery surface: it opens no matter what the user was browsing, so an
// install that lands on the Chrome Web Store still shows the greeting.
var GREETING_WELCOME_PAGE = "welcome.html";

/**
 * Web-accessible assets that are pinned by SHA-256, and the path used to
 * fetch them for an on-demand integrity check.
 */
var INTEGRITY_ASSETS = {
  inject: { path: "inject/inject.js", hash: EXPECTED_INJECT_HASH },
  content_css: { path: "content.css", hash: EXPECTED_CONTENT_CSS_HASH },
  synthetic_names: { path: "core/synthetic-names.js", hash: EXPECTED_SYNTHETIC_NAMES_HASH },
  file_identity: { path: "core/file-identity.js", hash: EXPECTED_FILE_IDENTITY_HASH },
  file_extractor: { path: "inject/file-extractor.js", hash: EXPECTED_FILE_EXTRACTOR_HASH },
  network_interceptor: { path: "inject/network-interceptor.js", hash: EXPECTED_NETWORK_INTERCEPTOR_HASH },
  file_tracker: { path: "inject/file-tracker.js", hash: EXPECTED_FILE_TRACKER_HASH },
};

/**
 * Assets that are executed in the page world. Injection is refused unless
 * every one of them matches a trusted hash. content.css is not in this set:
 * the manifest injects it directly, so a mismatch there is reported but
 * cannot stop it.
 */
var PAGE_WORLD_ASSETS = {
  inject: true,
  synthetic_names: true,
  file_identity: true,
  file_extractor: true,
  network_interceptor: true,
  file_tracker: true,
};

function isGreetingInjectableUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/^https?:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/i.test(url)) return false;
  return true;
}

/**
 * The tab the user is currently looking at: the active tab of the last
 * focused window. Returns null when there is no such tab.
 */
async function getForegroundTab() {
  try {
    var tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return (tabs && tabs[0]) || null;
  } catch (error) {
    return null;
  }
}

/**
 * True while the greeting still has to be delivered to the user.
 *
 * The greeting is presented once and acknowledged separately, so a user who
 * already saw it is never shown it again.
 */
async function isGreetingOutstanding() {
  try {
    var completedKey = (typeof ABLEStorage !== 'undefined' && ABLEStorage.GREETING_COMPLETED)
      ? ABLEStorage.GREETING_COMPLETED
      : 'able:greeting_completed';
    var presentedKey = (typeof ABLEStorage !== 'undefined' && ABLEStorage.GREETING_PRESENTED)
      ? ABLEStorage.GREETING_PRESENTED
      : 'able:greeting_presented';
    var stored = await chrome.storage.local.get([completedKey, presentedKey]);
    if (stored[completedKey] === true) return false;
    if (stored[presentedKey] === true) return false;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Injects the greeting modal into a tab.
 *
 * Returns true only when the greeting actually rendered. A swallowed
 * presentation (a modal already on screen, or the script unavailable) must
 * never be reported as success — otherwise the caller would treat a greeting
 * the user never saw as delivered.
 */
async function injectGreetingIntoTab(tabId, options) {
  options = options || {};
  var markPresented = options.markPresented !== false;
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content/modal-container.js", "content/greeting-modal.js"],
  });
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function (opts) {
      if (document.getElementById("able-modal-root") || document.querySelector(".able-modal-backdrop")) return false;
      if (typeof showGreetingModal !== "function") return false;
      showGreetingModal({ markPresented: !!(opts && opts.markPresented) });
      return true;
    },
    args: [{ markPresented: markPresented }],
  });
  return !!(results && results[0] && results[0].result === true);
}

/**
 * Presents the greeting in the tab the user is actually looking at.
 *
 * Foreground-only by construction: it targets the active tab of the last
 * focused window. Injecting into a background tab would render the modal
 * where nobody can see it and consume the one-shot presentation, so the
 * greeting would silently never appear.
 */
async function presentGreetingInActiveTab() {
  try {
    if (!(await isGreetingOutstanding())) return false;
    var tab = await getForegroundTab();
    if (!tab || typeof tab.id !== "number" || !isGreetingInjectableUrl(tab.url)) return false;
    return await injectGreetingIntoTab(tab.id, { markPresented: true });
  } catch (error) {
    console.warn("ABLE: Greeting presentation failed:", error);
    return false;
  }
}

/**
 * Opens the dedicated extension page that hosts the greeting modal.
 *
 * This is the guaranteed delivery surface for the first-run greeting.
 */
async function openWelcomeTab() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(GREETING_WELCOME_PAGE) });
    return true;
  } catch (error) {
    console.warn("ABLE: Failed to open the welcome tab:", error);
    return false;
  }
}

// Expose chrome.storage.session to content scripts (untrusted contexts) so
// their session/debounce/consent checks actually work. Defaults to TRUSTED_CONTEXTS.
try {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
} catch (error) {
  console.warn("ABLE: Failed to set storage.session access level:", error);
}

chrome.runtime.onInstalled.addListener(async function (details) {
  // The greeting is delivered first and independently of the setup below: a
  // slow or failing policy/pattern sync — or a lifecycle-logging failure —
  // must never delay or suppress the first-run introduction.
  if (details.reason === 'install') {
    try {
      var greetingKey = (typeof ABLEStorage !== 'undefined' && ABLEStorage.GREETING_COMPLETED)
        ? ABLEStorage.GREETING_COMPLETED
        : 'able:greeting_completed';
      var presentedKey = (typeof ABLEStorage !== 'undefined' && ABLEStorage.GREETING_PRESENTED)
        ? ABLEStorage.GREETING_PRESENTED
        : 'able:greeting_presented';
      await chrome.storage.local.set({ [greetingKey]: false, [presentedKey]: false });
      // The greeting is presented on the dedicated extension tab so it is
      // visible no matter what the user had open. The Chrome Web Store
      // rejects in-page injection, which left the greeting undelivered.
      await openWelcomeTab();
    } catch (welcomeError) {
      console.warn('ABLE: Failed to launch greeting overlay:', welcomeError);
    }
  }

  await ABLERuntimeSettings.initialize();

  await refreshRiskPatternsCache();

  var riskInterval = ABLERuntimeSettings.get("sync.risk_patterns_interval_minutes", 1440);
  var visitInterval = ABLERuntimeSettings.get("sync.visit_log_flush_interval_minutes", 5);
  var egressInterval = ABLERuntimeSettings.get("sync.egress_log_flush_interval_minutes", 5);
  chrome.alarms.create(RISK_PATTERNS_ALARM, { periodInMinutes: riskInterval });
  chrome.alarms.create(VISIT_LOG_ALARM, { periodInMinutes: visitInterval });
  chrome.alarms.create(EGRESS_LOG_ALARM, { periodInMinutes: egressInterval });
  chrome.alarms.create(SETTINGS_ALARM, { periodInMinutes: 30 });
  chrome.alarms.create(POLICY_ALARM, { periodInMinutes: 15 });

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
  } else if (alarm.name === POLICY_ALARM) {
    await refreshOfflineCache();
  }
});

chrome.runtime.onStartup.addListener(function () {
  ABLERuntimeSettings.initialize();
  refreshRiskPatternsCache();
  refreshOfflineCache();
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

    var skipSearch = ABLERuntimeSettings.get("logging.skip_search_results", typeof ABLE_SKIP_SEARCH_RESULTS !== "undefined" ? ABLE_SKIP_SEARCH_RESULTS : true);
    if (skipSearch && typeof isSearchResultUrl === "function" && isSearchResultUrl(url)) {
      return;
    }

    var domain = urlObj.hostname.toLowerCase().replace(/^www\./, "");
    var sessionKey = "able:session_visit:" + domain;
    try {
      var sessionStored = await chrome.storage.session.get(sessionKey);
      if (sessionStored[sessionKey]) return;
      await chrome.storage.session.set({ [sessionKey]: Date.now() });
    } catch {}

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

  // Internal SPA history state changes are intra-domain navigations — skip to avoid bloated visit audits
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
    var skipSearch = ABLERuntimeSettings.get("logging.skip_search_results", typeof ABLE_SKIP_SEARCH_RESULTS !== "undefined" ? ABLE_SKIP_SEARCH_RESULTS : true);
    if (skipSearch && typeof isSearchResultUrl === "function" && message.url && isSearchResultUrl(message.url)) {
      sendResponse({ success: true, visit_count: null, duplicate: true, skipped: true });
      return false;
    }
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
  if (message.type === "scoreContent") {
    requestContentScoreDirect(message.payload)
      .then(function (verdict) {
        sendResponse({
          success: !!verdict,
          verdict: verdict,
          // Why there is no verdict, so the content script can tell an
          // unreachable server apart from a rejected request.
          failure: verdict ? null : getLastScoreFailure(),
        });
      })
      .catch(function () {
        sendResponse({ success: false, verdict: null, failure: "error" });
      });
    return true;
  }
  if (message.type === "logEgress") {
    logEgressEvent(message.payload)
      .then(function () { sendResponse({ success: true }); })
      .catch(function () { sendResponse({ success: false }); });
    return true;
  }
  if (message.type === "checkIntegrity") {
    // Re-run the integrity check on demand. Nothing is persisted: the popup
    // asks for the current state, so the answer is always accurate and no
    // storage is spent remembering a failure.
    (async function () {
      try {
        // Restore the last verified (signed) settings so a published pin is
        // taken into account without a network round trip.
        await ABLERuntimeSettings.restorePersisted();

        var results = await ABLESecurity.checkAssetIntegrity(
          INTEGRITY_ASSETS,
          PAGE_WORLD_ASSETS
        );

        sendResponse({
          success: true,
          results: results.results,
          ok: results.ok,
        });
      } catch (error) {
        sendResponse({ success: false, results: [], ok: false });
      }
    })();
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
  if (message.type === "submitAccessRequest") {
    (async function () {
      try {
        var response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/access-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            author: message.author || null,
            domain: message.domain || null,
            message: message.message || "",
          }),
        });

        var payload = null;
        try {
          payload = await response.json();
        } catch {}

        sendResponse({
          success: response.ok,
          status: response.status,
          data: payload,
        });
      } catch (error) {
        console.warn("ABLE: Failed to submit access request:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  if (message.type === "closeCurrentTab") {
    (async function () {
      try {
        var tabId = sender && sender.tab && sender.tab.id;
        if (typeof tabId !== "number") {
          sendResponse({ success: false, reason: "no-tab" });
          return;
        }
        await chrome.tabs.remove(tabId);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, reason: error.message });
      }
    })();
    return true;
  }
  if (message.type === "openWelcomePage") {
    (async function () {
      try {
        var tab = await getForegroundTab();
        if (tab && isGreetingInjectableUrl(tab.url)) {
          // A manual disclaimer view must not latch the one-shot
          // presentation, otherwise it would suppress the first-run greeting.
          await injectGreetingIntoTab(tab.id, { markPresented: false });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, reason: "no-injectable-tab" });
        }
      } catch (error) {
        sendResponse({ success: false });
      }
    })();
    return true;
  }
  return false;
});

chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (changeInfo.status !== "complete") return;
  // Only a load in the foreground may present the greeting. A background tab
  // finishing a load must never consume the one-shot presentation.
  if (!tab || tab.active !== true) return;
  await presentGreetingInActiveTab();
});

// The user may land on a tab that was already open before the install, so no
// content script ever ran there. Presenting on tab activation covers that
// case without waiting for a navigation.
chrome.tabs.onActivated.addListener(function () {
  presentGreetingInActiveTab();
});

// Likewise when the browser window regains focus.
chrome.windows.onFocusChanged.addListener(function (windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  presentGreetingInActiveTab();
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
        block_access: !!serverResult.block_access,
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
        risk_score: 60,
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
        block_access: !!exactMatch.block_access,
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
        block_access: !!subdomainMatch.block_access,
        risk_score: subdomainMatch.risk_score,
      };
    }

    return null;
  } catch (error) {
    console.error("Error in classifyFromOfflineCache:", error);
    return null;
  }
}