/**
 * ABLE Extension - Blocked Access Modal
 *
 * Non-dismissible "Sorry for the Inconvenience" modal shown when an admin
 * has enabled block_access on the domain's policy. Shares the exact markup
 * and styling of the other ABLE modals (site-warning, repeat-visit, ...).
 */

function escapeBlockedText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showBlockedAccessModal(data) {
  var domain = escapeBlockedText(data && data.domain ? data.domain : window.location.hostname);

  var html = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">SORRY FOR THE INCONVENIENCE</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>
            Access to <span class="able-highlight-text">${domain}</span>
            is <span class="able-highlight-text">BLOCKED</span> per administrator governance.
          </p>
          <p>
            This site has been classified as restricted by your IT security policy.
            Normal navigation and operations are disabled for institutional safety.
          </p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableBlockedRequestAccess">Request Access</button>
          <button class="able-btn able-btn-cancel" id="ableBlockedGoBack">Go Back</button>
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

  backdrop.querySelector("#ableBlockedRequestAccess").addEventListener("click", function () {
    chrome.runtime.sendMessage({
      type: "openMessageBoard",
      domain: data && data.domain ? data.domain : window.location.hostname,
    });
  });

  backdrop.querySelector("#ableBlockedGoBack").addEventListener("click", function () {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = (typeof SERVER_URL !== "undefined" ? SERVER_URL : "https://able-server-admin.onrender.com");
    }
  });

  // The blocked modal is intentionally not dismissible: swallow Escape so it
  // never reaches a cleanup handler that would remove the modal.
  var handleKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener("keydown", handleKeydown, true);
  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.registerModalCleanup) {
    ABLEModalContainer.registerModalCleanup(function () {
      window.removeEventListener("keydown", handleKeydown, true);
    });
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEBlockedAccessModal = {
    showBlockedAccessModal,
  };
}
