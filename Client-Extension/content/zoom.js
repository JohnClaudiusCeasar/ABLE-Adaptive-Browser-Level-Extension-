/**
 * ABLE Extension - Zoom Compensation
 *
 * Detects browser zoom level and applies counter-scaling to modals
 * so they remain visually static regardless of zoom.
 */

function getZoomLevel() {
  if (window.visualViewport && window.visualViewport.scale) {
    return window.visualViewport.scale;
  }
  if (window.outerWidth && window.innerWidth) {
    return window.outerWidth / window.innerWidth;
  }
  return 1;
}

function applyZoomCompensation(backdrop) {
  const zoom = getZoomLevel();
  const counterScale = 1 / zoom;
  backdrop.style.transform = `scale(${counterScale})`;
}

function updateActiveModalZoom() {
  const backdrop = document.querySelector('.able-modal-backdrop');
  if (backdrop) {
    applyZoomCompensation(backdrop);
  }
}

function initZoomListener() {
  window.addEventListener('resize', updateActiveModalZoom);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateActiveModalZoom);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEZoom = {
    getZoomLevel,
    applyZoomCompensation,
    updateActiveModalZoom,
    initZoomListener,
  };
}
