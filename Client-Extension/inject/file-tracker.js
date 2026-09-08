/**
 * ABLE Extension - File Tracker
 *
 * Tracks file selections and detects file inputs/attachment buttons.
 */

// ─── File selection tracking ────────────────────────────────────────

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

// ─── File input detection ───────────────────────────────────────────

var reportedInputs = new Set();

function checkElement(el) {
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

  var tagName = (el.tagName || '').toLowerCase();
  var role = (el.getAttribute('role') || '').toLowerCase();
  var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  var title = (el.title || '').toLowerCase();
  var textContent = (el.textContent || '').trim().toLowerCase();

  var isAttachButton =
    role === 'button' && /attach|upload|file|paperclip/.test(ariaLabel + ' ' + title + ' ' + textContent) ||
    /attach|upload|add file|paperclip/.test(ariaLabel) ||
    /attach|upload|add file|paperclip/.test(title) ||
    (tagName === 'button' && /attach|upload|add file/.test(textContent)) ||
    /attach|upload|paperclip|file-add|file-upload/.test(el.className || '') ||
    /attach|upload|paperclip|file-add|file-upload/.test(el.getAttribute('data-testid') || '') ||
    (tagName === 'svg' && /attach|upload|paperclip/.test(el.innerHTML || ''));

  if (isAttachButton && !reportedInputs.has('btn-' + (el.id || el.className))) {
    reportedInputs.add('btn-' + (el.id || el.className));
    el.addEventListener('click', function () {
      window.postMessage({
        source: 'ABLE_INJECT',
        type: 'ABLE_ATTACH_BUTTON_CLICKED',
        payload: { text: el.textContent?.trim()?.slice(0, 50) || null, className: el.className || null }
      }, '*');
    }, true);
  }
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

  // Expose for use in extractFiles
  window.__ableTrackFiles = trackSelectedFiles;
  window.__ableMatchFilename = matchTrackedFilename;

  // Check existing elements
  var allElements = document.querySelectorAll('input[type="file"], button, [role="button"], svg, [class*="attach"], [class*="upload"], [data-testid*="attach"], [data-testid*="upload"]');
  for (var i = 0; i < allElements.length; i++) {
    checkElement(allElements[i]);
  }

  // Watch for new elements
  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var addedNodes = mutations[m].addedNodes;
      for (var n = 0; n < addedNodes.length; n++) {
        var node = addedNodes[n];
        if (node.nodeType === 1) {
          checkElement(node);
          var children = node.querySelectorAll('input[type="file"], button, [role="button"], svg, [class*="attach"], [class*="upload"]');
          for (var c = 0; c < children.length; c++) {
            checkElement(children[c]);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEFileTracker = {
    trackSelectedFiles,
    matchTrackedFilename,
    initFileTracking,
  };
}
