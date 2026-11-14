/**
 * ABLE Extension - ABLE Recommends view
 *
 * The sanctioned-alternatives list shown inside the site warning card. This
 * is a view renderer, not a standalone modal: the warning modal swaps the
 * card content in place so the warning's consent flow is never torn down.
 */

/**
 * Reduce untrusted recommendation values to bare HTTPS hostnames.
 *
 * The values come from the signed policy feed or the classify response, but
 * they still cross a trust boundary: accept only strings that parse as a
 * hostname, strip any path/scheme, dedupe, and cap the list.
 */
function sanitizeRecommendationDomains(list, limit) {
  var max = typeof limit === "number" && limit > 0
    ? Math.min(limit, 20)
    : ABLE_RECOMMENDATIONS_LIMIT;

  var seen = {};
  var domains = [];

  (Array.isArray(list) ? list : []).forEach(function (value) {
    if (typeof value !== "string") return;

    var hostname;
    try {
      hostname = new URL("https://" + value.trim()).hostname.toLowerCase();
    } catch (error) {
      return;
    }

    hostname = hostname.replace(/\.$/, "");

    if (!hostname || hostname.indexOf(".") === -1) return;
    if (!/^[a-z0-9.-]+$/.test(hostname)) return;
    if (seen[hostname]) return;

    seen[hostname] = true;
    domains.push(hostname);
  });

  return domains.slice(0, max);
}

/**
 * Full card inner HTML for the recommendation view. The caller swaps this
 * into the existing .able-modal-card, so both banner edges are included.
 */
function buildRecommendationsCardHtml(data) {
  var category = data && typeof data.category === "string" ? data.category.trim() : "";
  var domains = sanitizeRecommendationDomains(data && data.recommendations);

  if (!category || domains.length === 0) return "";

  var items = domains.map(function (domain) {
    var safeDomain = escapeHtml(domain);
    var logoUrl = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=64";
    var initial = escapeHtml((domain.replace(/^(?:www\.)+/i, "").charAt(0) || "D").toUpperCase());

    return '<button type="button" class="able-recommend-item" data-rec-domain="' + safeDomain + '">' +
        '<div class="able-recommend-info">' +
          '<div class="able-recommend-logo-container">' +
            '<img class="able-recommend-logo" src="' + escapeHtml(logoUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';" />' +
            '<span class="able-recommend-logo-fallback" style="display:none;">' + initial + '</span>' +
          '</div>' +
          '<span class="able-recommend-domain">' + safeDomain + '</span>' +
        '</div>' +
        '<span class="able-recommend-tag">Sanctioned</span>' +
      '</button>';
  }).join("");

  return `
    <div class="able-banner-edge"></div>
    <div class="able-modal-content">
      <h1 class="able-modal-title">ABLE RECOMMENDS</h1>
      <div class="able-modal-divider"><div class="able-modal-divider-circle"></div></div>
      <div class="able-modal-body">
        <p class="able-recommend-intro">Sanctioned alternatives for <span class="able-highlight-text">${escapeHtml(category)}</span>:</p>
        <div class="able-recommend-list">${items}</div>
      </div>
      <div class="able-modal-actions">
        <button type="button" class="able-btn able-btn-alt" id="ableRecommendsBack">Back</button>
      </div>
    </div>
    <div class="able-banner-edge"></div>
  `;
}

/**
 * Bind the Back action and the per-domain navigation buttons.
 *
 * Navigation is routed through the background so the unsafe page's own
 * scripts cannot hijack a page-world click.
 */
function wireRecommendationsActions(card, data, onBack) {
  if (!card) return;

  var back = card.querySelector("#ableRecommendsBack");
  if (back) back.addEventListener("click", onBack);

  var buttons = typeof card.querySelectorAll === "function"
    ? card.querySelectorAll(".able-recommend-item")
    : [];

  for (var i = 0; i < buttons.length; i++) {
    (function (button) {
      button.addEventListener("click", function () {
        var domain = button.getAttribute("data-rec-domain") || "";
        try {
          chrome.runtime.sendMessage({
            type: "openRecommendation",
            url: "https://" + domain,
          });
        } catch (error) {
          // A dismissed extension context must not break the modal.
        }
      });
    })(buttons[i]);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERecommendsModal = {
    sanitizeRecommendationDomains,
    buildRecommendationsCardHtml,
    wireRecommendationsActions,
  };
}
