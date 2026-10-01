/**
 * ABLE Extension - Storage Constants
 *
 * Centralized storage key constants and helpers for chrome.storage.
 * Loaded by both content scripts and background service worker.
 */

const ABLEStorage = {
  // Runtime settings
  RUNTIME_SETTINGS: "able:runtime_settings",
  RUNTIME_SETTINGS_TIMESTAMP: "able:runtime_settings_timestamp",

  // Domain policies (offline cache)
  OFFLINE_CACHE: "able:domain_policies",
  OFFLINE_CACHE_TIMESTAMP: "able:domain_policies_timestamp",
  OFFLINE_CACHE_ENVELOPE: "able:domain_policies_envelope",

  // Risk patterns
  RISK_PATTERNS: "able:risk_patterns",
  RISK_PATTERNS_TIMESTAMP: "able:risk_patterns_timestamp",
  RISK_PATTERNS_ENVELOPE: "able:risk_patterns_envelope",

  // User ID
  USER_ID: "able:user_id",

  // Rate limiting
  RATE_LIMIT: "able:rate_limit",

  // Daily egress cap
  DAILY_EGRESS_COUNT: "able:daily_egress_count",
  DAILY_EGRESS_DATE: "able:daily_egress_date",

  // Pending queues
  PENDING_VISITS: "able:pending_visits",
  PENDING_EGRESS: "able:pending_egress",

  // Onboarding & greeting
  GREETING_COMPLETED: "able:greeting_completed",
  getGreetingCompletedKey() {
    return "able:greeting_completed";
  },

  // Modal cooldown
  getLastModalShownKey(domain) {
    return "able:last_modal:" + domain;
  },
  getInteractionCountKey(domain) {
    return "able:modal_interactions:" + domain;
  },
  getSiteWarningKey(domain) {
    return "able:warning:" + domain;
  },
  getVisitDebounceKey(domain) {
    return "able:last_visit:" + domain;
  },
  getSessionVisitKey(domain) {
    return "able:session_visit:" + domain;
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.ABLEStorage = ABLEStorage;
}
