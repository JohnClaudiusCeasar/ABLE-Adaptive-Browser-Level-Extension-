/**
 * ABLE Extension - File Scanner
 *
 * File reading, content extraction, and remote scoring.
 *
 * The scoring algorithm lives on the server: this module only extracts text
 * locally and posts it to /api/score-content (api/scoring.js), which returns
 * the server-computed, HMAC-signed verdict. Unscannable files (PDF/OLE/images)
 * are still scored — the server returns the domain risk baseline for them, so
 * nothing is ever silently logged as 0%.
 */

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function computeContentHash(file) {
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  } catch {
    return null;
  }
}

function detectFileTypeFromMagicBytes(file) {
  return new Promise(function (resolve) {
    var slice = file.slice(0, 8);
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var arr = new Uint8Array(reader.result);
        var hex = Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

        if (hex.startsWith('25504446')) return resolve('pdf');
        if (hex.startsWith('504b0304')) return resolve('zip');
        if (hex.startsWith('d0cf11e0')) return resolve('ole');
        if (hex.startsWith('89504e47')) return resolve('png');
        if (hex.startsWith('ffd8ff')) return resolve('jpg');
        if (hex.startsWith('47494638')) return resolve('gif');
        return resolve(null);
      } catch {
        return resolve(null);
      }
    };
    reader.onerror = function () { resolve(null); };
    reader.readAsArrayBuffer(slice);
  });
}

// ─── File-type extraction ────────────────────────────────────────────────────
// Note: the file-type heuristic multiplier (⑥) is applied server-side now
// (RiskScoringService::fileTypeMultiplier); the extension only reports the
// extension/container it detected.

async function scanFile(file) {
  const scanStartTime = Date.now();
  const MAX_TEXT_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_BINARY_SCAN_SIZE = 10 * 1024 * 1024;
  let text = null;
  let fileFormat = "plain";

  // Detect binary containers by magic bytes on every upload, regardless of the
  // synthetic filename (e.g. "upload.pdf") assigned by the file extractor.
  var detectedType = null;
  if (file.size < MAX_BINARY_SCAN_SIZE) {
    detectedType = await detectFileTypeFromMagicBytes(file);
  }
  console.debug("ABLE: Scanning file:", file.name, "size:", file.size, "detectedType:", detectedType);

  // PDF and legacy OLE (.doc/.xls/.ppt) have no text extractor — score them
  // without text (the server applies the domain risk baseline) rather than
  // sending garbage readAsText output.
  if (detectedType === 'pdf' || detectedType === 'ole') {
    console.warn("ABLE: Unscannable binary type (domain baseline will be scored):", detectedType, file.name);
  } else if (detectedType === 'zip' || detectedType === 'png' || detectedType === 'jpg' || detectedType === 'gif') {
    // ZIP may be an Office Open XML container (docx/xlsx/pptx); image containers
    // have no meaningful text to scan.
    if (detectedType === 'zip') {
      try {
        var zipOfficeFormat = detectOfficeFormat(file);
        if (zipOfficeFormat) {
          var zipOfficeResult = await extractOfficeText(file);
          text = zipOfficeResult.text;
          fileFormat = zipOfficeResult.format;
        } else {
          console.warn("ABLE: Non-Office ZIP skipped (domain baseline will be scored):", file.name);
        }
      } catch (err) {
        console.warn("ABLE: Office extraction failed:", err.message || err);
      }
    } else {
      console.warn("ABLE: Image file skipped (domain baseline will be scored):", detectedType, file.name);
    }
  }

  if (!text && detectedType !== 'pdf' && detectedType !== 'ole' && detectedType !== 'png' && detectedType !== 'jpg' && detectedType !== 'gif') {
    var officeFormat = detectOfficeFormat(file);
    if (officeFormat) {
      try {
        var officeResult = await extractOfficeText(file);
        text = officeResult.text;
        fileFormat = officeResult.format;
      } catch (err) {
        console.warn("ABLE: Office parsing skipped:", err.message || err);
      }
    } else if (file.size > MAX_TEXT_FILE_SIZE) {
      console.warn("ABLE: File too large for text extraction, scoring domain baseline:", file.name);
    } else {
      try {
        text = await readFileContent(file);
        console.debug("ABLE: Read file content, length:", text?.length, "type:", typeof text);
      } catch (err) {
        console.warn("ABLE: Failed to read file content:", err.message || err);
      }
    }
  }

  // ── ④ Collect page context for contextual risk scoring ────────────────────
  var pageContext = null;
  try {
    if (typeof ABLEPageSignals !== 'undefined' && ABLEPageSignals.collectPageSignals) {
      pageContext = ABLEPageSignals.collectPageSignals();
    }
  } catch (e) {
    // Non-fatal — scoring proceeds without page context
  }

  const contentHash = await computeContentHash(file);
  var fileExt = (file.name.split('.').pop() || '').toLowerCase();

  // Server-authoritative scoring (returns null when unreachable/unverifiable).
  const verdict = await requestContentScore({
    text: text,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileExt,
    fileFormat: fileFormat,
    contentHash: contentHash,
    pageContext: pageContext,
    domain: domainStatus?.domain || new URL(window.location.href).hostname.replace(/^www\./, ""),
  });

  const scanDurationMs = Date.now() - scanStartTime;

  if (!verdict) {
    console.warn("ABLE: Scoring server unreachable — upload must be held:", file.name);
    return {
      ok: false,
      fileName: file.name,
      fileSize: file.size,
      contentHash: contentHash,
      scanDurationMs: scanDurationMs,
    };
  }

  console.log("ABLE Scan:", {
    file: file.name,
    domain: domainStatus?.domain,
    domain_status: verdict.domainStatus,
    domain_risk_score: verdict.domainRiskScore,
    pattern_score: verdict.patternScore,
    total_score: verdict.score,
    threshold: ABLERuntimeSettings.get("behavior.risk_threshold", 85),
    flagged_item_count: verdict.flaggedItems.length,
    scan_duration_ms: scanDurationMs,
    content_hash: contentHash ? contentHash.substring(0, 16) + '...' : null,
  });

  return {
    ok: true,
    score: verdict.score,
    patternScore: verdict.patternScore,
    domainRiskScore: verdict.domainRiskScore,
    flaggedItems: verdict.flaggedItems,
    scanToken: verdict.scanToken,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileFormat,
    contentHash,
    scanDurationMs,
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEFileScanner = {
    scanFile,
    readFileContent,
    computeContentHash,
    detectFileTypeFromMagicBytes,
  };
}
