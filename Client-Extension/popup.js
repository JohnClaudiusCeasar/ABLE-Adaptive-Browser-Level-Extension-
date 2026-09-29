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
  const { status, domain, category, alternatives } = classification;
  const messages = getStatusMessage(status, domain, category, alternatives);

  // Update container class for styling
  container.className = `container status-${status}`;

  // Update status badge
  statusText.textContent = "Status: Active";

  // Update domain card
  domainValue.textContent = domain;
  statusValue.textContent = status.charAt(0).toUpperCase() + status.slice(1);

  // Update message card
  messageTitle.innerHTML = messages.title;
  messageBody.innerHTML = (messages.message || "").replace(/\n/g, "<br>");
  if (messageSuggestion) {
    messageSuggestion.textContent = messages.suggestion || "";
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
}

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initial analysis
  initializeExtension();

  // Set up event listeners
  setupEventListeners();
});

/**
 * Handle visibility changes (when popup is shown/hidden)
 */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    initializeExtension();
  }
});
