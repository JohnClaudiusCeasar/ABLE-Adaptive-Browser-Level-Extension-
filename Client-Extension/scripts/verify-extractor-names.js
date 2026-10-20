/*
 * End-to-end verification of the extractor's placeholder gate.
 *
 * The real inject/file-extractor.js is executed against Node's native File,
 * Blob and FormData, with core/synthetic-names.js loaded first exactly as
 * inject.js loads it in the page world.
 *
 * The gate is what stops a MIME-derived placeholder name ("upload.csv") from
 * ever reaching the audit, so it is asserted directly:
 *
 *   1. A name fabricated from the MIME type is dropped
 *   2. A name fabricated from the form field + MIME type is dropped
 *   3. A page-authored placeholder name is dropped
 *   4. A magic-byte-derived name is dropped
 *   5. A page-supplied real name is kept
 *   6. A name recovered from the user's own file selection is kept, even when
 *      it looks like a placeholder — the user may really have "upload.csv"
 *
 * Run: npm run verify:extractor-names   (from Client-Extension/)
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
const PDF_BYTES = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\ntrailer\n");

// ── Build the page world ────────────────────────────────────────────────────
const sandbox = {
  console,
  File,
  Blob,
  FormData,
  ArrayBuffer,
  Uint8Array,
  ReadableStream,
  URL,
  Promise,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.__ABLE_PAGE_WORLD = true;

// No file has been picked by the user unless a test says otherwise.
sandbox.__ableMatchFilename = () => null;
sandbox.__ableLookupTrackedFilename = () => null;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core/synthetic-names.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "inject/file-extractor.js"), "utf8"), sandbox);

const { extractFiles } = sandbox;
if (typeof extractFiles !== "function") {
  throw new Error("inject/file-extractor.js did not expose extractFiles");
}

const URL_CTX = { url: "https://example.test/api/upload", headers: null };

function extract(body, ctx) {
  return extractFiles(body, ctx || URL_CTX);
}

// ── 1. A name fabricated from the MIME type ─────────────────────────────────
{
  const blob = new Blob([CSV], { type: "text/csv" });
  const out = extract(blob);
  check("MIME-derived name (upload.csv) is dropped", out.length === 0, "got " + JSON.stringify(out.map((f) => f.file.name)));
}

// ── 2. A name fabricated from the form field + MIME type ────────────────────
{
  // Appended without a filename, the entry is named by the MIME type alone.
  const fd = new FormData();
  fd.append("attachment", new Blob([CSV], { type: "text/csv" }));
  const out = extract(fd);
  check("MIME-derived form entry name is dropped", out.length === 0, "got " + JSON.stringify(out.map((f) => f.file.name)));

  // Appended with an explicit filename, the page named the file itself.
  const named = new FormData();
  named.append("attachment", new Blob([CSV], { type: "text/csv" }), "ticket.csv");
  const namedOut = extract(named);
  check("explicitly named form entry is kept", namedOut.length === 1, "got " + JSON.stringify(namedOut.map((f) => f.file.name)));
  check("explicitly named form entry keeps its name", namedOut.length === 1 && namedOut[0].file.name === "ticket.csv");
}

// ── 3. A page-authored placeholder name ─────────────────────────────────────
{
  const file = new File([CSV], "upload.csv", { type: "text/csv" });
  const out = extract(file);
  check("page-authored placeholder (upload.csv) is dropped", out.length === 0, "got " + JSON.stringify(out.map((f) => f.file.name)));

  const form = new FormData();
  form.append("file", new File([CSV], "form-upload.csv", { type: "text/csv" }));
  const formOut = extract(form);
  check("page-authored placeholder (form-upload.csv) is dropped", formOut.length === 0, "got " + JSON.stringify(formOut.map((f) => f.file.name)));
}

// ── 4. A magic-byte-derived name ───────────────────────────────────────────
{
  const buf = PDF_BYTES.buffer.slice(PDF_BYTES.byteOffset, PDF_BYTES.byteOffset + PDF_BYTES.byteLength);
  const out = extract(buf);
  check("magic-byte-derived name (upload.pdf) is dropped", out.length === 0, "got " + JSON.stringify(out.map((f) => f.file.name)));
}

// ── 5. A page-supplied real name is kept ────────────────────────────────────
{
  const file = new File([CSV], "payroll.csv", { type: "text/csv" });
  const out = extract(file);
  check("page-supplied real name is kept", out.length === 1, "got " + out.length);
  check("kept file keeps its name", out.length === 1 && out[0].file.name === "payroll.csv");
  check("kept file is marked as a page name", out.length === 1 && out[0].nameSource === "page", "got " + (out[0] && out[0].nameSource));
}

// ── 6. A name recovered from the user's own selection is kept ───────────────
{
  sandbox.__ableLookupTrackedFilename = (size, validator) =>
    validator("upload.csv") ? "upload.csv" : null;

  const file = new File([CSV], "upload.csv", { type: "text/csv" });
  const out = extract(file);
  check("user-selected placeholder-looking name is kept", out.length === 1, "got " + JSON.stringify(out.map((f) => f.file.name)));
  check("user-selected name is marked as a user name", out.length === 1 && out[0].nameSource === "user", "got " + (out[0] && out[0].nameSource));

  sandbox.__ableLookupTrackedFilename = () => null;
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\nABLE extractor placeholder-gate verification");
console.log("=".repeat(60));
console.log("Checks run: " + checks);
if (failures.length === 0) {
  console.log("RESULT: PASS — all " + checks + " checks passed");
} else {
  console.log("RESULT: FAIL — " + failures.length + " failure(s)");
  failures.forEach((f) => console.log("  x " + f));
}
process.exit(failures.length === 0 ? 0 : 1);
