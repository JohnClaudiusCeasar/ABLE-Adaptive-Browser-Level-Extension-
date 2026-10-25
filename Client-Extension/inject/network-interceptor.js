/**
 * ABLE Extension - Network Interceptor
 *
 * Wraps fetch, XHR, sendBeacon, and WebSocket to intercept file uploads.
 */

// Only KNOWN analytics HOSTS may be skipped. Path-only patterns ("/log_event",
// "/analytics.js", ...) let a hostile page silence interception by choosing an
// upload URL that happens to match one.
function isAnalyticsUrl(url) {
  if (!url) return false;

  var parsed;
  try {
    parsed = new URL(url, (typeof window !== 'undefined' && window.location) ? window.location.href : undefined);
  } catch (e) {
    return false;
  }

  var host = (parsed.hostname || '').toLowerCase();
  if (!host) return false;

  function matches(suffix) {
    return host === suffix || host.slice(-(suffix.length + 1)) === '.' + suffix;
  }

  var analyticsHosts = [
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'scorecardresearch.com',
    'quantserve.com',
    'log.xing.com',
    'fourier.taobao.com',
    'gator.volces.com',
  ];
  for (var i = 0; i < analyticsHosts.length; i++) {
    if (matches(analyticsHosts[i])) return true;
  }

  if (/^browser-intake-.+\.com$/.test(host)) return true;
  if (host === 'play.google.com' && parsed.pathname.indexOf('/log') === 0) return true;

  var isYoutube = matches('youtube.com') || host === 'youtubei.googleapis.com';
  if (isYoutube && /\/youtubei\/v1\/(log_event|player\/log)/.test(parsed.pathname)) {
    return true;
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

// Capture the internals ONCE, in this closure. Reading them from the mutable
// global scope at request time is what let a page swap in a pass-through.
var ableExtractFiles = (typeof ABLEFileExtractor !== 'undefined' && typeof ABLEFileExtractor.extractFiles === 'function')
  ? ABLEFileExtractor.extractFiles
  : ((typeof extractFiles === 'function') ? extractFiles : null);
var ableExtractFilesAsync = (typeof ABLEFileExtractor !== 'undefined' && typeof ABLEFileExtractor.extractFilesAsync === 'function')
  ? ABLEFileExtractor.extractFilesAsync
  : ((typeof extractFilesAsync === 'function') ? extractFilesAsync : null);
var ableRequestCheck = (typeof window !== 'undefined' && typeof window.__ableRequestCheck === 'function')
  ? window.__ableRequestCheck
  : ((typeof window !== 'undefined' && typeof window.requestCheck === 'function') ? window.requestCheck : null);

function getRequestCheckFn() {
  return ableRequestCheck;
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
          clearFileInputs(infos);
          throw new DOMException('Upload cancelled by ABLE security extension', 'AbortError');
        }
        return originalFetch.call(window, input, init);
      });
    }

    // Content identity for Blob/File/FormData bodies needs their bytes, which
    // is async. Never block the request on an extraction failure.
    if (ableExtractFilesAsync) {
      return ableExtractFilesAsync(body, context)
        .then(processDecision)
        .catch(function () {
          return originalFetch.call(window, input, init);
        });
    }

    var fileInfos = ableExtractFiles ? ableExtractFiles(body, context) : [];
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
    var context = {
      headers: this.__ableHeaders || null,
      url: this.__ableUrl || ''
    };

    var xhr = this;
    var checkFn = getRequestCheckFn();
    if (!checkFn) {
      console.warn('ABLE: requestCheck handler unavailable, proceeding with XHR');
      return originalSend.call(xhr, body);
    }

    function sendAfterExtraction(fileInfos) {
      if (!fileInfos || fileInfos.length === 0) {
        originalSend.call(xhr, body);
        return;
      }

      console.debug("ABLE: Extracted", fileInfos.length, "file(s) from XHR, filenames:", fileInfos.map(function (f) { return f.file ? f.file.name : 'unnamed'; }));
      var ct = xhr.getRequestHeader ? xhr.getRequestHeader('Content-Type') : (xhr.__ableHeaders ? xhr.__ableHeaders['content-type'] : null);
      for (var i = 0; i < fileInfos.length; i++) {
        fileInfos[i].contentType = ct;
      }

      checkFn(fileInfos).then(function (decision) {
        if (decision === 'proceed') {
          originalSend.call(xhr, body);
        } else {
          clearFileInputs(fileInfos);
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
    }

    if (ableExtractFilesAsync) {
      ableExtractFilesAsync(body, context)
        .then(sendAfterExtraction)
        .catch(function () { originalSend.call(xhr, body); });
    } else {
      sendAfterExtraction(ableExtractFiles ? ableExtractFiles(body, context) : []);
    }
    return;
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
      var checkFn = getRequestCheckFn();
      function startCheck(fileInfos) {
        if (fileInfos && fileInfos.length > 0 && checkFn) {
          checkFn(fileInfos).then(function () {});
        }
      }
      if (ableExtractFilesAsync) {
        ableExtractFilesAsync(data, context).then(startCheck).catch(function () {});
      } else {
        startCheck(ableExtractFiles ? ableExtractFiles(data, context) : []);
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
    var ws = this;

    function sendAfterExtraction(fileInfos) {
      if (!fileInfos || fileInfos.length === 0) {
        originalWsSend.call(ws, data);
        return;
      }

      console.debug("ABLE: WebSocket file upload detected:", fileInfos[0].contentSize, "bytes, filename:", fileInfos[0].file?.name);
      var checkFn = getRequestCheckFn();
      if (!checkFn) {
        originalWsSend.call(ws, data);
        return;
      }

      checkFn(fileInfos).then(function (decision) {
        if (decision === 'proceed') {
          originalWsSend.call(ws, data);
        } else {
          console.warn("ABLE: WebSocket upload cancelled by security extension");
          clearFileInputs(fileInfos);
        }
      });
    }

    if (ableExtractFilesAsync) {
      ableExtractFilesAsync(data, context)
        .then(sendAfterExtraction)
        .catch(function () { originalWsSend.call(ws, data); });
    } else {
      sendAfterExtraction(ableExtractFiles ? ableExtractFiles(data, context) : []);
    }
    return;
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
