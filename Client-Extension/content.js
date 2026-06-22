const SENSITIVE_PATTERNS = [
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, label: "Credit Card Number", weight: 20 },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "Social Security Number (SSN)", weight: 30 },
  { pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key)\s*[:=]\s*\S+/gi, label: "API Key / Token", weight: 25 },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, label: "Private Key", weight: 35 },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, label: "Plaintext Password", weight: 25 },
  { pattern: /(?:jdbc|postgresql|mysql|mongodb|redis):\/\/\S+:\S+@/gi, label: "Database Connection String", weight: 25 },
];

const PIE_COLORS = {
  "Credit Card Number": "var(--pie-cc)",
  "Social Security Number (SSN)": "var(--pie-ssn)",
  "API Key / Token": "var(--pie-api-key)",
  "Private Key": "var(--pie-private-key)",
  "Plaintext Password": "var(--pie-password)",
  "Database Connection String": "var(--pie-db-string)",
};

let domainStatus = null;
let processedInputs = new WeakSet();

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

function calculateRiskScore(text) {
  let totalScore = 0;
  const flaggedItems = [];

  for (const entry of SENSITIVE_PATTERNS) {
    const matches = [...text.matchAll(entry.pattern)];
    if (matches.length > 0) {
      totalScore += entry.weight;
      flaggedItems.push({
        label: entry.label,
        count: matches.length,
        weight: entry.weight,
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

async function handleFileUpload(fileInput, file) {
  const consent = await hasSessionConsent();
  if (consent) return;

  let text;
  let fileFormat = 'plain';

  const officeFormat = detectOfficeFormat(file);
  if (officeFormat) {
    try {
      const result = await extractOfficeText(file);
      text = result.text;
      fileFormat = result.format;
    } catch (err) {
      console.warn('ABLE: Office parsing skipped:', err.message || err);
      return;
    }
  } else {
    try {
      text = await readFileContent(file);
    } catch {
      return;
    }
  }

  const result = calculateRiskScore(text);

  if (result.score > 85) {
    showModal({
      score: result.score,
      flaggedItems: result.flaggedItems,
      domain: domainStatus.domain,
      status: domainStatus.status,
      websiteName: getWebsiteName(),
      fileName: file.name,
      fileSize: file.size,
      fileInput: fileInput,
      fileType: fileFormat,
    });
  }
}

function resetFileInput(fileInput) {
  const form = fileInput.closest("form");
  if (form) {
    form.reset();
  } else {
    fileInput.value = "";
  }
}

function showModal(data) {
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
    removeModal();
  });

  backdrop.querySelector("#ableCancelBtn").addEventListener("click", () => {
    resetFileInput(data.fileInput);
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      resetFileInput(data.fileInput);
      removeModal();
    }
  });

  backdrop.querySelector(".able-score-ring-wrapper").addEventListener("click", () => {
    showScoreDetails(data);
  });
}

function showScoreDetails(data) {
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
    showModal(data);
  });

  document.querySelector("#ableDetailCancelBtn").addEventListener("click", () => {
    resetFileInput(data.fileInput);
    removeModal();
  });
}

function removeModal() {
  const existing = document.querySelector(".able-modal-backdrop");
  if (existing) existing.remove();
}

function showSiteWarningModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  backdrop.innerHTML = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">${data.title}</h1>
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
      removeModal();
      setSiteWarningConsent();
    }
  });
}

function initFileScanner() {
  const inputs = document.querySelectorAll('input[type="file"]');
  for (const input of inputs) {
    attachFileHandler(input);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && node.matches('input[type="file"]')) {
            attachFileHandler(node);
          }
          if (node.querySelectorAll) {
            const fileInputs = node.querySelectorAll('input[type="file"]');
            for (const fi of fileInputs) {
              attachFileHandler(fi);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function attachFileHandler(input) {
  if (processedInputs.has(input)) return;
  processedInputs.add(input);

  input.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      await handleFileUpload(input, file);
    }
  });
}

function injectFonts() {
  if (document.getElementById("able-fonts")) return;
  const link = document.createElement("link");
  link.id = "able-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Unbounded:wght@700&display=swap";
  document.head.appendChild(link);
}

async function initialize() {
  injectFonts();
  await classifyCurrentDomain();

  if (shouldActivate()) {
    await migrateOldSessionConsent();
    const consent = await hasSiteWarningConsent();
    if (!consent && domainStatus.title && domainStatus.message) {
      showSiteWarningModal({
        title: domainStatus.title,
        message: domainStatus.message,
      });
    }
    initFileScanner();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
