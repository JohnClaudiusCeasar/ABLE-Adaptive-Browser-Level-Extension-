/**
 * ABLE Extension - Zoom Compensation
 *
 * Keeps modals visually consistent across browser zoom and window sizing.
 */

function getZoomLevel() {
  return 1;
}

function applyZoomCompensation(backdrop) {
  if (backdrop && backdrop.style) {
    backdrop.style.transform = '';
  }
}

function updateActiveModalZoom() {
  // No-op: Modal layout is stably governed by CSS and Shadow DOM.
}

function initZoomListener() {
  // Maintained for interface compatibility.
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEZoom = {
    getZoomLevel,
    applyZoomCompensation,
    updateActiveModalZoom,
    initZoomListener,
  };
}
