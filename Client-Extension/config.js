const COMPANY_NAME = "ABLE";

/**
 * ABLE now supports a signed runtime configuration pushed from the admin
 * server. The constants in this file remain the fallback defaults used when
 * the server is unreachable or returns an unverifiable payload. Values present
 * in the verified runtime payload (see runtime-settings.js) take precedence.
 */

/**
 * Server URL the extension talks to. Single source of truth — api.js reads
 * this constant and security.js derives its ALLOWED_ORIGINS from it so the
 * origin and port can never disagree.
 *
 * DEVELOPMENT: http://localhost:8000
 * PRODUCTION:  https://able-admin.internal:8443
 *
 * Change this value before building for distribution.
 */
const SERVER_URL = "http://localhost:8000";

/**
 * Public keys for verifying signed offline cache payloads.
 * Each key is a raw HMAC secret in hex (32 bytes = 64 hex chars).
 * The extension ships with the active key plus any previous key still
 * valid during a rotation window.
 *
 * TODO: Replace placeholders at deploy time with the server's actual key.
 */
const PUBLIC_KEYS = {
  1: {
    key: "13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d",
  },
};

/**
 * TLS SPKI pins for the admin server, keyed by hostname.
 * Each value is an array of base64 SPKI hashes; a request passes if any
 * pin in the list matches the leaf cert's public key.
 *
 * TODO: Populate with the production admin server's SPKI pin.
 */
const TLS_PINS = {
  "able-admin.internal": [],
};

/**
 * SHA-256 hashes of web-accessible resources, computed at build time.
 * Used to detect tampering with inject.js or content.css.
 *
 * TODO: Compute these at deploy time:
 *   npm run build
 */
const EXPECTED_INJECT_HASH = "37d986766c48ac99db7953ea990bfd0c6c5a8d2092903b8d0c249836a0add92a";
const EXPECTED_CONTENT_CSS_HASH = "cb03f6dd8c78fed3f2c2a9c28109f55db4f3e063e583178652a5ae3c1a172d1b";

/**
 * Origins the extension is allowed to make requests to.
 * Derived from SERVER_URL so the URL and allowlist can never drift apart.
 * Anything not in this list will be refused by secureFetch().
 */
const ALLOWED_ORIGINS = (() => {
  try {
    const u = new URL(SERVER_URL);
    return [`${u.protocol}//${u.host}`];
  } catch {
    return [];
  }
})();

/**
 * Domains excluded from extension detection.
 * Uploads to these domains will not trigger the intercept modal or logging.
 * Useful for development (localhost) and internal services.
 */
const EXCLUDED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "[::1]",
];

/**
 * Fallback runtime values used by runtime-settings.js when the signed server
 * payload is unavailable. These mirror the server-side schema defaults.
 */
const ABLE_RISK_THRESHOLD = 90;
const ABLE_MODAL_SHORT_COOLDOWN_MS = 35000;
const ABLE_MODAL_STAGGER_COOLDOWN_MS = 300000;
const ABLE_SESSION_CONSENT_ENABLED = true;
const ABLE_CACHE_TTL = 5 * 60 * 1000;
const ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES = 24 * 60;
const ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES = 5;
const ABLE_EGRESS_LOG_FLUSH_INTERVAL_MINUTES = 5;
const ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS = 60000;
const ABLE_DAILY_EGRESS_CAP = 500;
const ABLE_VISIT_DEBOUNCE_MS = 5000;
const ABLE_SKIP_SEARCH_RESULTS = true;

/**
 * Detect whether a given URL is a search engine listing / result page.
 * Prevents search queries (e.g. Google Search, Yahoo Search, Bing) from bloating
 * the domain visits audit table or showing intrusive site warnings.
 */
function isSearchResultUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    var u = new URL(url);
    var host = u.hostname.toLowerCase().replace(/^www\./, "");
    var path = u.pathname.toLowerCase();
    var search = u.searchParams;

    // Google Search (excludes docs, drive, mail, meet, maps, finance, etc.)
    if (/^google\.(com?|org|[a-z]{2})(\.[a-z]{2})?$/.test(host)) {
      var isSearchPath = path === "/" || path === "" || path === "/search" || path === "/webhp" || path === "/imghp";
      if (isSearchPath) return true;
      return false;
    }

    // Yahoo Search (excludes finance, mail, sports, news, etc.)
    if (host === "search.yahoo.com" || host.endsWith(".search.yahoo.com") || /^search\.yahoo\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) {
      return true;
    }
    if (host === "yahoo.com" || /^([a-z]{2}\.)?yahoo\.(com?|[a-z]{2})$/.test(host)) {
      if (path.startsWith("/search") || search.has("p")) {
        return true;
      }
    }

    // Bing
    if (host === "bing.com" || /^([a-z]{2}\.)?bing\.com$/.test(host) || host === "cn.bing.com") {
      if (path === "/" || path === "" || path.startsWith("/search") || search.has("q")) {
        return true;
      }
    }

    // DuckDuckGo
    if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) {
      return true;
    }

    // Baidu
    if (host === "baidu.com" || host === "m.baidu.com") {
      if (path === "/" || path === "" || path === "/s" || search.has("wd") || search.has("word")) {
        return true;
      }
    }

    // Yandex
    if (/^yandex\.(com?|[a-z]{2})(\.[a-z]{2})?$/.test(host)) {
      if (path === "/" || path === "" || path.startsWith("/search") || search.has("text")) {
        return true;
      }
    }

    // Brave Search
    if (host === "search.brave.com") {
      return true;
    }

    // Ecosia
    if (host === "ecosia.org" || host.endsWith(".ecosia.org")) {
      if (path === "/" || path === "" || path.startsWith("/search") || search.has("q")) {
        return true;
      }
    }

    // Ask.com
    if (host === "ask.com" || host.endsWith(".ask.com")) {
      if (path === "/" || path === "" || path.startsWith("/web") || search.has("q")) {
        return true;
      }
    }

    // Startpage
    if (host === "startpage.com" || host.endsWith(".startpage.com")) {
      return true;
    }

    // AOL Search
    if (host === "search.aol.com") {
      return true;
    }

    // Qwant
    if (host === "qwant.com" || host.endsWith(".qwant.com")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Generate status messages for domain classification.
 * These are template messages, not data - they use the classification result from the server/cache.
 */
function getStatusMessage(status, domain, category, alternatives) {
  const messages = {
    safe: {
      title: "The site you are entering is SAFE",
      message: `${domain} has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared safe to use and operate.\n\nFeel free to use the website to your heart\u2019s content,\n\nHave a nice day :)`,
      suggestion: ""
    },
    unsafe: {
      title: "The site you are entering is UNSAFE",
      message: `${domain} has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared to be unsafe to use.\nPlease refrain from sending sensitive institutional data to this website.${category && alternatives.length ? `\n\nSince you are entering a ${category} website, to make your internet experience safe, please consider the following alternatives: ${alternatives.join(", ")}.` : ""}`,
      suggestion: ""
    },
    unlisted: {
      title: "The site you are entering is UNLISTED",
      message: `${domain} is an unlisted service that has not been reviewed, and analyzed by the ${COMPANY_NAME} IT security department. While the service is not labeled unsafe by our security team, please refrain from sending any sensitive institutional data from this website until it is properly reviewed.`,
      suggestion: ""
    }
  };

  return messages[status] || messages.unlisted;
}

/**
 * Generate a default unlisted response when no classification data is available.
 */
function getDefaultClassification(domain) {
  return {
    status: "unlisted",
    domain: domain,
    category: null,
    alternatives: [],
    policy: "under_review",
    risk_score: 70,
  };
}
