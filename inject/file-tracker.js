/**
 * ABLE Extension - File Tracker
 *
 * Tracks file selections and detects file inputs/attachment buttons
 * on modern websites. Uses WeakSet for observed elements to avoid
 * memory leaks, IntersectionObserver for lazy-loaded inputs, and
 * debounced MutationObserver for SPA DOM churn.
 */

// ─── File selection tracking ────────────────────────────────

var FILE_MATCH_WINDOW_MS = 30000;
var trackedFiles = [];
var trackedInputElements = new Set();
var trackedObjectUrls = new Map();

// ─── Object URL tracking & revocation ──────────────────────
if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
  var originalCreateObjectURL = URL.createObjectURL;
  var originalRevokeObjectURL = URL.revokeObjectURL;

  URL.createObjectURL = function (obj) {
    var url = originalCreateObjectURL.apply(URL, arguments);
    if (obj instanceof File || obj instanceof Blob) {
      trackedObjectUrls.set(url, {
        name: obj.name || (obj.type ? 'blob.' + obj.type.split('/')[1] : 'blob'),
        size: obj.size || 0,
        timestamp: Date.now()
      });
    }
    return url;
  };

  URL.revokeObjectURL = function (url) {
    trackedObjectUrls.delete(url);
    return originalRevokeObjectURL.apply(URL, arguments);
  };
}

function revokeTrackedObjectUrls(targetNames) {
  if (!targetNames || targetNames.length === 0) return;
  var names = Array.isArray(targetNames) ? targetNames : [targetNames];

  for (var entry of trackedObjectUrls.entries()) {
    var url = entry[0];
    var meta = entry[1];
    if (names.includes(meta.name) || names.some(function (n) { return meta.name && meta.name.indexOf(n) !== -1; })) {
      try {
        var imgs = document.querySelectorAll('img[src="' + url + '"]');
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].remove();
        }
        if (typeof originalRevokeObjectURL === 'function') {
          originalRevokeObjectURL.call(URL, url);
        }
      } catch (e) {}
      trackedObjectUrls.delete(url);
    }
  }
}

function ableDefine(name, value) {
  if (typeof ABLEFileIdentity !== 'undefined' && ABLEFileIdentity.defineImmutableGlobal) {
    return ABLEFileIdentity.defineImmutableGlobal(name, value);
  }
  window[name] = value;
  return true;
}

ableDefine('__ableRevokeObjectUrls', revokeTrackedObjectUrls);

function trackSelectedFiles(files) {
  var now = Date.now();
  for (var i = 0; i < files.length; i++) {
    (function (f) {
      if (typeof ABLEFileIdentity === 'undefined') return;
      ABLEFileIdentity.computeFileFingerprint(f).then(function (fp) {
        if (!fp) return;
        trackedFiles.push({
          name: f.name,
          size: f.size,
          fp: fp,
          lastModified: f.lastModified,
          timestamp: now
        });
      });
    })(files[i]);
  }
  cleanupTrackedFiles();
}

function cleanupTrackedFiles() {
  var now = Date.now();
  trackedFiles = trackedFiles.filter(function (entry) {
    return now - entry.timestamp < FILE_MATCH_WINDOW_MS;
  });
}

/**
 * Match a payload to a file the user selected by CONTENT, never by size.
 *
 * Both sides use the same `head:tail:size` fingerprint, so a page-generated
 * blob that merely shares a byte length with the user's file cannot steal its
 * name. A missing fingerprint is a non-match: there is no size-only fallback,
 * because size is exactly what the sidecar blobs had in common.
 */
function matchTrackedFilename(size, fp, validator) {
  cleanupTrackedFiles();
  if (!fp) return null;

  for (var i = trackedFiles.length - 1; i >= 0; i--) {
    var entry = trackedFiles[i];
    if (entry.size !== size || entry.fp !== fp) continue;
    if (typeof validator === 'function' && !validator(entry.name)) continue;
    trackedFiles.splice(i, 1);
    return entry.name;
  }

  return null;
}

/**
 * Find a tracked file name for a payload WITHOUT consuming the tracked entry.
 *
 * matchTrackedFilename splices the entry out, so calling it to merely probe
 * would steal the user's file from whichever branch gets there next.
 */
function lookupTrackedFilename(size, fp, validator) {
  cleanupTrackedFiles();
  if (!fp) return null;

  for (var i = trackedFiles.length - 1; i >= 0; i--) {
    var entry = trackedFiles[i];
    if (entry.size !== size || entry.fp !== fp) continue;
    if (typeof validator === 'function' && !validator(entry.name)) continue;
    return entry.name;
  }

  return null;
}

