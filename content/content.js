/**
 * ABLE Extension - Content Script Entry
 *
 * Orchestrates domain classification, interception handling, and modal display.
 * This is the main entry point for content script functionality.
 */

// ─── State ────────────────────────────────────────────────

var domainStatus = null;
var pageNonceHex = null;
var injectReadyReceived = false;
var classifyReady;

// Recent scans deduplication
var recentScans = [];
var DEDUPLICATION_WINDOW_MS = 5000;
var guardTamperReported = false;

// A content script can outlive the extension. Chrome does not tear down scripts
// already injected into open tabs on update or uninstall; it only invalidates
// `chrome.*`. Without this guard the orphaned script reads the dead context as
// an unclassified, never-consented page and keeps rendering warning/hold
// modals. Detect the orphan once and go inert for the rest of the page's life.
var extensionOrphaned = false;
var interceptionMessageHandler = null;
var pageshowHandler = null;

function isExtensionContextValid() {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

function teardownOrphanedContentScript() {
  if (extensionOrphaned) return;
  extensionOrphaned = true;
  console.warn("ABLE: Extension context invalidated; disabling ABLE in this tab.");
  domainStatus = null;
  try {
    removeModal();
  } catch {}
  try {
    if (interceptionMessageHandler) {
      window.removeEventListener("message", interceptionMessageHandler);
      interceptionMessageHandler = null;
    }
    if (pageshowHandler) {
      window.removeEventListener("pageshow", pageshowHandler);
      pageshowHandler = null;
    }
  } catch {}
}

/**
 * A page-world hook was replaced by page script. We cannot stop the request
 * from here, but the tamper attempt must not be silent: escalate it once per
 * page load as an integrity signal. This is not a file egress, so it is sent
 * to the integrity endpoint rather than the egress ledger.
 */
function handleGuardTamper(reason) {
  if (guardTamperReported) return;
  guardTamperReported = true;
  console.warn("ABLE: page-world guard tampering detected:", reason);
  try {
    logIntegrityEvent({
      domain: domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, ""),
      reason: reason || "unknown",
    });
  } catch (e) {
    // Reporting is best-effort; never let a tamper report break the page.
  }
}

var reportedInterceptionFailures = new Set();

/**
 * Report a degraded-interception condition: a request the extension could not
 * score or hold. That is a guard-health signal, not a verified file egress, so
 * it goes to the integrity endpoint and never into the incident ledger.
 */
function reportInterceptionFailure(reason) {
  var key = reason || "unknown";
  if (reportedInterceptionFailures.has(key)) return;
  reportedInterceptionFailures.add(key);
  try {
    logIntegrityEvent({
      domain: domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, ""),
      reason: key,
    });
  } catch (e) {
    // Reporting is best-effort; never let it break the page.
  }
}

function isDuplicateScan(contentHash) {
  if (!contentHash) return false;
  var now = Date.now();
  recentScans = recentScans.filter(function (entry) {
    return now - entry.timestamp < DEDUPLICATION_WINDOW_MS;
  });
  for (var i = 0; i < recentScans.length; i++) {
    // Keyed on the content alone: the same file re-wrapped under a different
    // name ("blob" → "report.pdf") is still the same upload.
    if (recentScans[i].hash === contentHash) {
      return true;
    }
  }
  recentScans.push({ hash: contentHash, timestamp: now });
  return false;
}

// ─── Domain helpers ────────────────────────────────────────

function getWebsiteName() {
  var hostname = window.location.hostname.replace(/^www\./, "");
  var parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + "." + parts.slice(1).join(".");
  }
  return hostname;
}

function buildDefaultDomainStatus() {
  var hostname = window.location.hostname;
  var statusLabel = "unlisted";
  return {
    status: statusLabel,
    domain: hostname,
    category: null,
    recommendations: [],
    risk_score: 60,
    title: "The site you are entering is " + statusLabel.toUpperCase(),
    message: "<span class=\"able-highlight-text\">" + hostname + "</span> is an <span class=\"able-highlight-text\">" + statusLabel + "</span> service that has not been reviewed by our security team. Please refrain from sending sensitive institutional data from this website until it is properly reviewed."
  };
}

// Server-computed domain risk baseline. Falls back to the unlisted default
// (60, matching config.js getDefaultClassification) when classification
// hasn't resolved — never a silent 0.
function currentDomainBaseline() {
  var score = domainStatus ? domainStatus.risk_score : undefined;
  return typeof score === "number" ? score : 60;
}

