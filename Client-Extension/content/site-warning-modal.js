/**
 * ABLE Extension - Site Warning Modal
 *
 * Initial warning modal for unsafe/unlisted domains.
 */

function formatSiteWarningTitle(title, status) {
  if (!title) {
    return 'The site you are entering is <span class="able-highlight-text">' + (status || "UNLISTED").toUpperCase() + '</span>';
  }
  if (title.includes("<span") || title.includes("<strong")) {
    return title;
  }
  if (status) {
    var statusEscaped = status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var reg = new RegExp("\\b" + statusEscaped + "\\b", "i");
    if (reg.test(title)) {
      return title.replace(reg, function (m) {
        return '<span class="able-highlight-text">' + m.toUpperCase() + '</span>';
      });
    }
  }
  return title;
}

function formatSiteWarningMessage(domain, status, message) {
  if (!message) return "";
  if (message.includes("<span") || message.includes("<strong")) {
    return message;
  }
  var formatted = message;
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
  var formattedTitle = formatSiteWarningTitle(data.title, data.status);
  var formattedMessage = formatSiteWarningMessage(data.domain, data.status, data.message);

  var html = `
    <div class="able-modal-card">
      <div class="able-banner-edge"></div>
      <div class="able-modal-content">
        <h1 class="able-modal-title">${formattedTitle}</h1>
        <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
        <div class="able-modal-body">
          <p>${formattedMessage}</p>
        </div>
        <div class="able-modal-actions">
          <button class="able-btn able-btn-proceed" id="ableWarningDismiss">I Understand</button>
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

  backdrop.querySelector("#ableWarningDismiss").addEventListener("click", async () => {
    await setSiteWarningConsent();
    removeModal();
  });

  var handleKeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setSiteWarningConsent();
      removeModal();
      window.removeEventListener("keydown", handleKeydown);
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  window.addEventListener("keydown", handleKeydown);
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLESiteWarningModal = {
    showSiteWarningModal,
    formatSiteWarningTitle,
    formatSiteWarningMessage,
  };
}
