/**
 * ABLE Extension - Intercept Modal
 *
 * File upload intercept modal with risk score visualization.
 */

function showInterceptModal(data) {
  removeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "able-modal-backdrop";

  const statusLabel = data.status === "unsafe" ? "Unsafe" : "Unlisted";
  const totalWeight = data.flaggedItems.reduce((sum, item) => sum + item.weight, 0);

  const stops = [];
  let currentAngle = 0;

  for (const item of data.flaggedItems) {
    const sliceAngle = totalWeight > 0 ? (item.weight / totalWeight) * 360 : 0;
    const color = PIE_COLORS[item.label] || "var(--score-orange)";
    if (sliceAngle > 0) {
      stops.push(`${color} ${currentAngle}deg ${currentAngle + sliceAngle}deg`);
    }
    currentAngle += sliceAngle;
  }

  const gapEnd = Math.min(currentAngle + 11, 360);

  const gradient = `conic-gradient(
  ${stops.join(",\n  ")},
  var(--dark-gray) ${currentAngle}deg ${gapEnd}deg,
  var(--track-gray) ${gapEnd}deg 360deg
)`;

  backdrop.innerHTML = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">HOLD IT RIGHT THERE!</h1>
        <div class="able-score-ring-wrapper" role="button" tabindex="0">
          <div class="able-score-ring-chart" style="background: ${gradient};">
            <div class="able-score-ring-inner">
              <span class="able-score-percentage">${data.score}%</span>
              <span class="able-score-label">Risk Score</span>
            </div>
          </div>
        </div>
        <div class="able-modal-body">
          <p>
            ABLE has detected sensitive information from
            "<span class="able-highlight-text">${data.fileName}</span>" that is being uploaded into
            <span class="able-highlight-text">${data.websiteName}</span>.
            Please be informed that the website is marked as
            <span class="able-highlight-text">${statusLabel}</span> by our security team
            and sending this file may expose your information to these third-party services.
            Please consider whether this upload is necessary or use our verified alternative service instead.
          </p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableProceedBtn">I Understand the Risk, But I Wish to Proceed.</button>
          <button class="able-btn able-btn-cancel" id="ableCancelBtn">Cancel</button>
        </div>
      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;

  document.documentElement.appendChild(backdrop);
  applyZoomCompensation(backdrop);

  backdrop.querySelector("#ableProceedBtn").addEventListener("click", async () => {
    await setSessionConsent();
    sendDecision(data.requestId, "proceed");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "proceeded",
      userAction: "proceeded",
    });
    removeModal();
  });

  backdrop.querySelector("#ableCancelBtn").addEventListener("click", () => {
    sendDecision(data.requestId, "cancel");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
    });
    removeModal();
  });

  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      sendDecision(data.requestId, "cancel");
      logEgressEvent({
        domain: data.domain,
        fileName: data.fileName,
        fileSize: data.fileSize,
        riskScore: data.score,
        action: "denied",
        userAction: "cancelled",
      });
      removeModal();
    }
  });

  backdrop.querySelector(".able-score-ring-wrapper").addEventListener("click", () => {
    showInterceptScoreDetails(data);
  });
}

function showInterceptScoreDetails(data) {
  const modalCard = document.querySelector(".able-modal-card");
  if (!modalCard) return;

  const totalWeight = data.flaggedItems.reduce((sum, item) => sum + item.weight, 0);

  const itemsHtml = data.flaggedItems.map((item) => {
    const color = PIE_COLORS[item.label] || "var(--score-orange)";
    const pct = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(0) : 0;
    return `
      <div class="able-detail-item">
        <span class="able-detail-swatch" style="background: ${color};"></span>
        <span class="able-detail-label"><span class="able-highlight-text">${item.label}</span></span>
        <span class="able-detail-count">x<span class="able-highlight-text">${item.count}</span></span>
        <span class="able-detail-weight">+<span class="able-highlight-text">${item.weight}</span></span>
        <span class="able-detail-pct"><span class="able-highlight-text">${pct}%</span></span>
      </div>`;
  }).join("");

  modalCard.innerHTML = `
    <div class="able-banner-edge"></div>
    <div class="able-modal-content">
      <h1 class="able-modal-title">SCORE BREAKDOWN</h1>
      <div class="able-detail-list">${itemsHtml}</div>
      <div class="able-detail-total">
        <span>Total Risk Score</span>
        <span class="able-detail-total-score"><span class="able-highlight-text">${data.score}%</span></span>
      </div>
      <div class="able-modal-actions">
        <button class="able-btn able-btn-proceed" id="ableDetailBackBtn">Back to Warning</button>
        <button class="able-btn able-btn-cancel" id="ableDetailCancelBtn">Cancel Upload</button>
      </div>
    </div>
    <div class="able-banner-edge"></div>
  `;

  document.querySelector("#ableDetailBackBtn").addEventListener("click", () => {
    showInterceptModal(data);
  });

  document.querySelector("#ableDetailCancelBtn").addEventListener("click", () => {
    sendDecision(data.requestId, "cancel");
    logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
    });
    removeModal();
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEInterceptModal = {
    showInterceptModal,
    showInterceptScoreDetails,
  };
}
