/*
 * Verification of the page-world extractor's COLLECTOR contract.
 *
 * The extractor must never decide admission from page-writable state. Every
 * plausible file body is forwarded to the isolated world, which re-derives
 * provenance. This harness pins that property and the removal of MIME-derived
 * name fabrication.
 *
 * Admission decisions themselves are covered by verify-provenance.js.
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

function describe(out) {
  return JSON.stringify(out.map((f) => ({ name: f.file.name, source: f.source, nameSource: f.nameSource })));
}

const CSV = "name,salary\nAlice,100\n";
const PDF_BYTES = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\ntrailer\n");
const URL_API = { url: "https://example.test/api/upload", headers: null };

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

// If the extractor ever consults these, the harness fails: admission must not
// depend on page-writable tracker state.
const trackerCalls = [];
sandbox.__ableHasTrackedFiles = () => { trackerCalls.push("hasTrackedFiles"); return false; };
sandbox.__ableMatchFilename = () => { trackerCalls.push("matchFilename"); return null; };
sandbox.__ableLookupTrackedFilename = () => { trackerCalls.push("lookupTrackedFilename"); return null; };

vm.createContext(sandbox);
for (const file of ["core/synthetic-names.js", "core/file-identity.js", "inject/file-extractor.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
}

const { extractFiles, extractFilesAsync } = sandbox;
if (typeof extractFiles !== "function" || typeof extractFilesAsync !== "function") {
  throw new Error("inject/file-extractor.js did not expose the extractors");
}

async function extract(body, ctx) {
  return extractFilesAsync(body, ctx || URL_API);
}

async function main() {
  // ── 1. Candidates the page could previously make disappear are forwarded ──
  {
    const mimeBlob = await extract(new Blob([CSV], { type: "text/csv" }));
    check("MIME-only blob is forwarded", mimeBlob.length === 1, describe(mimeBlob));
    check("MIME-only blob keeps a placeholder name", mimeBlob.length === 1 && mimeBlob[0].file.name === "blob", describe(mimeBlob));

    const pdfBlob = await extract(new Blob([PDF_BYTES], { type: "application/pdf" }));
    check("PDF blob without a name is forwarded", pdfBlob.length === 1, describe(pdfBlob));

    const imageBlob = await extract(new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }));
    check("image blob without a name is forwarded", imageBlob.length === 1, describe(imageBlob));

    const typeless = await extract(new Blob([PDF_BYTES]));
    check("typeless blob is forwarded", typeless.length === 1, describe(typeless));

    const namedBlob = await extract(new File([PDF_BYTES], "blob", { type: "application/pdf" }));
    check("page-built File named 'blob' is forwarded", namedBlob.length === 1, describe(namedBlob));
  }

  // ── 2. Explicit names survive the collector ───────────────────────────────
  {
    const file = await extract(new File([CSV], "payroll.csv", { type: "text/csv" }));
    check("page-supplied real name survives", file.length === 1 && file[0].file.name === "payroll.csv", describe(file));

    const viaUrl = await extract(new Blob([PDF_BYTES], { type: "application/pdf" }), {
      url: "https://bucket.example.test/u/1/report.pdf",
      headers: null,
    });
    check("real name in the request URL survives", viaUrl.length === 1 && viaUrl[0].file.name === "report.pdf", describe(viaUrl));

    const form = new FormData();
    form.append("attachment", new Blob([CSV], { type: "text/csv" }), "ticket.csv");
    const formOut = await extract(form);
    check("explicitly named FormData entry survives", formOut.length === 1 && formOut[0].file.name === "ticket.csv", describe(formOut));

    const unnamed = new FormData();
    unnamed.append("attachment", new Blob([CSV], { type: "text/csv" }));
    const unnamedOut = await extract(unnamed);
    check("unnamed FormData blob is forwarded", unnamedOut.length === 1, describe(unnamedOut));
  }

  // ── 3. No MIME/magic-derived name fabrication ────────────────────────────
  {
    const pdfBuffer = PDF_BYTES.buffer.slice(PDF_BYTES.byteOffset, PDF_BYTES.byteOffset + PDF_BYTES.byteLength);
    const out = await extract(pdfBuffer);
    check("ArrayBuffer is forwarded", out.length === 1, describe(out));
    check("ArrayBuffer name is not magic-derived", out.length === 1 && out[0].file.name === "upload", describe(out));
    check(
      "no candidate name is an upload.<mime> placeholder",
      out.every((f) => !/^upload\.[a-z0-9-]+$/i.test(f.file.name))
    );
  }

  // ── 4. Page-writable tracker globals are never consulted ─────────────────
  {
    check("extractor never calls hasTrackedFiles", trackerCalls.indexOf("hasTrackedFiles") === -1);
    check("extractor never calls matchFilename", trackerCalls.indexOf("matchFilename") === -1);
    check("extractor never calls lookupTrackedFilename", trackerCalls.indexOf("lookupTrackedFilename") === -1);
  }

  // ── 5. The sync path is a collector too ──────────────────────────────────
  {
    const syncOut = extractFiles(new File([CSV], "blob", { type: "text/csv" }), URL_API);
    check("sync path forwards a 'blob' File as well", syncOut.length === 1, describe(syncOut));
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log("\nABLE extractor collector verification");
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
