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
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.warn("ABLE: Extension context invalidated, cannot fetch risk patterns.");
      return [];
    }
    console.debug("ABLE: Requesting risk patterns from background...");
    const response = await chrome.runtime.sendMessage({ type: "getRiskPatterns" });
    console.debug("ABLE: Risk patterns response:", response ? `success=${response.success}, count=${response.patterns?.length || 0}` : 'null');
    if (response && response.success) {
      return response.patterns;
    }
    console.warn("ABLE: getRiskPatterns response indicates failure:", response);
    return [];
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      console.warn("ABLE: Extension context invalidated. Please refresh the page.");
    } else {
      console.warn("ABLE: Failed to get risk patterns via background:", error);
    }
    return [];
  }
}

/**
 * Log an egress event via the background service worker.
 * Fire-and-forget — failures are silently ignored.
 */
async function logEgressEvent(payload) {
  // Skip events with generic filenames (no real file uploaded)
  // These are typically analytics/tracking endpoints or failed filename recovery
  var genericNames = ['binary-upload', 'blob', 'websocket-upload', 'stream-upload', 'unknown'];
  if (payload.fileName && genericNames.includes(payload.fileName.toLowerCase())) {
    console.debug("ABLE: Skipping generic filename:", payload.fileName);
    return;
  }

  var maxRetries = 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        return; // Silently skip if context invalidated
      }
      await chrome.runtime.sendMessage({
        type: "logEgress",
        payload: { ...payload, timestamp: Date.now() },
      });
      return; // Success
    } catch (err) {
      if (attempt === maxRetries - 1) {
        console.warn("ABLE: Failed to log egress after", maxRetries, "attempts");
      }
      // Wait before retry (exponential backoff)
      await new Promise(function (resolve) { setTimeout(resolve, 100 * (attempt + 1)); });
    }
  }
}

// ─── Deduplication ──────────────────────────────────────────────────
// Track recently scanned files to prevent duplicate audit entries
var recentScans = [];
var DEDUPLICATION_WINDOW_MS = 5000; // 5 seconds

function isDuplicateScan(contentHash, fileName) {
  if (!contentHash) return false;

  var now = Date.now();
  // Clean old entries
  recentScans = recentScans.filter(function (entry) {
    return now - entry.timestamp < DEDUPLICATION_WINDOW_MS;
  });

  // Check for duplicate
  for (var i = 0; i < recentScans.length; i++) {
    if (recentScans[i].hash === contentHash && recentScans[i].name === fileName) {
      return true;
    }
  }

  // Add to recent scans
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
  return {
    status: "unlisted",
    domain: hostname,
    title: "The site you are entering is UNLISTED",
    message: `${hostname} is an unlisted service that has not been reviewed by our security team. Please refrain from sending sensitive institutional data from this website until it is properly reviewed.`
  };
}

