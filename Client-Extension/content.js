// Dynamic pie colors - will be generated based on pattern titles
const PIE_COLORS = {};

let domainStatus = null;
let pageNonceHex = null;

// ─── Background bridge (api.js runs in the service worker) ──────────

/**
 * Fetch risk patterns via the background service worker.
 * The background worker has host_permissions and is exempt from CORS.
 */
async function getRiskPatterns() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "getRiskPatterns" });
    if (response && response.success) {
      return response.patterns;
    }
    return [];
  } catch (error) {
    console.warn("ABLE: Failed to get risk patterns via background:", error);
    return [];
  }
}

/**
 * Log an egress event via the background service worker.
 * Fire-and-forget — failures are silently ignored.
 */
async function logEgressEvent(payload) {
  try {
    await chrome.runtime.sendMessage({
      type: "logEgress",
      payload: { ...payload, timestamp: Date.now() },
    });
  } catch {
    // Silently fail — logging egress is non-critical
  }
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

async function classifyCurrentDomain() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: "classifyDomain",
      url: window.location.href,
    });
    domainStatus = result;
    return result;
  } catch {
    const hostname = window.location.hostname;
    domainStatus = {
      status: "unlisted",
      domain: hostname,
      title: "The site you are entering is UNLISTED",
      message: `${hostname} is an unlisted service that has not been reviewed by our security team. Please refrain from sending sensitive institutional data from this website until it is properly reviewed.`
    };
    return domainStatus;
  }
}

function shouldActivate() {
  return domainStatus && (domainStatus.status === "unsafe" || domainStatus.status === "unlisted");
}

async function hasSessionConsent() {
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
  } catch {
  }
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
  } catch {
  }
}

async function migrateOldSessionConsent() {
  try {
    const oldKey = domainStatus.domain + "-warning";
    const oldData = await chrome.storage.session.get(oldKey);
    if (oldData[oldKey]) {
      const newKey = "able:warning:" + domainStatus.domain;
      await chrome.storage.local.set({ [newKey]: true });
      await chrome.storage.session.remove(oldKey);
    }
  } catch {
  }
}

// ─── Modal cooldown tracking ──────────────────────────────────────

const COOLDOWN_SHORT_MS = 10000; // 10 seconds
const COOLDOWN_STAGGER_MS = 300000; // 5 minutes

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
  } catch {
  }
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
  } catch {
  }
}

async function shouldShowRepeatVisitModal() {
  const lastShown = await getLastModalShownTime();
  if (!lastShown) return false;

  const interactionCount = await getInteractionCount();
  // Cooldown cycle: [10s, 10s, 5min] repeating.
  // After every 2 short-cooldown interactions, the next cooldown
  // staggers to 5 minutes.
  const nextShowNumber = interactionCount + 1;
  const cooldown = (nextShowNumber % 3 === 0)
    ? COOLDOWN_STAGGER_MS
    : COOLDOWN_SHORT_MS;
  return Date.now() - lastShown >= cooldown;
}

// ─── File scanning ─────────────────────────────────────────────────

// Heuristic guard against catastrophic backtracking (ReDoS): rejects
// patterns with nested quantifiers that can cause exponential runtime.
const RE_DANGEROUS_PATTERN = /(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])/;

/**
 * Safely test a pattern against text, returning the match count.
 * Returns 0 for invalid or potentially unsafe patterns instead of throwing.
 */
function safeTestPattern(pattern, text) {
  if (typeof pattern !== 'string' || pattern.length === 0) return 0;
  if (RE_DANGEROUS_PATTERN.test(pattern)) {
    console.warn('ABLE: Potentially unsafe regex skipped:', pattern);
    return 0;
  }
  try {
    const re = new RegExp(pattern, 'g');
    const matches = text.match(re);
    return matches ? matches.length : 0;
  } catch (error) {
    console.warn('ABLE: Invalid regex pattern:', pattern, error);
    return 0;
  }
}

/**
 * Evaluate a criteria's top-level items with AND/OR logic.
 * Sub-items are scored independently (like single patterns) and do not
 * gate the criteria match.
 */
