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

function computeQuickHash(file, callback) {
  var slice = file.slice(0, 4096);
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var arr = new Uint8Array(reader.result);
      var hex = Array.from(arr.slice(0, 16)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
      callback(hex + ':' + file.size);
    } catch (e) {
      callback(null);
    }
  };
  reader.onerror = function () { callback(null); };
  reader.readAsArrayBuffer(slice);
}

function trackSelectedFiles(files) {
  var now = Date.now();
  for (var i = 0; i < files.length; i++) {
    (function (f) {
      computeQuickHash(f, function (hash) {
        trackedFiles.push({
          name: f.name,
          size: f.size,
          hash: hash,
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

function matchTrackedFilename(size, quickHash) {
  cleanupTrackedFiles();

  if (quickHash) {
    for (var i = trackedFiles.length - 1; i >= 0; i--) {
      if (trackedFiles[i].hash === quickHash) {
        var name = trackedFiles[i].name;
        trackedFiles.splice(i, 1);
        return name;
      }
    }
  }

  for (var i = trackedFiles.length - 1; i >= 0; i--) {
    var sizeDiff = Math.abs(trackedFiles[i].size - size);
    var sizeThreshold = Math.max(trackedFiles[i].size * 0.1, 1024);
    if (sizeDiff <= sizeThreshold) {
      var name = trackedFiles[i].name;
      trackedFiles.splice(i, 1);
      return name;
    }
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
    el.addEventListener('change', function () {
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
  // Track file selections from all file inputs
  document.addEventListener('change', function (event) {
    var target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file' && target.files) {
      trackSelectedFiles(Array.from(target.files));
    }
  }, true);

  // Track file selections from drag-and-drop
  document.addEventListener('drop', function (event) {
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      trackSelectedFiles(Array.from(event.dataTransfer.files));
    }
  }, true);

  // Track file selections from paste (clipboard)
  document.addEventListener('paste', function (event) {
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

  // Expose for use in extractFiles
  window.__ableTrackFiles = trackSelectedFiles;
  window.__ableMatchFilename = matchTrackedFilename;
  window.__ableHasTrackedFiles = hasTrackedFiles;

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
  globalThis.ABLEFileTracker = {
    trackSelectedFiles,
    matchTrackedFilename,
    initFileTracking,
  };
}