async function classifyCurrentDomain() {
  var CLASSIFY_TIMEOUT_MS = 8000;

  try {
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return null;
    }

    var signals = (typeof ABLEPageSignals !== "undefined")
      ? ABLEPageSignals.collectPageSignals()
      : { url: window.location.href, title: (document.title || "").slice(0, 200), meta: {}, headings: [], excerpt: "", imageAltText: [], domDepth: 0 };

    var result = await Promise.race([
      chrome.runtime.sendMessage({
        type: "classifyDomain",
        url: window.location.href,
        signals: signals,
      }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("classifyDomain timeout")); }, CLASSIFY_TIMEOUT_MS);
      }),
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
  var domain = domainStatus.domain.toLowerCase();
  var excluded = ABLERuntimeSettings.get("excluded_domains", EXCLUDED_DOMAINS);
  return excluded.some(function (excludedDomain) { return domain === excludedDomain || domain.endsWith("." + excludedDomain); });
}

// Content scoring applies to every classified domain, including safe ones.
// Safe domains are scored silently; only the nudge gates below exclude them.
function shouldScanContent() {
  if (isExcludedDomain()) return false;
  var skipAuth = ABLERuntimeSettings.get("logging.skip_account_login", typeof ABLE_SKIP_ACCOUNT_LOGIN !== "undefined" ? ABLE_SKIP_ACCOUNT_LOGIN : true);
  if (skipAuth && typeof isAuthOrAccountUrl === "function" && isAuthOrAccountUrl(window.location.href)) {
    return false;
  }
  return !!domainStatus;
}

// First-visit advisory and repeat-visit nudges only apply to unsafe/unlisted.
function shouldActivate() {
  if (!shouldScanContent()) return false;
  return domainStatus.status === "unsafe" || domainStatus.status === "unlisted";
}

// ─── Consent management ────────────────────────────────────

async function hasSessionConsent() {
  if (ABLERuntimeSettings.get("behavior.session_consent_enabled", true) === false) {
    return false;
  }
  try {
    var key = domainStatus.domain;
    var data = await chrome.storage.session.get(key);
    return !!data[key];
  } catch {
    return false;
  }
}

async function setSessionConsent() {
  try {
    var key = domainStatus.domain;
    await chrome.storage.session.set({ [key]: true });
  } catch {}
}

async function hasSiteWarningConsent() {
  try {
    var key = "able:warning:" + domainStatus.domain;
    var data = await chrome.storage.local.get(key);
    return !!data[key];
  } catch {
    return false;
  }
}

async function setSiteWarningConsent() {
  try {
    var key = "able:warning:" + domainStatus.domain;
    await chrome.storage.local.set({ [key]: true });
  } catch {}
}

// ─── Modal cooldown tracking ────────────────────────────────────────

var COOLDOWN_SHORT_MS = 35000;
var COOLDOWN_STAGGER_MS = 300000;
var UNSAFE_COOLDOWN_SHORT_MS = 15000;
var UNSAFE_COOLDOWN_STAGGER_MS = 120000;

function isUnsafeStatus() {
  return !!(domainStatus && domainStatus.status === "unsafe");
}

function getShortCooldown() {
  return isUnsafeStatus()
    ? ABLERuntimeSettings.get("behavior.unsafe_modal_short_cooldown_ms", UNSAFE_COOLDOWN_SHORT_MS)
    : ABLERuntimeSettings.get("behavior.modal_short_cooldown_ms", COOLDOWN_SHORT_MS);
}

function getStaggerCooldown() {
  return isUnsafeStatus()
    ? ABLERuntimeSettings.get("behavior.unsafe_modal_stagger_cooldown_ms", UNSAFE_COOLDOWN_STAGGER_MS)
    : ABLERuntimeSettings.get("behavior.modal_stagger_cooldown_ms", COOLDOWN_STAGGER_MS);
}

async function getLastModalShownTime() {
  try {
    var key = "able:last_modal:" + domainStatus.domain;
    var data = await chrome.storage.local.get(key);
    return data[key] || 0;
  } catch {
    return 0;
  }
}

async function setLastModalShownTime() {
  try {
    var key = "able:last_modal:" + domainStatus.domain;
    await chrome.storage.local.set({ [key]: Date.now() });
  } catch {}
}

async function getInteractionCount() {
  try {
    var key = "able:modal_interactions:" + domainStatus.domain;
    var data = await chrome.storage.local.get(key);
    return data[key] || 0;
  } catch {
    return 0;
  }
}

