/**
 * ABLE Extension - Greeting Modal
 *
 * Comprehensive introduction modal presented after extension install.
 *
 * Modal layout order:
 * 1. ABLE Logo
 * 2. ABLE Title
 * 3. ABLE Subtitle
 * 4. Introduction
 * 5. Use and Purpose
 * 6. Data Extraction
 * 7. Disclaimer
 */

async function hasGreetingCompleted() {
  try {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return false;
    }
    var key = (typeof ABLEStorage !== "undefined" && ABLEStorage.GREETING_COMPLETED)
      ? ABLEStorage.GREETING_COMPLETED
      : "able:greeting_completed";
    var result = await chrome.storage.local.get(key);
    return result[key] === true;
  } catch {
    return false;
  }
}

async function setGreetingCompleted() {
  try {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }
    var key = (typeof ABLEStorage !== "undefined" && ABLEStorage.GREETING_COMPLETED)
      ? ABLEStorage.GREETING_COMPLETED
      : "able:greeting_completed";
    await chrome.storage.local.set({ [key]: true });
  } catch (e) {
    console.warn("ABLE: Failed to set greeting completed state:", e);
  }
}

function showGreetingModal(options) {
  options = options || {};

  var logoSrc = "";
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      logoSrc = chrome.runtime.getURL("assets/ABLE-LOGO.png");
    } else {
      logoSrc = "assets/ABLE-LOGO.png";
    }
  } catch {
    logoSrc = "assets/ABLE-LOGO.png";
  }

  var html = `
    <div class="able-modal-card able-modal-large" role="dialog" aria-modal="true" aria-labelledby="ableGreetingTitle">
      <div class="able-banner-edge"></div>
      <div class="able-greeting-container">
        
        <!-- 1. ABLE Logo -->
        <div class="able-greeting-logo-wrap">
          <img src="${escapeHtml(logoSrc)}" alt="ABLE Logo" class="able-greeting-logo" />
        </div>

        <!-- 2. ABLE Title -->
        <h1 class="able-greeting-title" id="ableGreetingTitle">ABL<span class="able-greeting-highlight">E</span></h1>

        <!-- 3. ABLE Subtitle -->
        <p class="able-greeting-subtitle">Adaptive Browser-Level Extension</p>

        <div class="able-modal-divider" aria-hidden="true"><div class="able-modal-divider-circle"></div></div>

        <div class="able-greeting-sections">
          <!-- 4. Introduction -->
          <section class="able-greeting-section">
            <div class="able-greeting-section-header">
              <span class="able-greeting-section-badge">1</span>
              <h2 class="able-greeting-section-title">Introduction</h2>
            </div>
            <div class="able-greeting-section-body">
              <p>
                The <strong>Adaptive Browser-Level Extension (ABLE)</strong> is an in-browser security and Data Loss Prevention (DLP) system designed to safeguard institutional users from accidental data exposure, untrusted cloud destinations, and emerging web threats.
              </p>
              <p>
                Operating in real time directly within your web browser, ABLE provides continuous risk assessment, transparent safety scoring, and proactive interventions before confidential organizational assets leave your local device.
              </p>
            </div>
          </section>

          <!-- 5. Use and Purpose -->
          <section class="able-greeting-section">
            <div class="able-greeting-section-header">
              <span class="able-greeting-section-badge">2</span>
              <h2 class="able-greeting-section-title">Use and Purpose</h2>
            </div>
            <div class="able-greeting-section-body">
              <p>
                ABLE is engineered to protect sensitive institutional assets without impeding your day-to-day workflow. Key functions and purposes include:
              </p>
              <ul class="able-greeting-list">
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#10004;</span>
                  <div>
                    <strong>Domain Risk Auditing &amp; Access Advisories:</strong> Continuously evaluates visited sites against security policies, alerting you whenever you access unlisted, unknown, or high-risk web destinations.
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#10004;</span>
                  <div>
                    <strong>Sensitive Data Exfiltration Defense:</strong> Intercepts file uploads and outbound data transmissions, inspecting payloads for confidential data—including access credentials, API keys, private certificates, and personal identity records.
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#10004;</span>
                  <div>
                    <strong>Dynamic Risk Scoring &amp; Feedback:</strong> Computes transparent, pattern-weighted risk scores and displays informative advisories so you can make informed decisions before submitting data.
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#10004;</span>
                  <div>
                    <strong>Compliance &amp; Threat Awareness:</strong> Fosters institutional data governance and cybersecurity hygiene seamlessly in the background without requiring heavy software installations.
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <!-- 6. Data Extraction -->
          <section class="able-greeting-section">
            <div class="able-greeting-section-header">
              <span class="able-greeting-section-badge">3</span>
              <h2 class="able-greeting-section-title">Data Extraction &amp; Privacy</h2>
            </div>
            <div class="able-greeting-section-body">
              <p>
                ABLE adheres to strict data minimization principles. We maintain complete transparency regarding what data is accessed, processed, and transmitted:
              </p>
              <ul class="able-greeting-list">
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#8226;</span>
                  <div>
                    <strong>Domain Navigation Telemetry:</strong> Visited hostnames (e.g. <span class="able-greeting-code">example.com</span>), domain classification status (safe, unlisted, unsafe), and navigation timestamps are audited for security monitoring. <em>Specific search queries and sensitive URL parameters are never logged.</em>
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#8226;</span>
                  <div>
                    <strong>Egress Event Metadata:</strong> When an outbound upload is scanned, ABLE logs only high-level event metadata: filename, file size, timestamp, matched pattern categories (e.g., Credit Card, API Token), action taken, and risk score.
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#8226;</span>
                  <div>
                    <strong>Zero Raw File or Content Transmission:</strong> All document parsing, file scanning, and pattern matching occur <strong>entirely locally</strong> inside your browser sandbox. Your raw files, document texts, and credentials are <em>never uploaded or sent to external servers</em>.
                  </div>
                </li>
                <li class="able-greeting-list-item">
                  <span class="able-greeting-bullet">&#8226;</span>
                  <div>
                    <strong>Pseudonymous Identifiers:</strong> Telemetry uses a randomly generated pseudonymous device identifier (<span class="able-greeting-code">user_id</span>) that does not reveal personal identifying details or hardware serials.
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <!-- 7. Disclaimer -->
          <section class="able-greeting-section able-greeting-disclaimer-box">
            <div class="able-greeting-section-header">
              <span class="able-greeting-section-badge able-greeting-disclaimer-badge">!</span>
              <h2 class="able-greeting-section-title">Disclaimer</h2>
            </div>
            <div class="able-greeting-section-body">
              <p>
                <strong>Security Tool Notice:</strong> ABLE is an automated advisory mechanism designed to enhance defense-in-depth and assist in preventing accidental data leakage. While ABLE employs pattern matching and domain intelligence, no automated tool can guarantee 100% prevention of all security vulnerabilities or data exfiltration vectors.
              </p>
              <p>
                <strong>User Responsibility:</strong> ABLE acts as a protective assistant, not a replacement for personal diligence. Users remain ultimately responsible for adhering to institutional data protection policies, exercising sound judgment, and keeping sensitive materials secure.
              </p>
              <p>
                <strong>Notice of Security Monitoring:</strong> By proceeding with this extension enabled, you acknowledge that domain navigation telemetry and security event metadata are recorded for organizational security auditing and threat analysis in accordance with administrative security policy.
              </p>
            </div>
          </section>
        </div>

        <div class="able-greeting-footer">
          <button class="able-btn able-greeting-btn" id="ableGreetingAcknowledge" type="button">
            I Understand &amp; Get Started
          </button>
        </div>

      </div>
      <div class="able-banner-edge"></div>
    </div>
  `;

  var mounted = (typeof ABLEModalContainer !== "undefined")
    ? ABLEModalContainer.renderModalIntoShadow(html)
    : null;

  var backdrop = mounted ? mounted.backdrop : null;
  if (!backdrop) {
    if (typeof removeModal === "function") removeModal();
    backdrop = document.createElement("div");
    backdrop.className = "able-modal-backdrop";
    backdrop.innerHTML = html;
    (document.documentElement || document.body).appendChild(backdrop);
  }

  var handleDismiss = async function () {
    await setGreetingCompleted();
    if (typeof removeModal === "function") {
      removeModal();
    } else if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
    if (typeof options.onDismiss === "function") {
      options.onDismiss();
    }
  };

  var acknowledgeBtn = backdrop.querySelector("#ableGreetingAcknowledge");
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener("click", handleDismiss);
  }

  var handleKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      handleDismiss();
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  window.addEventListener("keydown", handleKeydown);

  if (typeof ABLEModalContainer !== "undefined" && ABLEModalContainer.registerModalCleanup) {
    ABLEModalContainer.registerModalCleanup(function () {
      window.removeEventListener("keydown", handleKeydown);
      backdrop.removeEventListener("keydown", handleKeydown);
    });
  }

  return backdrop;
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLEGreetingModal = {
    showGreetingModal: showGreetingModal,
    hasGreetingCompleted: hasGreetingCompleted,
    setGreetingCompleted: setGreetingCompleted,
  };
  globalThis.showGreetingModal = showGreetingModal;
  globalThis.hasGreetingCompleted = hasGreetingCompleted;
  globalThis.setGreetingCompleted = setGreetingCompleted;
}
