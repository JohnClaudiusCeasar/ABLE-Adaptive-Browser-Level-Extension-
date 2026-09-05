/**
 * ABLE Extension - Runtime Settings
 *
 * Loads a signed runtime configuration from the ABLE admin server and makes it
 * available to the rest of the extension. `config.js` remains the fallback for
 * development and offline first-boot, but any value present in the verified
 * server payload wins.
 *
 * The server payload is an HMAC-signed envelope:
 *   { payload: { settings: {...}, issued_at }, signature, key_version }
 *
 * It is verified with the public key bundled in config.js via
 * ABLESecurity.verifySignedCache() before being trusted.
 */

const RUNTIME_SETTINGS_STORAGE_KEY = "able:runtime_settings";
const RUNTIME_SETTINGS_TIMESTAMP_KEY = "able:runtime_settings_timestamp";
const RUNTIME_SETTINGS_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function buildDefaults() {
  return {
    "behavior.risk_threshold":
      typeof ABLE_RISK_THRESHOLD !== "undefined" ? ABLE_RISK_THRESHOLD : 90,
    "behavior.modal_short_cooldown_ms":
      typeof ABLE_MODAL_SHORT_COOLDOWN_MS !== "undefined" ? ABLE_MODAL_SHORT_COOLDOWN_MS : 10000,
    "behavior.modal_stagger_cooldown_ms":
      typeof ABLE_MODAL_STAGGER_COOLDOWN_MS !== "undefined" ? ABLE_MODAL_STAGGER_COOLDOWN_MS : 300000,
    "behavior.session_consent_enabled":
      typeof ABLE_SESSION_CONSENT_ENABLED !== "undefined" ? ABLE_SESSION_CONSENT_ENABLED : true,
    "sync.cache_ttl_ms":
      typeof ABLE_CACHE_TTL !== "undefined" ? ABLE_CACHE_TTL : 300000,
    "sync.risk_patterns_interval_minutes":
      typeof ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES !== "undefined"
        ? ABLE_RISK_PATTERNS_SYNC_INTERVAL_MINUTES
        : 1440,
    "sync.visit_log_flush_interval_minutes":
      typeof ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES !== "undefined"
        ? ABLE_VISIT_LOG_FLUSH_INTERVAL_MINUTES
        : 5,
    "connection.allowed_origins":
      typeof ALLOWED_ORIGINS !== "undefined" ? ALLOWED_ORIGINS : [],
    "connection.tls_pins":
      typeof TLS_PINS !== "undefined" ? TLS_PINS : {},
    "logging.rate_limit_default_backoff_ms":
      typeof ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS !== "undefined"
        ? ABLE_RATE_LIMIT_DEFAULT_BACKOFF_MS
        : 60000,
    "logging.daily_egress_cap":
      typeof ABLE_DAILY_EGRESS_CAP !== "undefined" ? ABLE_DAILY_EGRESS_CAP : 500,
    "logging.visit_debounce_ms":
      typeof ABLE_VISIT_DEBOUNCE_MS !== "undefined" ? ABLE_VISIT_DEBOUNCE_MS : 5000,
    "excluded_domains":
      typeof EXCLUDED_DOMAINS !== "undefined" ? EXCLUDED_DOMAINS : [],
  };
}

function sanitize(settings) {
  const defaults = buildDefaults();
  const result = {};

  for (const key of Object.keys(defaults)) {
    const value = settings[key];

    if (value === undefined) {
      result[key] = defaults[key];
      continue;
    }

    const expected = defaults[key];
    if (Array.isArray(expected)) {
      result[key] = Array.isArray(value) ? value.filter((v) => typeof v === "string") : expected;
    } else if (typeof expected === "boolean") {
      result[key] = typeof value === "boolean" ? value : expected;
    } else if (typeof expected === "number") {
      result[key] = typeof value === "number" ? value : expected;
    } else {
      result[key] = value;
    }
  }

  return result;
}

const ABLERuntimeSettings = {
  defaults: buildDefaults(),
  current: buildDefaults(),

  async load() {
    try {
      const envelope = await this.fetchEnvelope();

      if (!envelope) return this.current;

      const ok = await ABLESecurity.verifySignedCache(envelope);
      if (!ok) {
        console.warn("ABLE: Runtime settings failed signature verification, keeping defaults.");
        return this.current;
      }

      const payload = envelope.payload || {};
      const settings = sanitize(payload.settings || {});

      this.current = settings;

      try {
        await chrome.storage.local.set({
          [RUNTIME_SETTINGS_STORAGE_KEY]: settings,
          [RUNTIME_SETTINGS_TIMESTAMP_KEY]: payload.issued_at || Date.now(),
        });
      } catch (error) {
        console.warn("ABLE: Failed to persist runtime settings:", error.message);
      }

      return this.current;
    } catch (error) {
      console.warn("ABLE: Failed to load runtime settings:", error.message);
      return this.current;
    }
  },

  async initialize() {
    await this.restorePersisted();
    await this.load();
    return this.current;
  },

  async restorePersisted() {
    try {
      const result = await chrome.storage.local.get([
        RUNTIME_SETTINGS_STORAGE_KEY,
        RUNTIME_SETTINGS_TIMESTAMP_KEY,
      ]);

      const stored = result[RUNTIME_SETTINGS_STORAGE_KEY];
      const timestamp = result[RUNTIME_SETTINGS_TIMESTAMP_KEY] || 0;

      if (stored && Date.now() - timestamp < RUNTIME_SETTINGS_REFRESH_INTERVAL) {
        this.current = sanitize(stored);
      }
    } catch (error) {
      console.warn("ABLE: Failed to restore persisted runtime settings:", error.message);
    }
  },

  async fetchEnvelope() {
    try {
      const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/extension/config`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn("ABLE: Runtime settings fetch failed:", error.message);
      return null;
    }
  },

  get(path, fallback) {
    if (path && path in this.current) {
      return this.current[path];
    }

    if (path && path in this.defaults) {
      return this.defaults[path];
    }

    return fallback;
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.ABLERuntimeSettings = ABLERuntimeSettings;
}
