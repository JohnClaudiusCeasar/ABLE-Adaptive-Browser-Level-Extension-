/*
 * Verification of the isolated-world provenance authority.
 *
 * content/provenance.js is what decides whether an intercepted payload is the
 * user's file. It must ignore page-supplied provenance entirely: a hostile page
 * can claim "user" for any blob, and it can rewrite the page-world tracker
 * globals. Only a content-fingerprint match against a trusted selection, or a
 * real page-supplied name consistent with the MIME type, may admit a payload.
 *
 * Run: npm run verify:provenance   (from Client-Extension/)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

let checks = 0;
const failures = [];

function check(label, ok, detail) {
  checks++;
  if (!ok) failures.push(detail ? label + " — " + detail : label);
}

const CSV = "name,salary\nAlice,100\n";
const CSV_COLLISION = "name,salary\nAlice,999\n"; // same byte length, different content
const JSON_TEXT = '{"rows":[1,2,3]}';
const PDF_BYTES = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\ntrailer\n");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Build the isolated world ────────────────────────────────────────────────
const listeners = {};
const sandbox = {
  console,
  File,
  Blob,
  FormData,
  ArrayBuffer,
  Uint8Array,
  URL,
  Promise,
  Date,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.__ABLE_PAGE_WORLD = false;
sandbox.document = {
  addEventListener(type, fn) { listeners[type] = fn; },
};

class FakeInput {}
class FakeForm {}
sandbox.HTMLInputElement = FakeInput;
sandbox.HTMLFormElement = FakeForm;

vm.createContext(sandbox);
for (const file of ["core/synthetic-names.js", "core/file-identity.js", "content/provenance.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
}

const P = sandbox.ABLEProvenance;
if (!P) throw new Error("content/provenance.js did not expose ABLEProvenance");

function entry(file, claimedSource) {
  return { file, source: "blob", nameSource: claimedSource || "page" };
}

async function reset() {
  P._reset();
  await tick();
}

async function admit(file, claimedSource) {
  return P.admit(entry(file, claimedSource));
}

async function main() {
  // ── 1. No selection: only an explicit, consistent page name is admitted ──
  {
    await reset();
    check("MIME-only blob is dropped", (await admit(new File([PDF_BYTES], "blob", { type: "application/pdf" }))) === null);
    check("typeless 'blob' is dropped", (await admit(new File([PDF_BYTES], "blob", { type: "" }))) === null);
    check(
      "placeholder name is dropped even with a matching-looking MIME",
      (await admit(new File([CSV], "upload.csv", { type: "text/csv" }))) === null
    );

    const page = await admit(new File([CSV], "payroll.csv", { type: "text/csv" }));
    check("real page name with agreeing MIME is admitted", !!page);
    check("real page name is marked as a page name", page && page.nameSource === "page");

    const mismatch = await admit(new File([CSV], "report.pdf", { type: "image/png" }));
    check("real name disagreeing with the MIME is dropped", mismatch === null);
  }

  // ── 2. A forged page claim cannot create user provenance ────────────────
  {
    await reset();
    const forged = await admit(new File([CSV], "blob", { type: "text/csv" }), "user");
    check("forged 'user' claim without a match is dropped", forged === null);

    const forgedPlaceholder = await admit(new File([CSV], "upload.csv", { type: "text/csv" }), "user");
    check("forged 'user' claim cannot smuggle a placeholder", forgedPlaceholder === null);
  }

  // ── 3. A trusted selection gives content identity ───────────────────────
  {
    await reset();
    await P.trackSelection(new File([CSV], "payroll.csv", { type: "text/csv" }));

    const asFile = await admit(new File([CSV], "blob", { type: "text/csv" }));
    check("content match is admitted", !!asFile);
    check("content match takes the tracked name", asFile && asFile.file.name === "payroll.csv", asFile && asFile.file.name);
    check("content match is marked as a user name", asFile && asFile.nameSource === "user");

    const renamed = await admit(new File([CSV], "other.csv", { type: "text/csv" }));
    check("content match overrides a different page name", renamed && renamed.file.name === "payroll.csv", renamed && renamed.file.name);

    const typeless = await admit(new File([CSV], "blob", { type: "" }));
    check("typeless blob with matching content is admitted", typeless && typeless.nameSource === "user");
  }

  // ── 4. Same size, different content is not the user's file ──────────────
  {
    await reset();
    await P.trackSelection(new File([CSV], "payroll.csv", { type: "text/csv" }));

    const collision = await admit(new File([CSV_COLLISION], "blob", { type: "text/csv" }));
    check("same-size different-content blob is dropped", collision === null);

    const collisionNamed = await admit(new File([CSV_COLLISION], "blob", { type: "text/csv" }), "user");
    check("same-size different-content cannot claim 'user'", collisionNamed === null);
  }

  // ── 5. A selected JSON document is still a user file ────────────────────
  {
    await reset();
    await P.trackSelection(new File([JSON_TEXT], "export.json", { type: "application/json" }));

    const out = await admit(new File([JSON_TEXT], "blob", { type: "application/json" }));
    check("selected JSON uploaded as a blob is admitted", !!out);
    check("selected JSON takes the tracked name", out && out.file.name === "export.json");

    P._reset();
    const anonymous = await admit(new File([JSON_TEXT], "blob", { type: "application/json" }));
    check("unmatched JSON blob is dropped", anonymous === null);
  }

  // ── 6. Only trusted (user-agent) selection events create provenance ─────
  {
    await reset();
    const file = new File([CSV], "payroll.csv", { type: "text/csv" });
    const input = new FakeInput();
    input.type = "file";
    input.files = [file];

    listeners.change({ isTrusted: false, target: input });
    await tick();
    check("synthetic change event is ignored", P._selections().length === 0, String(P._selections().length));

    listeners.change({ isTrusted: true, target: input });
    await tick();
    await tick();
    check("trusted change event records a selection", P._selections().length === 1, String(P._selections().length));

    const admitted = await admit(new File([CSV], "blob", { type: "text/csv" }));
    check("a trusted selection is usable for admission", admitted && admitted.nameSource === "user");
  }

  // ── 7. Batch admission filters unattributable entries ───────────────────
  {
    await reset();
    const out = await P.admitAll([
      entry(new File([CSV], "blob", { type: "text/csv" }), "user"),
      entry(new File([CSV], "payroll.csv", { type: "text/csv" }), "page"),
      entry(new File([CSV], "upload.csv", { type: "text/csv" }), "page"),
    ]);
    check("batch admission keeps only the attributable entry", out.length === 1, JSON.stringify(out.map((e) => e.file.name)));
    check("batch admission keeps the right name", out.length === 1 && out[0].file.name === "payroll.csv");
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log("\nABLE provenance authority verification");
  console.log("=".repeat(60));
  console.log("Checks run: " + checks);
  if (failures.length === 0) {
    console.log("RESULT: PASS — all " + checks + " checks passed");
  } else {
    console.log("RESULT: FAIL — " + failures.length + " failure(s)");
    failures.forEach((f) => console.log("  x " + f));
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Harness error:", err);
  process.exit(1);
});
