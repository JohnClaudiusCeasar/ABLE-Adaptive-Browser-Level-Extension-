/**
 * ABLE Extension - Site Warning Modal
 *
 * Initial warning modal for unsafe/unlisted domains.
 */

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
  applyZoomCompensation(backdrop);

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

if (typeof globalThis !== "undefined") {
  globalThis.ABLESiteWarningModal = {
    showSiteWarningModal,
  };
}
