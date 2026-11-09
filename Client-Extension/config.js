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
 * An unpacked build is a development build and talks to the local Laravel
 * server. A store-installed build carries Chrome's update_url and talks to
 * production, so packaging the same source cannot accidentally ship the
 * localhost URL.
 */
const ABLE_IS_UNPACKED =
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  typeof chrome.runtime.getManifest === "function" &&
  !chrome.runtime.getManifest().update_url;

const SERVER_URL = ABLE_IS_UNPACKED
  ? "http://localhost:8000"
  : "https://able-shadow-security.onrender.com";

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
 * Every file listed in scripts/hash-targets.js is covered: the page-world
 * scripts injected into the site, and the content stylesheet.
 *
 * Regenerated automatically — `npm run build` rewrites these, and the git
 * pre-commit hook runs it so a commit can never carry a stale hash. Run
 * `npm run build:check` to fail instead of rewriting.
 */
const EXPECTED_INJECT_HASH = "f88439c40463520a80a9a19b264f779cd813e6f48597adc034dd71c103ed6b4d";
const EXPECTED_CONTENT_CSS_HASH = "e4adef44f740b3fbf09eb4f0394a6680b11ffa03c04c228168fbdab63718e39c";
const EXPECTED_SYNTHETIC_NAMES_HASH = "cf0a490a8eda37326822724137d7879c63c47b4dc43323f72629ef9bbbbda9c9";
const EXPECTED_FILE_IDENTITY_HASH = "d9e62e101d32a387947a25de89e96fe4c54101b2e76ee95d4c087e4ed8893f46";
const EXPECTED_FILE_EXTRACTOR_HASH = "ae4169054552e56b89a2873cbb83ada95d82423cf3ceb4a1ff7ff6a3ee3b0d38";
const EXPECTED_NETWORK_INTERCEPTOR_HASH = "11803afb6fe38ae60f7c5f25ee1128292fbdf55d7acf44cc828d1b68cce3e8fb";
const EXPECTED_FILE_TRACKER_HASH = "a39c63cae4435f9271e05c4605a1952066c21578c5df114e74ac671abb7443f5";

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
const ABLE_RISK_THRESHOLD = 85;
const ABLE_MODAL_SHORT_COOLDOWN_MS = 35000;
const ABLE_MODAL_STAGGER_COOLDOWN_MS = 300000;
const ABLE_UNSAFE_MODAL_SHORT_COOLDOWN_MS = 15000;
const ABLE_UNSAFE_MODAL_STAGGER_COOLDOWN_MS = 120000;
const ABLE_SESSION_CONSENT_ENABLED = true;
const ABLE_CACHE_TTL = 60 * 1000;
const ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES = 24 * 60;
const ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES = 5;
const ABLE_EGRESS_LOG_FLUSH_INTERVAL_MINUTES = 5;
const ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS = 60000;
const ABLE_DAILY_EGRESS_CAP = 500;
const ABLE_VISIT_DEBOUNCE_MS = 5000;
const ABLE_SKIP_SEARCH_RESULTS = true;
const ABLE_SKIP_ACCOUNT_LOGIN = true;
const ABLE_RECOMMENDATIONS_LIMIT = 6;

// Categories that never receive ABLE Recommends alternatives. The server
// enforces the same list; this copy covers the offline path.
const ABLE_RECOMMENDATION_EXCLUDED_CATEGORIES = ["adult", "gambling"];

/**
 * Second paragraph shown in the site warning when ABLE Recommends has
 * sanctioned alternatives for the domain's category.
 *
 * The copy is split around the category so the renderer can highlight it
 * without string surgery. The original wording requested for this feature
 * was "...since you entered into an [App Category]-based platform. ABLE
 * recommends..."; the punctuation is corrected here and the category
 * placeholder is removed.
 */
