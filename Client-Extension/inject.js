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

  function extractFiles(body) {
    if (body instanceof File) return [body];
    if (body instanceof Blob) return [new File([body], 'blob', { type: body.type })];
    if (body instanceof FormData) {
      var files = [];
      for (var entry of body.entries()) {
        if (entry[1] instanceof File || entry[1] instanceof Blob) {
          files.push(entry[1]);
        }
      }
      return files;
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
      var interval = setInterval(function () {
        if (nonceReady) {
          clearInterval(interval);
          resolve(ableNonce);
        } else if (Date.now() - waitStart > 1000) {
          // Nonce handshake failed — proceed without protection.
          clearInterval(interval);
          resolve(null);
        }
      }, 25);
    });
  }

  function requestCheck(files) {
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
            payload: { requestId: id, files: files }
          }, '*');
          resolve('proceed');
          return;
        }

        var id = generateId();
        var timeout = setTimeout(function () {
          pendingRequests.delete(id);
          // Notify content.js so it can log the egress event
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_TIMEOUT',
            nonce: ableNonce,
            payload: { requestId: id, files: files }
          }, '*');
          resolve('proceed');
        }, 30000);

        pendingRequests.set(id, { resolve: resolve, reject: reject, timeout: timeout });

        window.postMessage({
          source: 'ABLE_INJECT',
          type: 'ABLE_INTERCEPT',
          nonce: nonce,
          payload: {
            requestId: id,
            files: files
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
    if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0 && body) {
      var files = extractFiles(body);
      if (files.length > 0) {
        return requestCheck(files).then(function (decision) {
          if (decision === 'cancel') {
            clearFileInputs(files);
            throw new DOMException('Upload cancelled by ABLE security extension', 'AbortError');
          }
          return originalFetch.call(window, input, init);
        });
      }
    }
    return originalFetch.call(window, input, init);
  };

  // --- Wrap XMLHttpRequest.send ---
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (body) {
      var files = extractFiles(body);
      if (files.length > 0) {
        var xhr = this;
        requestCheck(files).then(function (decision) {
          if (decision === 'proceed') {
            originalSend.call(xhr, body);
          } else {
            // Remove the selected files from the page's file inputs
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
    return originalSend.call(this, body);
  };

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
})();
