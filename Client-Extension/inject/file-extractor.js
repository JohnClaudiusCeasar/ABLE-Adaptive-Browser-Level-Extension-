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

function extractFilenameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    var parsed = new URL(url, window.location.href);
    var queryKeys = ['filename', 'file_name', 'fileName', 'name', 'file', 'title', 'document'];
    for (var i = 0; i < queryKeys.length; i++) {
      var val = parsed.searchParams.get(queryKeys[i]);
      if (val && /\.[a-zA-Z0-9]{2,5}$/.test(val)) {
        return decodeURIComponent(val);
      }
    }
    var segments = parsed.pathname.split('/');
    var lastSegment = segments[segments.length - 1];
    if (lastSegment && /\.[a-zA-Z0-9]{2,5}$/.test(lastSegment)) {
      return decodeURIComponent(lastSegment);
    }
  } catch (e) {}
  return null;
}

function guessExtensionFromMagicBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;
  var hex = Array.from(bytes.slice(0, 8)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  if (hex.startsWith('25504446')) return '.pdf';
  if (hex.startsWith('504b0304')) return '.docx'; // ZIP-based: docx, xlsx, pptx, zip
  if (hex.startsWith('d0cf11e0')) return '.doc';  // OLE-based: doc, xls, ppt
  if (hex.startsWith('89504e47')) return '.png';
  if (hex.startsWith('ffd8ff')) return '.jpg';
  if (hex.startsWith('47494638')) return '.gif';
  if (hex.startsWith('52494646')) return '.webp'; // RIFF
  return null;
}

function isDocumentOrMediaMime(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return false;
  var mt = mimeType.toLowerCase().trim();
  if (mt.indexOf('image/') === 0) return true;
  if (mt.indexOf('video/') === 0) return true;
  if (mt.indexOf('audio/') === 0) return true;
  if (mt.indexOf('application/pdf') === 0) return true;
  if (mt.indexOf('application/zip') === 0 || mt.indexOf('application/x-zip') === 0) return true;
  if (mt.indexOf('application/vnd.openxmlformats') === 0) return true;
  if (mt.indexOf('application/msword') === 0) return true;
  if (mt.indexOf('application/vnd.ms-') === 0) return true;
  if (mt.indexOf('text/csv') === 0) return true;
  return false;
}

