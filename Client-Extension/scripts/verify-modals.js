/*
 * Headless verification harness for the ABLE modal family.
 *
 * Loads the real content/modal-container.js + intercept-modal.js +
 * text-warning-modal.js + score-hold-modal.js + greeting-modal.js into a
 * page with a minimal DOM shim, renders each modal, and asserts the
 * structural invariants that make the family uniform:
 *
 *   1. Every modal uses the .able-modal-card shell
 *   2. Every modal has a green banner edge top AND bottom
 *   3. Every modal title is .able-modal-title
 *   4. Every modal body is .able-modal-body
 *   5. Every modal actions block is .able-modal-actions
 *   6. Every modal that has a body copy also has a divider
 *   7. The text modal exposes a clickable score ring + a breakdown view
 *   8. No leftover .able-intercept-* classes anywhere
 *   9. No inline hardcoded hex colors in the rendered markup
 *
 * The greeting modal is a large scrollable intro card rather than a
 * title/body/actions card, so it carries its own structural contract plus
 * the one-shot presentation latch (render latches it, a competing modal
 * releases it, acknowledgement completes it).
 *
 * Run: npm run verify:modals   (from Client-Extension/)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ── Minimal DOM shim ─────────────────────────────────────────────
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  contains(c) { return this.set.has(c); }
  toString() { return [...this.set].join(" "); }
}

class FakeElement {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.className = "";
    this.id = "";
    this.innerHTML = "";
    this.style = { cssText: "", pointerEvents: "" };
    this.classList = new FakeClassList();
    this.children = [];
    this.parentNode = null;
    this._listeners = {};
    this.shadowRoot = null;
    this.textContent = "";
    this.isContentEditable = false;
    this.value = "";
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  attachShadow() { this.shadowRoot = new FakeElement("shadow-root"); return this.shadowRoot; }
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k]; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    if (this._listeners[t]) this._listeners[t] = this._listeners[t].filter((f) => f !== fn);
  }
  dispatch(t, ev) { (this._listeners[t] || []).forEach((fn) => fn(ev)); }
  querySelector(sel) { return makeStub(sel); }
  querySelectorAll() { return []; }
  focus() {}
}

// Stubs returned by querySelector: each records the selector it was
// resolved with, and captures the handlers bound to it so the harness can
// fire them.
const stubs = [];

function makeStub(sel) {
  const el = new FakeElement("div");
  el.selector = sel;
  el.id = String(sel || "").replace(/^#/, "");
  el.className = String(sel || "").replace(/^\./, "");
  stubs.push(el);
  return el;
}

const document = {
  documentElement: new FakeElement("html"),
  body: new FakeElement("body"),
  activeElement: null,
  createElement: (t) => new FakeElement(t),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

// ── chrome API stub ─────────────────────────────────────────────
// The greeting modal reads and writes chrome.storage.local. A minimal
// in-memory store lets the harness assert the one-shot presentation latch
// against the real production file rather than a re-implementation.
const storageStore = {};

function storageGet(keys) {
  const out = {};
  const list = Array.isArray(keys)
    ? keys
    : (typeof keys === "string" ? [keys] : Object.keys(keys || {}));
  list.forEach((k) => {
    if (k in storageStore) out[k] = storageStore[k];
  });
  return out;
}

const chromeStub = {
  storage: {
    local: {
      get: async (keys) => storageGet(keys),
      set: async (obj) => { Object.assign(storageStore, obj); },
      remove: async (key) => { delete storageStore[key]; },
    },
  },
  runtime: {
    getURL: (p) => "chrome-extension://able-verify/" + p,
    lastError: undefined,
    sendMessage: (msg, cb) => { if (typeof cb === "function") cb({ success: true }); },
  },
};

const sandbox = {
  document,
  chrome: chromeStub,
  window: { addEventListener() {}, removeEventListener() {}, location: { href: "https://example.com/" } },
  globalThis: null,
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Object,
  Array,
  Math,
  String,
  Number,
  JSON,
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;
sandbox.window.globalThis = sandbox;

const ctx = vm.createContext(sandbox);

function load(rel) {
  vm.runInContext(read(rel), ctx, { filename: rel });
}

load("core/storage.js");
load("content/modal-container.js");
load("content/intercept-modal.js");
load("content/text-warning-modal.js");
load("content/score-hold-modal.js");
load("content/request-access-modal.js");
load("content/blocked-access-modal.js");
load("content/greeting-modal.js");

// ── Capture rendered markup ─────────────────────────────────────
const rendered = {};
const realRender = sandbox.ABLEModalContainer.renderModalIntoShadow;
sandbox.ABLEModalContainer.renderModalIntoShadow = function (html) {
  const m = realRender.call(this, html);
  rendered[rendered.__current] = html;
  return m;
};

function capture(name, fn) {
  rendered.__current = name;
  const before = stubs.length;
  fn();
  // The breakdown views assign modalCard.innerHTML directly rather than
  // going through renderModalIntoShadow, so fall back to the card stub.
  const cardStub = stubs.slice(before).reverse().find((s) => s.selector === ".able-modal-card");
  if (rendered[name] === undefined && cardStub) {
    rendered[name] = cardStub.innerHTML;
  }
  return rendered[name];
}

// ── Assertions ──────────────────────────────────────────────────
const failures = [];
let checks = 0;

function check(label, cond, detail) {
  checks++;
  if (!cond) failures.push(label + (detail ? " — " + detail : ""));
}

const INTERCEPT_ITEMS = [
  { label: "Social Security Number (SSN)", count: 2, weight: 70 },
  { label: "API Key / Token", count: 1, weight: 20 },
];

const TEXT_ITEMS = [
  { label: "Domain Risk (Unlisted)", count: 1, weight: 60 },
  { label: "SSN - Standard Format", count: 1, weight: 30 },
];

const interceptHtml = capture("intercept", () => {
  sandbox.showInterceptModal({
    score: 90, flaggedItems: INTERCEPT_ITEMS, domain: "example.com",
    status: "unlisted", websiteName: "Example", fileName: "records.txt",
    fileSize: 100, requestId: "r1",
  });
});

const interceptSafeHtml = capture("interceptSafe", () => {
  sandbox.showInterceptModal({
    score: 90, flaggedItems: INTERCEPT_ITEMS, domain: "example.com",
    status: "safe", websiteName: "Example", fileName: "records.txt",
    fileSize: 100, requestId: "r1b",
  });
});

// The text modal now swaps its two views in place inside one card.
const textHtml = capture("text", () => {
  sandbox.showTextWarningModal({
    domain: "example.com", totalScore: 90, flaggedItems: TEXT_ITEMS,
    inputType: "textarea", checkId: "c1",
    onProceed() {}, onCancel() {},
  });
});

const holdHtml = capture("hold", () => {
  sandbox.showScoreHoldModal({
    domain: "example.com", fileName: "records.txt", onRetry() {}, onCancel() {},
  });
});

const blockedHtml = capture("blocked", () => {
  sandbox.showBlockedAccessModal({ domain: "blocked.example.com" });
});

const requestAccessHtml = capture("requestAccess", () => {
  sandbox.showRequestAccessModal({ domain: "blocked.example.com" });
});

const modals = {
  "intercept": interceptHtml,
  "interceptSafe": interceptSafeHtml,
  "text": textHtml,
  "hold": holdHtml,
  "blocked": blockedHtml,
  "requestAccess": requestAccessHtml,
};

check("interceptSafe: labels the domain Safe", interceptSafeHtml.includes("Safe"),
  "expected the safe status label in the intercept copy");

// 1-5: shared family structure
for (const [name, html] of Object.entries(modals)) {
  check(name + ": uses .able-modal-card", html.includes('class="able-modal-card"'));
  check(name + ": has .able-modal-content", html.includes('class="able-modal-content"'));
  check(name + ": has .able-modal-title", html.includes('class="able-modal-title"'));
  check(name + ": has .able-modal-body", html.includes('class="able-modal-body"'));
  check(name + ": has .able-modal-actions", html.includes('class="able-modal-actions"'));
  check(name + ": has .able-btn-proceed", html.includes('able-btn-proceed'));
  check(name + ": has .able-btn-cancel", html.includes('able-btn-cancel'));
  check(name + ": no leftover .able-intercept-*", !/able-intercept-/.test(html),
    (html.match(/able-intercept-[a-z-]+/) || [])[0]);
  check(name + ": no hardcoded hex colors in markup", !/#[0-9A-Fa-f]{6}\b/.test(html.replace(/var\(--[a-z-]+\)/g, "")),
    (html.match(/#[0-9A-Fa-f]{6}/) || [])[0]);
  // Inline styles are only legitimate for the dynamic conic gradient
  // (a computed value that cannot live in a stylesheet). Any other inline
  // style, or one carrying a hardcoded color, is a defect.
  const inlineStyles = html.match(/style="[^"]*"/g) || [];
  inlineStyles.forEach((s) => {
    check(name + ": inline style is only the conic gradient", /background:\s*conic-gradient\(/.test(s), s);
    check(name + ": inline style carries no hardcoded color", !/#[0-9A-Fa-f]{3,8}\b/.test(s), s);
  });

  // banner edges: exactly one at top and one at bottom
  const edges = html.match(/able-banner-edge/g) || [];
  check(name + ": two banner edges (top + bottom)", edges.length === 2, "found " + edges.length);
  const firstEdge = html.indexOf("able-banner-edge");
  const lastEdge = html.lastIndexOf("able-banner-edge");
  const cardOpen = html.indexOf("able-modal-card");
  check(name + ": banner edge directly after card open", firstEdge - cardOpen < 60);
  check(name + ": banner edge at the end", html.length - lastEdge < 60);
}

// 6: divider present alongside a body copy
for (const [name, html] of Object.entries(modals)) {
  if (html.includes('able-modal-body')) {
    check(name + ": has .able-modal-divider", html.includes('able-modal-divider'));
  }
}

// 6b: the blocked modal carries the governance copy and both actions
check("blocked: title is SORRY FOR THE INCONVENIENCE", blockedHtml.includes('SORRY FOR THE INCONVENIENCE'));
check("blocked: names the blocked domain", blockedHtml.includes('blocked.example.com'));
check("blocked: states the block is per administrator governance",
  blockedHtml.includes('administrator governance'));
check("blocked: highlights the blocked state", blockedHtml.includes('able-highlight-text'));
check("blocked: offers Request Access", blockedHtml.includes('Request Access'));
check("blocked: offers Go Back", blockedHtml.includes('Go Back'));
check("blocked: binds the request-access action", blockedHtml.includes('ableBlockedRequestAccess'));
check("blocked: binds the go-back action", blockedHtml.includes('ableBlockedGoBack'));

// 6c: the request-access modal is a form in the same page
check("requestAccess: title is REQUEST ACCESS", requestAccessHtml.includes('REQUEST ACCESS'));
check("requestAccess: names the blocked domain", requestAccessHtml.includes('blocked.example.com'));
check("requestAccess: has the request form", requestAccessHtml.includes('able-request-form'));
check("requestAccess: has an alias field", requestAccessHtml.includes('ableRequestAlias'));
check("requestAccess: has a reasons field", requestAccessHtml.includes('ableRequestReasons'));
check("requestAccess: offers Submit Request", requestAccessHtml.includes('Submit Request'));
check("requestAccess: offers Cancel", requestAccessHtml.includes('Cancel'));
check("requestAccess: binds the submit action", requestAccessHtml.includes('ableRequestSubmit'));
check("requestAccess: binds the cancel action", requestAccessHtml.includes('ableRequestCancel'));

// 7: text modal exposes ring + breakdown
check("text: has .able-score-ring-wrapper", textHtml.includes('able-score-ring-wrapper'));
check("text: ring shows the score percentage", textHtml.includes('>90%<'));
check("text: ring shows Risk Score label", textHtml.includes('able-score-label'));
check("text: ring has conic gradient", /conic-gradient/.test(textHtml));
check("text: ring is keyboard reachable", textHtml.includes('tabindex="0"'));
check("text: uses shared ring builder",
  textHtml.includes(sandbox.ABLEModalContainer.buildScoreRingMarkup(90, TEXT_ITEMS)));

// breakdown view: the text modal swaps it into the same card when the
// score ring is clicked.
const textRingStub = stubs.filter((s) => s.selector === ".able-score-ring-wrapper").pop();
if (textRingStub) textRingStub.dispatch("click", {});
// The view swap resolves the card again, so read the newest card stub.
const textCardStub = stubs.filter((s) => s.selector === ".able-modal-card").pop();
const textBreakdownHtml = textCardStub ? textCardStub.innerHTML : "";
check("textBreakdown: title SCORE BREAKDOWN", textBreakdownHtml.includes('SCORE BREAKDOWN'));
check("textBreakdown: has .able-detail-list", textBreakdownHtml.includes('able-detail-list'));
check("textBreakdown: has .able-detail-total", textBreakdownHtml.includes('able-detail-total'));
check("textBreakdown: shows item label", textBreakdownHtml.includes('SSN - Standard Format'));
check("textBreakdown: shows count", textBreakdownHtml.includes('able-detail-count'));
check("textBreakdown: shows weight", textBreakdownHtml.includes('able-detail-weight'));
check("textBreakdown: shows pct", textBreakdownHtml.includes('able-detail-pct'));
check("textBreakdown: two banner edges", (textBreakdownHtml.match(/able-banner-edge/g) || []).length === 2);
check("textBreakdown: has back button", textBreakdownHtml.includes('ableTextDetailBackBtn'));
check("textBreakdown: has cancel button", textBreakdownHtml.includes('ableTextDetailCancelBtn'));

// intercept breakdown still works after the extraction
const interceptBreakdown = capture("interceptBreakdown", () => {
  sandbox.showInterceptScoreDetails({
    score: 90, flaggedItems: INTERCEPT_ITEMS, domain: "example.com",
    websiteName: "Example", fileName: "records.txt", fileSize: 100, requestId: "r1",
  });
});
check("interceptBreakdown: title SCORE BREAKDOWN", interceptBreakdown.includes('SCORE BREAKDOWN'));
check("interceptBreakdown: has .able-detail-list", interceptBreakdown.includes('able-detail-list'));
check("interceptBreakdown: shows item label", interceptBreakdown.includes('Social Security Number (SSN)'));

// 8: the shared builders produce identical ring markup for both modals
const ringA = sandbox.ABLEModalContainer.buildScoreRingMarkup(90, INTERCEPT_ITEMS);
const ringB = sandbox.ABLEModalContainer.buildScoreRingMarkup(90, INTERCEPT_ITEMS);
check("shared: ring builder is deterministic", ringA === ringB);
check("shared: ring builder escapes nothing unsafe", !/on\w+=/.test(ringA));

// 9: MODAL_STYLES no longer carries the dead .able-intercept-* rules
const styles = sandbox.ABLEModalContainer.MODAL_STYLES;
check("styles: .able-intercept-* rules removed", !/able-intercept-/.test(styles),
  (styles.match(/able-intercept-[a-z-]+/g) || [])[0]);

// 10: content.css is now empty of rules
const css = read("content.css");
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
check("content.css: contains no CSS rules", cssRules.length === 0, JSON.stringify(cssRules.slice(0, 80)));

// ── Decision wiring: the text modal's buttons must fire the callbacks ──
(function decisionWiring() {
  let proceeded = 0, cancelled = 0;
  const before = stubs.length;
  sandbox.showTextWarningModal({
    domain: "example.com", totalScore: 90, flaggedItems: TEXT_ITEMS,
    inputType: "textarea", checkId: "c1",
    onProceed: function () { proceeded++; },
    onCancel: function () { cancelled++; },
  });

  const newStubs = stubs.slice(before);
  const proceedBtn = newStubs.find((s) => s.selector === "#ableTextProceedBtn");
  const cancelBtn = newStubs.find((s) => s.selector === "#ableTextCancelBtn");
  const ringEl = newStubs.find((s) => s.selector === ".able-score-ring-wrapper");

  check("wiring: proceed button was bound", !!proceedBtn);
  check("wiring: cancel button was bound", !!cancelBtn);
  check("wiring: score ring was bound", !!ringEl);

  if (proceedBtn) {
    proceedBtn.dispatch("click", {});
    check("wiring: Send Anyway calls onProceed", proceeded === 1, "proceeded=" + proceeded);
    check("wiring: Send Anyway does not call onCancel", cancelled === 0, "cancelled=" + cancelled);
  }
})();

// ── Greeting modal (first-run intro) ─────────────────────────────
// The greeting is a large scrollable intro card, so it does not share the
// .able-modal-content / .able-modal-actions shape the loop above asserts.
// It has its own structural contract, plus the one-shot presentation latch
// that decides whether the user is ever shown it again.
async function greetingVerification() {
  const COMPLETED_KEY = "able:greeting_completed";
  const PRESENTED_KEY = "able:greeting_presented";

  const settle = () => new Promise((r) => setImmediate(r));

  delete storageStore[COMPLETED_KEY];
  delete storageStore[PRESENTED_KEY];

  const greetingHtml = capture("greeting", () => {
    sandbox.showGreetingModal({});
  });
  await settle();

  check("greeting: uses .able-modal-card", greetingHtml.includes("able-modal-card"));
  const gEdges = (greetingHtml.match(/able-banner-edge/g) || []).length;
  check("greeting: two banner edges (top + bottom)", gEdges === 2, "found " + gEdges);
  check("greeting: has .able-modal-divider", greetingHtml.includes("able-modal-divider"));
  check("greeting: renders the logo", greetingHtml.includes("able-greeting-logo"));
  check("greeting: renders the title", greetingHtml.includes("able-greeting-title"));
  check("greeting: renders the subtitle", greetingHtml.includes("able-greeting-subtitle"));
  check("greeting: has an .able-btn acknowledgement button",
    greetingHtml.includes("able-btn") && greetingHtml.includes("ableGreetingAcknowledge"));
  check("greeting: no leftover .able-intercept-*", !/able-intercept-/.test(greetingHtml));
  check("greeting: no hardcoded hex colors in markup",
    !/#[0-9A-Fa-f]{6}\b/.test(greetingHtml.replace(/var\(--[a-z-]+\)/g, "")),
    (greetingHtml.match(/#[0-9A-Fa-f]{6}/) || [])[0]);

  // The documented sections must appear in the documented order.
  const sections = [
    "Introduction",
    "Use and Purpose",
    "Data Extraction &amp; Privacy",
    "Disclaimer",
  ];
  let cursor = -1;
  let ordered = true;
  sections.forEach((s) => {
    const at = greetingHtml.indexOf(s);
    if (at < 0 || at < cursor) ordered = false;
    cursor = at;
  });
  check("greeting: renders its sections in the documented order", ordered);

  // ── One-shot presentation latch ──────────────────────────────
  check("greeting: rendering latches the presented state",
    storageStore[PRESENTED_KEY] === true,
    "presented=" + storageStore[PRESENTED_KEY]);

  // There is a single modal slot: a competing advisory modal tears the
  // greeting down. The user never got to read it, so the latch must be
  // released or the greeting could never be delivered again.
  sandbox.ABLEModalContainer.removeModal();
  await settle();
  check("greeting: a clobbered greeting releases the presented latch",
    storageStore[PRESENTED_KEY] === false,
    "presented=" + storageStore[PRESENTED_KEY]);

  // ── Acknowledgement ──────────────────────────────────────────
  delete storageStore[COMPLETED_KEY];
  delete storageStore[PRESENTED_KEY];
  const before = stubs.length;
  sandbox.showGreetingModal({});
  const ackBtn = stubs.slice(before).find((s) => s.selector === "#ableGreetingAcknowledge");
  check("greeting: binds the acknowledge button", !!ackBtn);
  if (ackBtn) {
    ackBtn.dispatch("click", {});
    await settle();
  }
  check("greeting: acknowledgement sets the completed state",
    storageStore[COMPLETED_KEY] === true,
    "completed=" + storageStore[COMPLETED_KEY]);
  check("greeting: an acknowledged greeting stays latched as presented",
    storageStore[PRESENTED_KEY] === true,
    "presented=" + storageStore[PRESENTED_KEY]);

  // ── A manual view must not suppress the first-run greeting ────
  delete storageStore[COMPLETED_KEY];
  delete storageStore[PRESENTED_KEY];
  sandbox.showGreetingModal({ markPresented: false });
  await settle();
  check("greeting: a manual view does not latch the presented state",
    storageStore[PRESENTED_KEY] !== true,
    "presented=" + storageStore[PRESENTED_KEY]);
}

// ── Report ──────────────────────────────────────────────────────
greetingVerification()
  .then(function () {
    console.log("\nABLE modal family verification");
    console.log("=".repeat(60));
    console.log("Checks run: " + checks);
    if (failures.length === 0) {
      console.log("RESULT: PASS — all " + checks + " checks passed");
    } else {
      console.log("RESULT: FAIL — " + failures.length + " failure(s)");
      failures.forEach((f) => console.log("  x " + f));
    }
    process.exit(failures.length === 0 ? 0 : 1);
  })
  .catch(function (error) {
    console.log("\nABLE modal family verification");
    console.log("=".repeat(60));
    console.log("Verification crashed: " + (error && error.stack ? error.stack : error));
    process.exit(1);
  });
