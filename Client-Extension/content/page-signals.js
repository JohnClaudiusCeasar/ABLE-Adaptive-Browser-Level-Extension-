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

    var headings = [];
    try {
      var nodes = document.querySelectorAll("h1, h2");
      for (var h = 0; h < Math.min(nodes.length, 10); h++) {
        var text = (nodes[h].innerText || "").trim().replace(/\s+/g, " ");
        if (text) headings.push(text.slice(0, 200));
      }
    } catch (e) {}

    var excerpt = "";
    try {
      var bodyText = (document.body ? document.body.innerText : "") || "";
      excerpt = bodyText.replace(/\s+/g, " ").trim().slice(0, 3000);
    } catch (e) {}

    var ldJson = [];
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < Math.min(scripts.length, 3); s++) {
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
      var total = Math.min(linkNodes.length, 200);
      for (var a = 0; a < total; a++) {
        var anchorText = (linkNodes[a].innerText || "").trim().replace(/\s+/g, " ").slice(0, 40).toLowerCase();
        if (anchorText) counts[anchorText] = (counts[anchorText] || 0) + 1;
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
    };
  } catch (e) {
    return { url: window.location.href, title: "", meta: {}, headings: [], excerpt: "" };
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
