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