async function classifyCurrentDomain() {
  const CLASSIFY_TIMEOUT_MS = 8000;

  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.warn("ABLE: Extension context invalidated, using default classification.");
      domainStatus = buildDefaultDomainStatus();
      return domainStatus;
    }

    // Race the background response against a hard timeout. In MV3 the
    // service worker can be terminated mid-flight (e.g. while secureFetch
    // waits on DNS), causing sendMessage() to hang indefinitely instead
    // of rejecting. The timeout ensures evaluateAndShowModal() is always
    // reached within a reasonable time.
    const result = await Promise.race([
      chrome.runtime.sendMessage({
        type: "classifyDomain",
        url: window.location.href,
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
    ? getStaggerCooldown()
    : getShortCooldown();
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

var injectReadyReceived = false;

async function injectPageScript() {
  if (document.getElementById("able-inject-script")) return;

  // Verify inject.js integrity before injecting into the page world.
  // If the resource hash doesn't match, abort injection entirely.
  if (typeof EXPECTED_INJECT_HASH === "string" && EXPECTED_INJECT_HASH.length > 0) {
    try {
      const url = chrome.runtime.getURL("inject.js");
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
  script.src = chrome.runtime.getURL("inject.js");
  script.onload = () => script.remove();
  // If the script fails to load (e.g., CSP blocks chrome-extension: URLs),
  // the onerror event fires. Fall back to content-script-level detection.
  script.onerror = () => {
    console.warn("ABLE: inject.js failed to load (possible CSP block). Using fallback detection.");
    setupFallbackDetection();
  };
  (document.head || document.documentElement).appendChild(script);

  // Set a timeout to detect if inject.js never announces itself (ABLE_READY).
  // This can happen if CSP blocks the script or if the script crashes.
  setTimeout(() => {
    if (!injectReadyReceived) {
      console.warn("ABLE: inject.js did not announce readiness within 5s. Using fallback detection.");
      setupFallbackDetection();
    }
  }, 5000);
}

/**
 * Fallback detection when inject.js cannot be loaded (e.g., CSP blocks
 * chrome-extension: script injection). Watches for file inputs and
 * attachment buttons, and logs egress events when files are selected.
 * This provides partial coverage — pattern scoring still requires the
 * full inject.js interception flow.
 */
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

  // Watch for new file inputs
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

  // Check existing file inputs
  var existingInputs = document.querySelectorAll("input[type='file']");
  for (var i = 0; i < existingInputs.length; i++) {
    watchFileInput(existingInputs[i]);
  }
}

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

/**
 * Handle a text check request from inject.js.
 * Scans the text for sensitive patterns and sends back a decision.
 * If sensitive content is found, shows a warning modal and blocks the send.
 */
async function handleTextCheck(checkId, text, inputType, url) {
  try {
    // Limit text size to avoid performance issues
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

    // Log the egress event regardless of action
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
      // Sensitive content detected — block and show warning
      showTextWarningModal({
        domain,
        totalScore,
        flaggedItems: result.flaggedItems,
        inputType,
      });
      sendTextDecision(checkId, "block");
    } else {
      // Allow the text to proceed
      sendTextDecision(checkId, "allow");
    }
  } catch (error) {
    console.warn("ABLE: Text check failed:", error);
    // Fail open — allow the text to proceed
    sendTextDecision(checkId, "allow");
  }
}

/**
 * Show a warning modal when sensitive content is detected in text input.
 */
function showTextWarningModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  const card = document.createElement("div");
  card.className = "able-intercept-modal";
  card.innerHTML = `
    <div class="able-intercept-header" style="background: #d32f2f;">
      <span class="able-intercept-title">Sensitive Content Detected</span>
    </div>
    <div class="able-intercept-body">
      <p style="margin: 0 0 12px; font-size: 14px; color: #333;">
        The text you're about to send contains <strong>sensitive information</strong> that may violate your organization's data protection policy.
      </p>
      <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #e65100;">
        <strong>Risk Score: ${data.totalScore}/100</strong><br>
        Domain: ${data.domain}
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 16px;">
        <strong>Detected patterns:</strong>
        <ul style="margin: 4px 0; padding-left: 20px;">
          ${data.flaggedItems.map(item => `<li>${item.label} (${item.count} matches)</li>`).join("")}
        </ul>
      </div>
    </div>
    <div class="able-intercept-footer">
      <button class="able-btn able-btn-cancel" id="able-text-cancel">Cancel Send</button>
      <button class="able-btn able-btn-proceed" id="able-text-proceed">Send Anyway</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  // Cancel button — closes modal and clears the input
  document.getElementById("able-text-cancel").addEventListener("click", function () {
    removeModal();
    // Try to clear the input
    var activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
      activeElement.value = "";
    } else if (activeElement.isContentEditable) {
      activeElement.innerText = "";
    }
  });

  // Proceed button — closes modal (the Enter key was already blocked)
  document.getElementById("able-text-proceed").addEventListener("click", function () {
    removeModal();
    // User confirmed they want to send — we don't re-trigger the Enter key
    // The user can press Enter again to send
  });
}

/**
 * Compute SHA-256 hash of the first 4KB of a file for identification/deduplication.
 * Returns null if hashing fails.
 */
async function computeContentHash(file) {
  try {
    const slice = file.slice(0, 4096); // First 4KB
    const buffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  } catch {
    return null;
  }
}

/**
 * Detect file type from magic bytes (file signature).
 * Returns file extension or null if unknown.
 */
function detectFileTypeFromMagicBytes(file) {
  return new Promise(function (resolve) {
    var slice = file.slice(0, 8);
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var arr = new Uint8Array(reader.result);
        var hex = Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

        // Magic byte signatures
        if (hex.startsWith('25504446')) return resolve('pdf');           // %PDF
        if (hex.startsWith('504b0304')) return resolve('zip');           // PK (ZIP/DOCX/XLSX)
        if (hex.startsWith('d0cf11e0')) return resolve('ole');           // OLE (old Office)
        if (hex.startsWith('89504e47')) return resolve('png');           // PNG
        if (hex.startsWith('ffd8ff')) return resolve('jpg');             // JPEG
        if (hex.startsWith('47494638')) return resolve('gif');           // GIF
        return resolve(null);
      } catch {
        return resolve(null);
      }
    };
    reader.onerror = function () { resolve(null); };
    reader.readAsArrayBuffer(slice);
  });
}

async function scanFile(file) {
  const scanStartTime = Date.now();
  const MAX_TEXT_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const MAX_BINARY_SCAN_SIZE = 10 * 1024 * 1024; // 10MB for binary detection
  let text;
  let fileFormat = "plain";

  // For binary-upload files (from ArrayBuffer), detect file type from magic bytes
  // This enables proper parsing of PDF/DOCX/XLSX sent as binary chunks
  const isBinaryUpload = file.name === 'binary-upload' || file.name === 'blob';
  console.debug("ABLE: Scanning file:", file.name, "size:", file.size, "isBinaryUpload:", isBinaryUpload);

  if (isBinaryUpload && file.size < MAX_BINARY_SCAN_SIZE) {
    var detectedType = await detectFileTypeFromMagicBytes(file);
    console.debug("ABLE: Detected file type:", detectedType);
    if (detectedType === 'pdf' || detectedType === 'zip' || detectedType === 'ole') {
      try {
        var officeFormatBinary = detectOfficeFormat(file);
        if (officeFormatBinary) {
          var officeResult = await extractOfficeText(file);
          text = officeResult.text;
          fileFormat = officeResult.format;
        }
      } catch (err) {
        console.warn("ABLE: Office extraction failed:", err.message || err);
        // Fall through to text extraction
      }
    }
  }

  // Standard text extraction for non-binary files or if binary detection failed
  if (!text) {
    var officeFormat = detectOfficeFormat(file);
    if (officeFormat) {
      try {
        var officeResult = await extractOfficeText(file);
        text = officeResult.text;
        fileFormat = officeResult.format;
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
        console.debug("ABLE: Read file content, length:", text?.length, "type:", typeof text);
      } catch (err) {
        console.warn("ABLE: Failed to read file content:", err.message || err);
        return null;
      }
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

  const riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 90);

  // Compute content hash for identification/deduplication
  const contentHash = await computeContentHash(file);
  const scanDurationMs = Date.now() - scanStartTime;

  console.log("ABLE Scan:", {
    file: file.name,
    domain: domainStatus.domain,
    domain_status: domainStatus.status,
    domain_risk_score: domainRiskScore,
    pattern_score: result.score,
    total_score: totalScore,
    threshold: riskThreshold,
    triggered: totalScore > riskThreshold,
    flagged_item_count: flaggedItems.length,
    scan_duration_ms: scanDurationMs,
    content_hash: contentHash ? contentHash.substring(0, 16) + '...' : null,
  });

  return {
    score: totalScore,
    flaggedItems,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileFormat,
    contentHash,
    scanDurationMs,
  };
}

async function handleInterceptedFiles(fileInfos, requestId) {
  // Wait for domain classification to complete before making scanning decisions
  if (classifyReady) await classifyReady;

  // Extract File objects from fileInfos (filter out null files from streams)
  var files = fileInfos.map(function (info) { return info.file; }).filter(Boolean);
  var sources = fileInfos.map(function (info) { return info.source; });
  var primarySource = sources[0] || 'unknown';

  if (!shouldActivate()) {
    sendDecision(requestId, "proceed");

    // Log egress event for safe domains with action 'allowed'
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

  // Scan all files and find the highest-risk one
  var highestRisk = null;

  for (var i = 0; i < files.length; i++) {
    var result = await scanFile(files[i]);
    if (result && (!highestRisk || result.score > highestRisk.score)) {
      highestRisk = result;
    }
  }

  // Check for duplicate scan (prevent duplicate audit entries)
  if (highestRisk && highestRisk.contentHash && isDuplicateScan(highestRisk.contentHash, highestRisk.fileName)) {
    console.debug("ABLE: Duplicate scan detected, skipping");
    sendDecision(requestId, "proceed");
    return;
  }

  var consent = await hasSessionConsent();

  // Lowered threshold from 90 to 80 for better sensitivity
  // Also show modal if pattern score alone is high (>= 40) even if total is below threshold
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
    // Low-risk files: proceed without modal
    sendDecision(requestId, "proceed");

    // Log egress event for unlisted/unsafe domains even when below threshold
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
      // scanFile returned null for all files (binary, Office parse error, >100MB)
      // Log with first file's metadata and riskScore 0 — the upload still happened
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

function setupInterceptionListener() {
  // Generate a per-page-load nonce. inject.js must echo this nonce back
  // in every ABLE_INTERCEPT message. The nonce is random per page load
  // and never crosses origins, so page scripts can't predict or replay it.
  const pageNonce = crypto.getRandomValues(new Uint8Array(16));
  pageNonceHex = Array.from(pageNonce).map((b) => b.toString(16).padStart(2, "0")).join("");

  window.addEventListener("message", async (event) => {
    if (event.data?.source !== "ABLE_INJECT") return;

    if (event.data.type === "ABLE_READY") {
      injectReadyReceived = true;
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
      const { requestId, fileInfos } = event.data.payload;
      if (!requestId || !fileInfos || fileInfos.length === 0) return;
      await handleInterceptedFiles(fileInfos, requestId);
    }

    if (event.data.type === "ABLE_TEXT_CHECK") {
      // inject.js intercepted an Enter key in a text input.
      // Scan the text for sensitive patterns and return a decision.
      if (event.data.nonce !== pageNonceHex) {
        console.warn("ABLE: Rejecting ABLE_TEXT_CHECK with invalid nonce.");
        return;
      }
      const { checkId, text, inputType, url } = event.data.payload || {};
      if (!checkId || !text) return;

      // Scan the text asynchronously
      handleTextCheck(checkId, text, inputType, url);
    }

    if (event.data.type === "ABLE_TEXT_BLOCKED") {
      // inject.js blocked an Enter key because we detected sensitive content.
      // The egress event was already logged in handleTextCheck.
      console.debug("ABLE: Text send blocked by pattern detection.");
      return;
    }

    if (event.data.type === "ABLE_TIMEOUT") {
      // inject.js timed out waiting for content.js to respond.
      // Log the egress event with whatever info we have.
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
      // Nonce handshake failed — upload bypassed interception entirely.
      // Log the egress event so the upload is still recorded.
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
      // A file input detected a file selection. This is informational —
      // the actual upload will be intercepted via fetch/XHR wrapping.
      // Log for diagnostic purposes when debugging site-specific issues.
      console.debug("ABLE: File selection detected:", event.data.payload);
      return;
    }

    if (event.data.type === "ABLE_ATTACH_BUTTON_CLICKED") {
      // An attachment button was clicked. The file input may be created
      // transiently after this click. Log for diagnostics.
      console.debug("ABLE: Attach button clicked:", event.data.payload);
      return;
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

  // Skip excluded domains
  if (isExcludedDomain()) return null;

  // Debounce: Don't log the same domain within the configured window
  const DEBOUNCE_KEY = `able:last_visit:${domainStatus.domain}`;
  const debounceMs = ABLERuntimeSettings.get("logging.visit_debounce_ms", 5000);
  try {
    const result = await chrome.storage.session.get(DEBOUNCE_KEY);
    const lastVisit = result[DEBOUNCE_KEY];

    if (lastVisit && Date.now() - lastVisit < debounceMs) {
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
    // Check if extension context is still valid
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
