/**
 * ABLE Extension - Page Signals
 *
 * Collects page context signals for domain classification and
 * DOM-based file upload detection. Uses section-aware scanning
 * targeting semantic HTML5 elements first, then falling back
 * to <body> for sites that skip semantic markup.
 */

function collectPageSignals() {
  try {
    var meta = {};
    try {
      var tags = document.querySelectorAll("meta[name], meta[property]");
      for (var i = 0; i < tags.length; i++) {
        var name = (tags[i].getAttribute("name") || tags[i].getAttribute("property") || "").toLowerCase();
        var content = tags[i].getAttribute("content") || "";
        if (!content) continue;
        if (name === "description" || name === "keywords" || name.indexOf("og:") === 0 || name.indexOf("twitter:") === 0 || name.indexOf("article:") === 0) {
          meta[name] = content.slice(0, 500);
        }
      }
    } catch (e) {}

    // OG / Twitter card meta — richer context for classification
    try {
      var ogTags = document.querySelectorAll("meta[property^='og:'], meta[name^='twitter:']");
      for (var og = 0; og < ogTags.length; og++) {
        var ogName = (ogTags[og].getAttribute("property") || ogTags[og].getAttribute("name") || "").toLowerCase();
        var ogContent = ogTags[og].getAttribute("content") || "";
        if (ogContent && !meta[ogName]) {
          meta[ogName] = ogContent.slice(0, 500);
        }
      }
    } catch (e) {}

    var headings = [];
    try {
      // Section-aware heading scan: semantic containers first
      var sectionSelectors = "article h1, article h2, main h1, main h2, section h1, section h2, [role=\"main\"] h1, [role=\"main\"] h2";
      var sectionNodes = document.querySelectorAll(sectionSelectors);
      var seen = new Set();
      for (var s = 0; s < sectionNodes.length && headings.length < 50; s++) {
        var text = (sectionNodes[s].innerText || "").trim().replace(/\s+/g, " ");
        if (text && !seen.has(text)) {
          seen.add(text);
          headings.push(text.slice(0, 200));
        }
      }
      // Fallback: scan all h1/h2 if semantic containers yielded too few
      if (headings.length < 10) {
        var nodes = document.querySelectorAll("h1, h2");
        for (var h = 0; h < Math.min(nodes.length, 50); h++) {
          var text = (nodes[h].innerText || "").trim().replace(/\s+/g, " ");
          if (text && !seen.has(text)) {
            seen.add(text);
            headings.push(text.slice(0, 200));
          }
        }
      }
    } catch (e) {}

    var excerpt = "";
    try {
      // Section-aware excerpt: prioritize semantic containers
      var bodyText = "";
      var semanticContainers = document.querySelectorAll("article, main, section[role=\"main\"]");
      if (semanticContainers.length > 0) {
        for (var c = 0; c < Math.min(semanticContainers.length, 3); c++) {
          var containerText = (semanticContainers[c].innerText || "").trim();
          if (containerText) bodyText += " " + containerText;
        }
      }
      if (!bodyText.trim()) {
        bodyText = (document.body ? document.body.innerText : "") || "";
      }
      excerpt = bodyText.replace(/\s+/g, " ").trim().slice(0, 3000);
    } catch (e) {}

    var ldJson = [];
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < Math.min(scripts.length, 10); s++) {
        ldJson.push((scripts[s].textContent || "").slice(0, 2000));
      }
    } catch (e) {}

    var canonical = "";
    try {
      var canonEl = document.querySelector('link[rel="canonical"]');
      if (canonEl && canonEl.href) canonical = canonEl.href.slice(0, 500);
    } catch (e) {}

    var urlTokens = {};
    try {
      var u = new URL(window.location.href);
      var queryKeys = [];
      try {
        var params = new URLSearchParams(u.search);
        params.forEach(function (value, key) {
          if (queryKeys.length < 10 && queryKeys.indexOf(key) === -1) queryKeys.push(key.slice(0, 60));
        });
      } catch (e2) {}
      var hostParts = u.hostname.toLowerCase().split(".");
      var pathSegs = u.pathname.split("/").filter(function (seg) { return !!seg; }).slice(0, 10).map(function (seg) { return seg.slice(0, 80); });
      urlTokens = {
        hostParts: hostParts,
        pathSegs: pathSegs,
        queryKeys: queryKeys,
        hyphenCount: (u.hostname.match(/-/g) || []).length,
        subdomainDepth: Math.max(0, hostParts.length - 2),
      };
    } catch (e) {}

    var anchors = { n: 0, extRatio: 0, topText: [] };
    try {
      var linkNodes = document.querySelectorAll("a[href]");
      var counts = {};
      var ext = 0;
      var host = "";
      try { host = new URL(window.location.href).hostname.toLowerCase(); } catch (e2) {}
      var total = Math.min(linkNodes.length, 500);
      for (var a = 0; a < total; a++) {
        var anchorText = (linkNodes[a].innerText || "").trim().replace(/\s+/g, " ").slice(0, 120).toLowerCase();
        var titleAttr = (linkNodes[a].getAttribute("title") || "").trim().toLowerCase();
        var ariaLabel = (linkNodes[a].getAttribute("aria-label") || "").trim().toLowerCase();
        var combinedText = (anchorText + " " + titleAttr + " " + ariaLabel).trim();
        if (combinedText) counts[combinedText] = (counts[combinedText] || 0) + 1;
        try {
          var hrefHost = new URL(linkNodes[a].href, window.location.href).hostname.toLowerCase();
          if (host && hrefHost !== host && !hrefHost.endsWith("." + host)) ext++;
        } catch (e2) {}
      }
      var sorted = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; }).slice(0, 20);
      anchors = {
        n: linkNodes.length,
        extRatio: total > 0 ? Math.round((ext / total) * 100) / 100 : 0,
        topText: sorted.map(function (t) { return { text: t, count: counts[t] }; }),
      };
    } catch (e) {}

    // Image alt-text extraction — modern sites embed sensitive info in images
    var imageAltText = [];
    try {
      var imgNodes = document.querySelectorAll("img[alt]");
      for (var img = 0; img < Math.min(imgNodes.length, 50); img++) {
        var alt = (imgNodes[img].getAttribute("alt") || "").trim().replace(/\s+/g, " ");
        if (alt) imageAltText.push(alt.slice(0, 200));
      }
    } catch (e) {}

    var forms = { hasPassword: false, hasFileInput: false, actionMismatch: false };
    try {
      forms.hasPassword = !!document.querySelector("input[type=password]");
      forms.hasFileInput = !!document.querySelector("input[type=file]");
      var formEls = document.querySelectorAll("form[action]");
      var pageHost = "";
      try { pageHost = new URL(window.location.href).hostname.toLowerCase(); } catch (e2) {}
      for (var f = 0; f < formEls.length; f++) {
        try {
          var actionHost = new URL(formEls[f].getAttribute("action"), window.location.href).hostname.toLowerCase();
          if (pageHost && actionHost !== pageHost && !actionHost.endsWith("." + pageHost)) {
            forms.actionMismatch = true;
            break;
          }
        } catch (e2) {}
      }
    } catch (e) {}

    var lang = "";
    try {
      lang = ((document.documentElement && document.documentElement.lang) || "").slice(0, 20);
    } catch (e) {}

    var favicon = "";
    try {
      var iconEl = document.querySelector('link[rel*="icon"]');
      if (iconEl) favicon = (iconEl.getAttribute("href") || "").slice(0, 500);
    } catch (e) {}

    // DOM depth heuristic — signal for SPA-rendered vs static content
    var domDepth = 0;
    try {
      function maxDepth(node, depth) {
        if (depth > domDepth) domDepth = depth;
        var children = node.children;
        for (var i = 0; i < children.length; i++) {
          maxDepth(children[i], depth + 1);
        }
      }
      maxDepth(document.documentElement || document.body, 1);
    } catch (e) {}

    return {
      url: window.location.href,
      title: (document.title || "").slice(0, 200),
      meta: meta,
      headings: headings,
      excerpt: excerpt,
      ldJson: ldJson,
      canonical: canonical,
      urlTokens: urlTokens,
      anchors: anchors,
      forms: forms,
      lang: lang,
      favicon: favicon,
      imageAltText: imageAltText,
      domDepth: domDepth,
    };
  } catch (e) {
    return { url: window.location.href, title: "", meta: {}, headings: [], excerpt: "", imageAltText: [], domDepth: 0 };
  }
}

function contentHash() {
  try {
    var signals = collectPageSignals();
    var raw = (signals.title || "") + "|" + (signals.headings || []).join("|") + "|" + (signals.excerpt || "").slice(0, 500);
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return String(hash) + ":" + raw.length;
  } catch (e) {
    return "";
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEPageSignals = { collectPageSignals: collectPageSignals, contentHash: contentHash };
}
