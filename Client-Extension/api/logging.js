/**
 * ABLE Extension - Logging
 *
 * Handles logging of domain visits and egress events to the server.
 * Includes queueing for offline/retry scenarios.
 */

var PENDING_VISITS_KEY = "able:pending_visits";
var PENDING_EGRESS_KEY = "able:pending_egress";

var MAX_QUEUE_LENGTH = 500;
var IN_MEMORY_VISIT_DEDUP_MS = 5000;

// In-memory dedup guard + flush locks. The service worker is single-threaded,
// so synchronous check-then-set on these closes the get-then-set race that
// chrome.storage.session's async read/write introduces for concurrent calls.
var recentVisitLogs = new Map();
var visitFlushInProgress = false;
var egressFlushInProgress = false;
var userIdPromise = null;

function pruneRecentVisitLogs(now) {
  if (recentVisitLogs.size < 1000) return;
  recentVisitLogs.forEach(function (ts, key) {
    if (now - ts > 60000) recentVisitLogs.delete(key);
  });
}

function shouldLogVisit(domain) {
  var now = Date.now();
  var last = recentVisitLogs.get(domain);
  if (last && (now - last) < IN_MEMORY_VISIT_DEDUP_MS) {
    return false;
  }
  recentVisitLogs.set(domain, now);
  pruneRecentVisitLogs(now);
  return true;
}

function generateEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

async function getOrCreateUserId() {
  if (userIdPromise) return userIdPromise;
  userIdPromise = (async function () {
    try {
      var result = await chrome.storage.local.get(ABLEStorage.USER_ID);
      var stored = result[ABLEStorage.USER_ID];
      if (stored && ABLESecurity.isValidUserId(stored)) {
        return stored;
      }
      if (stored) {
        console.warn("ABLE: Stored user ID malformed, regenerating.");
      }
    } catch (error) {
      console.warn('Failed to retrieve user ID:', error);
    }

    var userId = await ABLESecurity.generateSecureUserId();

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await chrome.storage.local.set({ [ABLEStorage.USER_ID]: userId });
        break;
      } catch (error) {
        console.warn('Failed to store user ID:', error);
      }
    }

    return userId;
  })();
  return userIdPromise;
}

async function logExtensionLifecycle(args) {
  try {
    var userId = args.userId, extensionId = args.extensionId, event = args.event, version = args.version;
    var response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/extension/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        extension_id: extensionId,
        event: event,
        version: version,
      }),
    });

    if (!response.ok) {
      console.warn("ABLE: Failed to log extension lifecycle event:", response.status);
    }
  } catch (error) {
    // Silently fail
  }
}

async function queueVisitLog(domain, status, source, userId, visitedAt, eventId) {
  try {
    var result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    var queue = result[PENDING_VISITS_KEY] || [];

    // Idempotent enqueue: skip if an identical logical visit is already queued.
    var isDuplicate = queue.some(function (entry) {
      return entry.domain === domain && entry.user_id === userId && entry.visited_at === visitedAt;
    });
    if (isDuplicate) return;
    if (queue.length >= MAX_QUEUE_LENGTH) return;

    queue.push({
      domain: domain,
      status: status,
      source: source,
      user_id: userId,
      visited_at: visitedAt,
      event_id: eventId || null,
      enqueued_at: Date.now(),
    });
    await chrome.storage.local.set({ [PENDING_VISITS_KEY]: queue });
  } catch {
    // Silently fail
  }
}

