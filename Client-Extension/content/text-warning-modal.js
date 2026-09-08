/**
 * ABLE Extension - Text Warning Modal
 *
 * Warning modal for sensitive content detected in text input.
 */

function showTextWarningModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  const card = document.createElement("div");
  card.className = "able-intercept-modal";
  card.innerHTML = `
    <div class="able-intercept-header" style="background: #d32f2f;">
      <span class="able-intercept-title">Sensitive Content Detected</span>
    </div>
    <div class="able-intercept-body">
      <p style="margin: 0 0 12px; font-size: 14px; color: #333;">
        The text you're about to send contains <strong>sensitive information</strong> that may violate your organization's data protection policy.
      </p>
      <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #e65100;">
        <strong>Risk Score: ${data.totalScore}/100</strong><br>
        Domain: ${data.domain}
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 16px;">
        <strong>Detected patterns:</strong>
        <ul style="margin: 4px 0; padding-left: 20px;">
          ${data.flaggedItems.map(item => `<li>${item.label} (${item.count} matches)</li>`).join("")}
        </ul>
      </div>
    </div>
    <div class="able-intercept-footer">
      <button class="able-btn able-btn-cancel" id="able-text-cancel">Cancel Send</button>
      <button class="able-btn able-btn-proceed" id="able-text-proceed">Send Anyway</button>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  applyZoomCompensation(backdrop);

  document.getElementById("able-text-cancel").addEventListener("click", function () {
    removeModal();
    var activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
      activeElement.value = "";
    } else if (activeElement.isContentEditable) {
      activeElement.innerText = "";
    }
  });

  document.getElementById("able-text-proceed").addEventListener("click", function () {
    removeModal();
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLETextWarningModal = {
    showTextWarningModal,
  };
}