function evaluateCriteriaItems(items, text) {
  const results = items.map((item) => safeTestPattern(item.regex, text) > 0);
  const hasOr = items.some((item) => item.operator === 'or');
  return hasOr ? results.some(Boolean) : results.every(Boolean);
}

async function calculateRiskScore(text) {
  let totalScore = 0;
  const flaggedItems = [];

  // Get patterns from server/cache via api.js
  const patterns = await getRiskPatterns();

  // If no patterns available, return zero score
  if (patterns.length === 0) {
    console.warn('ABLE: No risk patterns available for scoring.');
    return {
      score: 0,
      flaggedItems: [],
    };
  }

  // Process single patterns
  const singlePatterns = patterns.filter(p => p.type === 'single');
  for (const pattern of singlePatterns) {
    const count = safeTestPattern(pattern.regex, text);
    if (count > 0) {
      totalScore += pattern.score;
      flaggedItems.push({
        label: pattern.title,
        count: count,
        weight: pattern.score,
      });
    }
  }

  // Process criteria patterns
  const criteriaPatterns = patterns.filter(p => p.type === 'criteria');
  for (const criteria of criteriaPatterns) {
    const items = criteria.criteria_pattern_items || [];
    if (items.length === 0) continue;

    let matchCount = 0;

    // Sub-items are independent single-pattern contributors: they always
    // score on their own and do not gate the criteria's composite match.
    function scoreSubItems(subItems, prefix) {
      for (const sub of subItems) {
        const count = safeTestPattern(sub.regex, text);
        if (count > 0) {
          matchCount += count;
          totalScore += sub.score;
          flaggedItems.push({
            label: `${prefix} › ${sub.title}`,
            count: count,
            weight: sub.score,
          });
        }
        if (sub.sub_items && sub.sub_items.length > 0) {
          scoreSubItems(sub.sub_items, `${prefix} › ${sub.title}`);
        }
      }
    }

    for (const item of items) {
      const count = safeTestPattern(item.regex, text);
      if (count > 0) matchCount += count;
      if (item.sub_items && item.sub_items.length > 0) {
        scoreSubItems(item.sub_items, criteria.title);
      }
    }

    const criteriaMatched = evaluateCriteriaItems(items, text);

    if (criteriaMatched) {
      totalScore += criteria.score;
      flaggedItems.push({
        label: criteria.title,
        count: matchCount,
        weight: criteria.score,
      });
    }
  }

  return {
    score: Math.min(100, totalScore),
    flaggedItems,
  };
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ─── Network interception (inject.js bridge) ───────────────────────

async function injectPageScript() {
  if (document.getElementById("able-inject-script")) return;

  // Verify inject.js integrity before injecting into the page world.
  // If the resource hash doesn't match, abort injection entirely.
  if (typeof EXPECTED_INJECT_HASH === "string" && EXPECTED_INJECT_HASH.length > 0) {
    const url = chrome.runtime.getURL("inject.js");
    const ok = await ABLESecurity.verifyResourceIntegrity(url, EXPECTED_INJECT_HASH);
    if (!ok) {
      console.warn("ABLE: inject.js integrity check failed, aborting injection.");
      return;
    }
  }

  const script = document.createElement("script");
  script.id = "able-inject-script";
  script.src = chrome.runtime.getURL("inject.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function sendDecision(requestId, action) {
  window.postMessage({
    source: "ABLE_CONTENT",
    type: "ABLE_DECISION",
    payload: { requestId, action }
  }, "*");
}

async function scanFile(file) {
  const MAX_TEXT_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  let text;
  let fileFormat = "plain";

  const officeFormat = detectOfficeFormat(file);
  if (officeFormat) {
    try {
      const result = await extractOfficeText(file);
      text = result.text;
      fileFormat = result.format;
    } catch (err) {
      console.warn("ABLE: Office parsing skipped:", err.message || err);
      return null;
    }
  } else {
    if (file.size > MAX_TEXT_FILE_SIZE) {
      console.warn("ABLE: File too large for scanning, skipping:", file.name);
      return null;
    }
    try {
      text = await readFileContent(file);
    } catch {
      return null;
    }
  }

  const result = await calculateRiskScore(text);
  const domainRiskScore = domainStatus?.risk_score || 0;
  const totalScore = Math.min(100, domainRiskScore + result.score);

  const flaggedItems = [];
  if (domainRiskScore > 0) {
    flaggedItems.push({
      label: "Domain Risk (" + (domainStatus.status === "unlisted" ? "Unlisted" : "Unsafe") + ")",
      count: 1,
      weight: domainRiskScore,
    });
  }
  flaggedItems.push(...result.flaggedItems);

  console.log("ABLE Scan:", {
    file: file.name,
    domain: domainStatus.domain,
    domain_status: domainStatus.status,
    domain_risk_score: domainRiskScore,
    pattern_score: result.score,
    total_score: totalScore,
    threshold: 85,
    triggered: totalScore > 85,
    flagged_item_count: flaggedItems.length,
  });

  return {
    score: totalScore,
    flaggedItems,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileFormat,
  };
}

async function handleInterceptedFiles(files, requestId) {
  // Wait for domain classification to complete before making scanning decisions
  if (classifyReady) await classifyReady;

  if (!shouldActivate()) {
    sendDecision(requestId, "proceed");
    return;
  }

  const consent = await hasSessionConsent();
  if (consent) {
    sendDecision(requestId, "proceed");
    return;
  }

  // Scan all files and find the highest-risk one
  let highestRisk = null;

  for (const file of files) {
    const result = await scanFile(file);
    if (result && (!highestRisk || result.score > highestRisk.score)) {
      highestRisk = result;
    }
  }

  if (highestRisk && highestRisk.score > 85) {
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
  }
}

function setupInterceptionListener() {
  // Generate a per-page-load nonce. inject.js must echo this nonce back
  // in every ABLE_INTERCEPT message. The nonce is random per page load
  // and never crosses origins, so page scripts can't predict or replay it.
  const pageNonce = crypto.getRandomValues(new Uint8Array(16));
  pageNonceHex = Array.from(pageNonce).map((b) => b.toString(16).padStart(2, "0")).join("");

  window.addEventListener("message", async (event) => {
    if (event.data?.source !== "ABLE_INJECT") return;

    if (event.data.type === "ABLE_READY") {
      // inject.js just announced itself; reply with the nonce.
      window.postMessage({
        source: "ABLE_CONTENT",
        type: "ABLE_NONCE",
        nonce: pageNonceHex,
      }, window.location.origin);
      return;
    }

    if (event.data.type === "ABLE_INTERCEPT") {
      // Validate nonce and origin before trusting the intercepted request.
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_INTERCEPT with invalid nonce.");
        return;
      }
      const { requestId, files } = event.data.payload;
      if (!requestId || !files || files.length === 0) return;
      await handleInterceptedFiles(files, requestId);
    }

    if (event.data.type === "ABLE_SPA_NAVIGATION") {
      handleSPANavigation();
    }
  });
}

// ─── Intercept modal ───────────────────────────────────────────────

function showInterceptModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  const statusLabel = data.status === "unsafe" ? "Unsafe" : "Unlisted";

  const totalWeight = data.flaggedItems.reduce((sum, item) => sum + item.weight, 0);

  const stops = [];
  let currentAngle = 0;

  for (const item of data.flaggedItems) {
    const sliceAngle = totalWeight > 0 ? (item.weight / totalWeight) * 360 : 0;
    const color = PIE_COLORS[item.label] || "var(--score-orange)";
    if (sliceAngle > 0) {
      stops.push(`${color} ${currentAngle}deg ${currentAngle + sliceAngle}deg`);
    }
    currentAngle += sliceAngle;
  }

  const gapEnd = Math.min(currentAngle + 11, 360);

  const gradient = `conic-gradient(
  ${stops.join(",\n  ")},
  var(--dark-gray) ${currentAngle}deg ${gapEnd}deg,
  var(--track-gray) ${gapEnd}deg 360deg
)`;

  backdrop.innerHTML = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">HOLD IT RIGHT THERE!</h1>
        <div class="able-score-ring-wrapper" role="button" tabindex="0">
          <div class="able-score-ring-chart" style="background: ${gradient};">
            <div class="able-score-ring-inner">
              <span class="able-score-percentage">${data.score}%</span>
              <span class="able-score-label">Risk Score</span>
            </div>
          </div>
        </div>
        <div class="able-modal-body">
          <p>
            ABLE has detected sensitive information from
            "<span class="able-highlight-text">${data.fileName}</span>" that is being uploaded into
            <span class="able-highlight-text">${data.websiteName}</span>.
            Please be informed that the website is marked as
            <span class="able-highlight-text">${statusLabel}</span> by our security team
            and sending this file may expose your information to these third-party services.
            Please consider whether this upload is necessary or use our verified alternative service instead.
          </p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableProceedBtn">I Understand the Risk, But I Wish to Proceed.</button>
          <button class="able-btn able-btn-cancel" id="ableCancelBtn">Cancel</button>
        </div>
      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;

  document.documentElement.appendChild(backdrop);

  backdrop.querySelector("#ableProceedBtn").addEventListener("click", async () => {
    await setSessionConsent();
    sendDecision(data.requestId, "proceed");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "proceeded",
      userAction: "proceeded",
    });
    removeModal();
  });

  backdrop.querySelector("#ableCancelBtn").addEventListener("click", () => {
    sendDecision(data.requestId, "cancel");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
    });
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      sendDecision(data.requestId, "cancel");
      logEgressEvent({
        domain: data.domain,
        fileName: data.fileName,
        fileSize: data.fileSize,
        riskScore: data.score,
        action: "denied",
        userAction: "cancelled",
      });
      removeModal();
    }
  });

  backdrop.querySelector(".able-score-ring-wrapper").addEventListener("click", () => {
    showInterceptScoreDetails(data);
  });
}

