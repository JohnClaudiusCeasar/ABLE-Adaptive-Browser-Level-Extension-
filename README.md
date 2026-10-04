# ABLE — Adaptive Browser-Level Extension

> A private, research-oriented browser security tool for website-safety classification and sensitive-data-leakage prevention.

---

## 1) Introduction

Modern browsing routinely exposes users to two under-studied risks: **interacting with unvetted or malicious websites**, and **accidentally disclosing sensitive data** — PII, credentials, API keys, internal documents — through file uploads and text submissions, especially into AI chat platforms (e.g. Gemini, Kimi, Qwen) and other web apps.

**ABLE (Adaptive Browser-Level Extension)** is a Manifest V3 browser extension paired with a self-hosted research server, built to study and demonstrate how these two problems can be addressed directly in the browser:

1. **Classify every site you visit** as `SAFE`, `UNSAFE`, or `UNLISTED`, and warn you before you interact with risky domains.
2. **Intercept outbound files and text** before they leave the browser, scan them for sensitive content, and let you decide — proceed, cancel, or hold — before anything is sent.

ABLE is an independent research project, not a commercial product. It collects only the data needed to operate and to evaluate detection accuracy, sends it only to its own self-hosted research server, and publishes findings only in aggregate or anonymized form. See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

**Repository layout:**

```text
ABLE-Adaptive-Browser-Level-Extension-/
├── Client-Extension/   # MV3 browser extension (content scripts, page-world interceptors, popup, background worker)
├── Server-Admin/       # Self-hosted research server (Laravel + React/Inertia) — policies, risk patterns, scoring, event logs
├── Implementation/     # Research notes, work overviews, test corpora
├── PRIVACY.md          # Privacy policy
└── README.md           # This file
```

---

## 2) About ABLE

### What it does

ABLE runs quietly on every page you visit and intervenes only when there is something worth your attention:

