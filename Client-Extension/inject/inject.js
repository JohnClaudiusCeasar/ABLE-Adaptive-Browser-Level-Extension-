/**
 * ABLE Extension - Page Script Entry
 *
 * Main entry point for the injected page script.
 * Handles nonce verification, request interception, and SPA navigation.
 */

(function () {
  'use strict';

  // Tells the shared modules they are running in the page world, so they keep
  // their helpers under the ABLESyntheticNames namespace instead of claiming
  // bare globals the page may already use.
  window.__ABLE_PAGE_WORLD = true;

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
    if (!ableNonce || event.data.nonce !== ableNonce) return;

    if (event.data.type === 'ABLE_DECISION') {
      var id = event.data.payload.requestId;
      var action = event.data.payload.action;
      var details = event.data.payload.details;
      if (action === 'cancel' && typeof clearFileInputs === 'function') {
        try {
          clearFileInputs(details || []);
        } catch (e) {}
      }
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
      // A held text check keeps its own pending entry. Suspend the
      // auto-allow timeout while the modal is open so it cannot release the
      // send behind the user's back.
      var textCheckId = event.data.payload && event.data.payload.checkId;
      var activeText = textCheckId && pendingTextChecks && pendingTextChecks.get(textCheckId);
      if (activeText && activeText.timeout) {
        clearTimeout(activeText.timeout);
        activeText.timeout = null;
      }
      return;
    }
  });

  // ─── Inject dependencies into page context ──────────────────────
  // The modularized inject scripts (file-extractor, network-interceptor,
  // file-tracker) each attach their API to globalThis. Load them now so
  // initFileTracking / extractFiles / ABLENetworkInterceptor are available.

  var INJECT_SCRIPTS = [
    'core/synthetic-names.js',
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

  // Set while ABLE re-dispatches a held Enter so our own capture-phase
  // listener does not intercept (and re-hold) its own replay.
  var replayingEnter = false;

  // Targets whose Enter was held and is waiting on the current check.
  // A second Enter while a check is pending would otherwise slip through
  // and send the text, defeating the hold.
  var heldEnters = [];

  /**
   * Re-dispatch a held Enter keydown on its original target.
   *
   * The original event object cannot be reused: its dispatch flags are
   * already spent, so re-dispatching it would never reach the page's own
   * handler. A fresh event is required.
   *
   * A synthetic keydown does not carry the browser's default action, so
   * the default behaviour is restored explicitly:
   *   - a textarea / contenteditable gets its newline back
   *   - a form control gets its implicit submit back
   * Pages that handle Enter themselves (chat composers) are left alone:
   * the page's own handler consumes the event and the browser's default
   * action never applied in the first place.
   */
  function replayEnterOnTarget(target) {
    if (!target || !target.isConnected) return;

    var event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });

    replayingEnter = true;
    try {
      target.dispatchEvent(event);
    } finally {
      replayingEnter = false;
    }

    // The page did not consume the Enter itself, so nothing else will
    // perform the default action. Restore it.
    if (event.defaultPrevented) return;

    try {
      if (target instanceof HTMLTextAreaElement) {
        target.focus();
        document.execCommand('insertText', false, '\n');
      } else if (target instanceof HTMLInputElement) {
        if (typeof target.form !== 'undefined' && target.form) {
          target.form.requestSubmit();
        }
      } else if (target.isContentEditable) {
        target.focus();
        document.execCommand('insertText', false, '\n');
      }
    } catch (e) {
      // Best effort: the text stays in the field and the user can retry.
    }
  }

  function releaseHeldEnters() {
    var targets = heldEnters.splice(0, heldEnters.length);
    for (var i = 0; i < targets.length; i++) {
      replayEnterOnTarget(targets[i]);
    }
  }

  function dropHeldEnters() {
    heldEnters.splice(0, heldEnters.length);
  }

  document.addEventListener('keydown', function (event) {
    if (replayingEnter) return;
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

    // Hold the Enter synchronously. The page's own handler must not run
    // until the score is known, otherwise the text is already gone by the
    // time the advisory modal appears.
    event.preventDefault();
    event.stopPropagation();
    heldEnters.push(target);

    // A second Enter while this check is pending joins the same hold
    // instead of slipping through and sending the text.
    if (textCheckPending) return;

    textCheckPending = true;
    var checkId = generateId();

    pendingTextChecks = pendingTextChecks || new Map();
    var entry = {
      target: target,
      timeout: null,
      resolve: function (decision) {
        textCheckPending = false;
        if (entry.timeout) {
          clearTimeout(entry.timeout);
          entry.timeout = null;
        }
        pendingTextChecks.delete(checkId);
        if (decision === 'block') {
          dropHeldEnters();
          window.postMessage({
            source: 'ABLE_INJECT',
            type: 'ABLE_TEXT_BLOCKED',
            payload: { checkId: checkId }
          }, '*');
        } else {
          releaseHeldEnters();
        }
      },
      reject: function () {
        textCheckPending = false;
        if (entry.timeout) {
          clearTimeout(entry.timeout);
          entry.timeout = null;
        }
        pendingTextChecks.delete(checkId);
        dropHeldEnters();
      }
    };
    pendingTextChecks.set(checkId, entry);

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

    entry.timeout = setTimeout(function () {
      if (pendingTextChecks && pendingTextChecks.has(checkId)) {
        var pending = pendingTextChecks.get(checkId);
        pendingTextChecks.delete(checkId);
        pending.resolve('allow');
      }
    }, 3000);
  }, true);

  window.addEventListener('message', function (event) {
    if (event.data && event.data.source === 'ABLE_CONTENT' && event.data.type === 'ABLE_TEXT_DECISION') {
      if (!ableNonce || event.data.nonce !== ableNonce) return;
      var id = event.data.payload?.checkId;
      var action = event.data.payload?.action;
      var pending = pendingTextChecks && pendingTextChecks.get(id);
      if (pending) {
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