function showInterceptScoreDetails(data) {
  const modalCard = document.querySelector(".able-modal-card");
  if (!modalCard) return;

  const totalWeight = data.flaggedItems.reduce((sum, item) => sum + item.weight, 0);

  const itemsHtml = data.flaggedItems.map((item) => {
    const color = PIE_COLORS[item.label] || "var(--score-orange)";
    const pct = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(0) : 0;
    return `
      <div class="able-detail-item">
        <span class="able-detail-swatch" style="background: ${color};"></span>
        <span class="able-detail-label"><span class="able-highlight-text">${item.label}</span></span>
        <span class="able-detail-count">x<span class="able-highlight-text">${item.count}</span></span>
        <span class="able-detail-weight">+<span class="able-highlight-text">${item.weight}</span></span>
        <span class="able-detail-pct"><span class="able-highlight-text">${pct}%</span></span>
      </div>`;
  }).join("");

  modalCard.innerHTML = `
    <div class="able-banner-edge"></div>
    <div class="able-modal-content">
      <h1 class="able-modal-title">SCORE BREAKDOWN</h1>
      <div class="able-detail-list">${itemsHtml}</div>
      <div class="able-detail-total">
        <span>Total Risk Score</span>
        <span class="able-detail-total-score"><span class="able-highlight-text">${data.score}%</span></span>
      </div>
      <div class="able-modal-actions">
        <button class="able-btn able-btn-proceed" id="ableDetailBackBtn">Back to Warning</button>
        <button class="able-btn able-btn-cancel" id="ableDetailCancelBtn">Cancel Upload</button>
      </div>
    </div>
    <div class="able-banner-edge"></div>
  `;

  document.querySelector("#ableDetailBackBtn").addEventListener("click", () => {
    showInterceptModal(data);
  });

  document.querySelector("#ableDetailCancelBtn").addEventListener("click", () => {
    sendDecision(data.requestId, "cancel");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
    });
    removeModal();
  });
}