function extractFiles(body, context) {
  context = context || {};
  var headers = context.headers;
  var requestUrl = context.url;

  var cdHeader = null;
  if (headers) {
    if (typeof headers.get === 'function') {
      cdHeader = headers.get('Content-Disposition') || headers.get('content-disposition');
    } else if (typeof headers === 'object') {
      for (var k in headers) {
        if (k.toLowerCase() === 'content-disposition') {
          cdHeader = headers[k];
          break;
        }
      }
    }
  }

  var headerFilename = parseContentDisposition(cdHeader);
  var urlFilename = extractFilenameFromUrl(requestUrl);
  var candidateFilename = headerFilename || urlFilename;

  if (body instanceof File) {
    var fname = (body.name && body.name !== 'blob') ? body.name : (candidateFilename || body.name);
    return [{ file: fname !== body.name ? new File([body], fname, { type: body.type }) : body, source: 'file', contentSize: body.size }];
  }

  if (body instanceof Blob) {
    var mime = (body.type || '').toLowerCase();
    // Exclude JSON, form-urlencoded, and event-streams: these are API payloads, not file uploads
    if (mime.indexOf('application/json') === 0 || mime.indexOf('text/json') === 0 || mime.indexOf('application/x-www-form-urlencoded') === 0 || mime.indexOf('text/event-stream') === 0) {
      return [];
    }

    var blobName = candidateFilename ||
      (window.__ableMatchFilename ? window.__ableMatchFilename(body.size, null) : null);

    if (!blobName && isDocumentOrMediaMime(body.type)) {
      var mimeExt = (body.type.split('/')[1] || '').split(';')[0];
      blobName = mimeExt ? 'upload.' + mimeExt : null;
    }

    if (!blobName) {
      // Not a tracked file, no candidate filename, and not a recognized document/media MIME type
      return [];
    }

    return [{ file: new File([body], blobName, { type: body.type }), source: 'blob', contentSize: body.size }];
  }

  if (body instanceof FormData) {
    var results = [];
    for (var entry of body.entries()) {
      var fieldName = entry[0];
      var val = entry[1];
      if (val instanceof File) {
        var fname = (val.name && val.name !== 'blob') ? val.name : (candidateFilename || val.name);
        results.push({ file: fname !== val.name ? new File([val], fname, { type: val.type }) : val, source: 'formdata', contentSize: val.size });
      } else if (val instanceof Blob) {
        var blobName = candidateFilename ||
          (window.__ableMatchFilename ? window.__ableMatchFilename(val.size, null) : null);
        if (!blobName && isDocumentOrMediaMime(val.type)) {
          var mimeExt = (val.type.split('/')[1] || '').split(';')[0];
          blobName = fieldName ? fieldName + '.' + mimeExt : 'upload.' + mimeExt;
        }
        if (blobName) {
          results.push({ file: new File([val], blobName, { type: val.type }), source: 'formdata', contentSize: val.size });
        }
      }
    }
    return results;
  }

  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    var byteLength = body.byteLength || 0;
    var byteOffset = body.byteOffset || 0;
    var underlyingBuffer = body.buffer || body;
    var viewBytes = new Uint8Array(underlyingBuffer, byteOffset, Math.min(16, byteLength));

    var bodyHash = computeBodyHashSync(body);
    var ext = guessExtensionFromMagicBytes(viewBytes);
    var matchedFilename = (window.__ableMatchFilename ? window.__ableMatchFilename(byteLength, bodyHash) : null);
    var arrayBufferName = candidateFilename || matchedFilename || (ext ? 'upload' + ext : null);

    if (!arrayBufferName) {
      // Raw binary protocol, WebSocket message, or unknown stream without recognized file magic bytes or tracked file
      return [];
    }

    return [{
      file: new File([underlyingBuffer.slice(byteOffset, byteOffset + byteLength)], arrayBufferName, { type: 'application/octet-stream' }),
      source: body instanceof ArrayBuffer ? 'arraybuffer' : 'typedarray',
      contentSize: byteLength
    }];
  }

  if (body instanceof URLSearchParams) {
    return [];
  }

  if (typeof body === 'string' && body.length >= 100) {
    // Check for multipart form-data encoded as string
    var cdMatch = body.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)";\s*filename="([^"]+)"/i);
    if (cdMatch && cdMatch[2] && cdMatch[2] !== 'blob') {
      return [{
        file: new File([body], cdMatch[2], { type: 'text/plain' }),
        source: 'string-multipart',
        contentSize: body.length
      }];
    }
    // Check for JSON containing explicit file upload structure with file extension
    if (body.charCodeAt(0) === 123) {
      try {
        var json = JSON.parse(body);
        var rawFileName = json.fileName || json.filename;
        if (rawFileName && typeof rawFileName === 'string' && /\.[a-zA-Z0-9]{2,5}$/.test(rawFileName)) {
          var fileContent = json.file || json.fileData || json.content || json.data || json.payload;
          if (typeof fileContent === 'string' && fileContent.length > 100) {
            return [{
              file: new File([fileContent], rawFileName, { type: 'text/plain' }),
              source: 'json-upload',
              contentSize: fileContent.length
            }];
          }
        }
      } catch (e) {}
    }
  }

  return [];
}

async function extractFilesAsync(body, context) {
  var syncFiles = extractFiles(body, context);
  if (syncFiles.length > 0) return syncFiles;

  if (body instanceof ReadableStream) {
    var peeked = await peekReadableStream(body, 512);
    if (peeked) {
      var ext = guessExtensionFromMagicBytes(new Uint8Array(peeked.buffer));
      var requestUrl = context ? context.url : null;
      var candidateFilename = extractFilenameFromUrl(requestUrl);
      var streamName = candidateFilename ||
        (window.__ableMatchFilename ? window.__ableMatchFilename(peeked.bytesRead, null) : null) ||
        (ext ? 'stream-upload' + ext : null);

      if (!streamName) {
        return [];
      }

      return [{
        file: new File([peeked.buffer], streamName, { type: 'application/octet-stream' }),
        source: 'readablestream',
        contentSize: peeked.bytesRead
      }];
    }
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
    extractFilesAsync,
    extractFilenameFromUrl,
    filesMatch,
    clearFileInputs,
    computeBodyHashSync,
    parseContentDisposition,
  };
}
