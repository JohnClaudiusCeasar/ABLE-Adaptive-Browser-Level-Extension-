/**
 * ABLE Extension - Rate Limiter
 *
 * Rate-limit state management for API endpoints.
 * Handles backoff windows and daily egress caps.
 */

const RATE_LIMIT_KEY = "able:rate_limit";
const DAILY_EGRESS_CAP = 500;
const DAILY_EGRESS_COUNT_KEY = "able:daily_egress_count";
const DAILY_EGRESS_DATE_KEY = "able:daily_egress_date";

function getDailyEgressCap() {
  return ABLERuntimeSettings.get("logging.daily_egress_cap", DAILY_EGRESS_CAP);
}

async function isEndpointCoolingDown(endpoint) {
  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_KEY);
    const map = result[RATE_LIMIT_KEY] || {};
    const until = map[endpoint] || 0;
    return Date.now() < until;
  } catch {
    return false;
  }
}

async function recordRateLimitBackoff(endpoint, response) {
  let retryAfterMs = ABLERuntimeSettings.get("logging.rate_limit_default_backoff_ms", 60000);
  try {
    const header = response.headers.get("Retry-After");
    if (header) {
      const seconds = parseInt(header, 10);
      if (!Number.isNaN(seconds)) retryAfterMs = seconds * 1000;
    }
  } catch {
    // fall through with default
  }
  retryAfterMs = Math.min(retryAfterMs, 10 * 60 * 1000);

  try {
    const result = await chrome.storage.session.get(RATE_LIMIT_KEY);
    const map = result[RATE_LIMIT_KEY] || {};
    map[endpoint] = Date.now() + retryAfterMs;
    await chrome.storage.session.set({ [RATE_LIMIT_KEY]: map });
  } catch {
    // ignore
  }
}

async function isDailyEgressCapReached() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await chrome.storage.session.get([DAILY_EGRESS_COUNT_KEY, DAILY_EGRESS_DATE_KEY]);
    if (result[DAILY_EGRESS_DATE_KEY] !== today) return false;
    return (result[DAILY_EGRESS_COUNT_KEY] || 0) >= getDailyEgressCap();
  } catch {
    return false;
  }
}

async function incrementDailyEgressCount(action) {
  if (action === 'allowed') return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await chrome.storage.session.get([DAILY_EGRESS_COUNT_KEY, DAILY_EGRESS_DATE_KEY]);
    const current = result[DAILY_EGRESS_DATE_KEY] === today
      ? (result[DAILY_EGRESS_COUNT_KEY] || 0) + 1
      : 1;
    await chrome.storage.session.set({
      [DAILY_EGRESS_COUNT_KEY]: current,
      [DAILY_EGRESS_DATE_KEY]: today,
    });
  } catch {
    // ignore
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERateLimiter = {
    isEndpointCoolingDown,
    recordRateLimitBackoff,
    isDailyEgressCapReached,
    incrementDailyEgressCount,
  };
}
