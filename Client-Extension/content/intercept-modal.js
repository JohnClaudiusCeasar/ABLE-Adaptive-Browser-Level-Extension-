/**
 * ABLE Extension - Intercept Modal
 *
 * File upload intercept modal with risk score visualization.
 *
 * The score ring and score breakdown markup are shared with the sensitive
 * content (text) modal via ABLEModalContainer so both surfaces stay identical.
 */

function showInterceptModal(data) {
  var statusLabel = data.status === "unsafe" ? "Unsafe"
    : data.status === "safe" ? "Safe"
    : "Unlisted";

  // A safe domain can still receive a risky upload: the warning is about the
  // file's contents, not the site's own classification.
  var statusSentence = data.status === "safe"
    ? ' Although the website is marked as <span class="able-highlight-text">Safe</span> by our security team, the file itself contains sensitive information that would leave your organization if uploaded.'
    : ' Please be informed that the website is marked as <span class="able-highlight-text">' + statusLabel + '</span> by our security team and sending this file may expose your information to these third-party services.';

  var html =
    '<div class="able-modal-card">' +
      '<div class="able-banner-edge"></div>' +
      '<div class="able-modal-content">' +
        '<h1 class="able-modal-title">HOLD IT RIGHT THERE!</h1>' +
        '<div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>' +
        ABLEModalContainer.buildScoreRingMarkup(data.score, data.flaggedItems) +
        '<div class="able-modal-body">' +
          '<p>' +
            'ABLE has detected sensitive information from' +
            ' "<span class="able-highlight-text">' + escapeHtml(data.fileName) + '</span>" that is being uploaded into' +
            ' <span class="able-highlight-text">' + escapeHtml(data.websiteName) + '</span>.' +
            statusSentence +
            ' Please consider whether this upload is necessary or use our verified alternative service instead.' +
          '</p>' +
        '</div>' +
        '<div class="able-modal-actions">' +
          '<button class="able-btn able-btn-proceed" id="ableProceedBtn">I Understand the Risk, But I Wish to Proceed.</button>' +
          '<button class="able-btn able-btn-cancel" id="ableCancelBtn">Cancel</button>' +
        '</div>' +
      '</div>' +
      '<div class="able-banner-edge"></div>' +
    '</div>';

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

  backdrop.querySelector("#ableProceedBtn").addEventListener("click", async function () {
    await setSessionConsent();
    sendDecision(data.requestId, "proceed");
    await logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "proceeded",
      userAction: "proceeded",
      contentHash: data.contentHash || null,
      scanDurationMs: data.scanDurationMs || null,
      contentSize: data.fileSize,
      flaggedItems: data.flaggedItems,
      scanToken: data.scanToken || null,
    });
    removeModal();
  });

  backdrop.querySelector("#ableCancelBtn").addEventListener("click", async function () {
    sendDecision(data.requestId, "cancel", { fileName: data.fileName, fileSize: data.fileSize });
    await logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
      contentHash: data.contentHash || null,
      scanDurationMs: data.scanDurationMs || null,
      contentSize: data.fileSize,
      flaggedItems: data.flaggedItems,
      scanToken: data.scanToken || null,
    });
    removeModal();
  });

  var handleKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      sendDecision(data.requestId, "cancel", { fileName: data.fileName, fileSize: data.fileSize });
      logEgressEvent({
        domain: data.domain,
        fileName: data.fileName,
        fileSize: data.fileSize,
        riskScore: data.score,
        action: "denied",
        userAction: "cancelled",
        contentHash: data.contentHash || null,
        scanDurationMs: data.scanDurationMs || null,
        contentSize: data.fileSize,
        flaggedItems: data.flaggedItems,
        scanToken: data.scanToken || null,
      });
      removeModal();
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  window.addEventListener("keydown", handleKeydown);
  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.registerModalCleanup) {
    ABLEModalContainer.registerModalCleanup(function () {
      window.removeEventListener("keydown", handleKeydown);
      backdrop.removeEventListener("keydown", handleKeydown);
    });
  }

  backdrop.querySelector(".able-score-ring-wrapper").addEventListener("click", function () {
    showInterceptScoreDetails(data);
  });
}

function showInterceptScoreDetails(data) {
  var shadow = (typeof ABLEModalContainer !== "undefined")
    ? ABLEModalContainer.getModalShadowRoot()
    : null;
  var modalCard = (shadow && shadow.querySelector(".able-modal-card")) || document.querySelector(".able-modal-card");
  if (!modalCard) return;

  modalCard.innerHTML =
    '<div class="able-banner-edge"></div>' +
    '<div class="able-modal-content">' +
      '<h1 class="able-modal-title">SCORE BREAKDOWN</h1>' +
      ABLEModalContainer.buildScoreBreakdownMarkup(data.score, data.flaggedItems) +
      '<div class="able-modal-actions">' +
        '<button class="able-btn able-btn-proceed" id="ableDetailBackBtn">Back to Warning</button>' +
        '<button class="able-btn able-btn-cancel" id="ableDetailCancelBtn">Cancel Upload</button>' +
      '</div>' +
    '</div>' +
    '<div class="able-banner-edge"></div>';

  modalCard.querySelector("#ableDetailBackBtn").addEventListener("click", function () {
    showInterceptModal(data);
  });

  modalCard.querySelector("#ableDetailCancelBtn").addEventListener("click", async function () {
    sendDecision(data.requestId, "cancel", { fileName: data.fileName, fileSize: data.fileSize });
    await logEgressEvent({
      domain: data.domain,
      fileName: data.fileName,
      fileSize: data.fileSize,
      riskScore: data.score,
      action: "denied",
      userAction: "cancelled",
      contentHash: data.contentHash || null,
      scanDurationMs: data.scanDurationMs || null,
      contentSize: data.fileSize,
      flaggedItems: data.flaggedItems,
      scanToken: data.scanToken || null,
    });
    removeModal();
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEInterceptModal = {
    showInterceptModal: showInterceptModal,
    showInterceptScoreDetails: showInterceptScoreDetails,
  };
}