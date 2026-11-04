/*
 * Verification harness for the egress audit policy on typed text.
 *
 * A typed-text event is not a file upload. It is audited only when the text
 * itself carried a risk score: the pattern score the scoring service computed
 * from the matches in the text. The target domain's own score is deliberately
 * not part of that decision, so a risky domain never justifies an audit row
 * on its own.
 *
 * The rule has to hold on both sides. The extension decides whether to write
 * the row at all; the server decides whether to keep it. When the two drift
 * apart, the client floods the incident list with events the server rejects —
 * or the server keeps events the client thought were noise. This harness pins
 * both halves down:
 *
 *   1. The extension writes the text row only from the modal's decision, and
 *      only when the text carried a pattern hit
 *   2. The server accepts a text row only when the token's pattern score says
 *      the same thing, and the domain's score is not consulted
 *   3. "[text-input]" is not a placeholder file name in either layer — adding
 *      it there would drop every high-risk text event before it is audited
 *   4. The table blueprint is unchanged: the event kind is read from the
 *      request, never persisted
 *   5. Guard-tamper signals travel on their own endpoint and never enter the
 *      egress ledger as a fabricated file
 *   6. Degraded interception (timeout, failed handshake, fallback mode) is
 *      reported as an integrity signal, and a released transport is recorded
 *      as proceeded rather than as containment that never happened
 *
 * Run: npm run verify:audit-policy   (from Client-Extension/)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ROOT = path.resolve(ROOT, "..", "Server-Admin");

let checks = 0;
const failures = [];

function check(label, ok, detail) {
  checks++;
  if (!ok) failures.push(detail ? label + " — " + detail : label);
}

function read(abs) {
  return fs.readFileSync(abs, "utf8");
}

function readRel(rel) {
  return read(path.join(ROOT, rel));
}

function readServer(rel) {
  return read(path.join(SERVER_ROOT, rel));
}

// ── 1. The extension's text flow ─────────────────────────────────────────────
const content = readRel("content/content.js");
const flowStart = content.indexOf("async function handleTextCheck");
const flowEnd = content.indexOf("function setupInterceptionListener");

check("content/content.js has a text-check flow", flowStart !== -1 && flowEnd > flowStart);

const textFlow = content.slice(flowStart, flowEnd);

// The row is written from the decision, so there is exactly one place that
// talks to the audit — the helper the two decision callbacks share.
const auditCalls = textFlow.match(/logEgressEvent\(/g) || [];
check(
  "the text flow writes its audit row in exactly one place",
  auditCalls.length === 1,
  "found " + auditCalls.length + " logEgressEvent calls"
);
check(
  "that one place is the shared audit helper",
  /var auditTextEvent = function \(action\) \{[\s\S]*?logEgressEvent\(/.test(textFlow)
);
check(
  "the helper carries the text-intercept source",
  /auditTextEvent = function[\s\S]*?source: "text-intercept"/.test(textFlow)
);
check(
  "the helper carries the scan token the server needs",
  /auditTextEvent = function[\s\S]*?scanToken: verdict\.scanToken/.test(textFlow)
);
check(
  "the helper keeps the text-input placeholder",
  /auditTextEvent = function[\s\S]*?fileName: "\[text-input\]"/.test(textFlow)
);

// Both decisions are audited, and only when the text carried a pattern hit.
check("proceeding is audited", textFlow.includes('auditTextEvent("proceeded")'));
check("cancelling is audited", textFlow.includes('auditTextEvent("blocked")'));

const guards = textFlow.match(/if \(hasTextRisk\) \{/g) || [];
check(
  "both decisions are guarded by the text's own risk",
  guards.length === 2,
  "found " + guards.length + " guards"
);
check(
  "the text risk comes from the pattern score, not the total",
  /var hasTextRisk = textRiskScore > 0;/.test(textFlow) &&
    /var textRiskScore = verdict\.patternScore \|\| 0;/.test(textFlow)
);
check(
  "the domain score does not decide the audit",
  !/hasTextRisk = .*domainRiskScore/.test(textFlow)
);

// The warning needs a pattern in the text before the domain is allowed to
// contribute anything: the pattern opens the door, then the domain and the
// pattern are scored together against the high-risk standard.
check(
  "the warning requires a pattern in the text",
  /var hasPatternHit = textRiskScore > 0 \|\| patternFlags\.length > 0;/.test(textFlow)
);
check(
  "the warning is raised on the combined domain and pattern score",
  /var showTextWarning = hasPatternHit && combinedScore >= riskThreshold;/.test(textFlow)
);
check(
  "the domain's own risk factor is separated from the pattern factors",
  /var patternFlags = \(verdict\.flaggedItems \|\| \[\]\)\.filter/.test(textFlow) &&
    /!item\.label\.startsWith\("Domain Risk"\)/.test(textFlow)
);
check(
  "the modal shows the combined score and every factor behind it",
  /totalScore: combinedScore/.test(textFlow) &&
    /flaggedItems: verdict\.flaggedItems/.test(textFlow)
);

// ── 2. The server accepts the same rule ─────────────────────────────────────
const policyPath = path.join(SERVER_ROOT, "app", "Support", "EgressAuditPolicy.php");
check("server has App\\Support\\EgressAuditPolicy", fs.existsSync(policyPath));

if (fs.existsSync(policyPath)) {
  const policy = read(policyPath);

  check(
    "the policy recognises a typed-text event",
    /isTextIntercept/.test(policy) && /text-intercept/.test(policy) && /typing/.test(policy)
  );

  const highRisk = policy.match(/function isHighRisk[\s\S]*?\n    \}/);
  check("the policy has a high-risk test", !!highRisk);

  if (highRisk) {
    check(
      "the high-risk test reads the pattern score",
      /pattern_score/.test(highRisk[0])
    );
    check(
      "the high-risk test ignores the domain's own score",
      !/total_score|domain_risk_score/.test(highRisk[0])
    );
  }
}

const controller = readServer("app/Http/Controllers/EgressEventController.php");
check(
  "the controller gates the audit on the policy",
  /EgressAuditPolicy::isTextIntercept/.test(controller) &&
    /EgressAuditPolicy::isHighRisk/.test(controller)
);
check(
  "the controller rejects a text event it cannot verify",
  /reason' => 'unverified_scan'/.test(controller) && /reason' => 'not_high_risk'/.test(controller)
);
check(
  "the controller tolerates an expired but signed token",
  /allowExpired: true/.test(controller)
);

// ── 3. The table blueprint is unchanged ─────────────────────────────────────
check(
  "the event kind is read from the request, not persisted",
  !/'source' => \$validated\['source'\]/.test(controller)
);
check(
  "the model does not carry a source column",
  !/^\s*'source',$/m.test(readServer("app/Models/EgressEvent.php"))
);
const migrations = fs
  .readdirSync(path.join(SERVER_ROOT, "database", "migrations"))
  .filter((f) => /source/i.test(f));
check(
  "no migration adds a source column",
  migrations.length === 0,
  migrations.join(", ")
);

// ── 4. The placeholder lists must not swallow the text events ───────────────
const synthetic = readRel("core/synthetic-names.js");
const listMatch = synthetic.match(/SYNTHETIC_NAME_BASES\s*=\s*\[([\s\S]*?)\]/);
const extensionBases = listMatch
  ? listMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  : [];

check(
  "the extension does not treat [text-input] as a placeholder",
  !extensionBases.includes("[text-input]"),
  "bases=[" + extensionBases.join(", ") + "]"
);

const serverFileName = readServer("app/Support/SyntheticFileName.php");
const serverMatch = serverFileName.match(/PLACEHOLDER_BASES\s*=\s*\[([\s\S]*?)\]/);
const serverBases = serverMatch
  ? serverMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  : [];

check(
  "the server does not treat [text-input] as a placeholder",
  !serverBases.includes("[text-input]"),
  "bases=[" + serverBases.join(", ") + "]"
);

// ── 5. Guard-tamper signals stay out of the egress ledger ───────────────────
// A tamper report is a security signal, not a data transfer. It must be sent
// to its own endpoint on both sides; a fabricated "ABLE guard tampered" file
// must never reach the egress audit again.
const tamperStart = content.indexOf("function handleGuardTamper");
const tamperEnd = content.indexOf("function isDuplicateScan");

check(
  "content/content.js has a guard-tamper handler",
  tamperStart !== -1 && tamperEnd > tamperStart
);

const tamperHandler = tamperStart !== -1 ? content.slice(tamperStart, tamperEnd) : "";

check(
  "the tamper handler reports an integrity event",
  /logIntegrityEvent\(/.test(tamperHandler)
);
check(
  "the tamper handler does not write an egress row",
  !/logEgressEvent\(/.test(tamperHandler)
);
check(
  "the tamper handler does not fabricate a file name",
  !/fileName\s*:/.test(tamperHandler)
);

const logging = readRel("api/logging.js");
check(
  "api/logging.js has an integrity logger",
  /async function logIntegrityEvent/.test(logging)
);
check(
  "the integrity logger posts to its own endpoint",
  /\/api\/extension\/integrity/.test(logging)
);
check(
  "the integrity logger is exported",
  /logIntegrityEvent: logIntegrityEvent/.test(logging)
);

const background = readRel("background.js");
check(
  "the background worker routes logIntegrity messages",
  /message\.type === "logIntegrity"/.test(background)
);

const policySource = fs.existsSync(policyPath) ? read(policyPath) : "";
check(
  "the server policy recognises a tamper signal",
  /function isTamperSignal/.test(policySource)
);
check(
  "the controller drops a tamper signal from the egress ledger",
  /EgressAuditPolicy::isTamperSignal/.test(controller) &&
    /tamper_not_egress/.test(controller)
);
check(
  "the API registers the integrity endpoint",
  /extension\/integrity/.test(readServer("routes/api.php"))
);

// ── 6. Degraded interception is not egress ──────────────────────────────────
// A timeout, a failed handshake or a fallback detection means the guard could
// not see the request. Those are guard-health signals, never incident rows.
const failureHelperStart = content.indexOf("function reportInterceptionFailure");
const failureHelperEnd = content.indexOf("function isDuplicateScan");
check(
  "content/content.js has an interception-failure reporter",
  failureHelperStart !== -1 && failureHelperEnd > failureHelperStart
);
const failureHelper = failureHelperStart !== -1
  ? content.slice(failureHelperStart, failureHelperEnd)
  : "";
check(
  "the interception-failure reporter uses the integrity channel",
  /logIntegrityEvent\(/.test(failureHelper)
);
check(
  "the interception-failure reporter never writes an egress row",
  !/logEgressEvent\(/.test(failureHelper)
);

const degradedStart = content.indexOf('if (event.data.type === "ABLE_TIMEOUT")');
const degradedEnd = content.indexOf('if (event.data.type === "ABLE_FILE_SELECTED")');
check(
  "content/content.js has the degraded handlers",
  degradedStart !== -1 && degradedEnd > degradedStart
);
const degradedHandlers = degradedStart !== -1
  ? content.slice(degradedStart, degradedEnd)
  : "";
check(
  "timeout and handshake failures are not audited as egress",
  !/logEgressEvent\(/.test(degradedHandlers) &&
    (degradedHandlers.match(/reportInterceptionFailure\(/g) || []).length === 2
);

const fallbackStart = content.indexOf("function setupFallbackDetection");
const fallbackEnd = content.indexOf("function initialize");
check(
  "content/content.js has fallback detection",
  fallbackStart !== -1 && fallbackEnd > fallbackStart
);
const fallback = fallbackStart !== -1 ? content.slice(fallbackStart, fallbackEnd) : "";
check(
  "fallback detection does not audit file selections as egress",
  !/logEgressEvent\(/.test(fallback) && !/logFallbackFile/.test(fallback)
);
check(
  "fallback detection reports the degraded guard once",
  /reportInterceptionFailure\("fallback detection active"\)/.test(fallback)
);

const releasedStart = content.indexOf("var releasedSource");
const releasedEnd = content.indexOf("// Parallel file scanning");
check(
  "content/content.js identifies released transports",
  releasedStart !== -1 && releasedEnd > releasedStart
);
const released = releasedStart !== -1 ? content.slice(releasedStart, releasedEnd) : "";
check("released transports are audited as proceeded", /action: "proceeded"/.test(released));
check(
  "released transports are never audited as denied",
  !/action: "denied"/.test(released) && !/action: "blocked"/.test(released)
);
check(
  "released transports never show a hold decision",
  !/showInterceptModal|showScoreHoldModal/.test(released)
);

// sendBeacon returns before the body is extracted, so the interceptor must tag
// those entries: without it the release is invisible and a cancel would record
// containment that never happened.
const interceptor = readRel("inject/network-interceptor.js");
check(
  "the beacon wrapper tags its entries as released",
  /\.source\s*=\s*['"]beacon['"]/.test(interceptor)
);

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\nABLE egress audit policy verification");
console.log("=".repeat(60));
console.log("Checks run: " + checks);
if (failures.length === 0) {
  console.log("RESULT: PASS — all " + checks + " checks passed");
} else {
  console.log("RESULT: FAIL — " + failures.length + " failure(s)");
  failures.forEach((f) => console.log("  x " + f));
}
process.exit(failures.length === 0 ? 0 : 1);