async function incrementInteractionCount() {
  try {
    var key = "able:modal_interactions:" + domainStatus.domain;
    var current = await getInteractionCount();
    await chrome.storage.local.set({ [key]: current + 1 });
  } catch {}
}

async function shouldShowRepeatVisitModal() {
  var lastShown = await getLastModalShownTime();
  if (!lastShown) return false;

  var interactionCount = await getInteractionCount();
  var nextShowNumber = interactionCount + 1;
  var cooldown = (nextShowNumber % 3 === 0)
    ? getStaggerCooldown()
    : getShortCooldown();
  return Date.now() - lastShown >= cooldown;
}

// ─── Decision communication ─────────────────────────────────

function sendDecision(requestId, action, details) {
  window.postMessage({
    source: "ABLE_CONTENT",
    type: "ABLE_DECISION",
    nonce: pageNonceHex,
    payload: { requestId: requestId, action: action, details: details || null }
  }, "*");
}

function sendTextDecision(checkId, action) {
  window.postMessage({
    source: "ABLE_CONTENT",
    type: "ABLE_TEXT_DECISION",
    nonce: pageNonceHex,
    payload: { checkId: checkId, action: action }
  }, "*");
}

// ─── Interception handling ──────────────────────────────────

async function handleInterceptedFiles(fileInfos, requestId) {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    // The page is still holding the upload on the other side; nothing can
    // score it now, so release it rather than leave it stuck behind a hold.
    sendDecision(requestId, "proceed");
    return;
  }

  if (classifyReady) await classifyReady;

  if (typeof ABLEProvenance === "undefined") {
    // The isolated-world authority is mandatory. Without it we cannot tell a
    // user upload from a page-generated payload, so never trust the page's
    // nameSource claim.
    handleGuardTamper("provenance module missing");
    sendDecision(requestId, "proceed");
    return;
  }

  var rawEntries = [];
  for (var i = 0; i < fileInfos.length; i++) {
    var info = fileInfos[i];
    if (!info || !info.file) continue;
    rawEntries.push({ file: info.file, source: info.source, nameSource: info.nameSource || null });
  }

  // Provenance is re-derived here, in the isolated world. The page-supplied
  // nameSource is ignored: a hostile page can claim "user" for anything, and
  // the page-world tracker globals are writable by that page.
  var entries = await ABLEProvenance.admitAll(rawEntries);

  // Defense in depth: even a resolved entry must carry an auditable name.
  entries = entries.filter(function (entry) {
    return isAuditableFileName(entry.file.name, entry.nameSource);
  });

  var sources = fileInfos.map(function (info) { return info.source; });
  var primarySource = sources[0] || 'unknown';

  if (entries.length === 0) {
    sendDecision(requestId, "proceed");
    return;
  }

  if (!shouldScanContent()) {
    sendDecision(requestId, "proceed");
    for (var j = 0; j < entries.length; j++) {
      logEgressEvent({
        domain: domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, ""),
        fileName: entries[j].file.name,
        fileSize: entries[j].file.size,
        riskScore: currentDomainBaseline(),
        action: "allowed",
        userAction: "allowed",
        source: entries[j].source,
        nameSource: entries[j].nameSource,
      });
    }
    return;
  }

  // A beacon or ReadableStream request is released by the page-world
  // interceptor the moment it is observed (inject/inject.js cannot hold those
  // transports). The bytes are already gone, so a modal cannot stop them and a
  // "denied" row would claim containment that never happened. Scan for the
  // record, but audit what actually happened: the upload proceeded.
  var releasedSource = fileInfos.some(function (info) {
    return info && (info.source === "beacon" || info.source === "readablestream");
  });

  if (releasedSource) {
    sendDecision(requestId, "proceed");

    var releasedScans = await Promise.all(entries.map(function (entry) {
      return scanFile(entry.file, entry.nameSource);
    }));

    var releasedBest = null;
    for (var r = 0; r < releasedScans.length; r++) {
      var releasedResult = releasedScans[r];
      if (releasedResult && releasedResult.ok &&
        (!releasedBest || releasedResult.score > releasedBest.score)) {
        releasedBest = releasedResult;
      }
    }

    if (releasedBest && isAuditableFileName(releasedBest.fileName, releasedBest.nameSource)) {
      await logEgressEvent({
        domain: domainStatus.domain,
        fileName: releasedBest.fileName,
        fileSize: releasedBest.fileSize,
        riskScore: releasedBest.score,
        action: "proceeded",
        userAction: "proceeded",
        source: primarySource,
        nameSource: releasedBest.nameSource,
        contentHash: releasedBest.contentHash,
        scanDurationMs: releasedBest.scanDurationMs,
        contentSize: releasedBest.fileSize,
        flaggedItems: releasedBest.flaggedItems,
        scanToken: releasedBest.scanToken,
      });
    } else {
      var releasedEntry = entries[0];
      if (isAuditableFileName(releasedEntry.file.name, releasedEntry.nameSource)) {
        await logEgressEvent({
          domain: domainStatus.domain,
          fileName: releasedEntry.file.name,
          fileSize: releasedEntry.file.size,
          riskScore: currentDomainBaseline(),
          action: "proceeded",
          userAction: "proceeded",
          source: primarySource,
          nameSource: releasedEntry.nameSource,
        });
      }
    }
    return;
  }

  // Parallel file scanning instead of sequential
  var scanPromises = entries.map(function (entry) { return scanFile(entry.file, entry.nameSource); });
  var scanResults = await Promise.all(scanPromises);

  // Scoring server unreachable/unverifiable: HOLD the upload — never proceed unscored.
  var failures = scanResults.filter(function (r) { return r && r.ok === false; });
  if (failures.length > 0) {
    // Notify page script that a modal is active; clear the upload timeout.
    window.postMessage({
      source: "ABLE_CONTENT",
      type: "ABLE_MODAL_ACTIVE",
      nonce: pageNonceHex,
      payload: { requestId: requestId }
    }, "*");

    var failed = failures[0];
    showScoreHoldModal({
      domain: domainStatus.domain,
      fileName: failed.fileName,
      fileSize: failed.fileSize,
      failure: failed.failure,
      onRetry: function () {
        removeModal();
        handleInterceptedFiles(fileInfos, requestId);
      },
      onCancel: function () {
        sendDecision(requestId, "cancel", { fileName: failed.fileName, fileSize: failed.fileSize });
        logEgressEvent({
          domain: domainStatus.domain,
          fileName: failed.fileName,
          fileSize: failed.fileSize,
          riskScore: currentDomainBaseline(),
          action: "denied",
          userAction: "cancelled",
          source: primarySource,
          nameSource: failed.nameSource,
          scanDurationMs: failed.scanDurationMs,
        });
        removeModal();
      },
    });
    return;
  }

  var scoredResults = scanResults.filter(function (r) { return r && r.ok; });
  var highestRisk = null;
  for (var j = 0; j < scoredResults.length; j++) {
    var result = scoredResults[j];
    if (!highestRisk || result.score > highestRisk.score) {
      highestRisk = result;
    }
  }

  if (highestRisk && highestRisk.contentHash && isDuplicateScan(highestRisk.contentHash)) {
    console.debug("ABLE: Duplicate scan detected, skipping");
    sendDecision(requestId, "proceed");
    return;
  }

  var consent = await hasSessionConsent();
  var riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 85);
  var patternScore = highestRisk ? highestRisk.patternScore : 0;
  var isExtremeRisk = highestRisk && highestRisk.score >= 85;
  var isAttributed = highestRisk &&
    isAuditableFileName(highestRisk.fileName, highestRisk.nameSource);
  var isFlagged = isAttributed && (
    highestRisk.score > riskThreshold ||
    (patternScore >= 31 && highestRisk.flaggedItems.length > 0)
  );
  var shouldShowModal = isFlagged && (!consent || isExtremeRisk);

  if (shouldShowModal) {
    // Notify page script that user is reviewing modal; clear upload timeout
    window.postMessage({
      source: "ABLE_CONTENT",
      type: "ABLE_MODAL_ACTIVE",
      nonce: pageNonceHex,
      payload: { requestId: requestId }
    }, "*");

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
      contentHash: highestRisk.contentHash,
      scanDurationMs: highestRisk.scanDurationMs,
      scanToken: highestRisk.scanToken,
    });
  } else {
    sendDecision(requestId, "proceed");
    if (highestRisk) {
      // A placeholder name is not the user's egress: the extension fabricated
      // it from the MIME type, and nothing was uploaded behind it. The score
      // cannot decide this — it carries the domain baseline, so it is
      // non-zero for every unlisted or unsafe domain.
      if (isAuditableFileName(highestRisk.fileName, highestRisk.nameSource)) {
        logEgressEvent({
          domain: domainStatus.domain,
          fileName: highestRisk.fileName,
          fileSize: highestRisk.fileSize,
          riskScore: highestRisk.score,
          action: "proceeded",
          userAction: "proceeded",
          source: primarySource,
          nameSource: highestRisk.nameSource,
          contentHash: highestRisk.contentHash,
          scanDurationMs: highestRisk.scanDurationMs,
          contentSize: highestRisk.fileSize,
          flaggedItems: highestRisk.flaggedItems,
          scanToken: highestRisk.scanToken,
        });
      }
    } else if (entries.length > 0) {
      var firstEntry = entries[0];
      var fallbackName = firstEntry.file.name || firstEntry.source || 'unknown';
      if (isAuditableFileName(fallbackName, firstEntry.nameSource)) {
        logEgressEvent({
          domain: domainStatus.domain,
          fileName: fallbackName,
          fileSize: firstEntry.file.size || 0,
          riskScore: currentDomainBaseline(),
          action: "proceeded",
          userAction: "proceeded",
          source: primarySource,
          nameSource: firstEntry.nameSource,
          contentSize: firstEntry.file.size || 0,
        });
      }
    }
  }
}

