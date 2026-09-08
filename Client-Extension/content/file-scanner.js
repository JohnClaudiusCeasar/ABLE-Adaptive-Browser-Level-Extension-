/**
 * ABLE Extension - File Scanner
 *
 * File reading, content extraction, and scanning for sensitive data.
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

async function scanFile(file) {
  const scanStartTime = Date.now();
  const MAX_TEXT_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_BINARY_SCAN_SIZE = 10 * 1024 * 1024;
  let text;
  let fileFormat = "plain";

  const isBinaryUpload = file.name === 'binary-upload' || file.name === 'blob';
  console.debug("ABLE: Scanning file:", file.name, "size:", file.size, "isBinaryUpload:", isBinaryUpload);

  if (isBinaryUpload && file.size < MAX_BINARY_SCAN_SIZE) {
    var detectedType = await detectFileTypeFromMagicBytes(file);
    console.debug("ABLE: Detected file type:", detectedType);
    if (detectedType === 'pdf' || detectedType === 'zip' || detectedType === 'ole') {
      try {
        var officeFormatBinary = detectOfficeFormat(file);
        if (officeFormatBinary) {
          var officeResult = await extractOfficeText(file);
          text = officeResult.text;
          fileFormat = officeResult.format;
        }
      } catch (err) {
        console.warn("ABLE: Office extraction failed:", err.message || err);
      }
    }
  }

  if (!text) {
    var officeFormat = detectOfficeFormat(file);
    if (officeFormat) {
      try {
        var officeResult = await extractOfficeText(file);
        text = officeResult.text;
        fileFormat = officeResult.format;
      } catch (err) {
        console.warn("ABLE: Office parsing skipped:", err.message || err);
        return null;
      }
    } else {
      if (file.size > MAX_TEXT_FILE_SIZE) {
        console.warn("ABLE: File too large for scanning, skipping:", file.name);
        return null;
      }
      try {
        text = await readFileContent(file);
        console.debug("ABLE: Read file content, length:", text?.length, "type:", typeof text);
      } catch (err) {
        console.warn("ABLE: Failed to read file content:", err.message || err);
        return null;
      }
    }
  }

  const result = await calculateRiskScore(text);
  const domainRiskScore = domainStatus?.risk_score || 0;
  const totalScore = Math.min(100, domainRiskScore + result.score);

  const flaggedItems = [];
  if (domainRiskScore > 0) {
    flaggedItems.push({
      label: "Domain Risk (" + (domainStatus.status === "unlisted" ? "Unlisted" : "Unsafe") + ")",
      count: 1,
      weight: domainRiskScore,
    });
  }
  flaggedItems.push(...result.flaggedItems);

  const riskThreshold = ABLERuntimeSettings.get("behavior.risk_threshold", 90);
  const contentHash = await computeContentHash(file);
  const scanDurationMs = Date.now() - scanStartTime;

  console.log("ABLE Scan:", {
    file: file.name,
    domain: domainStatus.domain,
    domain_status: domainStatus.status,
    domain_risk_score: domainRiskScore,
    pattern_score: result.score,
    total_score: totalScore,
    threshold: riskThreshold,
    triggered: totalScore > riskThreshold,
    flagged_item_count: flaggedItems.length,
    scan_duration_ms: scanDurationMs,
    content_hash: contentHash ? contentHash.substring(0, 16) + '...' : null,
  });

  return {
    score: totalScore,
    flaggedItems,
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
