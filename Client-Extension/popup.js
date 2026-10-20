/**
 * ABLE Extension - Popup Script
 * Handles domain detection, classification, and UI updates
 */

// DOM Elements
const statusBadge = document.querySelector(".status-pill");
const statusText = document.getElementById("statusText");
const statusValue = document.getElementById("statusValue");
const domainValue = document.getElementById("domainValue");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const messageSuggestion = document.getElementById("messageSuggestion");
const container = document.querySelector(".container");
const domainCard = document.querySelector(".info-card");

// Last domain rendered in the popup, used to avoid resetting the access
// request form while the user is typing in it.
let lastRenderedDomain = null;

/**
 * Get the current active tab and its URL
 */
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tab;
  } catch (error) {
    console.error("Error getting current tab:", error);
    return null;
  }
}

/**
 * Extract domain from URL for display
 */
function formatDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Update UI based on classification result
 */
function updateUI(classification) {
  const { status, domain, category, alternatives, block_access } = classification;
  const isBlocked = block_access === true;
  const effectiveStatus = isBlocked ? "blocked" : status;
  const messages = getStatusMessage(effectiveStatus, domain, category, alternatives);

  // Update container class for styling
  container.className = `container status-${effectiveStatus}`;

  // Update status badge
  statusText.textContent = "Status: Active";

  // Update domain card
  domainValue.textContent = domain;
  statusValue.textContent = isBlocked
    ? "Blocked"
    : status.charAt(0).toUpperCase() + status.slice(1);

  // Update message card
  messageTitle.innerHTML = messages.title;
  messageBody.innerHTML = (messages.message || "").replace(/\n/g, "<br>");
  if (messageSuggestion) {
    messageSuggestion.textContent = messages.suggestion || "";
  }

  // Only offer the request-access path on an administratively blocked site.
  // The form is only reset when the classified domain actually changes, so a
  // background tab finishing its load cannot wipe a half-typed request.
  const requestAccessBtn = document.getElementById("requestAccessBtn");
  const requestAccessForm = document.getElementById("requestAccessForm");
  const requestAccessStatus = document.getElementById("requestAccessStatus");
  const domainChanged = lastRenderedDomain !== domain;
  lastRenderedDomain = domain;

  if (requestAccessBtn) {
    requestAccessBtn.hidden = !isBlocked;
  }
  if (requestAccessForm && domainChanged) {
    requestAccessForm.hidden = true;
  }
  if (requestAccessStatus && domainChanged) {
    requestAccessStatus.textContent = "";
    requestAccessStatus.className = "request-access-status";
  }

  // Add animation
  animateUpdate();
}

/**
 * Animate the card updates
 */
function animateUpdate() {
  domainCard.style.opacity = "0";
  domainCard.style.transform = "translateY(-10px)";
  
  setTimeout(() => {
    domainCard.style.transition = "all 0.3s ease-out";
    domainCard.style.opacity = "1";
    domainCard.style.transform = "translateY(0)";
  }, 10);

  // Reset transition after animation
  setTimeout(() => {
    domainCard.style.transition = "";
  }, 350);
}

/**
 * Handle special cases (chrome://, about://, etc.)
 */
function isSpecialPage(url) {
  const specialProtocols = [
    "chrome://",
    "about://",
    "edge://",
    "firefox://",
    "opera://",
    "data:",
    "blob:"
  ];

  return specialProtocols.some(protocol => url.startsWith(protocol));
}

/**
 * Initialize extension and analyze current page
 */
async function initializeExtension() {
  try {
    const tab = await getCurrentTab();

    if (!tab || !tab.url) {
      showErrorState("Unable to detect page URL");
      return;
    }

    // Check for special pages
    if (isSpecialPage(tab.url)) {
      showSpecialPageState(tab.url);
      return;
    }

    let classification;

    // Try server classification via background script
    try {
      classification = await chrome.runtime.sendMessage({
        type: "classifyDomain",
        url: tab.url,
      });
    } catch (bgError) {
      console.warn("Background script unavailable:", bgError);
    }

    // If background script failed, use default classification
    if (!classification) {
      const domain = formatDomain(tab.url);
      classification = getDefaultClassification(domain);
      const messages = getStatusMessage(
        classification.status,
        classification.domain,
        classification.category,
        classification.alternatives
      );
      classification.title = messages.title;
      classification.message = messages.message;
      classification.source = "default";
    }

    // Update UI with results
    updateUI(classification);

    // Log for debugging
    console.log("Domain Classification:", classification);
  } catch (error) {
    console.error("Error initializing extension:", error);
    showErrorState("An error occurred while analyzing the page");
  }
}

/**
 * Show error state in UI
 */
function showErrorState(errorMessage) {
  container.className = "container status-unlisted";
  statusText.textContent = "Status: Active";
  messageTitle.textContent = "Unable to Analyze";
  messageBody.textContent = errorMessage;
  messageSuggestion.textContent = "Please try refreshing the page or checking your browser permissions.";
  domainValue.textContent = "Unknown";
  statusValue.textContent = "Error";
}

/**
 * Show state for special/protected pages
 */
function showSpecialPageState(url) {
  container.className = "container status-safe";
  statusText.textContent = "Status: Active";
  
  const pageType = url.split("://")[0].toUpperCase() || "System";
  
  messageTitle.textContent = `${pageType} Page`;
  messageBody.textContent = "This is a protected system page. Your browser automatically secures these pages.";
  messageSuggestion.textContent = "You can safely navigate browser settings and built-in features.";
  domainValue.textContent = pageType;
  statusValue.textContent = "Protected";
}

/**
 * Show notice when the greeting overlay cannot be injected
 */
