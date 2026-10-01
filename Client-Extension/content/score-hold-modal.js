/**
 * ABLE Extension - Score Hold Modal
 *
 * Shown when the scoring server is unreachable or its verdict cannot be
 * verified. The upload is HELD: no proceed/cancel decision is issued to the
 * page until the server can properly score the file.
 *
 * Displays the tamper-secure offline pattern snapshot reference (the signed
 * "recently assigned criteria pattern data" file) when one is available. A
 * tampered snapshot is purged by readSignedOfflineCache and the reference
 * line is simply omitted.
 */

async function showScoreHoldModal(data) {
  var snapshotRef = "";
  try {
    if (typeof ABLERiskPatterns !== "undefined" && ABLERiskPatterns.readPatternSnapshot) {
      var snapshot = await ABLERiskPatterns.readPatternSnapshot();
      if (snapshot && snapshot.issued_at) {
        var issuedAt = new Date(snapshot.issued_at * 1000).toLocaleString();
        var patternCount = (snapshot.patterns || []).length;
        snapshotRef =
          '<p style="font-size: 12px; margin-top: 10px;">' +
            'Referencing criteria set issued at <span class="able-highlight-text">' + escapeHtml(issuedAt) + '</span>' +
            ' (' + patternCount + ' patterns)' +
          '</p>';
      }
    }
  } catch (e) {
    // Non-fatal — the modal renders without the reference line.
  }

  var html =
    '<div class="able-modal-card">' +
      '<div class="able-banner-edge"></div>' +
      '<div class="able-modal-content">' +
        '<h1 class="able-modal-title">UPLOAD HELD</h1>' +
        '<div class="able-modal-body">' +
          '<p>' +
            'ABLE cannot reach the risk scoring server right now, so' +
            ' "<span class="able-highlight-text">' + escapeHtml(data.fileName) + '</span>"' +
            ' cannot be scored before it is sent to' +
            ' <span class="able-highlight-text">' + escapeHtml(data.domain) + '</span>.' +
            ' This upload is on hold and <span class="able-highlight-text">will not proceed unscored</span>.' +
            ' Please retry once the connection is restored, or cancel the upload.' +
          '</p>' +
          snapshotRef +
        '</div>' +
        '<div class="able-modal-actions">' +
          '<button class="able-btn able-btn-proceed" id="ableHoldRetryBtn">Retry Scoring</button>' +
          '<button class="able-btn able-btn-cancel" id="ableHoldCancelBtn">Cancel Upload</button>' +
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

  backdrop.querySelector("#ableHoldRetryBtn").addEventListener("click", function () {
    if (typeof data.onRetry === "function") data.onRetry();
  });

  backdrop.querySelector("#ableHoldCancelBtn").addEventListener("click", function () {
    if (typeof data.onCancel === "function") data.onCancel();
  });

  // Escape cancels the held upload (mirrors the intercept modal behavior).
  var handleKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (typeof data.onCancel === "function") data.onCancel();
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
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEScoreHoldModal = {
    showScoreHoldModal: showScoreHoldModal,
  };
  globalThis.showScoreHoldModal = showScoreHoldModal;
}