const ABLE_RECOMMENDS_PARAGRAPH_PREFIX = "Anyhow, while the system is not discouraging you from using this service, and since you entered an ";
const ABLE_RECOMMENDS_PARAGRAPH_SUFFIX = "-based platform, ABLE recommends the following sanctioned alternatives that will help improve your workflow as well as improve institutional security.";

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
      var isSearchPath = path === "/" || path === "" || path === "/search" || path === "/webhp" || path === "/imghp" || path === "/url" || path === "/imgres";
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
    if (host === "bing.com" || /^([a-z]{2}\.)?bing\.com$/.test(host) || host === "cn.bing.com" || host === "global.bing.com") {
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

    // Kagi Search
    if (host === "kagi.com" || host.endsWith(".kagi.com")) {
      if (path === "/" || path === "" || path.startsWith("/search") || search.has("q")) {
        return true;
      }
    }

    // Naver Search
    if (host === "search.naver.com") {
      return true;
    }

    // Sogou Search
    if (host === "sogou.com" || host === "search.sogou.com") {
      if (path === "/" || path === "" || path.startsWith("/web") || search.has("query")) {
        return true;
      }
    }

    // Seznam Search
    if (host === "search.seznam.cz") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Dedicated identity providers and authentication portals (Domain-level).
 * Visits to these domains exist solely for account login, registration, or SSO sync.
 */
const DEDICATED_AUTH_HOSTS = [
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "account.microsoft.com",
  "login.windows.net",
  "appleid.apple.com",
  "auth0.com",
  "okta.com",
  "onelogin.com",
  "pingidentity.com",
  "duosecurity.com",
];

/**
 * Path patterns representing dedicated login, registration, and OAuth flows.
 */
const AUTH_PATH_PATTERNS = [
  /^\/(sign[_-]?in|log[_-]?in|sign[_-]?up|register|join|create[_-]?account)(\/|$|\?)/i,
  /^\/(account|users?|auth|session)\/(sign[_-]?in|log[_-]?in|sign[_-]?up|register|new|create)(\/|$|\?)/i,
  /^\/(oauth2?|saml|sso|idp)\/(authorize|auth|sso|login)(\/|$|\?)/i,
  /^\/auth\/(callback|google|github|apple|facebook|microsoft)(\/|$|\?)/i,
  /^\/signin\/chrome(\/sync)?(\/|$|\?)/i,
  /^\/ServiceLogin(\/|$|\?)/i,
  /^\/AccountChooser(\/|$|\?)/i,
  /^\/AddSession(\/|$|\?)/i,
  /^\/o\/oauth2(\/|$|\?)/i,
];

/**
 * Detect whether a given URL is a dedicated account login, registration, or OAuth page.
 * Covers Chrome's automatic sync pages (accounts.google.com/signin/chrome/sync) as well as
 * universal SSO, OAuth, and registration endpoints across third-party providers.
 */
function isAuthOrAccountUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    var u = new URL(url);
    if (u.protocol === "chrome:" && (u.hostname === "chrome-signin" || u.hostname === "signin-internals")) {
      return true;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;

    var host = u.hostname.toLowerCase().replace(/^www\./, "");
    // Tier 1: Dedicated IdP domains
    for (var i = 0; i < DEDICATED_AUTH_HOSTS.length; i++) {
      var idp = DEDICATED_AUTH_HOSTS[i];
      if (host === idp || host.endsWith("." + idp)) return true;
    }

    // Tier 2 & 3: Auth & Registration Paths
    var path = u.pathname;
    for (var j = 0; j < AUTH_PATH_PATTERNS.length; j++) {
      if (AUTH_PATH_PATTERNS[j].test(path)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Master check for ignoring domain visits.
 * Returns true if the URL belongs to an excluded hostname, an authentication/registration page,
 * or a search engine result page.
 */
function shouldIgnoreDomainVisit(url) {
  if (!url || typeof url !== "string") return true;
  try {
    var u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;

    var host = u.hostname.toLowerCase().replace(/^www\./, "");
    var excluded = (typeof ABLERuntimeSettings !== "undefined")
      ? ABLERuntimeSettings.get("excluded_domains", typeof EXCLUDED_DOMAINS !== "undefined" ? EXCLUDED_DOMAINS : [])
      : (typeof EXCLUDED_DOMAINS !== "undefined" ? EXCLUDED_DOMAINS : []);
    if (Array.isArray(excluded) && excluded.some(function (e) { return host === e || host.endsWith("." + e); })) {
      return true;
    }

    var skipAuth = (typeof ABLERuntimeSettings !== "undefined")
      ? ABLERuntimeSettings.get("logging.skip_account_login", typeof ABLE_SKIP_ACCOUNT_LOGIN !== "undefined" ? ABLE_SKIP_ACCOUNT_LOGIN : true)
      : (typeof ABLE_SKIP_ACCOUNT_LOGIN !== "undefined" ? ABLE_SKIP_ACCOUNT_LOGIN : true);
    if (skipAuth && isAuthOrAccountUrl(url)) {
      return true;
    }

    var skipSearch = (typeof ABLERuntimeSettings !== "undefined")
      ? ABLERuntimeSettings.get("logging.skip_search_results", typeof ABLE_SKIP_SEARCH_RESULTS !== "undefined" ? ABLE_SKIP_SEARCH_RESULTS : true)
      : (typeof ABLE_SKIP_SEARCH_RESULTS !== "undefined" ? ABLE_SKIP_SEARCH_RESULTS : true);
    if (skipSearch && isSearchResultUrl(url)) {
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
  const statusUpper = (status || "unlisted").toUpperCase();
  const statusLower = (status || "unlisted").toLowerCase();
  const messages = {
    safe: {
      title: 'The site you are entering is <span class="able-highlight-text">SAFE</span>',
      message: `<span class="able-highlight-text">${domain}</span> has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared <span class="able-highlight-text">safe</span> to use and operate.\n\nFeel free to use the website to your heart\u2019s content,\n\nHave a nice day :)`,
      suggestion: ""
    },
    unsafe: {
      title: 'The site you are entering is <span class="able-highlight-text">UNSAFE</span>',
      message: `<span class="able-highlight-text">${domain}</span> has been reviewed, and analyzed by the ${COMPANY_NAME} IT security department and thus declared to be <span class="able-highlight-text">unsafe</span> to use.\nPlease refrain from sending sensitive institutional data to this website.`,
      suggestion: ""
    },
    unlisted: {
      title: 'The site you are entering is <span class="able-highlight-text">UNLISTED</span>',
      message: `<span class="able-highlight-text">${domain}</span> is an <span class="able-highlight-text">unlisted</span> service that has not been reviewed, and analyzed by the ${COMPANY_NAME} IT security department. While the service is not labeled unsafe by our security team, please refrain from sending any sensitive institutional data from this website until it is properly reviewed.`,
      suggestion: ""
    },
    blocked: {
      title: 'This site is <span class="able-highlight-text">BLOCKED</span>',
      message: `<span class="able-highlight-text">${domain}</span> is <span class="able-highlight-text">BLOCKED</span> per administrator governance. Normal navigation and operations are disabled for institutional safety.\n\nYou can request access below and an administrator will review your reasons.`,
      suggestion: ""
    }
  };

  return messages[statusLower] || messages.unlisted;
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
    block_access: false,
    risk_score: 60,
  };
}