- **Site-safety classification + warnings.** On each navigation, ABLE classifies the domain against a signed policy set (synced from the research server, cached offline) and shows a first-visit warning modal for `SAFE` / `UNSAFE` / `UNLISTED` sites, plus lightweight repeat-visit reminders with cooldowns.
- **File-upload interception.** An integrity-checked page-world script wraps `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, and `WebSocket.send`, extracts `File` / `Blob` / `FormData` / `ArrayBuffer` / stream bodies, and holds them for scanning. File-picker, drag-drop, and paste are tracked so original filenames survive format transformations. Analytics endpoints are explicitly bypassed.
- **Sensitive-text interception.** Enter-key submissions in textareas, inputs, and content-editables are captured and scored before the request is released.
- **Server-assisted scoring.** Intercepted file text (up to ~200k chars) or submitted text (up to ~50k chars) is sent to the research server for scoring against a signed set of sensitive-data patterns (PII, credentials, keys). The server returns a risk score and flagged categories; the extension renders a risk modal ("HOLD IT RIGHT THERE!", "Sensitive Content Detected") with **Proceed / Cancel** choices. If the scoring server is unreachable, uploads are **held, never sent unscored**.
- **Research telemetry.** Domain-level visit events and egress decisions (metadata only — never raw file contents in logs) are queued locally and flushed periodically for later analysis of classification coverage and warning effectiveness.
- **Toolbar popup.** Clicking the extension icon shows the current tab's domain and its `SAFE` / `UNSAFE` / `UNLISTED` classification.

### How it works (architecture)

```text
Web page (any site)
 ├── Content script (isolated world, document_end)
 │    ├── classify domain → site-warning / repeat-visit modals (Shadow DOM)
 │    ├── file-scanner → extract text (plain text, Office Open XML) → score
 │    └── intercept / text-warning / score-hold modals
 ├── Page-world scripts (inject/*.js via <script> tag, SHA-256 integrity-checked)
 │    ├── network-interceptor: wraps fetch/XHR/sendBeacon/WebSocket
 │    ├── file-tracker: input[type=file], drag-drop, paste
 │    └── file-extractor: recover Files, clear inputs/widgets on cancel
 │
Background service worker (background.js)
 ├── webNavigation.onCommitted → classify + log top-frame visits
 ├── alarms → sync policies/patterns/settings, flush visit + egress queues
 └── storage.session (TRUSTED_AND_UNTRUSTED) → dedup, backoff, session consent
        ↕ HTTPS only (TLS SPKI pin, origin allowlist, credentials: omit, signed responses)
Self-hosted research server (Server-Admin, Laravel)
 ├── GET  /api/extension/config, /api/risk-patterns/signed, /api/domain-policies/signed
 ├── POST /api/classify-domain, /api/score-content
 └── POST /api/log-visit, /api/log-egress, /api/extension/lifecycle
```

### Components

| Component | Location | Role |
|---|---|---|
| Manifest + background worker | `Client-Extension/manifest.json`, `background.js` | MV3 wiring, navigation auditing, periodic sync/flush via `alarms` |
| Content-script bundle | `Client-Extension/content/`, `api/`, `core/`, `parsers/` | Classification, scanning orchestration, Shadow-DOM modals, signed caches, rate limiting |
| Page-world interceptors | `Client-Extension/inject/` | Request wrapping, file tracking/extraction, text interception |
| Popup | `Client-Extension/popup.html/js` | Current-site safety display |
| Research server | `Server-Admin/` (Laravel + React/Inertia) | Policy/pattern distribution, classification + scoring APIs, event-log storage |
| Tests + corpora | `Client-Extension/tests/`, `Implementation/Mock Test Corpus/`, `Sample Office Data/` | Detection tests and sample documents |

### Tech stack

- **Extension:** Vanilla JS, Manifest V3, Shadow DOM modals, `chrome.storage` (local + session), `chrome.alarms`, `chrome.webNavigation`, `chrome.tabs` (popup only)
- **Server:** PHP 8.3 / Laravel 13, Inertia + React, SQLite/MySQL via migrations
- **Security primitives:** HMAC-SHA-256 signed server payloads, TLS SPKI pinning, SHA-256 asset-integrity checks, locally generated pseudonymous ID (`ABLE-XXXXXXXX`), offline-first signed caches

### Permissions (why each is needed)

- `activeTab` — popup reads the clicked tab's URL to show its safety status.
- `scripting` — reserved for programmatic injection of the interception helper into the active tab.
- `storage` — signed policy/pattern caches, offline event queues, per-domain consent and cooldowns.
- `alarms` — periodic policy sync and audit-log flushing (MV3 workers are ephemeral).
- `tabs` — popup refresh on tab switch / page load.
- `webNavigation` — reliable per-navigation classification and domain-level logging.
- `<all_urls>` host access — classification, interception, and server relay must work on any site the user visits.

---

## 3) Mission and Purpose

ABLE exists as a **private security-research instrument**, built around three questions:

1. **Can the browser itself be a meaningful last line of defense against data leakage?** Server-side DLP sees traffic after it leaves the device. ABLE tests the alternative: hold outbound files and text *in the page*, score them, and give the user an informed choice before anything is transmitted.
2. **How do users respond to in-the-moment security warnings?** By measuring proceed/cancel rates, repeat-visit behavior, and false-positive friction, the project studies what makes a warning effective rather than merely annoying.
3. **How well can lightweight, pattern-based detection perform in practice?** Signed regex risk-patterns plus page context are evaluated for accuracy (false positives/negatives) against realistic uploads and pasted text, including the AI-chat-app workflows where pasting sensitive data is now commonplace.

Guiding principles:

- **User agency first.** ABLE never exfiltrates on your behalf — every flagged send requires your decision, and unreachable scoring fails closed (held, not sent).
- **Minimal data, honestly described.** Only hostnames, page signals, about-to-be-sent content for scoring, and decision metadata are processed. No advertising, no third-party sharing, no remote code.
- **Reproducibility.** Signed, versioned policies and patterns; offline-capable caches; test corpora and diagnostics kept in-repo so results can be re-examined.
- **Research over product.** There is no commercial deployment, no customer data pipeline, and no growth metric — only the question of whether browser-level prevention actually works and how to make it usable.

---

## 4) Data Privacy

ABLE is designed so that its privacy story is short: **your browsing data goes only to the project's own self-hosted research server, is used only for security research and tool operation, and is never sold, shared with third parties, or used for advertising.**

In brief:

- **Visit events:** hostname, classification result, timestamp, event ID, pseudonymous ID. Search pages and excluded domains are skipped.
- **Scan inputs:** text of files/text you are about to send externally, plus file metadata, content hash, and page context — used to compute the verdict and to evaluate detection accuracy.
- **Egress log:** decision metadata (domain, filename, size, hash, score, action) — file contents are never in the log.
- **Identity:** a random on-device ID (`ABLE-XXXXXXXX`), not linked to any account, email, or hardware identifier.
- **Protections:** HTTPS with certificate pinning, origin allowlist, no cookies/credentials, HMAC-signed server payloads with tamper-eviction, offline queueing with held-not-sent failure mode.
- **Your control:** cancel any flagged send, uninstall anytime to stop all collection, and contact the operator to access or delete data tied to your pseudonymous ID.

The complete, binding policy — including retention, disclosure, children's privacy, and contact details — is in **[PRIVACY.md](./PRIVACY.md)**. If this README and the policy ever disagree, the policy governs.
