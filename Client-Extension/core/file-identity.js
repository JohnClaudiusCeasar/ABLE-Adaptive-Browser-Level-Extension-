/**
 * ABLE Extension - File Identity
 *
 * Single source of truth for deciding whether a payload is a file at all, and
 * whether its content matches a file the user actually selected.
 *
 * This module runs in both the page world (injected) and the content-script
 * isolated world. The page world uses it to collect candidates; the isolated
 * world uses it to make the authoritative admission decision. Keeping one
 * implementation means both sides always agree on a fingerprint.
 *
 * Content identity is sampled (first + last 64 KB bound to the exact size)
 * rather than a full-file hash: it is cheap enough to run on every upload and
 * still distinguishes a page-generated sidecar from the user's document.
 */
(function () {
  'use strict';

  var FINGERPRINT_SAMPLE_BYTES = 64 * 1024;

  var NAME_SOURCE = {
    USER: 'user',
    PAGE: 'page',
    SYNTHETIC: 'synthetic',
  };

  function hashFnv1a32(hash, bytes) {
    for (var i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function hex32(value) {
    return ('00000000' + value.toString(16)).slice(-8);
  }

  function hashSample(head, tail) {
    var h1 = hashFnv1a32(2166136261, head);
    h1 = hashFnv1a32(h1, tail);
    var h2 = hashFnv1a32(0x9e3779b9, head);
    h2 = hashFnv1a32(h2, tail);
    return hex32(h1) + hex32(h2);
  }

  function fingerprintBytesSync(bytes) {
    if (!bytes || typeof bytes.length !== 'number') return null;
    var head = bytes.length > FINGERPRINT_SAMPLE_BYTES
      ? bytes.subarray(0, FINGERPRINT_SAMPLE_BYTES)
      : bytes;
    var tail = bytes.length > FINGERPRINT_SAMPLE_BYTES
      ? bytes.subarray(bytes.length - FINGERPRINT_SAMPLE_BYTES)
      : bytes;
    return hashSample(head, tail) + ':' + bytes.length;
  }

  async function computeFileFingerprint(file) {
    if (!file || typeof file.size !== 'number' || typeof file.slice !== 'function') return null;
    try {
      var headSize = Math.min(FINGERPRINT_SAMPLE_BYTES, file.size);
      var head = new Uint8Array(await file.slice(0, headSize).arrayBuffer());
      var tailStart = file.size - headSize;
      var tail = tailStart > 0
        ? new Uint8Array(await file.slice(tailStart, file.size).arrayBuffer())
        : head;
      return hashSample(head, tail) + ':' + file.size;
    } catch (e) {
      return null;
    }
  }

  /**
   * A name a payload may legitimately carry. Placeholders the extension or the
   * page invented from a MIME type are never real names.
   */
  function isRealFileName(name) {
    if (!name || typeof name !== 'string' || name === 'blob') return false;
    if (typeof ABLESyntheticNames !== 'undefined' && ABLESyntheticNames.isSyntheticFileName) {
      return !ABLESyntheticNames.isSyntheticFileName(name);
    }
    return true;
  }

  /**
   * Whether an explicit name is consistent with the payload's declared MIME.
   * A disagreement is evidence the name describes something else.
   */
  function nameAgreesWithMime(name, mimeType) {
    if (!name || typeof name !== 'string') return false;
    var dot = name.lastIndexOf('.');
    var ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
    if (!ext) return false;

    var textExts = ['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'htm'];
    var zipExts = ['zip', 'docx', 'xlsx', 'pptx'];
    var oleExts = ['doc', 'xls', 'ppt'];
    var imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    var mediaExts = imageExts.concat(['mp4', 'mp3', 'wav', 'ogg', 'webm', 'mov', 'avi']);

    var mt = (mimeType || '').toLowerCase().trim();
    // "application/octet-stream" means the page did not know the file's type;
    // it is not evidence against the name.
    if (mt === 'application/octet-stream') return true;

    var isJson = mt.indexOf('application/json') === 0 || mt.indexOf('text/json') === 0;
    var isText = mt.indexOf('text/') === 0 || isJson;
    var isImage = mt.indexOf('image/') === 0;
    var isMedia = isImage || mt.indexOf('video/') === 0 || mt.indexOf('audio/') === 0;

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
        mt.indexOf('application/vnd.ms-') === 0;
    }

    // Plain-text family: text blobs may wear text names; anything binary may not.
    if (textExts.indexOf(ext) >= 0) {
      if (!mt) return true;
      return isText;
    }

    return true;
  }

  function isApiPayloadMime(mimeType) {
    var mt = (mimeType || '').toLowerCase();
    return mt.indexOf('application/json') === 0 ||
      mt.indexOf('text/json') === 0 ||
      mt.indexOf('application/x-www-form-urlencoded') === 0 ||
      mt.indexOf('text/event-stream') === 0;
  }

  /**
   * Install a page-world binding the page cannot reassign or delete.
   * Returns false when the name was already claimed non-configurably.
   */
  function defineImmutableGlobal(name, value) {
    try {
      Object.defineProperty(globalThis, name, {
        value: value,
        writable: false,
        configurable: false,
        enumerable: false,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  if (typeof globalThis === 'undefined') return;

  globalThis.ABLEFileIdentity = {
    FINGERPRINT_SAMPLE_BYTES: FINGERPRINT_SAMPLE_BYTES,
    NAME_SOURCE: NAME_SOURCE,
    fingerprintBytesSync: fingerprintBytesSync,
    computeFileFingerprint: computeFileFingerprint,
    isRealFileName: isRealFileName,
    nameAgreesWithMime: nameAgreesWithMime,
    isApiPayloadMime: isApiPayloadMime,
    defineImmutableGlobal: defineImmutableGlobal,
  };
})();