async function processVisitLogQueue() {
  if (visitFlushInProgress) return;
  visitFlushInProgress = true;
  try {
    if (await ABLERateLimiter.isEndpointCoolingDown("log-visit")) return;

    var result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    var queue = result[PENDING_VISITS_KEY] || [];
    if (queue.length === 0) return;

    for (var i = 0; i < queue.length; i++) {
      var entry = queue[i];
      var keep = true;
      var rateLimited = false;
      try {
        var response = await ABLESecurity.secureFetch(
          `${SERVER_URL}/api/log-visit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              domain: entry.domain,
              status: entry.status,
              source: entry.source,
              user_id: entry.user_id,
              visited_at: entry.visited_at,
              event_id: entry.event_id || null,
            }),
          }
        );

        if (response.status === 429) {
          await ABLERateLimiter.recordRateLimitBackoff("log-visit", response);
          console.warn("ABLE: log-visit queue retry rate-limited by server, backing off.");
          rateLimited = true;
        } else if (!response.ok) {
          console.warn("ABLE: Failed to flush queued visit log:", response.status);
        } else {
          keep = false;
        }
      } catch {
        // keep = true
      }

      // Crash-safe: persist the remaining slice immediately so a worker kill
      // after a successful POST cannot re-send that entry.
      await chrome.storage.local.set({
        [PENDING_VISITS_KEY]: keep ? queue.slice(i) : queue.slice(i + 1),
      });

      if (rateLimited) break;
    }
  } catch {
    // Silently fail
  } finally {
    visitFlushInProgress = false;
  }
}

async function logDomainVisit(domain, status, source, timestamp) {
  if (!shouldLogVisit(domain)) {
    return { visit_count: null, duplicate: true };
  }

  await processVisitLogQueue();

  if (await ABLERateLimiter.isEndpointCoolingDown("log-visit")) return null;

  var userId = await getOrCreateUserId();
  var eventId = generateEventId();

  try {
    var response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ domain: domain, status: status, source: source, user_id: userId, visited_at: timestamp, event_id: eventId }),
    });

    if (response.status === 429) {
      await ABLERateLimiter.recordRateLimitBackoff("log-visit", response);
      console.warn("ABLE: log-visit rate-limited by server, backing off.");
      return null;
    }

    if (!response.ok) {
      console.warn("ABLE: Failed to log domain visit:", response.status);
      await queueVisitLog(domain, status, source, userId, timestamp, eventId);
      return null;
    }

    var data = await response.json();
    return { visit_count: data.visit_count ?? null, duplicate: data.duplicate ?? false };
  } catch (error) {
    await queueVisitLog(domain, status, source, userId, timestamp, eventId);
    return null;
  }
}

async function queueEgressEvent(event) {
  try {
    var result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    var queue = result[PENDING_EGRESS_KEY] || [];

    var isDuplicate = event.event_id && queue.some(function (entry) {
      return entry.event_id === event.event_id;
    });
    if (isDuplicate) return;
    if (queue.length >= MAX_QUEUE_LENGTH) return;

    queue.push({
      ...event,
      enqueued_at: Date.now(),
    });
    await chrome.storage.local.set({ [PENDING_EGRESS_KEY]: queue });
  } catch {
    // Silently fail
  }
}

async function processEgressLogQueue() {
  if (egressFlushInProgress) return;
  egressFlushInProgress = true;
  try {
    if (await ABLERateLimiter.isEndpointCoolingDown("log-egress")) return;

    var result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    var queue = result[PENDING_EGRESS_KEY] || [];
    if (queue.length === 0) return;

    for (var i = 0; i < queue.length; i++) {
      var entry = queue[i];
      var keep = true;
      var rateLimited = false;
      try {
        var response = await ABLESecurity.secureFetch(
          `${SERVER_URL}/api/log-egress`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              domain: entry.domain,
              user_id: entry.user_id,
              file_name: entry.file_name,
              file_size: entry.file_size,
              risk_score: entry.risk_score,
              action: entry.action,
              user_action: entry.user_action,
              occurred_at: entry.occurred_at,
              flagged_items: entry.flagged_items || null,
              scan_token: entry.scan_token || null,
              event_id: entry.event_id || null,
            }),
          }
        );

        if (response.status === 429) {
          await ABLERateLimiter.recordRateLimitBackoff("log-egress", response);
          console.warn("ABLE: log-egress queue retry rate-limited by server, backing off.");
          rateLimited = true;
        } else if (!response.ok) {
          console.warn("ABLE: Failed to flush queued egress event:", response.status);
        } else {
          keep = false;
        }
      } catch {
        // keep = true
      }

      await chrome.storage.local.set({
        [PENDING_EGRESS_KEY]: keep ? queue.slice(i) : queue.slice(i + 1),
      });

      if (rateLimited) break;
    }
  } catch {
    // Silently fail
  } finally {
    egressFlushInProgress = false;
  }
}

async function logEgressEvent(args) {
  // If running in a content script, delegate to background service worker so HTTPS pages don't block http:// backend via Mixed Content
  if (typeof window !== 'undefined' && window.document && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      await chrome.runtime.sendMessage({
        type: "logEgress",
        payload: args
      });
      return;
    } catch (e) {
      console.debug("ABLE: Delegating logEgress to background failed, falling back to local queue:", e.message);
    }
  }

  var domain = args.domain, fileName = args.fileName, fileSize = args.fileSize, riskScore = args.riskScore, action = args.action, userAction = args.userAction, timestamp = args.timestamp, source = args.source, contentHash = args.contentHash, scanDurationMs = args.scanDurationMs, contentSize = args.contentSize, flaggedItems = args.flaggedItems, scanToken = args.scanToken;

  await processEgressLogQueue();

  var userId = await getOrCreateUserId();

  var payload = {
    domain: domain,
    user_id: userId,
    file_name: fileName,
    file_size: fileSize,
    risk_score: riskScore,
    action: action,
    user_action: userAction,
    occurred_at: timestamp,
    source: source || 'unknown',
    content_hash: contentHash || null,
    scan_duration_ms: scanDurationMs || null,
    content_size: contentSize || fileSize || null,
    flagged_items: flaggedItems ? JSON.stringify(flaggedItems) : null,
    scan_token: scanToken || null,
    event_id: generateEventId(),
  };

  if (await ABLERateLimiter.isEndpointCoolingDown("log-egress")) {
    await queueEgressEvent(payload);
    return;
  }
  if (await ABLERateLimiter.isDailyEgressCapReached()) {
    await queueEgressEvent(payload);
    return;
  }

  try {
    var response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-egress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      await ABLERateLimiter.recordRateLimitBackoff("log-egress", response);
      console.warn("ABLE: log-egress rate-limited by server, backing off.");
      await queueEgressEvent(payload);
      return;
    }

    if (!response.ok) {
      console.warn("ABLE: Failed to log egress event:", response.status);
      await queueEgressEvent(payload);
      return;
    }

    await ABLERateLimiter.incrementDailyEgressCount(action);
  } catch (error) {
    await queueEgressEvent(payload);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLELogging = {
    getOrCreateUserId: getOrCreateUserId,
    logExtensionLifecycle: logExtensionLifecycle,
    logDomainVisit: logDomainVisit,
    queueVisitLog: queueVisitLog,
    processVisitLogQueue: processVisitLogQueue,
    logEgressEvent: logEgressEvent,
    queueEgressEvent: queueEgressEvent,
    processEgressLogQueue: processEgressLogQueue,
  };
}