function showGreetingUnavailableNotice() {
  if (messageTitle) {
    messageTitle.textContent = "Greeting Unavailable Here";
  }
  if (messageBody) {
    messageBody.textContent = "Open any website, then use this link again to view the greeting.";
  }
  if (messageSuggestion) {
    messageSuggestion.textContent = "";
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for tab changes
  chrome.tabs.onActivated.addListener(() => {
    initializeExtension();
  });

  // Listen for tab URL changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      initializeExtension();
    }
  });

  const viewGreetingLink = document.getElementById("viewGreetingLink");
  if (viewGreetingLink) {
    viewGreetingLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "openWelcomePage" }, (response) => {
          if (chrome.runtime.lastError) {
            showErrorState("Unable to display the greeting on this page");
            return;
          }
          if (response && response.success === false && response.reason === "no-injectable-tab") {
            showGreetingUnavailableNotice();
          }
        });
      }
    });
  }

  // File the access request from the popup itself, so the user never has to
  // leave the blocked site for the message board.
  const requestAccessBtn = document.getElementById("requestAccessBtn");
  const requestAccessForm = document.getElementById("requestAccessForm");
  const requestAccessAlias = document.getElementById("requestAccessAlias");
  const requestAccessReasons = document.getElementById("requestAccessReasons");
  const requestAccessStatus = document.getElementById("requestAccessStatus");
  const requestAccessSubmit = document.getElementById("requestAccessSubmit");

  if (requestAccessBtn && requestAccessForm) {
    requestAccessBtn.addEventListener("click", () => {
      requestAccessForm.hidden = false;
      if (requestAccessReasons) requestAccessReasons.focus();
    });
  }

  if (requestAccessSubmit) {
    requestAccessSubmit.addEventListener("click", () => {
      const reasons = String(
        (requestAccessReasons && requestAccessReasons.value) || "",
      ).trim();
      const author = String(
        (requestAccessAlias && requestAccessAlias.value) || "",
      ).trim();
      const domain = domainValue ? domainValue.textContent : "";

      if (!reasons) {
        if (requestAccessStatus) {
          requestAccessStatus.textContent =
            "Please describe why you need access.";
          requestAccessStatus.className = "request-access-status error";
        }
        return;
      }

      requestAccessSubmit.disabled = true;
      if (requestAccessStatus) {
        requestAccessStatus.textContent = "Submitting your request...";
        requestAccessStatus.className = "request-access-status";
      }

      chrome.runtime.sendMessage(
        {
          type: "submitAccessRequest",
          author: author || null,
          domain: domain,
          message: reasons,
        },
        (response) => {
          requestAccessSubmit.disabled = false;

          if (chrome.runtime.lastError || !response || !response.success) {
            if (requestAccessStatus) {
              requestAccessStatus.textContent =
                "Could not submit your request. Please try again.";
              requestAccessStatus.className = "request-access-status error";
            }
            return;
          }

          if (requestAccessForm) requestAccessForm.hidden = true;
          if (requestAccessBtn) requestAccessBtn.hidden = true;
          if (requestAccessStatus) {
            requestAccessStatus.textContent =
              "Request sent. An administrator will review it.";
            requestAccessStatus.className = "request-access-status success";
          }
        },
      );
    });
  }
}

/**
 * Surface a persistent warning when server signature verification is
 * failing (see security.js noteSignatureFailure). Without this the
 * extension silently degrades to defaults and looks "broken".
 */
async function refreshSyncWarning() {
  const warning = document.getElementById("syncWarning");
  const warningText = document.getElementById("syncWarningText");
  if (!warning || !warningText || typeof ABLEStorage === "undefined") return;

  try {
    const result = await chrome.storage.local.get(ABLEStorage.SIGNATURE_FAILURE);
    const failure = result[ABLEStorage.SIGNATURE_FAILURE];

    if (failure) {
      const when = new Date(failure.last_failed_at || Date.now()).toLocaleString();
      warningText.textContent =
        "Data from the server is being rejected because its signing key does not " +
        `match this extension (${failure.count || "?"} failed checks, last: ${when}). ` +
        "Policies, risk scoring and telemetry sync are degraded until an administrator " +
        "aligns the server's ABLE_SIGNING_KEY with the extension build.";
      warning.hidden = false;
    } else {
      warning.hidden = true;
    }
  } catch {
    warning.hidden = true;
  }
}

/**
 * Surface a warning when an asset fails its integrity check.
 *
 * The check is re-run on demand rather than remembered, so nothing is
 * written to storage and the answer always reflects the current file.
 */
async function refreshIntegrityWarning() {
  const warning = document.getElementById("integrityWarning");
  const warningText = document.getElementById("integrityWarningText");
  if (!warning || !warningText) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: "checkIntegrity" });
    if (!response || !response.success || !Array.isArray(response.results)) {
      warning.hidden = true;
      return;
    }

    const failed = response.results.filter((result) => !result.ok);
    if (failed.length === 0) {
      warning.hidden = true;
      return;
    }

    warningText.textContent =
      "The extension's " +
      failed.map((result) => result.asset.replace("_", " ")).join(" and ") +
      " file does not match its expected hash. Upload interception is " +
      "degraded until the extension is reinstalled or the expected hash is " +
      "regenerated.";
    warning.hidden = false;
  } catch {
    warning.hidden = true;
  }
}

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initial analysis
  initializeExtension();

  // Surface any signature-verification failures
  refreshSyncWarning();
  refreshIntegrityWarning();

  // Set up event listeners
  setupEventListeners();
});

/**
 * Handle visibility changes (when popup is shown/hidden)
 */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    initializeExtension();
    refreshSyncWarning();
    refreshIntegrityWarning();
  }
});