// ─── File input detection ───────────────────────────────────

var reportedInputs = new WeakSet();
var reportedAttachButtons = new WeakSet();
var reportedDropZones = new WeakSet();

function getElementClass(el) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  var cls = el.getAttribute('class');
  if (typeof cls === 'string') return cls;
  if (typeof el.className === 'string') return el.className;
  if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
  return '';
}

function isAttachButton(el) {
  var tagName = (el.tagName || '').toLowerCase();
  var role = (el.getAttribute('role') || '').toLowerCase();
  var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  var title = (el.getAttribute('title') || (typeof el.title === 'string' ? el.title : '')).toLowerCase();
  var textContent = (el.textContent || '').trim().toLowerCase();
  var className = getElementClass(el).toLowerCase();
  var dataTestid = (el.getAttribute('data-testid') || '').toLowerCase();
  var innerHTML = (el.innerHTML || '').toLowerCase();

  return (
    (role === 'button' && /attach|upload|file|paperclip/.test(ariaLabel + ' ' + title + ' ' + textContent)) ||
    /attach|upload|add file|paperclip/.test(ariaLabel) ||
    /attach|upload|add file|paperclip/.test(title) ||
    (tagName === 'button' && /attach|upload|add file/.test(textContent)) ||
    /attach|upload|paperclip|file-add|file-upload/.test(className) ||
    /attach|upload|paperclip|file-add|file-upload/.test(dataTestid) ||
    (tagName === 'svg' && /attach|upload|paperclip/.test(innerHTML))
  );
}

function checkElement(el) {
  if (!(el instanceof Element)) return;

  if (el instanceof HTMLInputElement && el.type === 'file' && !reportedInputs.has(el)) {
    reportedInputs.add(el);
    el.addEventListener('change', function (e) {
      if (e && !e.isTrusted) return;
      if (el.files && el.files.length > 0) {
        window.postMessage({
          source: 'ABLE_INJECT',
          type: 'ABLE_FILE_SELECTED',
          payload: { fileCount: el.files.length, inputId: el.id || null }
        }, '*');
      }
    }, true);
  }

  if (isAttachButton(el) && !reportedAttachButtons.has(el)) {
    reportedAttachButtons.add(el);
    el.addEventListener('click', function () {
      var cls = getElementClass(el) || null;
      window.postMessage({
        source: 'ABLE_INJECT',
        type: 'ABLE_ATTACH_BUTTON_CLICKED',
        payload: { text: el.textContent?.trim()?.slice(0, 50) || null, className: cls }
      }, '*');
    }, true);
  }
}

// Drag-drop zone detection
function isDropZone(el) {
  if (!(el instanceof Element)) return false;
  var tagName = (el.tagName || '').toLowerCase();
  var role = (el.getAttribute('role') || '').toLowerCase();
  var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  var className = getElementClass(el).toLowerCase();
  var ondrop = el.getAttribute('ondrop');
  var dataDragDrop = el.getAttribute('data-drag-drop');

  return (
    tagName === 'div' && (
      role === 'region' && /drop|upload|file/.test(ariaLabel + ' ' + className) ||
      /drop-zone|file-drop|upload-area/.test(className) ||
      ondrop !== null ||
      dataDragDrop !== null
    )
  );
}

function observeDropZone(el) {
  if (!isDropZone(el) || reportedDropZones.has(el)) return;
  reportedDropZones.add(el);

  el.addEventListener('dragover', function (e) {
    e.preventDefault();
    el.classList.add('able-drop-active');
  }, true);

  el.addEventListener('dragleave', function () {
    el.classList.remove('able-drop-active');
  }, true);

  el.addEventListener('drop', function (e) {
    el.classList.remove('able-drop-active');
    if (e && !e.isTrusted) return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      trackSelectedFiles(Array.from(e.dataTransfer.files));
    }
  }, true);
}

// Debounce helper
function debounce(fn, delay) {
  var timer;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
}