function removeModal() {
  const existing = document.querySelector(".able-modal-backdrop");
  if (existing) existing.remove();
}

// ─── Site warning modal ────────────────────────────────────────────

function showSiteWarningModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  backdrop.innerHTML = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title"><span class="able-highlight-text">${data.title}</span></h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>${data.message}</p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableWarningDismiss">I Understand</button>
        </div>
      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;

  document.documentElement.appendChild(backdrop);

  backdrop.querySelector("#ableWarningDismiss").addEventListener("click", async () => {
    await setSiteWarningConsent();
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setSiteWarningConsent();
      removeModal();
    }
  });
}

// ─── Repeat visit modal ─────────────────────────────────────────

function showRepeatVisitModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  backdrop.innerHTML = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">BEFORE YOU PROCEED</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>
            You have visited <span class="able-highlight-text">${data.domain}</span>
            for <span class="able-highlight-text">${data.visitCount} time${data.visitCount !== 1 ? 's' : ''}</span> now.
            The ABLE security team is still marking this site as ${data.status}.
          </p>
          <br>
          <p>
            Please be advised that your visits are being recorded for security monitoring purposes.
            So please exercise caution when sharing sensitive information on this website.
          </p>
          <br>
          <p>Happy Surfing :)</p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableRepeatDismiss">I Understand</button>
        </div>
      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;

  document.documentElement.appendChild(backdrop);

  backdrop.querySelector("#ableRepeatDismiss").addEventListener("click", async () => {
    await setLastModalShownTime();
    await incrementInteractionCount();
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setLastModalShownTime();
      incrementInteractionCount();
      removeModal();
    }
  });
}

