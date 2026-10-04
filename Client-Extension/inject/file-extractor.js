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

function parseUrlForFilename(url) {
  if (typeof URL === 'function') {
    try {
      var base = (typeof window !== 'undefined' && window.location && window.location.href) || 'https://localhost/';
      return new URL(url, base);
    } catch (e) { /* fall through to regex fallback */ }
  }
  return null;
}

function extractFilenameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  var queryKeys = ['filename', 'file_name', 'fileName', 'name', 'file', 'title', 'document'];
  var parsed = parseUrlForFilename(url);
  if (parsed) {
    try {
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
  // Regex fallback for non-browser runtimes (URL constructor unavailable).
  try {
    var q = url.split('?')[1] || '';
    var pairs = q.split('&');
    for (var j = 0; j < pairs.length; j++) {
      var kv = pairs[j].split('=');
      if (queryKeys.indexOf(decodeURIComponent(kv[0] || '')) >= 0) {
        var v = decodeURIComponent(kv[1] || '');
        if (v && /\.[a-zA-Z0-9]{2,5}$/.test(v)) return v;
      }
    }
    var path = url.split('?')[0].split('#')[0];
    var segs = path.split('/');
    var last = segs[segs.length - 1];
    if (last && /\.[a-zA-Z0-9]{2,5}$/.test(last)) return decodeURIComponent(last);
  } catch (e) {}
  return null;
}

// Best-effort synchronous peek at a blob's first bytes, for the
// tracked-name/content agreement gate. Returns a lowercase hex string or
// null when the body isn't synchronously readable (streams, FileReader-only
// blobs). Callers treat null as "no content evidence" and fall back to the
// declared MIME type.
function peekBlobHexSync(body) {
  try {
    var parts = body && body.parts;
    if (!parts || parts.length === 0) return null;
    var first = parts[0];
    var bytes = null;
    if (typeof first === 'string') {
      bytes = [];
      for (var i = 0; i < Math.min(8, first.length); i++) bytes.push(first.charCodeAt(i) & 0xff);
    } else if (first instanceof ArrayBuffer) {
      bytes = Array.from(new Uint8Array(first).slice(0, 8));
    } else if (ArrayBuffer.isView(first)) {
      bytes = Array.from(new Uint8Array(first.buffer, first.byteOffset || 0, Math.min(8, first.byteLength || 0)));
    } else {
      return null;
    }
    if (!bytes || bytes.length < 4) return null;
    return bytes.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  } catch (e) {
    return null;
  }
}

// A tracked filename may only be reused for a nameless blob when the blob's
// own detected content agrees with the tracked file's extension: a JSON/text
// sidecar must never be logged as photo.png or report.txt.
//
// This is a targeted veto, not a whitelist: it returns false only when we
// positively know the blob is NOT the tracked file (JSON metadata claiming a
// document name, image bytes claiming a document name, ...). Anything it
// cannot judge returns true, so legitimate re-wrapped uploads keep working —
// the exact-size matching in matchTrackedFilename is the primary guard.
function trackedNameAgreesWithBlob(trackedName, blobType, peekHex) {
  if (!trackedName || typeof trackedName !== 'string') return false;
  var dot = trackedName.lastIndexOf('.');
  var ext = dot >= 0 ? trackedName.slice(dot + 1).toLowerCase() : '';
  if (!ext) return false;

  var textExts = ['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'htm'];
  var zipExts = ['zip', 'docx', 'xlsx', 'pptx'];
  var oleExts = ['doc', 'xls', 'ppt'];
  var imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  var mediaExts = imageExts.concat(['mp4', 'mp3', 'wav', 'ogg', 'webm', 'mov', 'avi']);

  var mt = (blobType || '').toLowerCase().trim();
  var isJson = mt.indexOf('application/json') === 0 || mt.indexOf('text/json') === 0;
  var isText = mt.indexOf('text/') === 0 || isJson;
  var isImage = mt.indexOf('image/') === 0;
  var isMedia = isImage || mt.indexOf('video/') === 0 || mt.indexOf('audio/') === 0;

  // Content sniff when sync bytes are available (ArrayBuffer/stream paths).
  var hex = (peekHex || '').toLowerCase();
  var isZipMagic = hex.indexOf('504b0304') === 0;
  var isOleMagic = hex.indexOf('d0cf11e0') === 0;
  if (isZipMagic) return zipExts.indexOf(ext) >= 0;
  if (isOleMagic) return oleExts.indexOf(ext) >= 0;

  // Media files keep their own names; a text/JSON blob can never be a photo,
  // and an image blob can never be a document.
  if (imageExts.indexOf(ext) >= 0 || mediaExts.indexOf(ext) >= 0) {
    return isImage || isMedia;
  }

  // JSON payloads are site-generated metadata (upload tickets, message
  // envelopes), never the user's document — unless the document is .json.
  if (isJson) return ext === 'json';

  // Office containers and PDFs: only a matching declared type keeps the name.
  if (zipExts.indexOf(ext) >= 0 || oleExts.indexOf(ext) >= 0 || ext === 'pdf') {
    if (!mt) return true;
    if (ext === 'pdf') return mt.indexOf('application/pdf') === 0;
    return mt.indexOf('application/zip') === 0 ||
      mt.indexOf('application/x-zip') === 0 ||
      mt.indexOf('application/vnd.openxmlformats') === 0 ||
      mt.indexOf('application/msword') === 0 ||
      mt.indexOf('application/vnd.ms-') === 0 ||
      mt.indexOf('application/octet-stream') === 0;
  }

  // Plain-text family: text blobs may wear text names; anything binary may not.
  if (textExts.indexOf(ext) >= 0) {
    if (!mt) return true;
    return isText;
  }

  return true;
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

    // Strict: a tracked filename may only be reused when the blob's own
    // detected content agrees with the tracked extension. Size-only or
    // hash-only matches let site-generated sidecar blobs (upload tickets,
    // message payloads) steal the user's filename and log phantom rows.
    var blobHex = peekBlobHexSync(body);
    if (blobHex === null && typeof window.__ablePeekBlobHex === 'function') {
      try { blobHex = window.__ablePeekBlobHex(body); } catch (e) { blobHex = null; }
    }
    // JSON-looking text content on a typeless blob is site-generated metadata
    // (message envelopes, upload tickets), never the user's document — unless
    // the tracked name itself is a .json file.
    var blobTextHead = null;
    try {
      var firstPart = body && body.parts && body.parts[0];
      if (typeof firstPart === 'string') blobTextHead = firstPart.slice(0, 64);
    } catch (e) { blobTextHead = null; }
    var agreesWith = function (candidateName) {
      if (!trackedNameAgreesWithBlob(candidateName, body.type, blobHex)) return false;
      if (blobTextHead && /^[\s]*[\[{]/.test(blobTextHead) && !(body.type || '').toLowerCase().match(/^text\//)) {
        var dot = (candidateName || '').lastIndexOf('.');
        var ext = dot >= 0 ? candidateName.slice(dot + 1).toLowerCase() : '';
        if (ext !== 'json') return false;
      }
      return true;
    };
    // A site-generated download (report.txt?filename=..., attachment, ...)
    // hosted at a real file URL is the page's document, not our upload — but
    // only when the blob's own content agrees with that filename. This keeps
    // genuine "save target as" style downloads working while JSON/plain
    // sidecars posted to API routes stay excluded. The JSON-content veto
    // applies to tracked-name reuse, not URL filenames: a URL that names the
    // file is itself corroborating evidence, so it only needs the base gate.
    if (candidateFilename && !trackedNameAgreesWithBlob(candidateFilename, body.type, blobHex)) {
      // JSON-looking message envelopes posted to API routes are sidecars even
      // when the URL happens to carry a file-like segment — drop those, keep
      // real downloads (text blobs get a second chance below).
      var looksLikeJson = blobTextHead && /^[\s]*[\[{]/.test(blobTextHead) &&
        !(body.type || '').toLowerCase().match(/^text\//);
      var looksLikeApiRoute = /\/api[\/\-_]|\/backend[\/\-_]|\/v\d+[\/\-_]|\/graphql/i.test(requestUrl || '');
      if (looksLikeJson || looksLikeApiRoute) {
        candidateFilename = null;
      }
    }
    var agreesWith = function (candidateName) {
      return trackedNameAgreesWithBlob(candidateName, body.type, blobHex);
    };
    var blobName = candidateFilename ||
      (window.__ableMatchFilename ? window.__ableMatchFilename(body.size, null, agreesWith) : null);

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
        var formAgreesWith = function (candidateName) {
          return trackedNameAgreesWithBlob(candidateName, val.type, null);
        };
        var blobName = candidateFilename ||
          (window.__ableMatchFilename ? window.__ableMatchFilename(val.size, null, formAgreesWith) : null);
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
    var abAgreesWith = function (candidateName) {
      return trackedNameAgreesWithBlob(candidateName, body.type || 'application/octet-stream', null);
    };
    var matchedFilename = (window.__ableMatchFilename ? window.__ableMatchFilename(byteLength, bodyHash, abAgreesWith) : null);
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
      var streamAgreesWith = function (candidateName) {
        return trackedNameAgreesWithBlob(candidateName, 'application/octet-stream', null);
      };
      var streamName = candidateFilename ||
        (window.__ableMatchFilename ? window.__ableMatchFilename(peeked.bytesRead, null, streamAgreesWith) : null) ||
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
  if (!a || !b) return false;
  if (a === b) return true;
  return a.name === b.name &&
         a.size === b.size &&
         a.type === b.type;
}

function normalizeFileTargets(items) {
  var targetNames = [];
  var targetFiles = [];
  var targetSizes = [];

  if (!items) return { targetNames: targetNames, targetFiles: targetFiles, targetSizes: targetSizes };

  var list = Array.isArray(items) ? items : [items];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item) continue;
    if (typeof item === 'string') {
      if (item.trim()) targetNames.push(item.trim());
    } else if (item instanceof File || item instanceof Blob) {
      targetFiles.push(item);
      if (item.name) targetNames.push(item.name.trim());
      if (typeof item.size === 'number') targetSizes.push(item.size);
    } else if (typeof item === 'object') {
      if (item.file) {
        targetFiles.push(item.file);
        if (item.file.name) targetNames.push(item.file.name.trim());
        if (typeof item.file.size === 'number') targetSizes.push(item.file.size);
      }
      if (item.fileName && typeof item.fileName === 'string') targetNames.push(item.fileName.trim());
      if (item.name && typeof item.name === 'string') targetNames.push(item.name.trim());
      if (typeof item.fileSize === 'number') targetSizes.push(item.fileSize);
      if (typeof item.size === 'number') targetSizes.push(item.size);
    }
  }

  // Deduplicate names
  targetNames = Array.from(new Set(targetNames)).filter(Boolean);
  return { targetNames: targetNames, targetFiles: targetFiles, targetSizes: targetSizes };
}

function resetNativeFileInput(input) {
  if (!(input instanceof HTMLInputElement)) return;
  try {
    var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, '');
    } else {
      input.value = '';
    }
  } catch (e) {
    input.value = '';
  }

  try {
    if (typeof DataTransfer !== 'undefined') {
      input.files = new DataTransfer().files;
    }
  } catch (e) {}

  try {
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));
    input.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true, composed: true }));
  } catch (e) {}
}

