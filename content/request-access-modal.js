/**
 * ABLE Extension - Request Access Modal
 *
 * In-page form shown when the user presses "Request Access" on the
 * blocked-access modal. The request is submitted to the research server
 * from the current tab, so the user never leaves the blocked site.
 * Shares the exact markup and styling of the other ABLE modals.
 */

function escapeRequestText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render the request-access form for a blocked domain.
 */
function showRequestAccessModal(data) {
  var domain = escapeRequestText(
    data && data.domain ? data.domain : window.location.hostname
  );

  var html = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">REQUEST ACCESS</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>
            You are requesting access to <span class="able-highlight-text">${domain}</span>.
            Describe why you need it and an administrator will review your request.
          </p>
        </div>
        <div class="able-request-form">
          <label class="able-request-field">
            <span class="able-request-label">Name or alias (optional)</span>
            <input class="able-request-input" id="ableRequestAlias" type="text" maxlength="32" placeholder="e.g. Auditor7" />
          </label>
          <label class="able-request-field">
            <span class="able-request-label">Reasons for access</span>
            <textarea class="able-request-textarea" id="ableRequestReasons" maxlength="800" placeholder="Type your reasons for access to this application..."></textarea>
          </label>
          <p class="able-request-status" id="ableRequestStatus"></p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableRequestSubmit">Submit Request</button>
          <button class="able-btn able-btn-cancel" id="ableRequestCancel">Cancel</button>
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

  var aliasInput = backdrop.querySelector("#ableRequestAlias");
  var reasonsInput = backdrop.querySelector("#ableRequestReasons");
  var statusEl = backdrop.querySelector("#ableRequestStatus");
  var submitBtn = backdrop.querySelector("#ableRequestSubmit");

  backdrop.querySelector("#ableRequestCancel").addEventListener("click", function () {
    // The site is still blocked, so return to the blocked modal.
    showBlockedAccessModal({ domain: data && data.domain ? data.domain : window.location.hostname });
  });

  submitBtn.addEventListener("click", function () {
    var reasons = String((reasonsInput && reasonsInput.value) || "").trim();
    var author = String((aliasInput && aliasInput.value) || "").trim();

    if (!reasons) {
      statusEl.textContent = "Please describe why you need access.";
      statusEl.className = "able-request-status error";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Submitting your request...";
    statusEl.className = "able-request-status";

    chrome.runtime.sendMessage({
      type: "submitAccessRequest",
      author: author || null,
      domain: data && data.domain ? data.domain : window.location.hostname,
      message: reasons,
    }, function (response) {
      if (chrome.runtime.lastError || !response || !response.success) {
        submitBtn.disabled = false;
        statusEl.textContent = "Could not submit your request. Please try again.";
        statusEl.className = "able-request-status error";
        return;
      }

      showRequestAccessSuccess(data && data.domain ? data.domain : window.location.hostname);
    });
  });
}

/**
 * Confirmation shown once the request reached the server.
 */
function showRequestAccessSuccess(domain) {
  var safeDomain = escapeRequestText(domain);

  var html = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">REQUEST SENT</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>
            Your access request for <span class="able-highlight-text">${safeDomain}</span>
            has been received and is pending review by an administrator.
          </p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableRequestDone">Close</button>
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

  backdrop.querySelector("#ableRequestDone").addEventListener("click", function () {
    // The site stays blocked until an administrator approves the request.
    showBlockedAccessModal({ domain: domain });
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERequestAccessModal = {
    showRequestAccessModal,
    showRequestAccessSuccess,
  };
}
