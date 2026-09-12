/**
 * ABLE Extension - Content Script Entry
 *
 * Orchestrates domain classification, interception handling, and modal display.
 * This is the main entry point for content script functionality.
 */

// ─── State ────────────────────────────────────────────────────────

var domainStatus = null;
var pageNonceHex = null;
var injectReadyReceived = false;
var classifyReady;

// Recent scans deduplication
var recentScans = [];
var DEDUPLICATION_WINDOW_MS = 5000;

function isDuplicateScan(contentHash, fileName) {
  if (!contentHash) return false;
  var now = Date.now();
  recentScans = recentScans.filter(function (entry) {
    return now - entry.timestamp < DEDUPLICATION_WINDOW_MS;
  });
  for (var i = 0; i < recentScans.length; i++) {
    if (recentScans[i].hash === contentHash && recentScans[i].name === fileName) {
      return true;
    }
  }
  recentScans.push({ hash: contentHash, name: fileName, timestamp: now });
  return false;
}

// ─── Domain helpers ────────────────────────────────────────────────

function getWebsiteName() {
  const hostname = window.location.hostname.replace(/^www\./, "");
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + "." + parts.slice(1).join(".");
  }
  return hostname;
}

function buildDefaultDomainStatus() {
  const hostname = window.location.hostname;
  const statusLabel = "unlisted";
  return {
    status: statusLabel,
    domain: hostname,
    title: `The site you are entering is ${statusLabel.toUpperCase()}`,
    message: `<span class="able-highlight-text">${hostname}</span> is an <span class="able-highlight-text">${statusLabel}</span> service that has not been reviewed by our security team. Please refrain from sending sensitive institutional data from this website until it is properly reviewed.`
  };
}

async function classifyCurrentDomain() {
  const CLASSIFY_TIMEOUT_MS = 8000;

  try {
    if (!chrome.runtime?.id) {
      console.warn("ABLE: Extension context invalidated, using default classification.");
      domainStatus = buildDefaultDomainStatus();
      return domainStatus;
    }

    const signals = (typeof ABLEPageSignals !== "undefined")
      ? ABLEPageSignals.collectPageSignals()
      : { url: window.location.href, title: (document.title || "").slice(0, 200), meta: {}, headings: [], excerpt: "" };

    const result = await Promise.race([
      chrome.runtime.sendMessage({
        type: "classifyDomain",
        url: window.location.href,
        signals: signals,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("classifyDomain timeout")), CLASSIFY_TIMEOUT_MS)
      ),
    ]);

    domainStatus = result;
    return result;
  } catch {
    domainStatus = buildDefaultDomainStatus();
    return domainStatus;
  }
}

function isExcludedDomain() {
  if (!domainStatus?.domain) return false;
  const domain = domainStatus.domain.toLowerCase();
  const excluded = ABLERuntimeSettings.get("excluded_domains", EXCLUDED_DOMAINS);
  return excluded.some(
    (excludedDomain) => domain === excludedDomain || domain.endsWith("." + excludedDomain)
  );
}

function shouldActivate() {
  if (isExcludedDomain()) return false;
  return domainStatus && (domainStatus.status === "unsafe" || domainStatus.status === "unlisted");
}

// ─── Consent management ────────────────────────────────────────────

async function hasSessionConsent() {
  if (ABLERuntimeSettings.get("behavior.session_consent_enabled", true) === false) {
    return false;
  }
  try {
    const key = domainStatus.domain;
    const data = await chrome.storage.session.get(key);
    return !!data[key];
  } catch {
    return false;
  }
}

async function setSessionConsent() {
  try {
    const key = domainStatus.domain;
    await chrome.storage.session.set({ [key]: true });
  } catch {}
}

async function hasSiteWarningConsent() {
  try {
    const key = "able:warning:" + domainStatus.domain;
    const data = await chrome.storage.local.get(key);
    return !!data[key];
  } catch {
    return false;
  }
}

async function setSiteWarningConsent() {
  try {
    const key = "able:warning:" + domainStatus.domain;
    await chrome.storage.local.set({ [key]: true });
  } catch {}
}

// ─── Modal cooldown tracking ────────────────────────────────────────

const COOLDOWN_SHORT_MS = 10000;
const COOLDOWN_STAGGER_MS = 300000;