function purgeNativeFileInputs(targets) {
  var inputs = document.querySelectorAll('input[type="file"]');
  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i];
    var shouldClear = false;

    if (!input.files || input.files.length === 0) {
      // If the input has a value string matching one of the filenames
      if (input.value && targets.targetNames.some(function (n) { return input.value.indexOf(n) !== -1; })) {
        shouldClear = true;
      }
    } else {
      for (var k = 0; k < input.files.length; k++) {
        var f = input.files[k];
        if (
          targets.targetFiles.includes(f) ||
          targets.targetNames.includes(f.name) ||
          targets.targetSizes.includes(f.size)
        ) {
          shouldClear = true;
          break;
        }
      }
    }

    if (shouldClear || (targets.targetNames.length === 0 && targets.targetFiles.length === 0)) {
      resetNativeFileInput(input);
    }
  }
}

function purgeUploadLibraries(targetNames, targetFiles) {
  // Dropzone.js instances
  try {
    var dzElements = document.querySelectorAll('.dropzone, [class*="dropzone"]');
    dzElements.forEach(function (dzEl) {
      var dz = dzEl.dropzone;
      if (dz && Array.isArray(dz.files)) {
        dz.files.slice().forEach(function (dzFile) {
          if (targetNames.includes(dzFile.name) || targetFiles.some(function (f) { return filesMatch(f, dzFile); })) {
            if (typeof dz.removeFile === 'function') {
              dz.removeFile(dzFile);
            }
          }
        });
      }
    });
  } catch (e) {}

  // FilePond instances
  try {
    if (typeof window !== 'undefined' && window.FilePond && typeof window.FilePond.getInstances === 'function') {
      var ponds = window.FilePond.getInstances();
      ponds.forEach(function (pond) {
        var items = typeof pond.getFiles === 'function' ? pond.getFiles() : [];
        items.forEach(function (item) {
          var fName = item.filename || (item.file && item.file.name);
          if (targetNames.includes(fName) && typeof pond.removeFile === 'function') {
            pond.removeFile(item.id);
          }
        });
      });
    }
  } catch (e) {}

  // Uppy instances
  try {
    if (typeof window !== 'undefined' && window.Uppy) {
      var uppyRoots = document.querySelectorAll('.uppy-Root, .uppy-Dashboard');
      uppyRoots.forEach(function (root) {
        var uppyInstance = root.__uppy || (window.__uppyInstances && window.__uppyInstances[0]);
        if (uppyInstance && typeof uppyInstance.getFiles === 'function') {
          uppyInstance.getFiles().forEach(function (uFile) {
            if (targetNames.includes(uFile.name) && typeof uppyInstance.removeFile === 'function') {
              uppyInstance.removeFile(uFile.id);
            }
          });
        }
      });
    }
  } catch (e) {}
}

