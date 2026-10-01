/**
 * ABLE Extension - Text Warning Modal
 *
 * Warning modal for sensitive content detected in text input.
 */

function showTextWarningModal(data) {
  var html = `
    <div class="able-intercept-modal">
      <div class="able-intercept-header" style="background: #d32f2f;">
        <span class="able-intercept-title">Sensitive Content Detected</span>
      </div>
      <div class="able-intercept-body">
        <p style="margin: 0 0 12px; font-size: 14px; color: #333333;">
          The text you're about to send contains <strong class="able-highlight-text">sensitive information</strong> that may violate your organization's data protection policy.
        </p>
        <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #e65100;">
          <strong>Risk Score: ${data.totalScore}/100</strong><br>
          Domain: ${escapeHtml(data.domain)}
        </div>
        <div style="font-size: 12px; color: #666666; margin-bottom: 16px;">
          <strong>Detected patterns:</strong>
          <ul style="margin: 4px 0; padding-left: 20px;">
            ${data.flaggedItems.map(item => `<li>${escapeHtml(item.label)} (${item.count} matches)</li>`).join("")}
          </ul>
        </div>
      </div>
      <div class="able-intercept-footer">
        <button class="able-btn able-btn-cancel" id="able-text-cancel">Cancel Send</button>
        <button class="able-btn able-btn-proceed" id="able-text-proceed">Send Anyway</button>
      </div>
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

  backdrop.querySelector("#able-text-cancel").addEventListener("click", function () {
    removeModal();
    var activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
      activeElement.value = "";
    } else if (activeElement && activeElement.isContentEditable) {
      activeElement.innerText = "";
    }
  });

  backdrop.querySelector("#able-text-proceed").addEventListener("click", function () {
    removeModal();
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLETextWarningModal = {
    showTextWarningModal,
  };
}
