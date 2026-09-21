/**
 * ABLE Extension - Repeat Visit Modal
 *
 * Modal shown on repeat visits to unsafe/unlisted domains.
 */

function showRepeatVisitModal(data) {
  var html = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">BEFORE YOU PROCEED</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>
            You have visited <span class="able-highlight-text">${data.domain}</span>
            for <span class="able-highlight-text">${data.visitCount} time${data.visitCount !== 1 ? 's' : ''}</span> now.
            The ABLE security team is still marking this site as <span class="able-highlight-text">${data.status}</span>.
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

  var mounted = (typeof ABLEModalContainer !== "undefined")
    ? ABLEModalContainer.renderModalIntoShadow(html)
    : null;

  var backdrop = mounted ? mounted.backdrop : null;
  if (!backdrop) {
    removeModal();
    backdrop = document.createElement("div");
    backdrop.className = "able-modal-backdrop";
    backdrop.innerHTML = html;
    (document.documentElement || document.body).appendChild(backdrop);
  }

  backdrop.querySelector("#ableRepeatDismiss").addEventListener("click", async () => {
    await setLastModalShownTime();
    await incrementInteractionCount();
    removeModal();
  });

  var handleKeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setLastModalShownTime();
      incrementInteractionCount();
      removeModal();
      window.removeEventListener("keydown", handleKeydown);
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  window.addEventListener("keydown", handleKeydown);
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERepeatVisitModal = {
    showRepeatVisitModal,
  };
}