// ─── Text check handling ────────────────────────────────────

async function handleTextCheck(checkId, text, inputType, url) {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    // Typed text already fails open when scoring is unavailable; a dead
    // extension must release the held Enter the same way.
    sendTextDecision(checkId, "allow");
    return;
  }

  try {
    var MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    // ── ④ Collect page context for contextual risk scoring ──────────────────
    var pageContext = null;
    try {
      if (typeof ABLEPageSignals !== 'undefined' && ABLEPageSignals.collectPageSignals) {
        pageContext = ABLEPageSignals.collectPageSignals();
      }
    } catch (e) {
      // Non-fatal — scoring proceeds without page context
    }

    var domain = domainStatus?.domain || new URL(url).hostname.replace(/^www\./, "");

    // Server-authoritative scoring (algorithm + regex modifiers live server-side).
    var verdict = await requestContentScore({
      text: text,
      fileName: "[text-input]",
      fileSize: text.length,
      domain: domain,
      pageContext: pageContext,
    });

    if (!verdict) {
      // Scoring server unreachable: uploads are held instead, but typed text
      // fails open. Never fabricate a 0% score in the logs — and since nothing
      // was blocked, no "[text-input]" audit row is written either.
      console.warn("ABLE: Scoring server unreachable — text check allowed at domain baseline.");
      sendTextDecision(checkId, "allow");
      return;
    }

    var totalScore = verdict.score;
    var riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 85);

    console.debug("ABLE Text Scan:", {
      inputType: inputType,
      textLength: text.length,
      pattern_score: verdict.patternScore,
      domain_risk_score: verdict.domainRiskScore,
      total_score: totalScore,
      flaggedItems: verdict.flaggedItems,
    });

    // A pattern in the text is what opens the door: the domain's own score
    // never raises the warning on its own. Once a pattern is detected, the
    // domain and the pattern are scored together, and the text warns only
    // when that combined score meets the high-risk standard.
    var patternFlags = (verdict.flaggedItems || []).filter(function (item) {
      return !item.label.startsWith("Domain Risk");
    });
    var textRiskScore = verdict.patternScore || 0;
    var hasPatternHit = textRiskScore > 0 || patternFlags.length > 0;
    var combinedScore = verdict.score;

    // "[text-input]" stays as the placeholder file name for typed text, but the
    // row is audited only when the text itself carried a risk pattern. The
    // domain's own score is not part of that decision: a risky domain never
    // justifies an audit row on its own, so routine typing never reaches the
    // database.
    var showTextWarning = hasPatternHit && combinedScore >= riskThreshold;
    var hasTextRisk = textRiskScore > 0;

    if (showTextWarning) {
      // The row is written from the decision, not before the modal: the audit
      // must record whether the text was actually sent or actually stopped.
      var auditTextEvent = function (action) {
        logEgressEvent({
          domain: domain,
          fileName: "[text-input]",
          fileSize: text.length,
          // The server replaces this with its own score from the scan token.
          riskScore: totalScore,
          action: action,
          userAction: "typing",
          source: "text-intercept",
          flaggedItems: verdict.flaggedItems,
          scanToken: verdict.scanToken,
        });
      };

      // Keep the page-side check open while the modal is up. Without this
      // the page side auto-allows after its timeout and releases the held
      // send behind the modal.
      window.postMessage({
        source: "ABLE_CONTENT",
        type: "ABLE_MODAL_ACTIVE",
        nonce: pageNonceHex,
        payload: { checkId: checkId }
      }, "*");

      showTextWarningModal({
        domain: domain,
        // The domain and the pattern are scored together, so the score the
        // modal shows is the one the warning was raised on, and the breakdown
        // lists every factor behind it.
        totalScore: combinedScore,
        flaggedItems: verdict.flaggedItems,
        inputType: inputType,
        checkId: checkId,
        onProceed: function () {
          // "Send Anyway" — the sensitive text really left the browser.
          if (hasTextRisk) {
            auditTextEvent("proceeded");
          }
          sendTextDecision(checkId, "allow");
        },
        onCancel: function () {
          // "Cancel Send", Escape, or a modal torn down without a decision.
          if (hasTextRisk) {
            auditTextEvent("blocked");
          }
          sendTextDecision(checkId, "block");
        },
      });
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
  if (extensionOrphaned) return;

  var pageNonce = crypto.getRandomValues(new Uint8Array(16));
  pageNonceHex = Array.from(pageNonce).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");

  interceptionMessageHandler = async function (event) {
    if (event.data?.source !== "ABLE_INJECT") return;
    if (extensionOrphaned) return;
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return;
    }

    if (event.data.type === "ABLE_READY") {
      injectReadyReceived = true;
      window.postMessage({
        source: "ABLE_CONTENT",
        type: "ABLE_NONCE",
        nonce: pageNonceHex,
      }, window.location.origin);
      return;
    }

    if (event.data.type === "ABLE_TAMPER") {
      if (!event.data.nonce || event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_TAMPER with invalid nonce.");
        return;
      }
      handleGuardTamper(event.data.payload && event.data.payload.reason);
      return;
    }

    if (event.data.type === "ABLE_INTERCEPT") {
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_INTERCEPT with invalid nonce.");
        return;
      }
      var _a = event.data.payload, requestId = _a.requestId, fileInfos = _a.fileInfos;
      if (!requestId || !fileInfos || fileInfos.length === 0) return;
      await handleInterceptedFiles(fileInfos, requestId);
    }

    if (event.data.type === "ABLE_TEXT_CHECK") {
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_TEXT_CHECK with invalid nonce.");
        return;
      }
      var _b = event.data.payload, checkId = _b.checkId, text = _b.text, inputType = _b.inputType, url = _b.url;
      if (!checkId || !text) return;
      handleTextCheck(checkId, text, inputType, url);
    }

    if (event.data.type === "ABLE_TEXT_BLOCKED") {
      console.debug("ABLE: Text send blocked by pattern detection.");
      return;
    }

    if (event.data.type === "ABLE_TIMEOUT") {
      // Interception timed out and the request was released unscored. That is a
      // degradation of the guard, not a verified file egress, so it is reported
      // as an integrity signal instead of an incident.
      reportInterceptionFailure("intercept timeout");
      return;
    }

    if (event.data.type === "ABLE_NONCE_FAILED") {
      // The handshake never completed, so this request was never observing the
      // guard. Report the degraded guard, not a file the extension never saw.
      reportInterceptionFailure("nonce handshake failed");
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
  };

  window.addEventListener("message", interceptionMessageHandler);
}

