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
          fileName: files[0].name || 'unknown',
          fileSize: files[0].size,
          fileType: files[0].type || 'application/octet-stream',
          file: files[0]
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
          }
        });
        return;
      }
    }
    return originalSend.call(this, body);
  };

  window.postMessage({ source: 'ABLE_INJECT', type: 'ABLE_READY' }, '*');
})();