function getShortCooldown() {
  return ABLERuntimeSettings.get("behavior.modal_short_cooldown_ms", COOLDOWN_SHORT_MS);
}

function getStaggerCooldown() {
  return ABLERuntimeSettings.get("behavior.modal_stagger_cooldown_ms", COOLDOWN_STAGGER_MS);
}

async function getLastModalShownTime() {
  try {
    const key = "able:last_modal:" + domainStatus.domain;
    const data = await chrome.storage.local.get(key);
    return data[key] || 0;
  } catch {
    return 0;
  }
}

async function setLastModalShownTime() {
  try {
    const key = "able:last_modal:" + domainStatus.domain;
    await chrome.storage.local.set({ [key]: Date.now() });
  } catch {}
}

async function getInteractionCount() {
  try {
    const key = "able:modal_interactions:" + domainStatus.domain;
    const data = await chrome.storage.local.get(key);
    return data[key] || 0;
  } catch {
    return 0;
  }
}

async function incrementInteractionCount() {
  try {
    const key = "able:modal_interactions:" + domainStatus.domain;
    const current = await getInteractionCount();
    await chrome.storage.local.set({ [key]: current + 1 });
  } catch {}
}

async function shouldShowRepeatVisitModal() {
  const lastShown = await getLastModalShownTime();
  if (!lastShown) return false;

  const interactionCount = await getInteractionCount();
  const nextShowNumber = interactionCount + 1;
  const cooldown = (nextShowNumber % 3 === 0)
    ? getStaggerCooldown()
    : getShortCooldown();
  return Date.now() - lastShown >= cooldown;
}

// ─── Decision communication ─────────────────────────────────────────

function sendDecision(requestId, action) {
  window.postMessage({
    source: "ABLE_CONTENT",
    type: "ABLE_DECISION",
    payload: { requestId, action }
  }, "*");
}

function sendTextDecision(checkId, action) {
  window.postMessage({
    source: "ABLE_CONTENT",
    type: "ABLE_TEXT_DECISION",
    payload: { checkId, action }
  }, "*");
}

// ─── Interception handling ──────────────────────────────────────────

async function handleInterceptedFiles(fileInfos, requestId) {
  if (classifyReady) await classifyReady;

  var files = fileInfos.map(function (info) { return info.file; }).filter(Boolean);
  var sources = fileInfos.map(function (info) { return info.source; });
  var primarySource = sources[0] || 'unknown';

  if (!shouldActivate()) {
    sendDecision(requestId, "proceed");
    for (var i = 0; i < files.length; i++) {
      logEgressEvent({
        domain: domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, ""),
        fileName: files[i].name,
        fileSize: files[i].size,
        riskScore: 0,
        action: "allowed",
        userAction: "allowed",
        source: fileInfos[i].source,
      });
    }
    return;
  }

  var highestRisk = null;

  for (var i = 0; i < files.length; i++) {
    var result = await scanFile(files[i]);
    if (result && (!highestRisk || result.score > highestRisk.score)) {
      highestRisk = result;
    }
  }

  if (highestRisk && highestRisk.contentHash && isDuplicateScan(highestRisk.contentHash, highestRisk.fileName)) {
    console.debug("ABLE: Duplicate scan detected, skipping");
    sendDecision(requestId, "proceed");
    return;
  }

  var consent = await hasSessionConsent();
  var riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 80);
  var patternScore = highestRisk ? (highestRisk.score - (domainStatus?.risk_score || 0)) : 0;
  var shouldShowModal = highestRisk && !consent && (
    highestRisk.score > riskThreshold ||
    (patternScore >= 40 && highestRisk.flaggedItems.length > 0)
  );

  if (shouldShowModal) {
    showInterceptModal({
      score: highestRisk.score,
      flaggedItems: highestRisk.flaggedItems,
      domain: domainStatus.domain,
      status: domainStatus.status,
      websiteName: getWebsiteName(),
      fileName: highestRisk.fileName,
      fileSize: highestRisk.fileSize,
      fileType: highestRisk.fileType,
      requestId: requestId,
    });
  } else {
    sendDecision(requestId, "proceed");
    if (highestRisk) {
      logEgressEvent({
        domain: domainStatus.domain,
        fileName: highestRisk.fileName,
        fileSize: highestRisk.fileSize,
        riskScore: highestRisk.score,
        action: "proceeded",
        userAction: "proceeded",
        source: primarySource,
        contentHash: highestRisk.contentHash,
        scanDurationMs: highestRisk.scanDurationMs,
        contentSize: highestRisk.fileSize,
        flaggedItems: highestRisk.flaggedItems,
      });
    } else if (fileInfos.length > 0) {
      var firstInfo = fileInfos[0];
      logEgressEvent({
        domain: domainStatus.domain,
        fileName: firstInfo.file?.name || firstInfo.source || 'unknown',
        fileSize: firstInfo.contentSize || firstInfo.file?.size || 0,
        riskScore: 0,
        action: "proceeded",
        userAction: "proceeded",
        source: primarySource,
        contentSize: firstInfo.contentSize || firstInfo.file?.size || 0,
      });
    }
  }
}