// ─── Modal management ──────────────────────────────────────

function removeModal() {
  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.removeModal) {
    ABLEModalContainer.removeModal();
    return;
  }
  var host = document.getElementById("able-modal-root");
  if (host) host.remove();
  var existing = document.querySelector(".able-modal-backdrop");
  if (existing) existing.remove();
}

// ─── Visit logging ──────────────────────────────────────────────────

async function logDomainVisit() {
  if (!domainStatus || !domainStatus.domain) return null;

  if (isExcludedDomain()) return null;

  if (typeof shouldIgnoreDomainVisit === "function" && shouldIgnoreDomainVisit(window.location.href)) {
    return null;
  }

  var sessionKey = "able:session_visit:" + domainStatus.domain;
  try {
    var sessionResult = await chrome.storage.session.get(sessionKey);
    if (sessionResult[sessionKey]) {
      return { visitCount: null, duplicate: true };
    }
  } catch (error) {
    // Continue even if session check fails
  }

  var DEBOUNCE_KEY = "able:last_visit:" + domainStatus.domain;
  var debounceMs = ABLERuntimeSettings.get("logging.visit_debounce_ms", 5000);
  try {
    var result = await chrome.storage.session.get(DEBOUNCE_KEY);
    var lastVisit = result[DEBOUNCE_KEY];

    if (lastVisit && Date.now() - lastVisit < debounceMs) {
      return null;
    }
  } catch (error) {
    // Continue even if debounce check fails
  }

  try {
    await chrome.storage.session.set({
      [DEBOUNCE_KEY]: Date.now(),
      [sessionKey]: Date.now()
    });
  } catch (error) {
    // Continue even if debounce storage fails
  }

  try {
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return null;
    }
    var response = await Promise.race([
      chrome.runtime.sendMessage({
        type: "logVisit",
        domain: domainStatus.domain,
        status: domainStatus.status || "unlisted",
        source: domainStatus.source || "unknown",
        url: window.location.href,
        timestamp: Date.now(),
      }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("logVisit timeout")); }, 8000);
      }),
    ]);
    if (response && response.duplicate) {
      return { visitCount: response.visit_count ?? null, duplicate: true };
    }
    return { visitCount: response?.visit_count ?? null, duplicate: false };
  } catch {
    return null;
  }
}

