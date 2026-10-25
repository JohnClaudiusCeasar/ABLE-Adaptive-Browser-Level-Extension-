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

// ─── Identity (shared with the content-script isolated world) ────────────────
// The page world only COLLECTS candidates. Whether a payload is attributable to
// the user is decided by content/provenance.js in the isolated world, which the
// page cannot read or overwrite. This file therefore never consults a
// page-writable tracker global to decide whether to scan something.
var ABLE_FILE_IDENTITY = (typeof ABLEFileIdentity !== 'undefined') ? ABLEFileIdentity : null;

function fingerprintBytesSync(bytes) {
  return ABLE_FILE_IDENTITY ? ABLE_FILE_IDENTITY.fingerprintBytesSync(bytes) : null;
}

function computeBodyHashSync(body) {
  try {
    var bytes;
    if (body instanceof ArrayBuffer) {
      bytes = new Uint8Array(body);
    } else if (ArrayBuffer.isView(body)) {
      bytes = new Uint8Array(body.buffer, body.byteOffset || 0, body.byteLength || 0);
    } else {
      return null;
    }
    return fingerprintBytesSync(bytes);
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

// ─── Candidate naming ────────────────────────────────────────────────────────
// The page world does not decide admission. It supplies the best name the
// request itself carries; content/provenance.js re-derives provenance from its
// own isolated-world state and drops anything it cannot attribute.
function requestFilename(context) {
  if (!context) return null;
  var headers = context.headers;
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
  return parseContentDisposition(cdHeader) || extractFilenameFromUrl(context.url);
}

// ─── Candidate collection ────────────────────────────────────────────────────
// Every plausible file body is forwarded. Admission is NOT decided here: a
// page-writable global must never be able to make a candidate disappear before
// the isolated world sees it. content/provenance.js owns the real decision.
function makeEntry(file, source) {
  return { file: file, source: source, contentSize: file.size, nameSource: 'page' };
}

function extractFileSync(body, context) {
  var name = body.name || requestFilename(context) || 'blob';
  var file = name === body.name ? body : new File([body], name, { type: body.type });
  return [makeEntry(file, 'file')];
}

async function extractFileAsync(body, context) {
  return extractFileSync(body, context);
}

function extractBlobSync(body, context) {
  if (!body.size) return [];
  var name = requestFilename(context) || 'blob';
  return [makeEntry(new File([body], name, { type: body.type }), 'blob')];
}

async function extractBlobAsync(body, context) {
  return extractBlobSync(body, context);
}

function extractFormDataEntrySync(val, candidateFilename) {
  if (val instanceof File) {
    var name = val.name || candidateFilename || 'blob';
    var file = name === val.name ? val : new File([val], name, { type: val.type });
    return makeEntry(file, 'formdata');
  }

  if (val instanceof Blob) {
    if (!val.size) return null;
    var blobName = candidateFilename || 'blob';
    return makeEntry(new File([val], blobName, { type: val.type }), 'formdata');
  }

  return null;
}

async function extractFormDataEntryAsync(val, candidateFilename) {
  return extractFormDataEntrySync(val, candidateFilename);
}

function extractFormDataSync(body, context) {
  var candidateFilename = requestFilename(context);
  var results = [];

  for (var entry of body.entries()) {
    var admitted = extractFormDataEntrySync(entry[1], candidateFilename);
    if (admitted) results.push(admitted);
  }

  return results;
}

async function extractFormDataAsync(body, context) {
  var candidateFilename = requestFilename(context);
  var results = [];

  for (var entry of body.entries()) {
    var admitted = await extractFormDataEntryAsync(entry[1], candidateFilename);
    if (admitted) results.push(admitted);
  }

  return results;
}

function extractBufferBody(body, context) {
  var byteLength = body.byteLength || 0;
  var byteOffset = body.byteOffset || 0;
  var underlyingBuffer = body.buffer || body;
  if (byteOffset + byteLength > underlyingBuffer.byteLength) {
    byteLength = underlyingBuffer.byteLength - byteOffset;
  }
  if (!byteLength) return [];

  var source = body instanceof ArrayBuffer ? 'arraybuffer' : 'typedarray';
  var name = requestFilename(context) || 'upload';

  return [makeEntry(
    new File([underlyingBuffer.slice(byteOffset, byteOffset + byteLength)], name, { type: 'application/octet-stream' }),
    source
  )];
}

function extractFiles(body, context) {
  context = context || {};

  if (body instanceof File) {
    return extractFileSync(body, context);
  }

  if (body instanceof Blob) {
    return extractBlobSync(body, context);
  }

  if (body instanceof FormData) {
    return extractFormDataSync(body, context);
  }

  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return extractBufferBody(body, context);
  }

  if (body instanceof URLSearchParams) {
    return [];
  }

  if (typeof body === 'string' && body.length >= 100) {
    // Check for multipart form-data encoded as string
    var cdMatch = body.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)";\s*filename="([^"]+)"/i);
    if (cdMatch && cdMatch[2]) {
      return [makeEntry(new File([body], cdMatch[2], { type: 'text/plain' }), 'string-multipart')];
    }
    // Check for JSON containing explicit file upload structure with file extension
    if (body.charCodeAt(0) === 123) {
      try {
        var json = JSON.parse(body);
        var rawFileName = json.fileName || json.filename;
        if (rawFileName && typeof rawFileName === 'string' && /\.[a-zA-Z0-9]{2,5}$/.test(rawFileName)) {
          var fileContent = json.file || json.fileData || json.content || json.data || json.payload;
          if (typeof fileContent === 'string' && fileContent.length > 100) {
            return [makeEntry(new File([fileContent], rawFileName, { type: 'text/plain' }), 'json-upload')];
          }
        }
      } catch (e) {}
    }
  }

  return [];
}

// The async entry point is what the network interceptor uses. It now differs
// from the sync path only for streams; Blob/File/FormData are collected
// identically and handed to the isolated world for the admission decision.
async function extractFilesAsync(body, context) {
  context = context || {};

  if (body instanceof File) return extractFileAsync(body, context);
  if (body instanceof Blob) return extractBlobAsync(body, context);
  if (body instanceof FormData) return extractFormDataAsync(body, context);
  if (body instanceof ReadableStream) return extractStreamAsync(body, context);

  return extractFiles(body, context);
}

async function extractStreamAsync(body, context) {
  // A stream cannot be content-matched without consuming it, so only a name the
  // request itself carries can attribute it. This is a known coverage gap.
  var name = requestFilename(context);
  if (!name) return [];

  var peeked = await peekReadableStream(body, 512);
  if (!peeked) return [];

  return [makeEntry(
    new File([peeked.buffer], name, { type: 'application/octet-stream' }),
    'readablestream'
  )];
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

function ableDefine(name, value) {
  if (typeof ABLEFileIdentity !== 'undefined' && ABLEFileIdentity.defineImmutableGlobal) {
    return ABLEFileIdentity.defineImmutableGlobal(name, value);
  }
  try {
    globalThis[name] = value;
  } catch (e) {}
  return true;
}

if (typeof globalThis !== "undefined") {
  var extractorApi = Object.freeze({
    extractFiles: extractFiles,
    extractFilesAsync: extractFilesAsync,
    extractFilenameFromUrl: extractFilenameFromUrl,
    parseUrlForFilename: parseUrlForFilename,
    filesMatch: filesMatch,
    normalizeFileTargets: normalizeFileTargets,
    resetNativeFileInput: resetNativeFileInput,
    purgeNativeFileInputs: purgeNativeFileInputs,
    purgeUploadLibraries: purgeUploadLibraries,
    purgeSpaFilePreviews: purgeSpaFilePreviews,
    clearFileInputs: clearFileInputs,
    computeBodyHashSync: computeBodyHashSync,
    parseContentDisposition: parseContentDisposition,
  });
  ableDefine('ABLEFileExtractor', extractorApi);
  ableDefine('extractFiles', extractFiles);
  ableDefine('extractFilesAsync', extractFilesAsync);
}