function initFileTracking() {
  ableDefine('__ableTrackedInputs', trackedInputElements);

  // Only user-agent-initiated events prove a real selection. A page can
  // dispatch synthetic change/drop/paste events with a fabricated FileList;
  // those untrusted events must never be tracked.
  document.addEventListener('change', function (event) {
    if (!event.isTrusted) return;
    var target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file' && target.files) {
      trackedInputElements.add(target);
      trackSelectedFiles(Array.from(target.files));
    }
  }, true);

  // Track file selections from drag-and-drop
  document.addEventListener('drop', function (event) {
    if (!event.isTrusted) return;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      trackSelectedFiles(Array.from(event.dataTransfer.files));
    }
  }, true);

  // Track file selections from paste (clipboard)
  document.addEventListener('paste', function (event) {
    if (!event.isTrusted) return;
    var items = event.clipboardData && event.clipboardData.items;
    if (items) {
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          var file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        trackSelectedFiles(files);
      }
    }
  }, true);

  function hasTrackedFiles() {
    cleanupTrackedFiles();
    return trackedFiles.length > 0;
  }

  // The page world no longer makes the admission decision; content/provenance.js
  // does. These bindings stay non-writable so a page cannot replace them with
  // something that lies to the content script.
  ableDefine('__ableTrackFiles', trackSelectedFiles);
  ableDefine('__ableMatchFilename', matchTrackedFilename);
  ableDefine('__ableLookupTrackedFilename', lookupTrackedFilename);
  ableDefine('__ableHasTrackedFiles', hasTrackedFiles);

  // Check existing elements
  var allElements = document.querySelectorAll('input[type="file"], button, [role="button"], svg, [class*="attach"], [class*="upload"], [data-testid*="attach"], [data-testid*="upload"]');
  for (var i = 0; i < allElements.length; i++) {
    checkElement(allElements[i]);
  }

  // Check existing drop zones
  var dropZones = document.querySelectorAll('[data-drag-drop], [ondrop], .drop-zone, [role="region"][aria-label*="drop"]');
  for (var d = 0; d < dropZones.length; d++) {
    observeDropZone(dropZones[d]);
  }

  // Watch for new elements — debounced to batch rapid DOM churn
  var debouncedMutate = debounce(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var addedNodes = mutations[m].addedNodes;
      for (var n = 0; n < addedNodes.length; n++) {
        var node = addedNodes[n];
        if (node.nodeType === 1) {
          checkElement(node);
          if (isDropZone(node)) {
            observeDropZone(node);
          }
          var children = node.querySelectorAll ? node.querySelectorAll('input[type="file"], button, [role="button"], svg, [class*="attach"], [class*="upload"], [data-testid*="attach"], [data-testid*="upload"]') : [];
          for (var c = 0; c < children.length; c++) {
            checkElement(children[c]);
          }
          // Check for drop zones within added nodes
          var childDropZones = node.querySelectorAll ? node.querySelectorAll('[data-drag-drop], [ondrop], .drop-zone, [role="region"][aria-label*="drop"]') : [];
          for (var z = 0; z < childDropZones.length; z++) {
            observeDropZone(childDropZones[z]);
          }
        }
      }
    }
  }, 300);

  var observer = new MutationObserver(debouncedMutate);
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  // IntersectionObserver for lazy-loaded file inputs
  if ('IntersectionObserver' in window) {
    var lazyObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var el = entries[i].target;
          if (el instanceof HTMLInputElement && el.type === 'file') {
            checkElement(el);
          }
          lazyObserver.unobserve(el);
        }
      }
    }, { rootMargin: '100px' });

    // Observe existing and future file inputs
    var existingInputs = document.querySelectorAll('input[type="file"]');
    for (var j = 0; j < existingInputs.length; j++) {
      lazyObserver.observe(existingInputs[j]);
    }

    // Also observe for new file inputs via MutationObserver
    var inputObserver = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var addedNodes = mutations[m].addedNodes;
        for (var n = 0; n < addedNodes.length; n++) {
          if (addedNodes[n].nodeType === 1) {
            if (addedNodes[n] instanceof HTMLInputElement && addedNodes[n].type === 'file') {
              lazyObserver.observe(addedNodes[n]);
            }
            var childInputs = addedNodes[n].querySelectorAll ? addedNodes[n].querySelectorAll('input[type="file"]') : [];
            for (var c = 0; c < childInputs.length; c++) {
              lazyObserver.observe(childInputs[c]);
            }
          }
        }
      }
    });
    inputObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }
}

if (typeof globalThis !== "undefined") {
  ableDefine('ABLEFileTracker', Object.freeze({
    trackSelectedFiles: trackSelectedFiles,
    matchTrackedFilename: matchTrackedFilename,
    lookupTrackedFilename: lookupTrackedFilename,
    initFileTracking: initFileTracking,
  }));
}
