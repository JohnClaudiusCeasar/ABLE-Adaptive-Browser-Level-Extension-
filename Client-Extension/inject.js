(function () {
  'use strict';

  var pendingRequests = new Map();
  var ableNonce = null;
  var nonceReady = false;

  // Wait for ABLE content script to provide a per-page-load nonce.
  // Without a valid nonce, ABLE_INTERCEPT messages are ignored.
  window.addEventListener('message', function (event) {
    if (event.data && event.data.source === 'ABLE_CONTENT' && event.data.type === 'ABLE_NONCE') {
      ableNonce = event.data.nonce;
      nonceReady = true;
    }
  });

  function generateId() {
    return 'able-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Check if a URL is a known analytics/tracking endpoint.
   * These should not be intercepted as file uploads.
   */
  function isAnalyticsUrl(url) {
    if (!url) return false;
    var analyticsPatterns = [
      /browser-intake-.*\.com\/api\/v2\/rum/i,  // Datadog RUM
      /play\.google\.com\/log/i,               // Google Play analytics
      /fourier\.taobao\.com/i,                 // Taobao analytics
      /gator\.volces\.com/i,                   // Volces analytics
      /collect-rangers/i,                      // Kimi analytics
      /analytics\.js/i,                        // Generic analytics
      /beacon\.min\.i/i,                       // Cloudflare beacon
      /awsc\.et/i,                             // Alibaba analytics
      /aplus.*\.js/i,                          // APLUS analytics
      /youtubei\/v1\/log_event/i,              // YouTube analytics
      /youtubei\/v1\/player\/log/i,            // YouTube player analytics
      \/log_event\?alt=json/i,                 // YouTube log event (relative URL)
      /google-analytics\.com/i,                // Google Analytics
      /stats\.g\.doubleclick\.net/i,           // DoubleClick stats
      /log\.xing\.com/i,                       // XING analytics
      /pixel\.quantserve\.com/i,               // Quantserve pixel
      /scorecardresearch\.com/i,               // Comscore analytics
    ];

    for (var i = 0; i < analyticsPatterns.length; i++) {
      if (analyticsPatterns[i].test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a Content-Type header indicates a file upload.
   * Returns true if the content type suggests file content.
   */
  function isFileContentType(contentType) {
    if (!contentType) return false;
    var ct = contentType.toLowerCase().trim();

    // File upload content types
    var fileTypes = [
      'application/octet-stream',
      'multipart/form-data',
      'application/pdf',
      'application/zip',
      'application/x-zip',
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument',  // DOCX, XLSX, PPTX
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'image/',
      'video/',
      'audio/',
      'text/plain',
      'text/csv',
      'application/json'  // Some APIs send files as base64 in JSON
    ];

    for (var i = 0; i < fileTypes.length; i++) {
      if (ct.indexOf(fileTypes[i]) === 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get a header value from various header formats.
   * Handles Headers object, plain object, and array format.
   */
  function getHeaderValue(headers, name) {
    if (!headers) return null;

    // Headers object (fetch API)
    if (typeof headers.get === 'function') {
      return headers.get(name);
    }

    // Plain object
    if (typeof headers === 'object') {
      // Try case-insensitive lookup
      for (var key in headers) {
        if (key.toLowerCase() === name.toLowerCase()) {
          return headers[key];
        }
      }
    }

    return null;
  }

  // Compute a simple synchronous hash from body's first bytes for filename matching
  function computeBodyHashSync(body) {
    try {
      var bytes;
      if (body instanceof ArrayBuffer) {
        bytes = new Uint8Array(body.slice(0, 16));
      } else if (ArrayBuffer.isView(body)) {
        bytes = new Uint8Array(body.buffer.slice(0, 16));
      } else if (body instanceof Blob) {
        // For Blob, we can't synchronously read, return null
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

  function extractFiles(body) {
    // Fast path — known file types (no copying needed)
    if (body instanceof File) return [{ file: body, source: 'file', contentSize: body.size }];
    if (body instanceof Blob) {
      // Try to recover original filename from tracked file selections
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
    // ArrayBuffer — binary file upload (common in modern SPAs like Claude.ai)
    // Copy the buffer to avoid mutating the original request body
    if (body instanceof ArrayBuffer) {
      // Try to recover original filename from tracked file selections
      var bodyHash = computeBodyHashSync(body);
      var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(body.byteLength, bodyHash) : null;
      return [{
        file: new File([body], arrayBufferName || 'binary-upload', { type: 'application/octet-stream' }),
        source: 'arraybuffer',
        contentSize: body.byteLength
      }];
    }
    // TypedArray (Uint8Array, Int8Array, etc.) — binary file upload
    if (ArrayBuffer.isView(body)) {
      // Try to recover original filename from tracked file selections
      var bodyHash = computeBodyHashSync(body);
      var typedArrayName = window.__ableMatchFilename ? window.__ableMatchFilename(body.byteLength, bodyHash) : null;
      return [{
        file: new File([body.buffer], typedArrayName || 'binary-upload', { type: 'application/octet-stream' }),
        source: 'typedarray',
        contentSize: body.byteLength
      }];
    }
    // ReadableStream — cannot read without consuming, cannot clone via postMessage.
    // Skip to avoid DataCloneError breaking third-party analytics (e.g., ChatGPT Statsig).
    if (body instanceof ReadableStream) {
      return [];
    }
    // URLSearchParams won't contain files, but guard against it
    if (body instanceof URLSearchParams) {
      return [];
    }
    // String bodies (JSON, XML) — no files to extract
    if (typeof body === 'string') {
      return [];
    }
    return [];
  }

  /**
   * Compare two File objects by their identity metadata.
   * Many frameworks clone File objects when building FormData, so the
   * object references differ even though they represent the same file.
   * Matching by name/size/lastModified/type reliably identifies the
   * same file regardless of cloning.
   */
  function filesMatch(a, b) {
    return a.name === b.name &&
           a.size === b.size &&
           a.lastModified === b.lastModified &&
           a.type === b.type;
  }

  /**
   * Clear the given files from any file input elements that currently hold them.
   * Matches by object reference first, then falls back to metadata matching
   * (name/size/lastModified/type) to handle cloned File objects. Setting
   * input.value = '' removes the user's selection from the DOM element.
   */
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

  function waitForNonce() {
    if (nonceReady) return Promise.resolve(ableNonce);
    return new Promise(function (resolve) {
      var waitStart = Date.now();
      // Increased to 3 seconds — some sites have heavy main-thread work
      // during initial load that delays content script message processing.
      var NONCE_TIMEOUT_MS = 3000;
      var interval = setInterval(function () {
        if (nonceReady) {
          clearInterval(interval);
          resolve(ableNonce);
        } else if (Date.now() - waitStart > NONCE_TIMEOUT_MS) {
          // Nonce handshake failed — log for debugging.
          console.warn('ABLE: Nonce handshake timed out after ' + (Date.now() - waitStart) + 'ms. Content script may not be loaded.');
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });
  }

  function requestCheck(fileInfos) {
    return waitForNonce().then(function (nonce) {
      return new Promise(function (resolve, reject) {
        if (!nonce) {
          // ABLE content script didn't establish a nonce handshake.
          // Cannot verify identity — fail open (proceed) to avoid
          // blocking legitimate uploads when ABLE is misconfigured.
          // Notify content.js so it can still log the egress event.
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_NONCE_FAILED',
            payload: { requestId: null, fileInfos: fileInfos }
          }, '*');
          resolve('proceed');
          return;
        }

        var id = generateId();

        // Determine timeout based on file size and source
        var totalSize = fileInfos.reduce(function (sum, info) {
          return sum + (info.contentSize || info.file?.size || 0);
        }, 0);

        // Fire-and-forget sources (beacon, websocket) — don't block
        var isFireAndForget = fileInfos.some(function (info) {
          return ['beacon', 'websocket'].includes(info.source);
        });
        // ReadableStream — cannot scan without consuming, log only
        var isStream = fileInfos.some(function (info) {
          return info.source === 'readablestream';
        });

        if (isFireAndForget || isStream) {
          // Don't block — fire and log
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_INTERCEPT',
            nonce: nonce,
            payload: { requestId: id, fileInfos: fileInfos }
          }, '*');
          resolve('proceed');
          return;
        }

        // Small files (< 50KB): 5s timeout
        // Large files (>= 50KB): 10s timeout
        var timeoutMs = totalSize < 50000 ? 5000 : 10000;

        var timeout = setTimeout(function () {
          pendingRequests.delete(id);
          // Notify content.js so it can log the egress event
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_TIMEOUT',
            nonce: ableNonce,
            payload: { requestId: id, fileInfos: fileInfos }
          }, '*');
          resolve('proceed');
        }, timeoutMs);

        pendingRequests.set(id, { resolve: resolve, reject: reject, timeout: timeout });

        window.postMessage({
          source: 'ABLE_INJECT',
          type: 'ABLE_INTERCEPT',
          nonce: nonce,
          payload: {
            requestId: id,
            fileInfos: fileInfos
          }
        }, '*');
      });
    });
  }

  window.addEventListener('message', function (event) {
    if (event.data && event.data.source === 'ABLE_CONTENT' && event.data.type === 'ABLE_DECISION') {
      var id = event.data.payload.requestId;
      var action = event.data.payload.action;
      var pending = pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.delete(id);
        pending.resolve(action);
      }
    }
  });

  // --- Wrap fetch ---
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    var body = init.body;
    if (!body && typeof input === 'object' && input.body) {
      body = input.body;
    }
    var method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();

    // Skip analytics URLs
    var requestUrl = typeof input === 'string' ? input : (input.url || '');
    if (isAnalyticsUrl(requestUrl)) {
      return originalFetch.call(window, input, init);
    }

    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0 && body) {
      // Check minimum size (skip small payloads like analytics)
      var bodySize = body.byteLength || body.size || 0;
      if (bodySize >= 100) {
        // Diagnostic logging for binary uploads (helps identify what sites are sending)
        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body) || (body instanceof Blob && !(body instanceof File))) {
          var contentType = init.headers ? getHeaderValue(init.headers, 'Content-Type') : null;
          console.debug("ABLE: Binary upload detected, Content-Type:", contentType, "Size:", bodySize, "URL:", requestUrl);
        }

        var fileInfos = extractFiles(body);
        if (fileInfos.length > 0) {
          // Attach Content-Type to fileInfos for diagnostic purposes
          var ct = init.headers ? getHeaderValue(init.headers, 'Content-Type') : null;
          for (var i = 0; i < fileInfos.length; i++) {
            fileInfos[i].contentType = ct;
          }
          return requestCheck(fileInfos).then(function (decision) {
            if (decision === 'cancel') {
              var files = fileInfos.map(function(info) { return info.file; }).filter(Boolean);
              clearFileInputs(files);
              throw new DOMException('Upload cancelled by ABLE security extension', 'AbortError');
            }
            return originalFetch.call(window, input, init);
          });
        }
      }
    }
    return originalFetch.call(window, input, init);
  };

  // --- Wrap XMLHttpRequest.open to capture URL ---
  var originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ableUrl = url;
    return originalXhrOpen.apply(this, arguments);
  };

  // --- Wrap XMLHttpRequest.send ---
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    // Skip analytics URLs
    if (this.__ableUrl && isAnalyticsUrl(this.__ableUrl)) {
      return originalSend.call(this, body);
    }

    if (body) {
      // Debug logging for body type detection (helps identify upload mechanisms)
      var bodyType = typeof body;
      if (body instanceof Blob) bodyType = body instanceof File ? 'File' : 'Blob';
      else if (body instanceof ArrayBuffer) bodyType = 'ArrayBuffer';
      else if (ArrayBuffer.isView(body)) bodyType = 'TypedArray';
      else if (body instanceof FormData) bodyType = 'FormData';
      else if (body instanceof URLSearchParams) bodyType = 'URLSearchParams';
      else if (body instanceof ReadableStream) bodyType = 'ReadableStream';

      var bodySize = body.byteLength || body.size || 0;
      if (bodySize >= 100) {
        // Diagnostic logging for all uploads (helps identify what sites are sending)
        var contentType = this.getRequestHeader ? this.getRequestHeader('Content-Type') : null;
        console.debug("ABLE: XHR upload detected, bodyType:", bodyType, "Content-Type:", contentType, "Size:", bodySize, "URL:", this.__ableUrl || 'unknown');

        var fileInfos = extractFiles(body);
        if (fileInfos.length > 0) {
          console.debug("ABLE: Extracted", fileInfos.length, "file(s) from XHR, filenames:", fileInfos.map(function(f) { return f.file.name; }));
          // Attach Content-Type to fileInfos for diagnostic purposes
          var ct = this.getRequestHeader ? this.getRequestHeader('Content-Type') : null;
          for (var i = 0; i < fileInfos.length; i++) {
            fileInfos[i].contentType = ct;
          }
          var xhr = this;
          requestCheck(fileInfos).then(function (decision) {
            if (decision === 'proceed') {
              originalSend.call(xhr, body);
            } else {
              // Remove the selected files from the page's file inputs
              var files = fileInfos.map(function(info) { return info.file; }).filter(Boolean);
              clearFileInputs(files);
              // Properly abort the XHR so callers get cleanup callbacks
              try {
                Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
                Object.defineProperty(xhr, 'status', { value: 0, writable: true });
                xhr.dispatchEvent(new ProgressEvent('abort'));
                if (typeof xhr.onerror === 'function') {
                  xhr.onerror(new ProgressEvent('error'));
                }
              } catch (e) {
                // Fallback: silently fail if properties are non-configurable
              }
            }
          });
          return;
        }
      }
    }
    return originalSend.call(this, body);
  };

  // --- Detect form submissions with files ---
  // Some sites (like Kimi) may use traditional form submission for file uploads
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form instanceof HTMLFormElement) {
      try {
        var formData = new FormData(form);
        var files = [];
        for (var entry of formData.entries()) {
          if (entry[1] instanceof File) {
            files.push(entry[1]);
          }
        }
        if (files.length > 0) {
          console.debug("ABLE: Form submission with files detected, fileCount:", files.length, "names:", files.map(function(f) { return f.name; }));
          // Track the files for filename recovery
          if (window.__ableTrackFiles) {
            window.__ableTrackFiles(files);
          }
        }
      } catch (e) {
        // Silently ignore form data extraction errors
      }
    }
  }, true);

  // --- Wrap navigator.sendBeacon ---
  // Beacon is fire-and-forget — cannot be blocked, only observed.
  // Common for analytics and sometimes file uploads on page unload.
  var originalSendBeacon = navigator.sendBeacon;
  navigator.sendBeacon = function (url, data) {
    // Skip analytics URLs
    if (isAnalyticsUrl(url)) {
      return originalSendBeacon.call(navigator, url, data);
    }

    try {
      if (data) {
        var fileInfos = [];
        if (data instanceof File) {
          fileInfos = [{ file: data, source: 'beacon', contentSize: data.size }];
        } else if (data instanceof Blob) {
          // Try to recover original filename from tracked file selections
          var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(data.size, null) : null;
          fileInfos = [{ file: new File([data], blobName || 'blob', { type: data.type }), source: 'beacon', contentSize: data.size }];
        } else if (data instanceof FormData) {
          for (var entry of data.entries()) {
            if (entry[1] instanceof File) fileInfos.push({ file: entry[1], source: 'beacon', contentSize: entry[1].size });
          }
        } else if (data instanceof ArrayBuffer) {
          // Try to recover original filename from tracked file selections
          var beaconHash = computeBodyHashSync(data);
          var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, beaconHash) : null;
          fileInfos = [{ file: new File([data], arrayBufferName || 'binary-upload'), source: 'beacon', contentSize: data.byteLength }];
        }

        if (fileInfos.length > 0) {
          // Fire-and-forget logging — beacon cannot be blocked
          requestCheck(fileInfos).then(function () { /* decision ignored for beacon */ });
        }
      }
    } catch (e) {
      // Silently ignore — beacon interception is best-effort
    }
    return originalSendBeacon.call(navigator, url, data);
  };

  // --- Wrap WebSocket.send ---
  // WebSocket.send accepts string, Blob, ArrayBuffer, or TypedArray.
  // Used for real-time file sharing (Slack, Discord, collaborative editors).
  var OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    var originalWsSend = OriginalWebSocket.prototype.send;

    OriginalWebSocket.prototype.send = function (data) {
      // Only intercept binary data above minimum size (skip control messages)
      var dataSize = data.byteLength || data.size || 0;
      if (dataSize < 100) {
        return originalWsSend.call(this, data);
      }

      var fileInfos = [];
      if (data instanceof Blob) {
        // Try to recover original filename from tracked file selections
        var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(data.size, null) : null;
        fileInfos = [{ file: new File([data], blobName || 'websocket-upload', { type: data.type }), source: 'websocket', contentSize: data.size }];
      } else if (data instanceof ArrayBuffer) {
        // Try to recover original filename from tracked file selections
        var wsHash = computeBodyHashSync(data);
        var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, wsHash) : null;
        fileInfos = [{ file: new File([data], arrayBufferName || 'websocket-upload'), source: 'websocket', contentSize: data.byteLength }];
      } else if (ArrayBuffer.isView(data)) {
        // Try to recover original filename from tracked file selections
        var wsHash = computeBodyHashSync(data);
        var typedArrayName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, wsHash) : null;
        fileInfos = [{ file: new File([data.buffer], typedArrayName || 'websocket-upload'), source: 'websocket', contentSize: data.byteLength }];
      }

      if (fileInfos.length > 0) {
        // Log the upload — WebSocket.send is sync, fire-and-forget
        console.debug("ABLE: WebSocket file upload detected:", fileInfos[0].contentSize, "bytes");
        requestCheck(fileInfos).then(function () { /* decision logged but not blocked for WS */ });
      }

      return originalWsSend.call(this, data);
    };

    // Preserve WebSocket constructor and static properties
    window.WebSocket = function (url, protocols) {
      return new OriginalWebSocket(url, protocols);
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  }

  window.postMessage({ source: 'ABLE_INJECT', type: 'ABLE_READY' }, '*');

  // --- SPA navigation detection ---
  // pushState / replaceState don't fire DOM events, so we patch them
  // and also listen for popstate / hashchange to cover all client-side
  // routing patterns used by modern web apps.
  (function () {
    var lastUrl = location.href;

    function notifyUrlChange() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        window.postMessage({
          source: 'ABLE_INJECT',
          type: 'ABLE_SPA_NAVIGATION',
          url: location.href,
        }, '*');
      }
    }

    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      notifyUrlChange();
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      notifyUrlChange();
    };

    window.addEventListener('popstate', notifyUrlChange);
    window.addEventListener('hashchange', notifyUrlChange);
  })();

  // --- Track file selections for filename recovery ---
  // When sites send files as ArrayBuffer/Blob, the original filename is lost.
  // We track file selections and match them to uploads by content hash, size, and timing.
  (function () {
    var FILE_MATCH_WINDOW_MS = 30000; // 30 seconds
    var trackedFiles = [];

    // Compute a quick hash of the first 4KB of a file for content-based matching
    function computeQuickHash(file, callback) {
      var slice = file.slice(0, 4096);
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var arr = new Uint8Array(reader.result);
          // Create a simple hash from first 16 bytes + size
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
          // Compute hash asynchronously for better matching
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
      // Clean up old entries
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

      // Strategy 1: Match by content hash (most reliable)
      if (quickHash) {
        for (var i = trackedFiles.length - 1; i >= 0; i--) {
          if (trackedFiles[i].hash === quickHash) {
            var name = trackedFiles[i].name;
            trackedFiles.splice(i, 1);
            return name;
          }
        }
      }

      // Strategy 2: Match by size with tolerance (10% or 1KB, whichever is larger)
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

    // Compute quick hash for an ArrayBuffer/Blob body
    function computeBodyHash(body, callback) {
      var blob;
      if (body instanceof Blob) {
        blob = body;
      } else if (body instanceof ArrayBuffer) {
        blob = new Blob([body]);
      } else if (ArrayBuffer.isView(body)) {
        blob = new Blob([body.buffer]);
      } else {
        callback(null);
        return;
      }

      var slice = blob.slice(0, 4096);
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var arr = new Uint8Array(reader.result);
          var hex = Array.from(arr.slice(0, 16)).map(function (b) {
            return b.toString(16).padStart(2, '0');
          }).join('');
          callback(hex + ':' + blob.size);
        } catch (e) {
          callback(null);
        }
      };
      reader.onerror = function () { callback(null); };
      reader.readAsArrayBuffer(slice);
    }

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
  })();

  // --- Detect file inputs and attachment buttons added dynamically ---
  // Modern SPAs (like Claude.ai) create file inputs on-demand when the user
  // clicks an attach button, then remove them after selection. We watch for
  // these transient inputs and also for clickable elements that trigger
  // file selection dialogs.
  (function () {
    var reportedInputs = new Set();

    function checkElement(el) {
      // Check for file inputs
      if (el instanceof HTMLInputElement && el.type === 'file' && !reportedInputs.has(el)) {
        reportedInputs.add(el);
        // Listen for file selection on this input
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

      // Check for elements that look like attachment buttons
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
        // Common icon class names
        /attach|upload|paperclip|file-add|file-upload/.test(el.className || '') ||
        /attach|upload|paperclip|file-add|file-upload/.test(el.getAttribute('data-testid') || '') ||
        // SVG use elements with attach/upload references
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
          if (node.nodeType === 1) { // Element node
            checkElement(node);
            // Check children of added containers
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
  })();

  // --- Intercept form submissions with file uploads ---
  var formSubmitting = false;

  document.addEventListener('submit', function (event) {
    if (formSubmitting) return; // already approved, let it through

    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    // Only intercept multipart forms (file uploads)
    var enctype = (form.enctype || '').toLowerCase();
    if (enctype !== 'multipart/form-data') return;

    var files = [];
    var fileInputs = form.querySelectorAll('input[type="file"]');
    for (var i = 0; i < fileInputs.length; i++) {
      for (var j = 0; j < fileInputs[i].files.length; j++) {
        files.push(fileInputs[i].files[j]);
      }
    }

    if (files.length === 0) return;

    event.preventDefault();

    requestCheck(files).then(function (decision) {
      if (decision === 'proceed') {
        formSubmitting = true;
        form.submit();
        formSubmitting = false;
      } else {
        // Remove the selected files from the form's file inputs
        clearFileInputs(files);
      }
    });
  }, true); // capture phase to intercept before other handlers

  // --- Intercept text input on Enter key (chat boxes, text areas) ---
  // Catches copy-paste exfiltration: user pastes sensitive data into a
  // chat box and hits Enter. We scan the text for patterns before
  // allowing the message to be sent.
  (function () {
    var textCheckPending = false;

    document.addEventListener('keydown', function (event) {
      // Only intercept Enter key (without Shift — Shift+Enter is newline)
      if (event.key !== 'Enter' || event.shiftKey) return;

      // Find the active text input element
      var target = event.target;
      var text = '';
      var inputType = '';

      if (target instanceof HTMLTextAreaElement) {
        text = target.value;
        inputType = 'textarea';
      } else if (target instanceof HTMLInputElement) {
        var type = (target.type || '').toLowerCase();
        if (type === 'text' || type === 'search') {
          text = target.value;
          inputType = 'input';
        }
      } else if (target.isContentEditable) {
        text = target.innerText || target.textContent || '';
        inputType = 'contenteditable';
      }

      if (!text || text.trim().length === 0) return;
      if (textCheckPending) return; // already checking this input

      // Send text to content.js for pattern scanning.
      // The content.js will respond with a decision via postMessage.
      textCheckPending = true;
      var checkId = generateId();

      // Store the pending check so content.js can respond
      pendingTextChecks = pendingTextChecks || new Map();
      pendingTextChecks.set(checkId, {
        resolve: function (decision) {
          textCheckPending = false;
          if (decision === 'block') {
            // Stop the Enter key from submitting
            event.preventDefault();
            event.stopPropagation();
            // Notify that we blocked it
            window.postMessage({
              source: 'ABLE_INJECT',
              type: 'ABLE_TEXT_BLOCKED',
              payload: { checkId: checkId }
            }, '*');
          }
          // If 'allow', do nothing — let the Enter key proceed
        },
        reject: function () {
          textCheckPending = false;
        }
      });

      window.postMessage({
        source: 'ABLE_INJECT',
        type: 'ABLE_TEXT_CHECK',
        nonce: ableNonce,
        payload: {
          checkId: checkId,
          text: text,
          inputType: inputType,
          url: window.location.href
        }
      }, '*');

      // Timeout: if content.js doesn't respond in 3 seconds, allow
      setTimeout(function () {
        if (pendingTextChecks && pendingTextChecks.has(checkId)) {
          var pending = pendingTextChecks.get(checkId);
          pendingTextChecks.delete(checkId);
          pending.resolve('allow');
        }
      }, 3000);
    }, true); // capture phase to intercept before other handlers

    // Listen for text check decisions from content.js
    window.addEventListener('message', function (event) {
      if (event.data && event.data.source === 'ABLE_CONTENT' && event.data.type === 'ABLE_TEXT_DECISION') {
        var id = event.data.payload?.checkId;
        var action = event.data.payload?.action;
        if (pendingTextChecks && pendingTextChecks.has(id)) {
          var pending = pendingTextChecks.get(id);
          pendingTextChecks.delete(id);
          pending.resolve(action || 'allow');
        }
      }
    });
  })();
})();