// ─── Text check handling ────────────────────────────────────────────

async function handleTextCheck(checkId, text, inputType, url) {
  try {
    const MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    const result = await calculateRiskScore(text);
    const domainRiskScore = domainStatus?.risk_score || 0;
    const totalScore = Math.min(100, domainRiskScore + result.score);
    const riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 90);

    console.debug("ABLE Text Scan:", {
      inputType,
      textLength: text.length,
      pattern_score: result.score,
      domain_risk_score: domainRiskScore,
      total_score: totalScore,
      flaggedItems: result.flaggedItems,
    });

    const domain = domainStatus?.domain || new URL(url).hostname.replace(/^www\./, "");
    logEgressEvent({
      domain,
      fileName: "[text-input]",
      fileSize: text.length,
      riskScore: totalScore,
      action: totalScore >= riskThreshold ? "blocked" : "proceeded",
      userAction: "typing",
      source: "text-intercept",
      flaggedItems: result.flaggedItems,
    });

    if (totalScore >= riskThreshold && result.flaggedItems.length > 0) {
      showTextWarningModal({
        domain,
        totalScore,
        flaggedItems: result.flaggedItems,
        inputType,
      });
      sendTextDecision(checkId, "block");
    } else {
      sendTextDecision(checkId, "allow");
    }
  } catch (error) {
    console.warn("ABLE: Text check failed:", error);
    sendTextDecision(checkId, "allow");
  }
}

// ─── Interception listener ──────────────────────────────────────────

function setupInterceptionListener() {
  const pageNonce = crypto.getRandomValues(new Uint8Array(16));
  pageNonceHex = Array.from(pageNonce).map((b) => b.toString(16).padStart(2, "0")).join("");

  window.addEventListener("message", async (event) => {
    if (event.data?.source !== "ABLE_INJECT") return;

    if (event.data.type === "ABLE_READY") {
      injectReadyReceived = true;
      window.postMessage({
        source: "ABLE_CONTENT",
        type: "ABLE_NONCE",
        nonce: pageNonceHex,
      }, window.location.origin);
      return;
    }

    if (event.data.type === "ABLE_INTERCEPT") {
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_INTERCEPT with invalid nonce.");
        return;
      }
      const { requestId, fileInfos } = event.data.payload;
      if (!requestId || !fileInfos || fileInfos.length === 0) return;
      await handleInterceptedFiles(fileInfos, requestId);
    }

    if (event.data.type === "ABLE_TEXT_CHECK") {
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_TEXT_CHECK with invalid nonce.");
        return;
      }
      const { checkId, text, inputType, url } = event.data.payload || {};
      if (!checkId || !text) return;
      handleTextCheck(checkId, text, inputType, url);
    }

    if (event.data.type === "ABLE_TEXT_BLOCKED") {
      console.debug("ABLE: Text send blocked by pattern detection.");
      return;
    }

    if (event.data.type === "ABLE_TIMEOUT") {
      const { fileInfos } = event.data.payload || {};
      if (fileInfos && fileInfos.length > 0) {
        const domain = domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, "");
        const firstInfo = fileInfos[0];
        logEgressEvent({
          domain,
          fileName: firstInfo.file?.name || firstInfo.source || 'unknown',
          fileSize: firstInfo.contentSize || firstInfo.file?.size || 0,
          riskScore: 0,
          action: "proceeded",
          userAction: "proceeded",
          source: firstInfo.source,
        });
      }
      return;
    }

    if (event.data.type === "ABLE_NONCE_FAILED") {
      const { fileInfos } = event.data.payload || {};
      if (fileInfos && fileInfos.length > 0) {
        const domain = new URL(window.location.href).hostname.replace(/^www\./, "");
        const firstInfo = fileInfos[0];
        logEgressEvent({
          domain,
          fileName: firstInfo.file?.name || firstInfo.source || 'unknown',
          fileSize: firstInfo.contentSize || firstInfo.file?.size || 0,
          riskScore: 0,
          action: "proceeded",
          userAction: "proceeded",
          source: firstInfo.source,
        });
      }
      return;
    }

    if (event.data.type === "ABLE_FILE_SELECTED") {
      console.debug("ABLE: File selection detected:", event.data.payload);
      return;
    }

    if (event.data.type === "ABLE_ATTACH_BUTTON_CLICKED") {
      console.debug("ABLE: Attach button clicked:", event.data.payload);
      return;
    }

    if (event.data.type === "ABLE_SPA_NAVIGATION") {
      handleSPANavigation();
    }
  });
}

