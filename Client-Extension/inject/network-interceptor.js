/**
 * ABLE Extension - Network Interceptor
 *
 * Wraps fetch, XHR, sendBeacon, and WebSocket to intercept file uploads.
 */

function isAnalyticsUrl(url) {
  if (!url) return false;
  var analyticsPatterns = [
    /browser-intake-.*\.com\/api\/v2\/rum/i,
    /play\.google\.com\/log/i,
    /fourier\.taobao\.com/i,
    /gator\.volces\.com/i,
    /collect-rangers/i,
    /analytics\.js/i,
    /beacon\.min\.i/i,
    /awsc\.et/i,
    /aplus.*\.js/i,
    /youtubei\/v1\/log_event/i,
    /youtubei\/v1\/player\/log/i,
    /\/log_event\?alt=json/i,
    /google-analytics\.com/i,
    /stats\.g\.doubleclick\.net/i,
    /log\.xing\.com/i,
    /pixel\.quantserve\.com/i,
    /scorecardresearch\.com/i,
  ];

  for (var i = 0; i < analyticsPatterns.length; i++) {
    if (analyticsPatterns[i].test(url)) {
      return true;
    }
  }
  return false;
}

function isFileContentType(contentType) {
  if (!contentType) return false;
  var ct = contentType.toLowerCase().trim();

  var fileTypes = [
    'application/octet-stream',
    'multipart/form-data',
    'application/pdf',
    'application/zip',
    'application/x-zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'image/',
    'video/',
    'audio/',
    'text/plain',
    'text/csv'
  ];

  for (var i = 0; i < fileTypes.length; i++) {
    if (ct.indexOf(fileTypes[i]) === 0) {
      return true;
    }
  }
  return false;
}

function getHeaderValue(headers, name) {
  if (!headers) return null;

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  if (typeof headers === 'object') {
    for (var key in headers) {
      if (key.toLowerCase() === name.toLowerCase()) {
        return headers[key];
      }
    }
  }

  return null;
}

function getRequestCheckFn() {
  if (typeof window !== 'undefined' && typeof window.__ableRequestCheck === 'function') {
    return window.__ableRequestCheck;
  }
  if (typeof window !== 'undefined' && typeof window.requestCheck === 'function') {
    return window.requestCheck;
  }
  if (typeof requestCheck === 'function') {
    return requestCheck;
  }
  return null;
}

// ─── Fetch wrapping ─────────────────────────────────────────────────

var originalFetch = window.fetch;
window.fetch = function (input, init) {
  init = init || {};
  var body = init.body;
  if (!body && typeof input === 'object' && input.body) {
    body = input.body;
  }
  var method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();

  var requestUrl = typeof input === 'string' ? input : (input.url || '');
  if (isAnalyticsUrl(requestUrl)) {
    return originalFetch.call(window, input, init);
  }

  if (['POST', 'PUT', 'PATCH'].indexOf(method) >= 0 && body) {
    var headersObj = init.headers || (typeof input === 'object' ? input.headers : null);
    var ctHeader = getHeaderValue(headersObj, 'Content-Type');
    if (ctHeader && (ctHeader.indexOf('application/json') === 0 || ctHeader.indexOf('application/grpc') === 0 || ctHeader.indexOf('text/event-stream') === 0)) {
      var candidate = typeof extractFilenameFromUrl === 'function' ? extractFilenameFromUrl(requestUrl) : null;
      var hasTracked = typeof window.__ableHasTrackedFiles === 'function' ? window.__ableHasTrackedFiles() : false;
      if (!candidate && !hasTracked && !(body instanceof FormData) && !(body instanceof File)) {
        return originalFetch.call(window, input, init);
      }
    }

    var bodySize = body.byteLength || body.size || 0;
    var context = {
      headers: headersObj,
      url: requestUrl
    };

    function processDecision(infos) {
      if (!infos || infos.length === 0) {
        return originalFetch.call(window, input, init);
      }
      var ct = init.headers ? getHeaderValue(init.headers, 'Content-Type') : null;
      for (var i = 0; i < infos.length; i++) {
        infos[i].contentType = ct;
      }
      var checkFn = getRequestCheckFn();
      if (!checkFn) {
        console.warn('ABLE: requestCheck handler unavailable, proceeding with fetch');
        return originalFetch.call(window, input, init);
      }
      return checkFn(infos).then(function (decision) {
        if (decision === 'cancel') {
          var files = infos.map(function (info) { return info.file; }).filter(Boolean);
          clearFileInputs(files);
          throw new DOMException('Upload cancelled by ABLE security extension', 'AbortError');
        }
        return originalFetch.call(window, input, init);
      });
    }

    if (body instanceof ReadableStream) {
      return (typeof extractFilesAsync === 'function' ? extractFilesAsync(body, context) : Promise.resolve(extractFiles(body, context)))
        .then(processDecision);
    }

    var fileInfos = extractFiles(body, context);
    if (fileInfos && fileInfos.length > 0) {
      return processDecision(fileInfos);
    }
  }

  return originalFetch.call(window, input, init);
};

// ─── XMLHttpRequest wrapping ────────────────────────────────────────

var originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
  this.__ableUrl = url;
  this.__ableHeaders = {};
  return originalXhrOpen.apply(this, arguments);
};

var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
  this.__ableHeaders = this.__ableHeaders || {};
  if (typeof header === 'string') {
    this.__ableHeaders[header.toLowerCase()] = value;
  }
  return originalSetRequestHeader.apply(this, arguments);
};

var originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body) {
  if (this.__ableUrl && isAnalyticsUrl(this.__ableUrl)) {
    return originalSend.call(this, body);
  }

  if (body) {
    var ct = this.getRequestHeader ? this.getRequestHeader('Content-Type') : (this.__ableHeaders ? this.__ableHeaders['content-type'] : null);
    if (ct && (ct.indexOf('application/json') === 0 || ct.indexOf('application/grpc') === 0 || ct.indexOf('text/event-stream') === 0)) {
      var candidate = typeof extractFilenameFromUrl === 'function' ? extractFilenameFromUrl(this.__ableUrl) : null;
      var hasTracked = typeof window.__ableHasTrackedFiles === 'function' ? window.__ableHasTrackedFiles() : false;
      if (!candidate && !hasTracked && !(body instanceof FormData) && !(body instanceof File)) {
        return originalSend.call(this, body);
      }
    }

    var context = {
      headers: this.__ableHeaders || null,
      url: this.__ableUrl || ''
    };

    var fileInfos = extractFiles(body, context);
    if (fileInfos && fileInfos.length > 0) {
      console.debug("ABLE: Extracted", fileInfos.length, "file(s) from XHR, filenames:", fileInfos.map(function(f) { return f.file ? f.file.name : 'unnamed'; }));
      var ct = this.getRequestHeader ? this.getRequestHeader('Content-Type') : (this.__ableHeaders ? this.__ableHeaders['content-type'] : null);
      for (var i = 0; i < fileInfos.length; i++) {
        fileInfos[i].contentType = ct;
      }
      var xhr = this;
      var checkFn = getRequestCheckFn();
      if (!checkFn) {
        console.warn('ABLE: requestCheck handler unavailable, proceeding with XHR');
        return originalSend.call(xhr, body);
      }
      checkFn(fileInfos).then(function (decision) {
        if (decision === 'proceed') {
          originalSend.call(xhr, body);
        } else {
          var files = fileInfos.map(function(info) { return info.file; }).filter(Boolean);
          clearFileInputs(files);
          try {
            Object.defineProperty(xhr, 'readyState', { value: 4, writable: true });
            Object.defineProperty(xhr, 'status', { value: 0, writable: true });
            xhr.dispatchEvent(new ProgressEvent('abort'));
            if (typeof xhr.onerror === 'function') {
              xhr.onerror(new ProgressEvent('error'));
            }
          } catch (e) {
            // Fallback: silently fail
          }
        }
      });
      return;
    }
  }
  return originalSend.call(this, body);
};

// ─── sendBeacon wrapping ────────────────────────────────────────────

var originalSendBeacon = navigator.sendBeacon;
navigator.sendBeacon = function (url, data) {
  if (isAnalyticsUrl(url)) {
    return originalSendBeacon.call(navigator, url, data);
  }

  try {
    if (data) {
      var context = { url: url };
      var fileInfos = extractFiles(data, context);
      var checkFn = getRequestCheckFn();
      if (fileInfos && fileInfos.length > 0 && checkFn) {
        checkFn(fileInfos).then(function () {});
      }
    }
  } catch (e) {
    // Silently ignore
  }
  return originalSendBeacon.call(navigator, url, data);
};

// ─── WebSocket wrapping ────────────────────────────────────────────

var OriginalWebSocket = window.WebSocket;
if (OriginalWebSocket) {
  var originalWsSend = OriginalWebSocket.prototype.send;

  OriginalWebSocket.prototype.send = function (data) {
    var dataSize = data ? (data.byteLength || data.size || 0) : 0;
    if (dataSize < 100) {
      return originalWsSend.call(this, data);
    }

    var context = { url: this.url || '' };
    var fileInfos = extractFiles(data, context);

    if (fileInfos && fileInfos.length > 0) {
      console.debug("ABLE: WebSocket file upload detected:", fileInfos[0].contentSize, "bytes, filename:", fileInfos[0].file?.name);
      var ws = this;
      var checkFn = getRequestCheckFn();
      if (!checkFn) {
        return originalWsSend.call(ws, data);
      }
      checkFn(fileInfos).then(function (decision) {
        if (decision === 'proceed') {
          originalWsSend.call(ws, data);
        } else {
          console.warn("ABLE: WebSocket upload cancelled by security extension");
          var files = fileInfos.map(function(info) { return info.file; }).filter(Boolean);
          clearFileInputs(files);
        }
      });
      return;
    }

    return originalWsSend.call(this, data);
  };

  window.WebSocket = function (url, protocols) {
    return new OriginalWebSocket(url, protocols);
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLENetworkInterceptor = {
    isAnalyticsUrl,
    isFileContentType,
    getHeaderValue,
  };
}
