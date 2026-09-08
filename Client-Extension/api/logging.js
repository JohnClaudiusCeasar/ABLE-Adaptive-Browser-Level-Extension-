/**
 * ABLE Extension - Logging
 *
 * Handles logging of domain visits and egress events to the server.
 * Includes queueing for offline/retry scenarios.
 */

const PENDING_VISITS_KEY = "able:pending_visits";
const PENDING_EGRESS_KEY = "able:pending_egress";

async function getOrCreateUserId() {
  const USER_ID_KEY = 'able:user_id';

  try {
    const result = await chrome.storage.local.get(USER_ID_KEY);
    const stored = result[USER_ID_KEY];
    if (stored && ABLESecurity.isValidUserId(stored)) {
      return stored;
    }
    if (stored) {
      console.warn("ABLE: Stored user ID malformed, regenerating.");
    }
  } catch (error) {
    console.warn('Failed to retrieve user ID:', error);
  }

  const userId = await ABLESecurity.generateSecureUserId();

  try {
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  } catch (error) {
    console.warn('Failed to store user ID:', error);
  }

  return userId;
}

async function logExtensionLifecycle({ userId, extensionId, event, version }) {
  try {
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/extension/lifecycle`, {
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

async function queueVisitLog(domain, status, source, userId, visitedAt) {
  try {
    const result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    const queue = result[PENDING_VISITS_KEY] || [];
    queue.push({
      domain,
      status,
      source,
      user_id: userId,
      visited_at: visitedAt,
      enqueued_at: Date.now(),
    });
    await chrome.storage.local.set({ [PENDING_VISITS_KEY]: queue });
  } catch {
    // Silently fail
  }
}

async function processVisitLogQueue() {
  try {
    if (await ABLERateLimiter.isEndpointCoolingDown("log-visit")) return;

    const result = await chrome.storage.local.get(PENDING_VISITS_KEY);
    const queue = result[PENDING_VISITS_KEY] || [];
    if (queue.length === 0) return;

    const remaining = [];

    for (const entry of queue) {
      try {
        const response = await ABLESecurity.secureFetch(
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
            }),
          }
        );

        if (response.status === 429) {
          await ABLERateLimiter.recordRateLimitBackoff("log-visit", response);
          console.warn("ABLE: log-visit queue retry rate-limited by server, backing off.");
          remaining.push(entry);
          break;
        }

        if (!response.ok) {
          console.warn("ABLE: Failed to flush queued visit log:", response.status);
          remaining.push(entry);
        }
      } catch {
        remaining.push(entry);
      }
    }

    await chrome.storage.local.set({ [PENDING_VISITS_KEY]: remaining });
  } catch {
    // Silently fail
  }
}

async function logDomainVisit(domain, status, source, timestamp) {
  await processVisitLogQueue();

  if (await ABLERateLimiter.isEndpointCoolingDown("log-visit")) return null;

  const userId = await getOrCreateUserId();

  try {
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ domain, status, source, user_id: userId, visited_at: timestamp }),
    });

    if (response.status === 429) {
      await ABLERateLimiter.recordRateLimitBackoff("log-visit", response);
      console.warn("ABLE: log-visit rate-limited by server, backing off.");
      return null;
    }

    if (!response.ok) {
      console.warn("ABLE: Failed to log domain visit:", response.status);
      await queueVisitLog(domain, status, source, userId, timestamp);
      return null;
    }

    const data = await response.json();
    return data.visit_count ?? null;
  } catch (error) {
    await queueVisitLog(domain, status, source, userId, timestamp);
    return null;
  }
}

async function queueEgressEvent(event) {
  try {
    const result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    const queue = result[PENDING_EGRESS_KEY] || [];
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
  try {
    if (await ABLERateLimiter.isEndpointCoolingDown("log-egress")) return;

    const result = await chrome.storage.local.get(PENDING_EGRESS_KEY);
    const queue = result[PENDING_EGRESS_KEY] || [];
    if (queue.length === 0) return;

    const remaining = [];

    for (const entry of queue) {
      try {
        const response = await ABLESecurity.secureFetch(
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
            }),
          }
        );

        if (response.status === 429) {
          await ABLERateLimiter.recordRateLimitBackoff("log-egress", response);
          console.warn("ABLE: log-egress queue retry rate-limited by server, backing off.");
          remaining.push(entry);
          break;
        }

        if (!response.ok) {
          console.warn("ABLE: Failed to flush queued egress event:", response.status);
          remaining.push(entry);
        }
      } catch {
        remaining.push(entry);
      }
    }

    await chrome.storage.local.set({ [PENDING_EGRESS_KEY]: remaining });
  } catch {
    // Silently fail
  }
}

async function logEgressEvent({ domain, fileName, fileSize, riskScore, action, userAction, timestamp, source, contentHash, scanDurationMs, contentSize, flaggedItems }) {
  await processEgressLogQueue();

  const userId = await getOrCreateUserId();

  const payload = {
    domain,
    user_id: userId,
    file_name: fileName,
    file_size: fileSize,
    risk_score: riskScore,
    action,
    user_action: userAction,
    occurred_at: timestamp,
    source: source || 'unknown',
    content_hash: contentHash || null,
    scan_duration_ms: scanDurationMs || null,
    content_size: contentSize || fileSize || null,
    flagged_items: flaggedItems ? JSON.stringify(flaggedItems) : null,
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
    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/log-egress`, {
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
    getOrCreateUserId,
    logExtensionLifecycle,
    logDomainVisit,
    queueVisitLog,
    processVisitLogQueue,
    logEgressEvent,
    queueEgressEvent,
    processEgressLogQueue,
  };
}