function purgeSpaFilePreviews(targetNames) {
  if (!targetNames || targetNames.length === 0) return;

  targetNames.forEach(function (name) {
    if (!name || typeof name !== 'string') return;
    var trimmed = name.trim();
    if (!trimmed) return;

    var escaped = trimmed.replace(/["\\]/g, '\\$&');

    // 1. Selector-based search for attributes matching filename
    var candidates = Array.from(document.querySelectorAll(
      '[title*="' + escaped + '"], [aria-label*="' + escaped + '"], [data-filename*="' + escaped + '"], [data-name*="' + escaped + '"], .dz-preview, .filepond--item, .uppy-Dashboard-Item, [class*="preview" i], [class*="attachment" i], [class*="file-chip" i], [class*="file-item" i], [class*="upload-item" i]'
    ));

    // 2. Text node search for leaf/small elements containing the filename
    var textNodes = document.querySelectorAll('div, li, span, p, tr, td, a');
    for (var i = 0; i < textNodes.length; i++) {
      var node = textNodes[i];
      if (node.children.length <= 4 && (node.textContent || '').indexOf(trimmed) !== -1) {
        candidates.push(node);
      }
    }

    candidates.forEach(function (el) {
      var text = (el.textContent || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '');
      if (text.indexOf(trimmed) === -1) return;

      // Try finding a remove/delete button
      var removeBtn = el.querySelector(
        'button[aria-label*="remove" i], button[aria-label*="delete" i], button[aria-label*="clear" i], button[aria-label*="close" i], button[aria-label*="cancel" i], .dz-remove, .filepond--action-remove-item, [class*="remove" i], [class*="delete" i], [class*="cancel" i], [data-testid*="remove" i], [data-testid*="delete" i], [data-testid*="clear" i]'
      );

      if (!removeBtn && el.parentElement) {
        removeBtn = el.parentElement.querySelector('button[aria-label*="remove" i], button[aria-label*="delete" i], .dz-remove, [class*="remove" i], [class*="delete" i]');
      }

      if (removeBtn && typeof removeBtn.click === 'function') {
        try {
          removeBtn.click();
          removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
          return;
        } catch (e) {}
      }

      // If no interactive removal button found, hide/remove the visual preview container
      var container = el.closest('.dz-preview, .filepond--item, .uppy-Dashboard-Item, [class*="preview" i], [class*="attachment" i], [class*="file-chip" i], [class*="file-item" i], [class*="upload-item" i], li, tr') || el;
      try {
        container.remove();
      } catch (e) {
        container.style.display = 'none';
      }
    });
  });
}

function clearFileInputs(files) {
  if (!files) return;
  var targets = normalizeFileTargets(files);

  // 1. Purge native <input type="file"> elements
  purgeNativeFileInputs(targets);

  // 2. Purge popular upload library instances (Dropzone, FilePond, Uppy)
  purgeUploadLibraries(targets.targetNames, targets.targetFiles);

  // 3. Purge SPA preview cards, file chips, and UI badges
  purgeSpaFilePreviews(targets.targetNames);

  // 4. Revoke tracked Object URLs and clear preview images
  if (typeof window !== 'undefined' && typeof window.__ableRevokeObjectUrls === 'function') {
    try {
      window.__ableRevokeObjectUrls(targets.targetNames);
    } catch (e) {}
  }

  // 5. Fire custom event for any listening framework
  try {
    window.dispatchEvent(new CustomEvent('able:file-upload-cancelled', {
      bubbles: true,
      detail: { fileNames: targets.targetNames }
    }));
  } catch (e) {}
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEFileExtractor = {
    extractFiles,
    extractFilesAsync,
    extractFilenameFromUrl,
    parseUrlForFilename,
    filesMatch,
    normalizeFileTargets,
    resetNativeFileInput,
    purgeNativeFileInputs,
    purgeUploadLibraries,
    purgeSpaFilePreviews,
    clearFileInputs,
    computeBodyHashSync,
    parseContentDisposition,
    trackedNameAgreesWithBlob,
  };
}

