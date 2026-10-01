/**
 * ABLE Extension - Remote Scoring Client
 *
 * Server-authoritative risk scoring: the extension only extracts text and
 * metadata, then POSTs it to the server, which runs the regex scoring
 * algorithm (including the per-pattern regex modifiers) against its own
 * database patterns and returns an HMAC-signed verdict.
 *
 * Returns null whenever the verdict cannot be trusted (server unreachable,
 * timeout, non-OK status, or signature verification failure) so callers can
 * HOLD the upload instead of silently scoring 0%.
 */

const SCORE_TEXT_MAX_LENGTH = 200000;
const SCORE_REQUEST_TIMEOUT_MS = 15000;

/**
 * Request a server-computed score for extracted content.
 *
 * @param {object} payload
 * @param {string|null} payload.text - Extracted text (null for unscannable files).
 * @param {string} payload.fileName
 * @param {number} payload.fileSize
 * @param {string} [payload.fileType] - File extension.
 * @param {string} [payload.fileFormat] - Resolved container format (docx, xlsx...).
 * @param {string|null} [payload.contentHash]
 * @param {object|null} [payload.pageContext] - Page signals for layer 4.
 * @param {string} payload.domain
 * @returns {Promise<object|null>} Verified verdict or null (treat as failure).
 */
async function requestContentScore(payload) {
  // Content scripts on HTTPS pages cannot fetch http:// backends directly
  // (Mixed Content) — relay through the background service worker.
  if (typeof window !== "undefined" && window.document && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "scoreContent",
        payload: payload,
      });
      if (response && response.success && response.verdict) {
        return response.verdict;
      }
      return null;
    } catch (e) {
      console.debug("ABLE: scoreContent relay failed:", e.message);
      return null;
    }
  }
  return requestContentScoreDirect(payload);
}

/**
 * Direct fetch path (background service worker). Verifies the verdict
 * envelope's HMAC before trusting any score.
 */
async function requestContentScoreDirect(payload) {
  try {
    const body = {
      domain: payload.domain,
      text: typeof payload.text === "string" ? payload.text.slice(0, SCORE_TEXT_MAX_LENGTH) : null,
      file_name: payload.fileName || null,
      file_size: typeof payload.fileSize === "number" ? payload.fileSize : null,
      file_type: payload.fileType || null,
      file_format: payload.fileFormat || null,
      content_hash: payload.contentHash || null,
      page_context: payload.pageContext || null,
      event_id: payload.eventId || null,
    };

    const response = await ABLESecurity.secureFetch(`${SERVER_URL}/api/score-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: SCORE_REQUEST_TIMEOUT_MS,
    });

    if (!response.ok) {
      console.warn("ABLE: score-content returned status", response.status);
      if (typeof ABLERiskPatterns !== "undefined" && ABLERiskPatterns.markOfflineEpisode) {
        await ABLERiskPatterns.markOfflineEpisode();
      }
      return null;
    }

    const envelope = await response.json();
    const verified = await ABLESecurity.verifySignedCache(envelope);
    if (!verified) {
      console.warn("ABLE: Scoring verdict failed signature verification — rejecting.");
      return null;
    }

    // Server is reachable again: safely delete the offline snapshot if an
    // outage episode had begun. Snapshot maintenance must never sink a
    // verified verdict.
    try {
      if (typeof ABLERiskPatterns !== "undefined" && ABLERiskPatterns.safelyDeleteSnapshotOnReconnect) {
        await ABLERiskPatterns.safelyDeleteSnapshotOnReconnect();
      }
    } catch (snapshotError) {
      console.debug("ABLE: Snapshot cleanup failed:", snapshotError.message);
    }

    const v = envelope.payload || {};
    return {
      score: v.total_score,
      patternScore: v.pattern_score,
      domainRiskScore: v.domain_risk_score,
      domainStatus: v.domain_status,
      flaggedItems: Array.isArray(v.flagged_items) ? v.flagged_items : [],
      scanToken: envelope.scan_token || null,
      scoredAt: v.scored_at,
    };
  } catch (error) {
    console.warn("ABLE: Scoring request failed (server unreachable?):", error.message);
    try {
      if (typeof ABLERiskPatterns !== "undefined" && ABLERiskPatterns.markOfflineEpisode) {
        await ABLERiskPatterns.markOfflineEpisode();
      }
    } catch {}
    return null;
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEScoring = {
    requestContentScore: requestContentScore,
    requestContentScoreDirect: requestContentScoreDirect,
  };
  globalThis.requestContentScore = requestContentScore;
  globalThis.requestContentScoreDirect = requestContentScoreDirect;
}