// ─── Evaluation & display ───────────────────────────────────

/**
 * True when the current domain is under an administrator block.
 */
function isBlockedDomain() {
  return !!(domainStatus && domainStatus.block_access === true && !isExcludedDomain());
}

/**
 * Render the non-dismissible blocked modal when the domain is blocked.
 * Replaces any modal already on screen (the block outranks advisories).
 */
function showBlockedModalIfNeeded() {
  if (!isBlockedDomain()) return false;
  showBlockedAccessModal({ domain: domainStatus.domain });
  return true;
}

async function evaluateAndShowModal(visitResult) {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  if (showBlockedModalIfNeeded()) return;

  // Safe domains are scored silently and never nudged.
  if (domainStatus && domainStatus.status === "safe") return;

  if (!shouldActivate()) return;

  var visitCount = visitResult && typeof visitResult === "object"
    ? visitResult.visitCount
    : visitResult;
  var isDuplicateLog = !!(visitResult && typeof visitResult === "object" && visitResult.duplicate);

  if (visitCount) {
    try {
      await chrome.storage.local.set({ ["able:visit_count:" + domainStatus.domain]: visitCount });
    } catch {}
  } else {
    try {
      var storedCount = await chrome.storage.local.get("able:visit_count:" + domainStatus.domain);
      visitCount = storedCount["able:visit_count:" + domainStatus.domain] || 1;
    } catch {}
  }

  var consent = await hasSiteWarningConsent();

  if (!consent) {
    if (domainStatus.title && domainStatus.message) {
      await setLastModalShownTime();

      showSiteWarningModal({
        title: domainStatus.title,
        message: domainStatus.message,
        status: domainStatus.status,
        domain: domainStatus.domain,
        category: domainStatus.category || null,
        recommendations: Array.isArray(domainStatus.recommendations)
          ? domainStatus.recommendations
          : [],
      });
    }

    return;
  }

  if (!isDuplicateLog && !(await getLastModalShownTime())) {
    await setLastModalShownTime();

    return;
  }

  var shouldShow = await shouldShowRepeatVisitModal();

  if (shouldShow) {
    showRepeatVisitModal({
      domain: domainStatus.domain,
      status: domainStatus.status === "unsafe" ? "Unsafe" : "Unlisted",
      visitCount: visitCount || 1,
    });
  }
}

