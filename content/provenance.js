/**
 * ABLE Extension - Provenance (isolated world)
 *
 * The authoritative answer to "is this payload the user's file?".
 *
 * The page world can only COLLECT candidates; it cannot be trusted with the
 * decision. This module lives in the content-script isolated world, where page
 * scripts cannot read or overwrite its state. It records file selections from
 * trusted (user-agent) events and re-derives provenance for every intercepted
 * payload:
 *
 *   - a content fingerprint matching a recorded selection  -> "user"
 *   - an explicit, real name consistent with the MIME type -> "page"
 *   - anything else (placeholder, empty, forged "user")   -> dropped
 *
 * A page can still hand the scanner a decoy File whose bytes differ from what
 * it actually transmits. That is inherent to observing requests from the page
 * world; it cannot fabricate a different user file, however.
 */
(function () {
  'use strict';

  var SELECTION_TTL_MS = 10 * 60 * 1000;
  var MAX_SELECTIONS = 64;

  var selections = [];

  function identity() {
    return (typeof ABLEFileIdentity !== 'undefined') ? ABLEFileIdentity : null;
  }

  function trim() {
    var now = Date.now();
    selections = selections.filter(function (entry) {
      return now - entry.timestamp < SELECTION_TTL_MS;
    });
    while (selections.length > MAX_SELECTIONS) {
      selections.shift();
    }
  }

  function trackSelection(file) {
    var lib = identity();
    if (!lib || !file || typeof file.size !== 'number' || !file.size) return Promise.resolve(null);

    // Synchronously record the selection so immediate fetch() cannot race past it
    var entry = {
      name: file.name || 'blob',
      size: file.size,
      type: file.type || '',
      fp: null,
      timestamp: Date.now(),
      rawFile: file,
      fpPromise: null,
    };
    selections.push(entry);
    trim();

    entry.fpPromise = lib.computeFileFingerprint(file).then(function (fp) {
      if (fp) {
        entry.fp = fp;
      }
      return fp;
    }).catch(function () {
      return null;
    });

    return entry.fpPromise;
  }

  function trackFiles(files) {
    if (!files || typeof files.length !== 'number') return;
    for (var i = 0; i < files.length; i++) {
      trackSelection(files[i]);
    }
  }

  function hasSelectionOfSize(size) {
    trim();
    for (var i = selections.length - 1; i >= 0; i--) {
      if (selections[i].size === size) return true;
    }
    return false;
  }

  function awaitPendingFingerprintsOfSize(size) {
    var promises = [];
    for (var i = 0; i < selections.length; i++) {
      if (selections[i].size === size && selections[i].fpPromise && !selections[i].fp) {
        promises.push(selections[i].fpPromise);
      }
    }
    if (promises.length === 0) return Promise.resolve();
    return Promise.all(promises);
  }

  function matchFingerprint(fp, size) {
    trim();
    for (var i = selections.length - 1; i >= 0; i--) {
      var entry = selections[i];
      if (entry.size !== size) continue;
      if (entry.fp === fp) return entry;
    }
    return null;
  }

  function renameFile(file, name) {
    if (!name || file.name === name) return file;
    try {
      return new File([file], name, { type: file.type, lastModified: file.lastModified });
    } catch (e) {
      return file;
    }
  }

  function matchStreamToRecentSelection(entry) {
    var file = entry.file;
    if (!file || !file.size) return Promise.resolve(null);
    var now = Date.now();
    var recentWindow = 30 * 1000;
    var candidates = selections.filter(function (s) {
      return (now - s.timestamp <= recentWindow) && s.rawFile;
    });
    if (candidates.length === 0) return Promise.resolve(null);

    var sampleLen = Math.min(file.size, 512);
    if (!sampleLen) return Promise.resolve(null);

    return (typeof file.slice === 'function' ? file.slice(0, sampleLen).arrayBuffer() : Promise.resolve(null))
      .then(function (peekBytes) {
        if (!peekBytes) return null;
        var peekU8 = new Uint8Array(peekBytes);
        if (peekU8.length === 0) return null;

        var checkIdx = function (i) {
          if (i < 0) return Promise.resolve(null);
          var sel = candidates[i];
          if (!sel.rawFile || typeof sel.rawFile.slice !== 'function') return checkIdx(i - 1);

          return sel.rawFile.slice(0, peekU8.length).arrayBuffer().then(function (selBytes) {
            var selU8 = new Uint8Array(selBytes);
            if (selU8.length === peekU8.length) {
              var matches = true;
              for (var j = 0; j < peekU8.length; j++) {
                if (peekU8[j] !== selU8[j]) {
                  matches = false;
                  break;
                }
              }
              if (matches) {
                return {
                  file: sel.rawFile,
                  source: entry.source || 'readablestream',
                  contentSize: sel.size,
                  nameSource: 'user',
                };
              }
            }
            return checkIdx(i - 1);
          }).catch(function () {
            return checkIdx(i - 1);
          });
        };

        return checkIdx(candidates.length - 1);
      }).catch(function () {
        return null;
      });
  }

  function matchRecentSelectionByName(entry, lib) {
    var file = entry.file;
    if (!file || !file.name || !lib.isRealFileName(file.name)) return null;
    if (file.type && !lib.nameAgreesWithMime(file.name, file.type)) return null;
    var now = Date.now();
    var recentWindow = 60 * 1000;
    for (var i = selections.length - 1; i >= 0; i--) {
      var s = selections[i];
      if (now - s.timestamp <= recentWindow && s.name === file.name && lib.isRealFileName(s.name)) {
        return {
          file: file,
          source: entry.source || 'unknown',
          contentSize: file.size,
          nameSource: 'user',
        };
      }
    }
    return null;
  }

  /**
   * Resolve one candidate entry. `entry.nameSource` is deliberately ignored:
   * it is page-supplied and therefore not evidence.
   *
   * @returns {Promise<{file: File, source: string, contentSize: number, nameSource: string}|null>}
   */
  function admit(entry) {
    var lib = identity();
    if (!lib || !entry || !entry.file) return Promise.resolve(null);

    var file = entry.file;
    if (!file.size) return Promise.resolve(null);

    // Stream attribution via recent user selection head match
    if (entry.source === 'readablestream' || file.name === 'stream-upload') {
      return matchStreamToRecentSelection(entry).then(function (matched) {
        if (matched) return matched;
        return pageNameOrNull(entry, lib);
      });
    }

    // Content identity first. Only read the payload when a recorded selection
    // has the same byte length, so unrelated API blobs stay cheap.
    if (hasSelectionOfSize(file.size)) {
      return awaitPendingFingerprintsOfSize(file.size).then(function () {
        return lib.computeFileFingerprint(file);
      }).then(function (fp) {
        var match = fp ? matchFingerprint(fp, file.size) : null;
        if (!match) {
          var pageFallback = pageNameOrNull(entry, lib);
          if (pageFallback) return pageFallback;
          return null;
        }

        return {
          file: renameFile(file, match.name),
          source: entry.source || 'unknown',
          contentSize: file.size,
          nameSource: 'user',
        };
      });
    }

    var namedUserMatch = matchRecentSelectionByName(entry, lib);
    if (namedUserMatch) return Promise.resolve(namedUserMatch);

    return Promise.resolve(pageNameOrNull(entry, lib));
  }

  function pageNameOrNull(entry, lib) {
    var file = entry.file;
    var name = file.name;
    if (!lib.isRealFileName(name)) return null;
    // An empty type means the page did not know; it is not a disagreement.
    if (file.type && !lib.nameAgreesWithMime(name, file.type)) return null;

    return {
      file: file,
      source: entry.source || 'unknown',
      contentSize: file.size,
      nameSource: 'page',
    };
  }

  function admitAll(entries) {
    if (!entries || entries.length === 0) return Promise.resolve([]);
    return Promise.all(entries.map(admit)).then(function (resolved) {
      return resolved.filter(Boolean);
    });
  }

  // ─── Trusted selection events ───────────────────────────────────────────────
  // Synthetic events (dispatchEvent) are not user actions and must never create
  // provenance. A page cannot forge `event.isTrusted`.
  function installSelectionListeners() {
    if (typeof document === 'undefined' || !document.addEventListener) return;

    document.addEventListener('change', function (event) {
      if (!event.isTrusted) return;
      var target = event.target;
      if (typeof HTMLInputElement !== 'undefined' &&
        target instanceof HTMLInputElement &&
        target.type === 'file' &&
        target.files) {
        trackFiles(Array.from(target.files));
      }
    }, true);

    document.addEventListener('drop', function (event) {
      if (!event.isTrusted) return;
      if (event.dataTransfer && event.dataTransfer.files) {
        trackFiles(Array.from(event.dataTransfer.files));
      }
    }, true);

    document.addEventListener('paste', function (event) {
      if (!event.isTrusted) return;
      var items = event.clipboardData && event.clipboardData.items;
      if (!items) return;
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          var file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      trackFiles(files);
    }, true);

    // A trusted submit is another user action that can carry files whose change
    // event the page swallowed before our listener saw it.
    document.addEventListener('submit', function (event) {
      if (!event.isTrusted) return;
      var form = event.target;
      if (typeof HTMLFormElement === 'undefined' || !(form instanceof HTMLFormElement)) return;
      try {
        var formData = new FormData(form);
        var files = [];
        for (var entry of formData.entries()) {
          if (entry[1] instanceof File) files.push(entry[1]);
        }
        trackFiles(files);
      } catch (e) {}
    }, true);
  }

  installSelectionListeners();

  if (typeof globalThis !== 'undefined') {
    globalThis.ABLEProvenance = {
      admit: admit,
      admitAll: admitAll,
      trackSelection: trackSelection,
      trackFiles: trackFiles,
      // Test hooks only; the production callers never inspect this.
      _selections: function () { return selections.slice(); },
      _reset: function () { selections = []; },
    };
  }
})();
