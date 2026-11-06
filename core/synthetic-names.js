/**
 * ABLE Extension - Synthetic File Names
 *
 * Single source of truth for the placeholder names the extension assigns when
 * it cannot recover the user's real file name, and for the decision on
 * whether an egress event may be audited at all.
 *
 * A placeholder such as "upload.csv" or "blob.pdf" is fabricated from the
 * MIME type or the file's magic bytes — never from the document the user
 * actually chose. Nothing was uploaded behind it, so an audit row carrying
 * such a name reports a file that does not exist.
 *
 * This module is loaded, from this single file, in all three realms:
 *   - content scripts   (manifest.json content_scripts)
 *   - the service worker (background.js importScripts)
 *   - the page world     (inject/inject.js INJECT_SCRIPTS)
 *
 * The page-world copy keeps its helpers under the ABLESyntheticNames
 * namespace so a page's own "isSyntheticFileName" is never shadowed.
 */
(function () {
  'use strict';

  // Base name (the part before the first dot) of every placeholder the
  // extension or the page may produce.
  var SYNTHETIC_NAME_BASES = [
    'upload',
    'blob',
    'binary-upload',
    'websocket-upload',
    'stream-upload',
    'form-upload',
    'unknown',
  ];

  // Where the file name that reaches the audit came from.
  var NAME_SOURCE = {
    // Recovered from the user's own file selection (a file input, a drop or a
    // paste). The only source that proves a real document sits behind the name.
    USER: 'user',
    // Supplied by the page: a File/Blob's own name, a Content-Disposition
    // header or a URL segment.
    PAGE: 'page',
    // Fabricated by the extension from the MIME type or the magic bytes.
    SYNTHETIC: 'synthetic',
  };

  /**
   * The base name of a file name — everything before the first dot, lowercased.
   */
  function syntheticNameBase(name) {
    if (!name || typeof name !== 'string') return '';
    return (name.split('.')[0] || '').toLowerCase();
  }

  /**
   * True when the name is one of the extension's placeholders, e.g. "blob.csv",
   * "upload.xlsx" or "stream-upload.png".
   *
   * The base name must match a placeholder exactly, so a real file called
   * "upload-report.pdf" or "myblob.csv" is not mistaken for one.
   */
  function isSyntheticFileName(name) {
    var base = syntheticNameBase(name);
    if (!base) return false;
    return SYNTHETIC_NAME_BASES.indexOf(base) !== -1;
  }

  /**
   * Whether an egress event with this name may be written to the audit.
   *
   * A name the extension fabricated is never audited. A name recovered from
   * the user's own file selection is always audited, even when it happens to
   * look like a placeholder — the user may genuinely have a file called
   * "upload.csv". Anything else falls back to the placeholder check.
   */
  function isAuditableFileName(name, nameSource) {
    if (nameSource === NAME_SOURCE.SYNTHETIC) return false;
    if (nameSource === NAME_SOURCE.USER) return true;
    return !isSyntheticFileName(name);
  }

  if (typeof globalThis === 'undefined') return;

  globalThis.ABLESyntheticNames = {
    SYNTHETIC_NAME_BASES: SYNTHETIC_NAME_BASES,
    NAME_SOURCE: NAME_SOURCE,
    syntheticNameBase: syntheticNameBase,
    isSyntheticFileName: isSyntheticFileName,
    isAuditableFileName: isAuditableFileName,
  };

  // The page world already owns these names; only the extension's own realms
  // get the bare globals.
  var isPageWorld = typeof window !== 'undefined' && window.__ABLE_PAGE_WORLD === true;
  if (!isPageWorld) {
    globalThis.ABLE_SYNTHETIC_NAME_BASES = SYNTHETIC_NAME_BASES;
    globalThis.ABLE_NAME_SOURCE = NAME_SOURCE;
    globalThis.ableSyntheticNameBase = syntheticNameBase;
    globalThis.isSyntheticFileName = isSyntheticFileName;
    globalThis.isAuditableFileName = isAuditableFileName;
  }
})();