async function handleSPANavigation() {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  // A blocked domain must be blocked on in-app navigation too, so this
  // path re-checks the block before bailing out on an existing modal.
  if (isBlockedDomain()) {
    showBlockedModalIfNeeded();
    return;
  }

  if (document.getElementById("able-modal-root") || document.querySelector(".able-modal-backdrop")) return;

  classifyReady = classifyCurrentDomain();
  await classifyReady;

  if (!domainStatus) return;

  if (showBlockedModalIfNeeded()) return;

  try {
    if (typeof ABLEPageSignals !== "undefined" && ABLEPageSignals.contentHash) {
      initialContentHash = ABLEPageSignals.contentHash();
    }
  } catch {}
}

// ─── Font injection ─────────────────────────────────────────────────

function injectFonts() {
  if (document.getElementById("able-fonts")) return;
  var link = document.createElement("link");
  link.id = "able-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Unbounded:wght@700&display=swap";
  document.head.appendChild(link);
}

// ─── Page script injection ──────────────────────────────────

async function injectPageScript() {
  if (document.getElementById("able-inject-script")) return;

  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  // Every page-world script must match a trusted hash before any of them is
  // executed. Checking inject.js on its own is not enough: it loads its
  // dependencies from the extension afterwards, and those would run unchecked.
  try {
    var response = await chrome.runtime.sendMessage({ type: "checkIntegrity" });
    if (!response || !response.success || !response.ok) {
      console.warn("ABLE: integrity check failed, aborting injection.");
      setupFallbackDetection();
      return;
    }
  } catch {
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return;
    }
    console.warn("ABLE: integrity check failed, aborting injection.");
    setupFallbackDetection();
    return;
  }

  var script = document.createElement("script");
  script.id = "able-inject-script";
  script.src = chrome.runtime.getURL("inject/inject.js");
  script.onload = function () { script.remove(); };
  script.onerror = function () {
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return;
    }
    console.warn("ABLE: inject.js failed to load (possible CSP block). Using fallback detection.");
    setupFallbackDetection();
  };
  (document.head || document.documentElement).appendChild(script);

  setTimeout(function () {
    if (!injectReadyReceived) {
      if (!isExtensionContextValid()) {
        teardownOrphanedContentScript();
        return;
      }
      console.warn("ABLE: inject.js did not announce readiness within 5s. Using fallback detection.");
      setupFallbackDetection();
    }
  }, 5000);
}

