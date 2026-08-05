// Dynamic pie colors - will be generated based on pattern titles
const PIE_COLORS = {};

let domainStatus = null;

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

async function shouldShowRepeatVisitModal() {
  const lastShown = await getLastModalShownTime();
  if (!lastShown) return false;

  const COOLDOWN_MS = 10000; // 10 seconds
  return Date.now() - lastShown >= COOLDOWN_MS;
}

// ─── File scanning ─────────────────────────────────────────────────

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
    try {
      const regex = new RegExp(pattern.regex, 'g');
      const matches = [...text.matchAll(regex)];
      if (matches.length > 0) {
        totalScore += pattern.score;
        flaggedItems.push({
          label: pattern.title,
          count: matches.length,
          weight: pattern.score,
        });
      }
    } catch (error) {
      console.warn('ABLE: Invalid regex pattern:', pattern.regex, error);
    }
  }

  // Process criteria patterns
  const criteriaPatterns = patterns.filter(p => p.type === 'criteria');
  for (const criteria of criteriaPatterns) {
    let allMatched = true;
    let matchCount = 0;

    function checkItem(item) {
      try {
        const regex = new RegExp(item.regex, 'g');
        const matches = [...text.matchAll(regex)];
        if (matches.length === 0) return false;
        matchCount += matches.length;
        return true;
      } catch (error) {
        console.warn('ABLE: Invalid regex pattern in criteria:', item.regex, error);
        return false;
      }
    }

    function checkItemsRecursive(items) {
      for (const item of items) {
        if (!checkItem(item)) {
          allMatched = false;
          return;
        }
        if (item.sub_items && item.sub_items.length > 0) {
          checkItemsRecursive(item.sub_items);
          if (!allMatched) return;
        }
      }
    }

    checkItemsRecursive(criteria.criteria_pattern_items);

    if (allMatched) {
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

function injectPageScript() {
  if (document.getElementById("able-inject-script")) return;
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

async function handleInterceptedFile(file, requestId) {
  if (!shouldActivate()) {
    sendDecision(requestId, "proceed");
    return;
  }

  const consent = await hasSessionConsent();
  if (consent) {
    sendDecision(requestId, "proceed");
    return;
  }

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
      sendDecision(requestId, "proceed");
      return;
    }
  } else {
    if (file.size > MAX_TEXT_FILE_SIZE) {
      console.warn("ABLE: File too large for scanning, auto-proceeding:", file.name);
      sendDecision(requestId, "proceed");
      return;
    }
    try {
      text = await readFileContent(file);
    } catch {
      sendDecision(requestId, "proceed");
      return;
    }
  }

  const result = await calculateRiskScore(text);

  // Combine domain base risk score with pattern match score
  const domainRiskScore = domainStatus?.risk_score || 0;
  const totalScore = Math.min(100, domainRiskScore + result.score);

  // Build flagged items list, including domain risk as a line item
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
    domain: domainStatus.domain,
    domain_status: domainStatus.status,
    domain_risk_score: domainRiskScore,
    pattern_score: result.score,
    total_score: totalScore,
    threshold: 85,
    triggered: totalScore > 85,
    flagged_items: flaggedItems,
  });

  if (totalScore > 85) {
    showInterceptModal({
      score: totalScore,
      flaggedItems: flaggedItems,
      domain: domainStatus.domain,
      status: domainStatus.status,
      websiteName: getWebsiteName(),
      fileName: file.name,
      fileSize: file.size,
      fileType: fileFormat,
      requestId: requestId,
    });
  } else {
    sendDecision(requestId, "proceed");
  }
}

function setupInterceptionListener() {
  window.addEventListener("message", async (event) => {
    if (event.data?.source !== "ABLE_INJECT") return;
    if (event.data.type === "ABLE_READY") return;
    if (event.data.type === "ABLE_INTERCEPT") {
      const { requestId, file } = event.data.payload;
      if (!requestId || !file) return;
      await handleInterceptedFile(file, requestId);
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
        <span class="able-detail-label">${item.label}</span>
        <span class="able-detail-count">x${item.count}</span>
        <span class="able-detail-weight">+${item.weight}</span>
        <span class="able-detail-pct">${pct}%</span>
      </div>`;
  }).join("");

  modalCard.innerHTML = `
    <div class="able-banner-edge"></div>
    <div class="able-modal-content">
      <h1 class="able-modal-title">SCORE BREAKDOWN</h1>
      <div class="able-detail-list">${itemsHtml}</div>
      <div class="able-detail-total">
        <span>Total Risk Score</span>
        <span class="able-detail-total-score">${data.score}%</span>
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
        <h1 class="able-modal-title">${data.title}</h1>
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
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setLastModalShownTime();
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

async function initialize() {
  injectFonts();
  await classifyCurrentDomain();

  // Log the visit and get the authoritative count from the server
  const serverVisitCount = await logDomainVisit();

  if (shouldActivate()) {
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
      // Repeat visit - check cooldown and show modal with server count
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
}

injectPageScript();
setupInterceptionListener();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