// ─── Modal management ──────────────────────────────────────────────

function removeModal() {
  const existing = document.querySelector(".able-modal-backdrop");
  if (existing) existing.remove();
}

// ─── Visit logging ──────────────────────────────────────────────────

async function logDomainVisit() {
  if (!domainStatus || !domainStatus.domain) return null;

  if (isExcludedDomain()) return null;

  const DEBOUNCE_KEY = `able:last_visit:${domainStatus.domain}`;
  const debounceMs = ABLERuntimeSettings.get("logging.visit_debounce_ms", 5000);
  try {
    const result = await chrome.storage.session.get(DEBOUNCE_KEY);
    const lastVisit = result[DEBOUNCE_KEY];

    if (lastVisit && Date.now() - lastVisit < debounceMs) {
      return null;
    }
  } catch (error) {
    // Continue even if debounce check fails
  }

  try {
    await chrome.storage.session.set({ [DEBOUNCE_KEY]: Date.now() });
  } catch (error) {
    // Continue even if debounce storage fails
  }

  try {
    if (!chrome.runtime?.id) {
      return null;
    }
    const response = await Promise.race([
      chrome.runtime.sendMessage({
        type: "logVisit",
        domain: domainStatus.domain,
        status: domainStatus.status || "unlisted",
        source: domainStatus.source || "unknown",
        timestamp: Date.now(),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("logVisit timeout")), 8000)
      ),
    ]);
    return response?.visit_count ?? null;
  } catch {
    return null;
  }
}

// ─── Evaluation & display ───────────────────────────────────────────

async function evaluateAndShowModal(serverVisitCount) {
  if (!shouldActivate()) return;

  const consent = await hasSiteWarningConsent();

  if (!consent) {
    if (domainStatus.title && domainStatus.message) {
      await setLastModalShownTime();

      showSiteWarningModal({
        title: domainStatus.title,
        message: domainStatus.message,
      });
    }
  } else {
    const shouldShow = await shouldShowRepeatVisitModal();

    if (shouldShow) {
      showRepeatVisitModal({
        domain: domainStatus.domain,
        status: domainStatus.status === "unsafe" ? "Unsafe" : "Unlisted",
        visitCount: serverVisitCount || 1,
      });
    }
  }
}

async function handleSPANavigation() {
  if (document.querySelector(".able-modal-backdrop")) return;

  classifyReady = classifyCurrentDomain();
  await classifyReady;

  try {
    if (typeof ABLEPageSignals !== "undefined" && ABLEPageSignals.contentHash) {
      initialContentHash = ABLEPageSignals.contentHash();
    }
  } catch {}

  const serverVisitCount = await logDomainVisit();
  await evaluateAndShowModal(serverVisitCount);
}

// ─── Font injection ─────────────────────────────────────────────────

function injectFonts() {
  if (document.getElementById("able-fonts")) return;
  const link = document.createElement("link");
  link.id = "able-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Unbounded:wght@700&display=swap";
  document.head.appendChild(link);
}

// ─── Page script injection ──────────────────────────────────────────