// ─── Fallback detection ─────────────────────────────────────────────

function setupFallbackDetection() {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  if (document.getElementById("able-fallback-active")) return;
  var marker = document.createElement("div");
  marker.id = "able-fallback-active";
  marker.style.display = "none";
  document.documentElement.appendChild(marker);

  console.warn("ABLE: Fallback file detection active. Uploads cannot be intercepted in this mode, so they are not audited.");

  // A selected file is not an egress event: the fallback cannot observe whether
  // it is ever submitted, so it must not write incident rows. The degraded
  // guard itself is still worth reporting once, on the integrity channel.
  reportInterceptionFailure("fallback detection active");
}

// ─── Initialization ─────────────────────────────────────────

var initialContentHash = null;

async function initialize() {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  injectFonts();

  var greetingDone = (typeof hasGreetingCompleted === "function")
    ? await hasGreetingCompleted()
    : true;

  // The greeting is a one-shot presentation: it is shown once, and it does
  // not reappear on every page load until it is acknowledged.
  var greetingShown = (typeof hasGreetingBeenPresented === "function")
    ? await hasGreetingBeenPresented()
    : true;

  if (!greetingDone && !greetingShown && typeof showGreetingModal === "function") {
    if (document.getElementById("able-modal-root") || document.querySelector(".able-modal-backdrop")) {
      await continueInitialization();
      return;
    }
    showGreetingModal({
      onDismiss: async function () {
        await continueInitialization();
      }
    });
    return;
  }

  await continueInitialization();
}

async function continueInitialization() {
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }

  classifyReady = classifyCurrentDomain();
  await classifyReady;

  if (!domainStatus) return;

  try {
    if (typeof ABLEPageSignals !== "undefined" && ABLEPageSignals.contentHash) {
      initialContentHash = ABLEPageSignals.contentHash();
    }
  } catch {}

  var visitResult = await logDomainVisit();
  await evaluateAndShowModal(visitResult);

  scheduleHydrationRecheck();
}

function scheduleHydrationRecheck() {
  var run = async function () {
    if (!isExtensionContextValid()) {
      teardownOrphanedContentScript();
      return;
    }

    try {
      if (!domainStatus || !domainStatus.domain) return;
      if (isBlockedDomain()) {
        showBlockedModalIfNeeded();
        return;
      }
      if (document.getElementById("able-modal-root") || document.querySelector(".able-modal-backdrop")) return;
      if (typeof ABLEPageSignals === "undefined" || !ABLEPageSignals.contentHash) return;
      var current = ABLEPageSignals.contentHash();
      if (!current || current === initialContentHash) return;
      initialContentHash = current;
      classifyReady = classifyCurrentDomain();
      await classifyReady;
      showBlockedModalIfNeeded();
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

// ─── Bootstrap ──────────────────────────────────────────────

injectPageScript();
setupInterceptionListener();
initZoomListener();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

pageshowHandler = function (event) {
  if (!event.persisted) return;
  if (!isExtensionContextValid()) {
    teardownOrphanedContentScript();
    return;
  }
  injectPageScript();
  initialize();
};

if (!extensionOrphaned) {
  window.addEventListener("pageshow", pageshowHandler);
}