// ─── Logging ─────────────────────────────────────────────────────────

async function logDomainVisit() {
  if (!domainStatus || !domainStatus.domain) return null;

  // Debounce: Don't log the same domain within 5 seconds
  const DEBOUNCE_KEY = `able:last_visit:${domainStatus.domain}`;
  try {
    const result = await chrome.storage.session.get(DEBOUNCE_KEY);
    const lastVisit = result[DEBOUNCE_KEY];

    if (lastVisit && Date.now() - lastVisit < 5000) {
      return null; // Skip duplicate visit
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
    const response = await chrome.runtime.sendMessage({
      type: "logVisit",
      domain: domainStatus.domain,
      status: domainStatus.status || "unlisted",
      source: domainStatus.source || "unknown",
      timestamp: Date.now(),
    });
    return response?.visit_count ?? null;
  } catch {
    return null;
  }
}

// ─── Fonts ──────────────────────────────────────────────────────────

function injectFonts() {
  if (document.getElementById("able-fonts")) return;
  const link = document.createElement("link");
  link.id = "able-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Unbounded:wght@700&display=swap";
  document.head.appendChild(link);
}

// ─── Initialization ─────────────────────────────────────────────────

let classifyReady;

async function evaluateAndShowModal(serverVisitCount) {
  if (!shouldActivate()) return;

  await migrateOldSessionConsent();
  const consent = await hasSiteWarningConsent();

  if (!consent) {
    // First visit to this unsafe/unlisted domain - show initial warning
    if (domainStatus.title && domainStatus.message) {
      await setLastModalShownTime();

      showSiteWarningModal({
        title: domainStatus.title,
        message: domainStatus.message,
      });
    }
  } else {
    // Repeat visit - check dynamic cooldown and show modal with server count
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
  // Skip if a modal is already showing to avoid disrupting an in-flight intercept
  if (document.querySelector(".able-modal-backdrop")) return;

  // Re-classify so the new route's domain gets evaluated
  classifyReady = classifyCurrentDomain();
  await classifyReady;

  const serverVisitCount = await logDomainVisit();
  await evaluateAndShowModal(serverVisitCount);
}

async function initialize() {
  injectFonts();

  // Store the classification promise so handleInterceptedFile can await it
  classifyReady = classifyCurrentDomain();

  await classifyReady;

  // Log the visit and get the authoritative count from the server
  const serverVisitCount = await logDomainVisit();

  await evaluateAndShowModal(serverVisitCount);
}

injectPageScript();
setupInterceptionListener();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Re-initialize on bfcache restoration (back/forward navigation from cache)
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    injectPageScript();
    initialize();
  }
});
