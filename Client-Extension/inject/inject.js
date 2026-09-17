/**
 * ABLE Extension - Page Script Entry
 *
 * Main entry point for the injected page script.
 * Handles nonce verification, request interception, and SPA navigation.
 */

(function () {
  'use strict';

  var pendingRequests = new Map();
  var ableNonce = null;
  var nonceReady = false;

  function generateId() {
    return 'able-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Wait for ABLE content script to provide a per-page-load nonce.
  window.addEventListener('message', function (event) {
    if (event.data && event.data.source === 'ABLE_CONTENT' && event.data.type === 'ABLE_NONCE') {
      ableNonce = event.data.nonce;
      nonceReady = true;
    }
  });

  function waitForNonce() {
    if (nonceReady) return Promise.resolve(ableNonce);
    return new Promise(function (resolve) {
      var waitStart = Date.now();
      var NONCE_TIMEOUT_MS = 3000;
      var interval = setInterval(function () {
        if (nonceReady) {
          clearInterval(interval);
          resolve(ableNonce);
        } else if (Date.now() - waitStart > NONCE_TIMEOUT_MS) {
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
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_NONCE_FAILED',
            payload: { requestId: null, fileInfos: fileInfos }
          }, '*');
          resolve('proceed');
          return;
        }

        var id = generateId();

        var totalSize = fileInfos.reduce(function (sum, info) {
          return sum + (info.contentSize || info.file?.size || 0);
        }, 0);

        var isFireAndForget = fileInfos.some(function (info) {
          return info.source === 'beacon';
        });
        var isStream = fileInfos.some(function (info) {
          return info.source === 'readablestream';
        });

        if (isFireAndForget || isStream) {
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_INTERCEPT',
            nonce: nonce,
            payload: { requestId: id, fileInfos: fileInfos }
          }, '*');
          resolve('proceed');
          return;
        }

        var timeoutMs = totalSize < 50000 ? 5000 : 10000;

        var timeout = setTimeout(function () {
          pendingRequests.delete(id);
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

  // Expose requestCheck globally in page context so network-interceptor.js can call it
  window.requestCheck = requestCheck;
  window.__ableRequestCheck = requestCheck;

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.source !== 'ABLE_CONTENT') return;

    if (event.data.type === 'ABLE_DECISION') {
      var id = event.data.payload.requestId;
      var action = event.data.payload.action;
      var pending = pendingRequests.get(id);
      if (pending) {
        if (pending.timeout) clearTimeout(pending.timeout);
        pendingRequests.delete(id);
        pending.resolve(action);
      }
      return;
    }

    if (event.data.type === 'ABLE_MODAL_ACTIVE') {
      var modalId = event.data.payload && event.data.payload.requestId;
      var activePending = pendingRequests.get(modalId);
      if (activePending && activePending.timeout) {
        clearTimeout(activePending.timeout);
        activePending.timeout = null;
      }
      return;
    }
  });

  // ─── Inject dependencies into page context ──────────────────────
  // The modularized inject scripts (file-extractor, network-interceptor,
  // file-tracker) each attach their API to globalThis. Load them now so
  // initFileTracking / extractFiles / ABLENetworkInterceptor are available.

  var INJECT_SCRIPTS = [
    'inject/file-extractor.js',
    'inject/network-interceptor.js',
    'inject/file-tracker.js'
  ];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function injectDependencies() {
    var resolved = INJECT_SCRIPTS.map(function (rel) {
      // Resolve relative to this script's URL (chrome-extension://.../inject/inject.js)
      var base = '';
      var scripts = document.querySelectorAll('script[src]');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src.indexOf('inject/inject.js') !== -1) {
          base = scripts[i].src.substring(0, scripts[i].src.lastIndexOf('inject/inject.js'));
          break;
        }
      }
      return base + rel;
    });

    // Chain the loads so each script runs before the next
    var chain = Promise.resolve();
    for (var i = 0; i < resolved.length; i++) {
      chain = chain.then((function (url) {
        return function () { return loadScript(url); };
      })(resolved[i]));
    }
    return chain;
  }

  // ─── Form submission interception ──────────────────────────────────

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
          if (window.__ableTrackFiles) {
            window.__ableTrackFiles(files);
          }
        }
      } catch (e) {
        // Silently ignore
      }
    }
  }, true);

  // ─── Text input interception ───────────────────────────────────────

  var pendingTextChecks = null;
  var textCheckPending = false;

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.shiftKey) return;

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
    if (textCheckPending) return;

    textCheckPending = true;
    var checkId = generateId();

    pendingTextChecks = pendingTextChecks || new Map();
    pendingTextChecks.set(checkId, {
      resolve: function (decision) {
        textCheckPending = false;
        if (decision === 'block') {
          event.preventDefault();
          event.stopPropagation();
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_TEXT_BLOCKED',
            payload: { checkId: checkId }
          }, '*');
        }
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

    setTimeout(function () {
      if (pendingTextChecks && pendingTextChecks.has(checkId)) {
        var pending = pendingTextChecks.get(checkId);
        pendingTextChecks.delete(checkId);
        pending.resolve('allow');
      }
    }, 3000);
  }, true);

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

  // ─── SPA navigation detection ──────────────────────────────────────

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

  // ─── Initialize ────────────────────────────────────────────────────

  // Inject dependencies first, then signal ready and start file tracking
  injectDependencies().then(function () {
    window.postMessage({ source: 'ABLE_INJECT', type: 'ABLE_READY' }, '*');
    if (typeof initFileTracking === 'function') {
      try {
        initFileTracking();
      } catch (trackErr) {
        console.warn('ABLE: File tracking initialization failed:', trackErr);
      }
    }
  }).catch(function (err) {
    console.warn('ABLE: Failed to inject dependencies:', err);
    // Still signal ready so the handshake completes
    window.postMessage({ source: 'ABLE_INJECT', type: 'ABLE_READY' }, '*');
  });

})();
