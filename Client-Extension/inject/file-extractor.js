/**
 * ABLE Extension - File Extractor
 *
 * Extracts files from various request body formats.
 * Includes Content-Disposition filename parsing and
 * ReadableStream buffered peek for modern upload detection.
 */

function parseContentDisposition(header) {
  if (!header) return null;
  // Try to extract filename from Content-Disposition header
  // Handles: attachment; filename="file.pdf", attachment; filename*=UTF-8''file.pdf
  var match = header.match(/filename\s*=\s*"([^"]*)"/i);
  if (match) return match[1];
  match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (match) return decodeURIComponent(match[1]);
  match = header.match(/filename\s*=\s*([^;\s]+)/i);
  if (match) return match[1];
  return null;
}

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

async function peekReadableStream(stream, maxBytes) {
  if (!(stream instanceof ReadableStream)) return null;
  try {
    var reader = stream.getReader();
    var chunks = [];
    var totalRead = 0;
    while (totalRead < maxBytes) {
      var result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
      totalRead += result.value.length;
    }
    // Reconstruct the stream by prepending the read chunks
    var combined = new Uint8Array(totalRead);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      combined.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    var newStream = new ReadableStream({
      start(controller) {
        for (var j = 0; j < chunks.length; j++) {
          controller.enqueue(chunks[j]);
        }
        reader.releaseLock();
        // Pump remaining chunks from original stream
        (async function pump() {
          try {
            while (true) {
              var r = await reader.read();
              if (r.done) break;
              controller.enqueue(r.value);
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        })();
      }
    });
    return { buffer: combined.buffer, stream: newStream, bytesRead: totalRead };
  } catch (e) {
    return null;
  }
}

async function extractFiles(body) {
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
    var peeked = await peekReadableStream(body, 512);
    if (peeked) {
      var detectedType = detectFileTypeFromMagicBytes(new File([peeked.buffer], 'peek', { type: 'application/octet-stream' }));
      console.debug("ABLE: ReadableStream peek detected type:", detectedType, "bytes:", peeked.bytesRead);
      // Return the reconstructed stream so the original fetch continues
      return [{
        file: new File([peeked.buffer], window.__ableMatchFilename ? window.__ableMatchFilename(peeked.bytesRead, null) || 'stream-upload' : 'stream-upload', { type: 'application/octet-stream' }),
        source: 'readablestream',
        contentSize: peeked.bytesRead
      }];
    }
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
    parseContentDisposition,
  };
}