async function injectPageScript() {
  if (document.getElementById("able-inject-script")) return;

  if (typeof EXPECTED_INJECT_HASH === "string" && EXPECTED_INJECT_HASH.length > 0) {
    try {
      const url = chrome.runtime.getURL("inject/inject.js");
      const response = await chrome.runtime.sendMessage({
        type: "verifyIntegrity",
        url: url,
        hash: EXPECTED_INJECT_HASH,
      });
      if (!response || !response.ok) {
        console.warn("ABLE: inject.js integrity check failed, aborting injection.");
        setupFallbackDetection();
        return;
      }
    } catch {
      console.warn("ABLE: inject.js integrity check failed, aborting injection.");
      setupFallbackDetection();
      return;
    }
  }

  const script = document.createElement("script");
  script.id = "able-inject-script";
  script.src = chrome.runtime.getURL("inject/inject.js");
  script.onload = () => script.remove();
  script.onerror = () => {
    console.warn("ABLE: inject.js failed to load (possible CSP block). Using fallback detection.");
    setupFallbackDetection();
  };
  (document.head || document.documentElement).appendChild(script);

  setTimeout(() => {
    if (!injectReadyReceived) {
      console.warn("ABLE: inject.js did not announce readiness within 5s. Using fallback detection.");
      setupFallbackDetection();
    }
  }, 5000);
}

// ─── Fallback detection ─────────────────────────────────────────────

function setupFallbackDetection() {
  if (document.getElementById("able-fallback-active")) return;
  var marker = document.createElement("div");
  marker.id = "able-fallback-active";
  marker.style.display = "none";
  document.documentElement.appendChild(marker);

  console.warn("ABLE: Fallback file detection active. Pattern scoring unavailable without inject.js.");

  var reportedInputs = new Set();

  function watchFileInput(el) {
    if (reportedInputs.has(el)) return;
    reportedInputs.add(el);
    el.addEventListener("change", function () {
      if (el.files && el.files.length > 0) {
        var domain = new URL(window.location.href).hostname.replace(/^www\./, "");
        for (var i = 0; i < el.files.length; i++) {
          logEgressEvent({
            domain,
            fileName: el.files[i].name,
            fileSize: el.files[i].size,
            riskScore: 0,
            action: "proceeded",
            userAction: "proceeded",
            source: "fallback",
          });
        }
      }
    }, true);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var addedNodes = mutations[m].addedNodes;
      for (var n = 0; n < addedNodes.length; n++) {
        var node = addedNodes[n];
        if (node.nodeType === 1) {
          if (node instanceof HTMLInputElement && node.type === "file") {
            watchFileInput(node);
          }
          var children = node.querySelectorAll("input[type='file']");
          for (var c = 0; c < children.length; c++) {
            watchFileInput(children[c]);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  var existingInputs = document.querySelectorAll("input[type='file']");
  for (var i = 0; i < existingInputs.length; i++) {
    watchFileInput(existingInputs[i]);
  }
}

// ─── Initialization ─────────────────────────────────────────────────

var initialContentHash = null;

async function initialize() {
  injectFonts();

  classifyReady = classifyCurrentDomain();
  await classifyReady;

  try {
    if (typeof ABLEPageSignals !== "undefined" && ABLEPageSignals.contentHash) {
      initialContentHash = ABLEPageSignals.contentHash();
    }
  } catch {}

  const serverVisitCount = await logDomainVisit();
  await evaluateAndShowModal(serverVisitCount);

  scheduleHydrationRecheck();
}

function scheduleHydrationRecheck() {
  var run = async function () {
    try {
      if (!domainStatus || !domainStatus.domain) return;
      if (document.querySelector(".able-modal-backdrop")) return;
      if (typeof ABLEPageSignals === "undefined" || !ABLEPageSignals.contentHash) return;
      var current = ABLEPageSignals.contentHash();
      if (!current || current === initialContentHash) return;
      initialContentHash = current;
      classifyReady = classifyCurrentDomain();
      await classifyReady;
    } catch {}
  };

  try {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(function () { setTimeout(run, 1500); }, { timeout: 5000 });
    } else {
      setTimeout(run, 2500);
    }
  } catch {
    setTimeout(run, 2500);
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────

injectPageScript();
setupInterceptionListener();
initZoomListener();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    injectPageScript();
    initialize();
  }
});
