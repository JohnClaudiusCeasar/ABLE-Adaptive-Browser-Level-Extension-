(function () {
  'use strict';

  var pendingRequests = new Map();

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
   * Clear the given files from any file input elements that currently hold them.
   * Matches by object reference so we only clear the inputs that actually
   * contain the intercepted files. Setting input.value = '' removes the
   * user's selection from the DOM element.
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
          if (input.files[k] === files[j]) {
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

  function requestCheck(files) {
    return new Promise(function (resolve, reject) {
      var id = generateId();
      var timeout = setTimeout(function () {
        pendingRequests.delete(id);
        resolve('proceed');
      }, 30000);

      pendingRequests.set(id, { resolve: resolve, reject: reject, timeout: timeout });

      window.postMessage({
        source: 'ABLE_INJECT',
        type: 'ABLE_INTERCEPT',
        payload: {
          requestId: id,
          files: files
        }
      }, '*');
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
