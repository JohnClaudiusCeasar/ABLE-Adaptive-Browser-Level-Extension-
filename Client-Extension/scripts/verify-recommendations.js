/*
 * Headless verification for the ABLE Recommends data rules.
 *
 * Loads the real config.js + api/classification.js into a vm and exercises
 * the offline helpers. They must match the server's
 * DomainRecommendationService:
 *
 *   1. The admin-curated list for the category wins.
 *   2. With no manual entries, cached whitelisted policies in the category
 *      are the fallback.
 *   3. Both exclude the visited domain and its relatives, dedupe, sort, cap.
 *
 * Run: npm run verify:recommendations   (from Client-Extension/)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const sandbox = {
  console,
  URL,
  Map,
  Array,
  Object,
  String,
  Number,
  JSON,
  Math,
  chrome: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
    },
  },
  ABLERuntimeSettings: { get: (key, fallback) => fallback },
};
sandbox.globalThis = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(read("config.js"), ctx, { filename: "config.js" });
vm.runInContext(read("api/classification.js"), ctx, { filename: "api/classification.js" });

const { filterRecommendations, filterWhitelistedPolicies } = sandbox.ABLEClassification;

const failures = [];
let checks = 0;

function check(label, cond, detail) {
  checks++;
  if (!cond) failures.push(label + (detail ? " — " + detail : ""));
}

function rec(domain, category) {
  return { category: category, domain: domain };
}

function policy(domain, category, overrides) {
  return Object.assign({
    domain: domain,
    category: category,
    policy: "whitelisted",
    block_access: false,
  }, overrides || {});
}

function same(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

// ── Manual list ─────────────────────────────────────────────────
const manual = [
  rec("notion.test", "Productivity"),
  rec("asana.test", "Productivity"),
  rec("slack.test", "Communication"),
];

const selected = filterRecommendations(manual, "Productivity", "visited.test");
check("selects manual entries for the category", same(selected, ["asana.test", "notion.test"]),
  JSON.stringify(selected));
check("excludes other categories", !selected.includes("slack.test"));
check("manual entries ignore domain-policy fields",
  same(filterRecommendations([
    { category: "Productivity", domain: "x.test", policy: "blacklisted", block_access: true },
  ], "Productivity", "visited.test"), ["x.test"]));

// ── Exclusions ──────────────────────────────────────────────────
const relatives = [
  rec("example.test", "Productivity"),
  rec("other.test", "Productivity"),
  rec("app.example.test", "Productivity"),
];
check("excludes the current domain and its parent",
  same(filterRecommendations(relatives, "Productivity", "app.example.test"), ["other.test"]),
  JSON.stringify(filterRecommendations(relatives, "Productivity", "app.example.test")));
check("excludes a child of the current domain",
  same(filterRecommendations(relatives, "Productivity", "example.test"), ["other.test"]));

// ── Category matching ───────────────────────────────────────────
check("matches category case- and whitespace-insensitively",
  same(filterRecommendations([rec("notion.test", "  ProDuctivity ")], "Productivity", "visited.test"),
    ["notion.test"]));
check("no category yields no recommendations",
  same(filterRecommendations(manual, null, "visited.test"), []));
check("blank category yields no recommendations",
  same(filterRecommendations(manual, "   ", "visited.test"), []));

// ── Ordering, cap, dedupe, junk ─────────────────────────────────
const many = [
  rec("charlie.test", "Productivity"),
  rec("alpha.test", "Productivity"),
  rec("bravo.test", "Productivity"),
];
check("sorts by domain", same(filterRecommendations(many, "Productivity", "visited.test"),
  ["alpha.test", "bravo.test", "charlie.test"]));
check("honours an explicit limit",
  same(filterRecommendations(many, "Productivity", "visited.test", 2),
    ["alpha.test", "bravo.test"]));

check("dedupes domains",
  same(filterRecommendations([rec("notion.test", "Productivity"), rec("notion.test", "Productivity")],
    "Productivity", "visited.test"), ["notion.test"]));

const ten = [];
for (let i = 0; i < 10; i++) {
  ten.push(rec("d" + i + ".test", "Productivity"));
}
check("default cap comes from ABLE_RECOMMENDATIONS_LIMIT",
  filterRecommendations(ten, "Productivity", "visited.test").length === 6,
  "length=" + filterRecommendations(ten, "Productivity", "visited.test").length);

const junk = [
  null, 42, "", {}, { category: "Productivity" },
  { category: "Productivity", domain: 42 },
  rec("ok.test", "Productivity"),
];
check("ignores malformed entries",
  same(filterRecommendations(junk, "Productivity", "visited.test"), ["ok.test"]));

// ── Whitelisted fallback ────────────────────────────────────────
const policies = [
  policy("asana.test", "Productivity"),
  policy("notion.test", "Productivity"),
  policy("slack.test", "Communication"),
  policy("review.test", "Productivity", { policy: "under_review" }),
  policy("blocked.test", "Productivity", { block_access: true }),
];

const fallback = filterWhitelistedPolicies(policies, "Productivity", "visited.test");
check("fallback selects whitelisted same-category domains",
  same(fallback, ["asana.test", "notion.test"]), JSON.stringify(fallback));
check("fallback excludes non-whitelisted policies", !fallback.includes("review.test"));
check("fallback excludes block_access rows", !fallback.includes("blocked.test"));
check("fallback excludes other categories", !fallback.includes("slack.test"));
check("fallback matches category case-insensitively",
  same(filterWhitelistedPolicies([policy("notion.test", "  productivity ")], "Productivity", "visited.test"),
    ["notion.test"]));
check("fallback excludes the current domain and its relatives",
  same(filterWhitelistedPolicies([
    policy("example.test", "Productivity"),
    policy("app.example.test", "Productivity"),
    policy("other.test", "Productivity"),
  ], "Productivity", "app.example.test"), ["other.test"]));

// ── Excluded categories ──────────────────────────────────────────
check("manual lists for Gambling and Adult are ignored",
  same(filterRecommendations([
    rec("casino.test", "Gambling"),
    rec("adult.test", "Adult"),
  ], "Gambling", "visited.test"), []));
check("whitelisted fallbacks for Gambling and Adult are ignored",
  same(filterWhitelistedPolicies([
    policy("casino.test", "Gambling"),
    policy("adult.test", "Adult"),
  ], "Adult", "visited.test"), []));
check("excluded-category matching is case-insensitive",
  same(filterRecommendations([rec("casino.test", "  GAMBLING ")], "gambling", "visited.test"), []));

// ── Report ──────────────────────────────────────────────────────
console.log("\nABLE Recommends verification");
console.log("=".repeat(60));
console.log("Checks run: " + checks);
if (failures.length === 0) {
  console.log("RESULT: PASS — all " + checks + " checks passed");
} else {
  console.log("RESULT: FAIL — " + failures.length + " failure(s)");
  failures.forEach((f) => console.log("  x " + f));
}
process.exit(failures.length === 0 ? 0 : 1);
