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
    'text/csv',
    'application/json'
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
    var bodySize = body.byteLength || body.size || 0;
    if (bodySize >= 100) {
      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body) || (body instanceof Blob && !(body instanceof File))) {
        var contentType = init.headers ? getHeaderValue(init.headers, 'Content-Type') : null;
        console.debug("ABLE: Binary upload detected, Content-Type:", contentType, "Size:", bodySize, "URL:", requestUrl);
      }

      var fileInfos = extractFiles(body);
      if (fileInfos.length > 0) {
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

// ─── XMLHttpRequest wrapping ────────────────────────────────────────

var originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
  this.__ableUrl = url;
  return originalXhrOpen.apply(this, arguments);
};

var originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body) {
  if (this.__ableUrl && isAnalyticsUrl(this.__ableUrl)) {
    return originalSend.call(this, body);
  }

  if (body) {
    var bodyType = typeof body;
    if (body instanceof Blob) bodyType = body instanceof File ? 'File' : 'Blob';
    else if (body instanceof ArrayBuffer) bodyType = 'ArrayBuffer';
    else if (ArrayBuffer.isView(body)) bodyType = 'TypedArray';
    else if (body instanceof FormData) bodyType = 'FormData';
    else if (body instanceof URLSearchParams) bodyType = 'URLSearchParams';
    else if (body instanceof ReadableStream) bodyType = 'ReadableStream';

    var bodySize = body.byteLength || body.size || 0;
    if (bodySize >= 100) {
      var contentType = this.getRequestHeader ? this.getRequestHeader('Content-Type') : null;
      console.debug("ABLE: XHR upload detected, bodyType:", bodyType, "Content-Type:", contentType, "Size:", bodySize, "URL:", this.__ableUrl || 'unknown');

      var fileInfos = extractFiles(body);
      if (fileInfos.length > 0) {
        console.debug("ABLE: Extracted", fileInfos.length, "file(s) from XHR, filenames:", fileInfos.map(function(f) { return f.file.name; }));
        var ct = this.getRequestHeader ? this.getRequestHeader('Content-Type') : null;
        for (var i = 0; i < fileInfos.length; i++) {
          fileInfos[i].contentType = ct;
        }
        var xhr = this;
        requestCheck(fileInfos).then(function (decision) {
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
      var fileInfos = [];
      if (data instanceof File) {
        fileInfos = [{ file: data, source: 'beacon', contentSize: data.size }];
      } else if (data instanceof Blob) {
        var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(data.size, null) : null;
        fileInfos = [{ file: new File([data], blobName || 'blob', { type: data.type }), source: 'beacon', contentSize: data.size }];
      } else if (data instanceof FormData) {
        for (var entry of data.entries()) {
          if (entry[1] instanceof File) fileInfos.push({ file: entry[1], source: 'beacon', contentSize: entry[1].size });
        }
      } else if (data instanceof ArrayBuffer) {
        var beaconHash = computeBodyHashSync(data);
        var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, beaconHash) : null;
        fileInfos = [{ file: new File([data], arrayBufferName || 'binary-upload'), source: 'beacon', contentSize: data.byteLength }];
      }

      if (fileInfos.length > 0) {
        requestCheck(fileInfos).then(function () {});
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
    var dataSize = data.byteLength || data.size || 0;
    if (dataSize < 100) {
      return originalWsSend.call(this, data);
    }

    var fileInfos = [];
    if (data instanceof Blob) {
      var blobName = window.__ableMatchFilename ? window.__ableMatchFilename(data.size, null) : null;
      fileInfos = [{ file: new File([data], blobName || 'websocket-upload', { type: data.type }), source: 'websocket', contentSize: data.size }];
    } else if (data instanceof ArrayBuffer) {
      var wsHash = computeBodyHashSync(data);
      var arrayBufferName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, wsHash) : null;
      fileInfos = [{ file: new File([data], arrayBufferName || 'websocket-upload'), source: 'websocket', contentSize: data.byteLength }];
    } else if (ArrayBuffer.isView(data)) {
      var wsHash = computeBodyHashSync(data);
      var typedArrayName = window.__ableMatchFilename ? window.__ableMatchFilename(data.byteLength, wsHash) : null;
      fileInfos = [{ file: new File([data.buffer], typedArrayName || 'websocket-upload'), source: 'websocket', contentSize: data.byteLength }];
    }

    if (fileInfos.length > 0) {
      console.debug("ABLE: WebSocket file upload detected:", fileInfos[0].contentSize, "bytes");
      requestCheck(fileInfos).then(function () {});
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
