/**
 * ABLE Extension - Text Warning Modal
 *
 * Advisory shown when sensitive content is detected in a text field before
 * it is sent.
 *
 * Shares the extension's modal family with the intercept (file upload)
 * modal: green banner edges, Unbounded title, divider, clickable conic
 * score ring with a score breakdown drill-down, centred body copy and
 * stacked actions. The score ring and breakdown markup come from
 * ABLEModalContainer so both surfaces stay identical by construction.
 */

function showTextWarningModal(data) {
  // Captured while focus is still on the field the user typed into — once
  // the modal is up, focus may move into the shadow tree.
  var targetField = document.activeElement;
  var decided = false;

  var mainHtml =
    '<div class="able-banner-edge"></div>' +
    '<div class="able-modal-content">' +
      '<h1 class="able-modal-title">SENSITIVE CONTENT DETECTED</h1>' +
      '<div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>' +
      ABLEModalContainer.buildScoreRingMarkup(data.totalScore, data.flaggedItems) +
      '<div class="able-modal-body">' +
        '<p>' +
          'The text you are about to send to' +
          ' <span class="able-highlight-text">' + escapeHtml(data.domain) + '</span>' +
          ' contains <span class="able-highlight-text">sensitive information</span>' +
          ' that may violate your organization\'s data protection policy.' +
          ' Please review the detected patterns below before continuing.' +
        '</p>' +
      '</div>' +
      '<div class="able-modal-actions">' +
        '<button class="able-btn able-btn-proceed" id="ableTextProceedBtn">Send Anyway</button>' +
        '<button class="able-btn able-btn-cancel" id="ableTextCancelBtn">Cancel Send</button>' +
      '</div>' +
    '</div>' +
    '<div class="able-banner-edge"></div>';

  var breakdownHtml =
    '<div class="able-banner-edge"></div>' +
    '<div class="able-modal-content">' +
      '<h1 class="able-modal-title">SCORE BREAKDOWN</h1>' +
      ABLEModalContainer.buildScoreBreakdownMarkup(data.totalScore, data.flaggedItems) +
      '<div class="able-modal-actions">' +
        '<button class="able-btn able-btn-proceed" id="ableTextDetailBackBtn">Back to Warning</button>' +
        '<button class="able-btn able-btn-cancel" id="ableTextDetailCancelBtn">Cancel Send</button>' +
      '</div>' +
    '</div>' +
    '<div class="able-banner-edge"></div>';

  var mounted = (typeof ABLEModalContainer !== "undefined")
    ? ABLEModalContainer.renderModalIntoShadow(
        '<div class="able-modal-card">' + mainHtml + '</div>'
      )
    : null;

  var backdrop = mounted ? mounted.backdrop : null;
  if (!backdrop) {
    removeModal();
    backdrop = document.createElement("div");
    backdrop.className = "able-modal-backdrop";
    backdrop.innerHTML = '<div class="able-modal-card">' + mainHtml + '</div>';
    (document.documentElement || document.body).appendChild(backdrop);
  }

  function restoreFocus() {
    try {
      if (targetField && targetField.isConnected && typeof targetField.focus === "function") {
        targetField.focus();
      }
    } catch (e) {
      // Focus restoration is best effort.
    }
  }

  function clearTargetField() {
    try {
      if (targetField instanceof HTMLTextAreaElement || targetField instanceof HTMLInputElement) {
        targetField.value = "";
      } else if (targetField && targetField.isContentEditable) {
        targetField.innerText = "";
      }
    } catch (e) {
      // Clearing the field is best effort.
    }
  }

  function proceed() {
    if (decided) return;
    decided = true;
    if (typeof data.onProceed === "function") data.onProceed();
    restoreFocus();
    removeModal();
  }

  function cancel() {
    if (decided) return;
    decided = true;
    clearTargetField();
    if (typeof data.onCancel === "function") data.onCancel();
    restoreFocus();
    removeModal();
  }

  // The two views are swapped in place inside the same card. Re-rendering
  // the whole modal would run the cleanup registered below, which would
  // resolve the held check as a cancellation the moment the user opened
  // the breakdown.
  function renderMainView() {
    var card = backdrop.querySelector(".able-modal-card");
    if (!card) return;
    card.innerHTML = mainHtml;

    card.querySelector("#ableTextProceedBtn").addEventListener("click", proceed);
    card.querySelector("#ableTextCancelBtn").addEventListener("click", cancel);

    var ring = card.querySelector(".able-score-ring-wrapper");
    if (ring) {
      ring.addEventListener("click", function () {
        renderBreakdownView();
      });
    }
  }

  function renderBreakdownView() {
    var card = backdrop.querySelector(".able-modal-card");
    if (!card) return;
    card.innerHTML = breakdownHtml;

    card.querySelector("#ableTextDetailBackBtn").addEventListener("click", function () {
      renderMainView();
    });
    card.querySelector("#ableTextDetailCancelBtn").addEventListener("click", cancel);
  }

  // If the modal is torn down without a decision (another modal replaced
  // it, or the page navigated), the held check must still be resolved or
  // every later text check on this page stays blocked. Fail closed.
  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.registerModalCleanup) {
    ABLEModalContainer.registerModalCleanup(function () {
      if (decided) return;
      decided = true;
      if (typeof data.onCancel === "function") data.onCancel();
    });
  }

  renderMainView();

  var handleKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
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
  globalThis.ABLETextWarningModal = {
    showTextWarningModal: showTextWarningModal,
  };
}
