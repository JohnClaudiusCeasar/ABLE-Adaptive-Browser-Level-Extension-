/**
 * ABLE Extension - Site Warning Modal
 *
 * Initial warning modal for unsafe/unlisted domains.
 *
 * The card has two views: the warning itself, and the ABLE Recommends list.
 * They are swapped in place inside the same card because re-rendering the
 * modal would tear down the warning's consent flow.
 */

function formatSiteWarningTitle(title, status) {
  if (!title) {
    return 'The site you are entering is <span class="able-highlight-text">' + escapeHtml((status || "UNLISTED").toUpperCase()) + '</span>';
  }
  if (title.includes("<span") || title.includes("<strong")) {
    return title;
  }
  var escapedTitle = escapeHtml(title);
  if (status) {
    var statusEscaped = status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var reg = new RegExp("\\b" + statusEscaped + "\\b", "i");
    if (reg.test(escapedTitle)) {
      return escapedTitle.replace(reg, function (m) {
        return '<span class="able-highlight-text">' + m.toUpperCase() + '</span>';
      });
    }
  }
  return escapedTitle;
}

function formatSiteWarningMessage(domain, status, message) {
  if (!message) return "";
  if (message.includes("<span") || message.includes("<strong")) {
    return message;
  }
  var formatted = escapeHtml(message);
  if (domain) {
    var domainEscaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    formatted = formatted.replace(new RegExp(domainEscaped, "gi"), function (m) {
      return '<span class="able-highlight-text">' + m + '</span>';
    });
  }
  if (status) {
    var statusEscaped = status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    formatted = formatted.replace(new RegExp("\\b" + statusEscaped + "\\b", "gi"), function (m) {
      return '<span class="able-highlight-text">' + m + '</span>';
    });
  }
  return formatted;
}

function showSiteWarningModal(data) {
  var category = data && typeof data.category === "string" ? data.category.trim() : "";
  var status = data ? data.status : null;

  var domains = (typeof ABLERecommendsModal !== "undefined")
    ? ABLERecommendsModal.sanitizeRecommendationDomains(data ? data.recommendations : [])
    : [];

  // The paragraph and the button are gated by the same boolean: a missing
  // category or an empty list takes the legacy single-paragraph path.
  var canRecommend = (status === "unsafe" || status === "unlisted")
    && category !== ""
    && domains.length > 0;

  function warningCardHtml() {
    var formattedTitle = formatSiteWarningTitle(data.title, data.status);
    var formattedMessage = formatSiteWarningMessage(data.domain, data.status, data.message);

    var paragraphs = '<p>' + formattedMessage + '</p>';

    if (canRecommend) {
      paragraphs += '<p>' +
        ABLE_RECOMMENDS_PARAGRAPH_PREFIX +
        '<span class="able-highlight-text">' + escapeHtml(category) + '</span>' +
        ABLE_RECOMMENDS_PARAGRAPH_SUFFIX +
        '</p>';
    }

    var actions = '<button type="button" class="able-btn able-btn-proceed" id="ableWarningDismiss">I Understand</button>';

    if (canRecommend) {
      actions += '<button type="button" class="able-btn able-btn-alt" id="ableWarningRecommend">ABLE Recommends</button>';
    }

    return `
    <div class="able-modal-card" tabindex="0">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">${formattedTitle}</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">${paragraphs}</div>
        <div class="able-modal-actions">${actions}</div>
      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;
  }

  var html = warningCardHtml();

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

  var currentView = "warning";

  function focusCard(card) {
    if (card && typeof card.focus === "function") {
      try { card.focus(); } catch (e) {}
    }
  }

  function bindWarningActions(card) {
    if (!card) return;

    var dismiss = card.querySelector("#ableWarningDismiss");
    if (dismiss) {
      dismiss.addEventListener("click", async () => {
        await setSiteWarningConsent();
        removeModal();
      });
    }

    var recommend = card.querySelector("#ableWarningRecommend");
    if (recommend) {
      recommend.addEventListener("click", renderRecommendsView);
    }
  }

  function renderWarningView() {
    var card = backdrop.querySelector(".able-modal-card");
    if (!card) return;

    card.innerHTML = warningCardHtml();
    currentView = "warning";
    bindWarningActions(card);
    focusCard(card);
  }

  function renderRecommendsView() {
    var card = backdrop.querySelector(".able-modal-card");
    if (!card) return;

    var recommendsHtml = (typeof ABLERecommendsModal !== "undefined")
      ? ABLERecommendsModal.buildRecommendationsCardHtml({
          category: category,
          recommendations: domains,
        })
      : "";

    if (!recommendsHtml) return;

    card.innerHTML = recommendsHtml;
    currentView = "recommends";

    ABLERecommendsModal.wireRecommendationsActions(
      card,
      { recommendations: domains },
      renderWarningView
    );

    focusCard(card);
  }

  // The initial render already produced warningCardHtml; only the handlers
  // are missing.
  bindWarningActions(backdrop.querySelector(".able-modal-card"));

  var handleKeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();

      // Escape while reading recommendations returns to the warning; it
      // must never grant consent the user did not acknowledge.
      if (currentView === "recommends") {
        renderWarningView();
        return;
      }

      setSiteWarningConsent();
      removeModal();
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  window.addEventListener("keydown", handleKeydown);
  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.registerModalCleanup) {
    ABLEModalContainer.registerModalCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      backdrop.removeEventListener("keydown", handleKeydown);
    });
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLESiteWarningModal = {
    showSiteWarningModal,
    formatSiteWarningTitle,
    formatSiteWarningMessage,
  };
}
