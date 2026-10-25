/*
 * Verification harness for the placeholder file-name list.
 *
 * The extension fabricates a name like "upload.csv" from the MIME type when it
 * cannot recover the user's real file name. Nothing was uploaded behind such a
 * name, so it must never be audited into egress_events.
 *
 * That rule only holds while every layer agrees on which names are
 * placeholders. Four divergent lists is exactly what let placeholder rows
 * reach the database, so this harness pins the list down:
 *
 *   1. core/synthetic-names.js is the only place the list is written down
 *   2. The server's App\Support\SyntheticFileName::PLACEHOLDER_BASES matches
 *   3. No module carries its own copy of the list any more
 *   4. No module hardcodes a placeholder pattern inline any more
 *
 * Run: npm run verify:synthetic-names   (from Client-Extension/)
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

// ── 1. The extension's canonical list ───────────────────────────────────────
const syntheticSrc = readRel("core/synthetic-names.js");
const listMatch = syntheticSrc.match(/SYNTHETIC_NAME_BASES\s*=\s*\[([\s\S]*?)\]/);
check("core/synthetic-names.js declares the placeholder list", !!listMatch);

const extensionBases = listMatch
  ? listMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  : [];

check(
  "core/synthetic-names.js exposes the shared helpers",
  syntheticSrc.includes("globalThis.ABLESyntheticNames") &&
    syntheticSrc.includes("isAuditableFileName")
);

// ── 2. The server's list must match ─────────────────────────────────────────
const serverPath = path.join(SERVER_ROOT, "app", "Support", "SyntheticFileName.php");
check("server has App\\Support\\SyntheticFileName", fs.existsSync(serverPath));

if (fs.existsSync(serverPath)) {
  const serverSrc = read(serverPath);
  const serverMatch = serverSrc.match(/PLACEHOLDER_BASES\s*=\s*\[([\s\S]*?)\]/);
  const serverBases = serverMatch
    ? serverMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean)
    : [];

  check(
    "server placeholder list matches the extension",
    JSON.stringify(serverBases) === JSON.stringify(extensionBases),
    "server=[" + serverBases.join(", ") + "] extension=[" + extensionBases.join(", ") + "]"
  );
}

// ── 3. No module carries its own copy of the list ───────────────────────────
const listOwners = [
  "api/logging.js",
  "api/scoring.js",
  "content/content.js",
  "content/file-scanner.js",
  "content/provenance.js",
  "core/file-identity.js",
  "core/storage.js",
  "core/security.js",
  "core/runtime-settings.js",
  "inject/file-extractor.js",
  "inject/inject.js",
  "inject/file-tracker.js",
  "inject/network-interceptor.js",
  "parsers/office-parser.js",
];

for (const rel of listOwners) {
  const src = readRel(rel);
  check(
    rel + " does not redeclare the placeholder list",
    !/SYNTHETIC_NAME_BASES\s*=\s*\[/.test(src)
  );
  check(
    rel + " does not hardcode a placeholder pattern inline",
    !/upload\\\.|blob-upload|binary-upload|websocket-upload/.test(src)
  );
}

// ── 4. Every realm loads the shared module ──────────────────────────────────
const manifest = JSON.parse(readRel("manifest.json"));
const contentScripts = manifest.content_scripts.flatMap((entry) => entry.js || []);
const war = (manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || []);

check(
  "content scripts load core/synthetic-names.js",
  contentScripts.includes("core/synthetic-names.js")
);
check(
  "core/synthetic-names.js is loaded before the modules that use it",
  contentScripts.indexOf("core/synthetic-names.js") !== -1 &&
    contentScripts.indexOf("core/synthetic-names.js") < contentScripts.indexOf("parsers/office-parser.js") &&
    contentScripts.indexOf("core/synthetic-names.js") < contentScripts.indexOf("api/logging.js")
);
check(
  "the page world can load core/synthetic-names.js",
  war.includes("core/synthetic-names.js")
);

check(
  "content scripts load core/file-identity.js",
  contentScripts.includes("core/file-identity.js")
);
check(
  "content/provenance.js is loaded after the shared identity module",
  contentScripts.includes("content/provenance.js") &&
    contentScripts.indexOf("core/file-identity.js") < contentScripts.indexOf("content/provenance.js")
);
check(
  "the page world can load core/file-identity.js",
  war.includes("core/file-identity.js")
);

const background = readRel("background.js");
check(
  "the service worker loads core/synthetic-names.js",
  background.includes("core/synthetic-names.js")
);
check(
  "the service worker loads core/file-identity.js",
  background.includes("core/file-identity.js")
);

const inject = readRel("inject/inject.js");
check(
  "the page world loads core/synthetic-names.js first",
  /INJECT_SCRIPTS\s*=\s*\[\s*'core\/synthetic-names\.js'/.test(inject)
);
check(
  "the page world loads core/file-identity.js before its consumers",
  inject.indexOf("'core/file-identity.js'") !== -1 &&
    inject.indexOf("'core/file-identity.js'") < inject.indexOf("'inject/file-extractor.js'") &&
    inject.indexOf("'core/file-identity.js'") < inject.indexOf("'inject/file-tracker.js'")
);

// ── 5. The audit gate is centralised ────────────────────────────────────────
const logging = readRel("api/logging.js");
check(
  "api/logging.js gates the audit on the shared helper",
  logging.includes("isAuditableFileName")
);
check(
  "api/logging.js forwards the name source to the server",
  logging.includes("name_source")
);

const content = readRel("content/content.js");
check(
  "content/content.js gates the audit on the shared helper",
  content.includes("isAuditableFileName")
);
check(
  "content/content.js has no inline placeholder pattern",
  !/upload\\\.|blob-upload/.test(content)
);

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\nABLE synthetic file-name verification");
console.log("=".repeat(60));
console.log("Placeholder list: " + extensionBases.join(", "));
console.log("Checks run: " + checks);
if (failures.length === 0) {
  console.log("RESULT: PASS — all " + checks + " checks passed");
} else {
  console.log("RESULT: FAIL — " + failures.length + " failure(s)");
  failures.forEach((f) => console.log("  x " + f));
}
process.exit(failures.length === 0 ? 0 : 1);
