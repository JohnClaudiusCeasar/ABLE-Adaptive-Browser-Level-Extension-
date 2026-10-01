/**
 * ABLE Extension - Modal Container
 *
 * Encapsulates all modals inside an isolated Shadow DOM container
 * to prevent host page CSS bleed and rem font scaling issues across domains.
 */

var ABLE_MODAL_HOST_ID = "able-modal-root";

// Per-modal cleanup callbacks (e.g. window keydown listeners) so removing a
// modal also tears down its global listeners, preventing stale re-fires.
var modalCleanupFns = [];

function registerModalCleanup(fn) {
  if (typeof fn === "function") {
    modalCleanupFns.push(fn);
  }
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

var MODAL_STYLES = `
:host {
  all: initial;
}

:root,
.able-modal-backdrop {
  --brand-green: #00FF44;
  --score-orange: #FFB900;
  --track-gray: #E2E2E2;
  --dark-gray: #B0B0B0;
  --text-black: #000000;
  --bg-white: #FFFFFF;
  --proceed-bg: #FFE7D1;
  --proceed-border: #FFC99E;
  --cancel-bg: #FBCBCB;
  --cancel-border: #FFA3A3;
  --pie-cc: #EF4444;
  --pie-ssn: #06B6D4;
  --pie-api-key: #F59E0B;
  --pie-private-key: #F97316;
  --pie-password: #8B5CF6;
  --pie-db-string: #3B82F6;
}

.able-modal-backdrop {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  letter-spacing: normal;
  text-transform: none;
  box-sizing: border-box;
  color: #000000;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.able-modal-backdrop *,
.able-modal-backdrop *::before,
.able-modal-backdrop *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: inherit;
  letter-spacing: normal;
}

.able-modal-card {
  width: 360px;
  max-width: 90vw;
  max-height: 90vh;
  background-color: var(--bg-white, #FFFFFF);
  border-radius: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.able-banner-edge {
  width: 100%;
  height: 28px;
  background-color: var(--brand-green, #00FF44);
  flex-shrink: 0;
}

.able-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 22px 24px;
  text-align: center;
}

.able-modal-title {
  font-family: 'Unbounded', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 20px;
  color: var(--text-black, #000000);
  letter-spacing: -0.3px;
  margin-bottom: 0;
  line-height: 1.3;
}

.able-modal-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 12px;
  margin-bottom: 12px;
  user-select: none;
}

.able-modal-divider::before,
.able-modal-divider::after {
  content: '';
  flex: 1;
  height: 1.5px;
  background-color: var(--dark-gray, #B0B0B0);
}

.able-modal-divider-circle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--dark-gray, #B0B0B0);
  flex-shrink: 0;
}

.able-score-ring-wrapper {
  cursor: pointer;
  outline: none;
  transition: transform 0.2s ease;
  margin-top: 6px;
  margin-bottom: 6px;
}

.able-score-ring-wrapper:hover {
  transform: scale(1.03);
}

.able-score-ring-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
}

.able-score-ring-inner {
  width: 90px;
  height: 90px;
  background-color: var(--bg-white, #FFFFFF);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.able-score-percentage {
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 26px;
  color: var(--score-orange, #FFB900);
  line-height: 1;
}

.able-score-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-black, #000000);
  margin-top: 3px;
}

.able-modal-subtitle {
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-black, #000000);
  margin-top: 14px;
  margin-bottom: 14px;
  letter-spacing: -0.1px;
  line-height: 1.3;
}

.able-modal-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 18px;
  padding: 0 4px;
}

.able-modal-body p {
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-black, #000000);
  font-style: italic;
  margin: 0;
}

.able-modal-body br {
  display: none;
}

.able-highlight-text {
  font-weight: 700;
  font-style: normal;
}

.able-file-type-badge {
  display: inline-block;
  background: var(--brand-green, #00FF44);
  color: #000000;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
  margin-left: 4px;
  font-style: normal;
}

.able-modal-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 10px;
}

.able-detail-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 0;
}

.able-detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1.4;
}

.able-detail-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.able-detail-label {
  flex: 1;
  text-align: left;
  font-weight: 600;
  color: var(--text-black, #000000);
}

.able-detail-count {
  font-size: 12px;
  color: var(--dark-gray, #B0B0B0);
  min-width: 28px;
  text-align: right;
}

.able-detail-weight {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-black, #000000);
  min-width: 30px;
  text-align: right;
}

.able-detail-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--score-orange, #FFB900);
  min-width: 36px;
  text-align: right;
}

.able-detail-total {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  margin-bottom: 10px;
  border-top: 1px solid var(--track-gray, #E2E2E2);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-black, #000000);
}

.able-detail-total-score {
  font-size: 18px;
  color: var(--score-orange, #FFB900);
}

.able-btn {
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-black, #000000);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: filter 0.15s ease;
  line-height: normal;
  text-align: center;
  box-sizing: border-box;
}

.able-btn:hover {
  filter: brightness(0.97);
}

.able-btn-proceed {
  width: 100%;
  background-color: var(--proceed-bg, #FFE7D1);
  border-color: var(--proceed-border, #FFC99E);
  padding: 10px 18px;
  border-radius: 14px;
}

.able-btn-cancel {
  width: 50%;
  background-color: var(--cancel-bg, #FBCBCB);
  border-color: var(--cancel-border, #FFA3A3);
  padding: 8px 18px;
  border-radius: 16px;
}

/* Text Warning Modal styles */
.able-intercept-header {
  width: 100%;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}

.able-intercept-title {
  font-family: 'Unbounded', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: #ffffff;
  text-align: center;
}

.able-intercept-modal {
  width: 360px;
  max-width: 90vw;
  max-height: 90vh;
  background-color: var(--bg-white, #FFFFFF);
  border-radius: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.able-intercept-body {
  padding: 20px 24px;
  flex-grow: 1;
}

.able-intercept-footer {
  display: flex;
  gap: 10px;
  padding: 16px 24px;
  justify-content: center;
}

.able-intercept-footer .able-btn-proceed,
.able-intercept-footer .able-btn-cancel {
  width: 50%;
}

/* Greeting Modal (Install Introduction) */
.able-modal-card.able-modal-large {
  width: 660px;
  max-width: 94vw;
  max-height: 92vh;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-white, #FFFFFF);
}

.able-greeting-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 32px;
  width: 100%;
  max-height: calc(92vh - 56px);
  overflow-y: auto;
  box-sizing: border-box;
}

.able-greeting-container::-webkit-scrollbar {
  width: 7px;
}

.able-greeting-container::-webkit-scrollbar-track {
  background: #F1F1F1;
  border-radius: 4px;
}

.able-greeting-container::-webkit-scrollbar-thumb {
  background: #C4C4C4;
  border-radius: 4px;
}

.able-greeting-container::-webkit-scrollbar-thumb:hover {
  background: #9E9E9E;
}

.able-greeting-logo-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
}

.able-greeting-logo {
  width: 68px;
  height: 68px;
  border-radius: 16px;
  object-fit: contain;
  background: #000000;
  padding: 6px;
  border: 2px solid var(--brand-green, #00FF44);
  box-shadow: 0 6px 18px rgba(0, 255, 68, 0.28);
}

.able-greeting-title {
  font-family: 'Unbounded', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-black, #000000);
  letter-spacing: -0.5px;
  line-height: 1.15;
  margin: 0;
  text-align: center;
}

.able-greeting-highlight {
  color: #00C834;
}

.able-greeting-subtitle {
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #666666;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-top: 4px;
  margin-bottom: 8px;
  text-align: center;
}

.able-greeting-sections {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
  margin-top: 8px;
  margin-bottom: 22px;
}

.able-greeting-section {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 14px;
  padding: 16px 20px;
  transition: border-color 0.15s ease;
}

.able-greeting-section:hover {
  border-color: #D1D5DB;
}

.able-greeting-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.able-greeting-section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--brand-green, #00FF44);
  color: #000000;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}

.able-greeting-section-title {
  font-family: 'Unbounded', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #111827;
  margin: 0;
  letter-spacing: -0.2px;
}

.able-greeting-section-body {
  font-family: 'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13.5px;
  line-height: 1.55;
  color: #374151;
}

.able-greeting-section-body p {
  margin-bottom: 8px;
  font-style: normal;
}

.able-greeting-section-body p:last-child {
  margin-bottom: 0;
}

.able-greeting-list {
  list-style: none;
  padding: 0;
  margin: 6px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.able-greeting-list-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
}

.able-greeting-bullet {
  color: #00B32D;
  font-weight: bold;
  font-size: 14px;
  line-height: 1.3;
  flex-shrink: 0;
}

.able-greeting-code {
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: #E5E7EB;
  padding: 1px 5px;
  border-radius: 4px;
  color: #111827;
}

.able-greeting-disclaimer-box {
  background: #FFFDF5;
  border: 1.5px solid #FDE68A;
}

.able-greeting-disclaimer-badge {
  background: #F59E0B;
  color: #FFFFFF;
}

.able-greeting-disclaimer-box .able-greeting-section-title {
  color: #92400E;
}

.able-greeting-disclaimer-box .able-greeting-section-body {
  color: #78350F;
  font-size: 12.5px;
  line-height: 1.5;
}

.able-greeting-footer {
  width: 100%;
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.able-greeting-btn {
  width: 100%;
  max-width: 340px;
  background-color: var(--brand-green, #00FF44);
  border: 1.5px solid #00DD3B;
  font-weight: 700;
  font-size: 15px;
  padding: 12px 28px;
  border-radius: 14px;
  color: #000000;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 255, 68, 0.3);
  transition: all 0.15s ease;
}

.able-greeting-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 255, 68, 0.38);
}
`;

function getModalShadowRoot() {
  var host = document.getElementById(ABLE_MODAL_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = ABLE_MODAL_HOST_ID;
    host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
    (document.documentElement || document.body).appendChild(host);
  }
  if (!host.shadowRoot) {
    var shadow = host.attachShadow({ mode: "open" });
    var styleEl = document.createElement("style");
    styleEl.textContent = MODAL_STYLES;
    shadow.appendChild(styleEl);
  }
  return host.shadowRoot;
}

function renderModalIntoShadow(htmlContent) {
  removeModal();
  var shadow = getModalShadowRoot();
  var host = document.getElementById(ABLE_MODAL_HOST_ID);
  if (host) host.style.pointerEvents = "auto";

  var backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";
  backdrop.innerHTML = htmlContent;
  shadow.appendChild(backdrop);
  return { shadowRoot: shadow, backdrop: backdrop };
}

function removeModal() {
  var cleanupFns = modalCleanupFns.splice(0);
  for (var i = 0; i < cleanupFns.length; i++) {
    try {
      cleanupFns[i]();
    } catch (e) {
      // Cleanup failures must not block modal removal.
    }
  }

  var host = document.getElementById(ABLE_MODAL_HOST_ID);
  if (host) {
    host.remove();
  }
  var legacy = document.querySelector(".able-modal-backdrop");
  if (legacy) {
    legacy.remove();
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEModalContainer = {
    getModalShadowRoot: getModalShadowRoot,
    renderModalIntoShadow: renderModalIntoShadow,
    removeModal: removeModal,
    registerModalCleanup: registerModalCleanup,
    escapeHtml: escapeHtml,
    MODAL_STYLES: MODAL_STYLES,
  };
  globalThis.removeModal = removeModal;
  globalThis.escapeHtml = escapeHtml;
}
