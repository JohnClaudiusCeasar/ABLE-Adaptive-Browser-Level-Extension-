/**
 * ABLE Extension - File Extractor
 *
 * Extracts files from various request body formats.
 */

function computeBodyHashSync(body) {
  try {
    var bytes;
    if (body instanceof ArrayBuffer) {
      bytes = new Uint8Array(body.slice(0, 16));
    } else if (ArrayBuffer.isView(body)) {
      bytes = new Uint8Array(body.buffer.slice(0, 16));
    } else if (body instanceof Blob) {
      return null;
    } else {
      return null;
    }
    var hex = Array.from(bytes).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
    var size = body.byteLength || body.size || 0;
    return hex + ':' + size;
  } catch (e) {
    return null;
  }
}

function extractFiles(body) {
  if (body instanceof File) return [{ file: body, source: 'file', contentSize: body.size }];
  if (body instanceof Blob) {
    var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(body.size, null) : null;
    if (!blobName) {
      console.debug("ABLE: Blob filename not recovered, size:", body.size, "type:", body.type);
    }
    return [{ file: new File([body], blobName || 'blob', { type: body.type }), source: 'blob', contentSize: body.size }];
  }
  if (body instanceof FormData) {
    var results = [];
    for (var entry of body.entries()) {
      if (entry[1] instanceof File) {
        results.push({ file: entry[1], source: 'formdata', contentSize: entry[1].size });
      } else if (entry[1] instanceof Blob) {
        var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(entry[1].size, null) : null;
        results.push({ file: new File([entry[1]], blobName || 'blob', { type: entry[1].type }), source: 'formdata', contentSize: entry[1].size });
      }
    }
    return results;
  }
  if (body instanceof ArrayBuffer) {
    var bodyHash = computeBodyHashSync(body);
    var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(body.byteLength, bodyHash) : null;
    return [{
      file: new File([body], arrayBufferName || 'binary-upload', { type: 'application/octet-stream' }),
      source: 'arraybuffer',
      contentSize: body.byteLength
    }];
  }
  if (ArrayBuffer.isView(body)) {
    var bodyHash = computeBodyHashSync(body);
    var typedArrayName = window.__ableMatchFilename ? window.__ableMatchFilename(body.byteLength, bodyHash) : null;
    return [{
      file: new File([body.buffer], typedArrayName || 'binary-upload', { type: 'application/octet-stream' }),
      source: 'typedarray',
      contentSize: body.byteLength
    }];
  }
  if (body instanceof ReadableStream) {
    return [];
  }
  if (body instanceof URLSearchParams) {
    return [];
  }
  if (typeof body === 'string') {
    return [];
  }
  return [];
}

function filesMatch(a, b) {
  return a.name === b.name &&
         a.size === b.size &&
         a.lastModified === b.lastModified &&
         a.type === b.type;
}

function clearFileInputs(files) {
  if (!files || files.length === 0) return;
  var inputs = document.querySelectorAll('input[type="file"]');
  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i];
    if (!input.files || input.files.length === 0) continue;
    var shouldClear = false;
    for (var j = 0; j < files.length && !shouldClear; j++) {
      for (var k = 0; k < input.files.length; k++) {
        if (input.files[k] === files[j] || filesMatch(input.files[k], files[j])) {
          shouldClear = true;
          break;
        }
      }
    }
    if (shouldClear) {
      input.value = '';
    }
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEFileExtractor = {
    extractFiles,
    filesMatch,
    clearFileInputs,
    computeBodyHashSync,
  };
}
