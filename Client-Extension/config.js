const COMPANY_NAME = "ABLE";

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
 *   node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('inject.js')).digest('hex'))"
 */
const EXPECTED_INJECT_HASH = "9640c4373f4c5cab0a6e065daa94eaf7ea4bb512cfdb0654eeafd496261e8542";
const EXPECTED_CONTENT_CSS_HASH = "a214eb4e885669bcf0d0a7b0f7dd619531b762ea0291cc89b1a20ee4d0955542";

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
