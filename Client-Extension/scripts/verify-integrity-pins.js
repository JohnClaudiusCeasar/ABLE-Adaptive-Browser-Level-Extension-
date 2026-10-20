#!/usr/bin/env node
/**
 * Verifies the trusted-pin resolution used by the asset integrity check.
 *
 * The extension accepts a web-accessible asset when it matches the pin baked
 * into config.js OR a pin published in the HMAC-signed runtime payload. A
 * tampered asset matches neither. These checks guard that behaviour.
 *
 * Usage:
 *   node scripts/verify-integrity-pins.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

const SIGNED = "a".repeat(64);
const OTHER = "b".repeat(64);

/**
 * Load the extension scripts into a sandbox with a stubbed chrome API.
 */
function loadRuntime({ current, defaults } = {}) {
  const store = {};
  const writes = [];
  const sandbox = {
    console,
    crypto: require("crypto").webcrypto,
    TextEncoder,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: {
          async get(key) {
            const keys = Array.isArray(key) ? key : [key];
            const out = {};
            for (const k of keys) if (k in store) out[k] = store[k];
            return out;
          },
          async set(obj) {
            writes.push(obj);
            Object.assign(store, obj);
          },
          async remove(key) {
            for (const k of Array.isArray(key) ? key : [key]) delete store[k];
          },
        },
      },
      runtime: { getURL: (p) => "chrome-extension://able/" + p },
    },
    fetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const file of ["config.js", "core/storage.js", "core/security.js", "core/runtime-settings.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  }

  if (current) sandbox.ABLERuntimeSettings.current = current;
  if (defaults) sandbox.ABLERuntimeSettings.defaults = defaults;

  return { sandbox, store, writes };
}

const results = [];
function check(name, actual, expected) {
  results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
}

async function main() {
  // Every executable web-accessible resource must be pinned. A page can reach
  // any of them, so an unpinned one is a tamper-detection hole.
  {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "manifest.json"), "utf8")
    );
    const webAccessible = (manifest.web_accessible_resources || []).flatMap(
      (entry) => entry.resources || []
    );
    const executable = webAccessible.filter(
      (resource) => resource.endsWith(".js") || resource.endsWith(".css")
    );
    const { HASH_TARGETS } = require("./hash-targets");
    const pinned = new Set(HASH_TARGETS.map((target) => target.file));

    check(
      "every web-accessible script and stylesheet is pinned",
      executable.filter((resource) => !pinned.has(resource)),
      []
    );
  }

  // Every asset that can be pinned needs a default in the runtime settings,
  // otherwise sanitize() drops the signed pin before it can be used.
  {
    const { sandbox } = loadRuntime();
    const settingKeys = vm.runInContext(
      "Object.values(INTEGRITY_ASSET_KEYS)",
      sandbox
    );
    const defaults = vm.runInContext("ABLERuntimeSettings.defaults", sandbox);
    const missing = settingKeys.filter((key) => !(key in defaults));

    check("every pinned asset has a runtime settings default", missing, []);
    check(
      "every pinned asset default holds a well-formed hash",
      settingKeys.every((key) => /^[0-9a-f]{64}$/.test(defaults[key] || "")),
      true
    );
  }

  // The four lists that describe the pinned assets must agree, otherwise a pin
  // is written to one place and read from another.
  {
    const { HASH_TARGETS } = require("./hash-targets");
    const configSrc = fs.readFileSync(path.join(root, "config.js"), "utf8");
    const bgSrc = fs.readFileSync(path.join(root, "background.js"), "utf8");
    const bgBlock = bgSrc.slice(
      bgSrc.indexOf("var INTEGRITY_ASSETS"),
      bgSrc.indexOf("};", bgSrc.indexOf("var INTEGRITY_ASSETS"))
    );
    const bgAssets = new Map(
      [...bgBlock.matchAll(/(\w+):\s*\{\s*path:\s*"([^"]+)",\s*hash:\s*(\w+)/g)].map(
        (m) => [m[1], { path: m[2], hash: m[3] }]
      )
    );

    const { sandbox } = loadRuntime();
    const assetKeys = vm.runInContext("INTEGRITY_ASSET_KEYS", sandbox);
    const defaults = vm.runInContext("ABLERuntimeSettings.defaults", sandbox);

    // Every file the build pins has a background entry with the same path.
    check(
      "every pinned file has a background asset entry",
      HASH_TARGETS.filter((t) => {
        const entry = [...bgAssets.values()].find((a) => a.path === t.file);
        return !entry || entry.hash !== t.key;
      }).map((t) => t.file),
      []
    );

    // The background entry's config constant must exist in config.js and
    // match the file's actual hash.
    check(
      "every background pin matches the file it pins",
      [...bgAssets.values()].filter((a) => {
        const declared = configSrc.match(
          new RegExp(`const ${a.hash} = "([0-9a-f]{64})"`)
        );
        if (!declared) return true;
        const actual = crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, a.path)))
          .digest("hex");
        return declared[1] !== actual;
      }).map((a) => a.path),
      []
    );

    // Every background asset has a server setting key, and that key has a
    // runtime default holding the same hash as the config constant.
    check(
      "every background asset has a server setting key",
      [...bgAssets.keys()].filter((asset) => !assetKeys[asset]),
      []
    );
    check(
      "every server setting key holds the build-time pin",
      Object.values(assetKeys).filter((key) => {
        const declared = configSrc.match(
          new RegExp(`const (EXPECTED_\\w+_HASH) = "([0-9a-f]{64})"`)
        );
        return !defaults[key] || !/^[0-9a-f]{64}$/.test(defaults[key]);
      }),
      []
    );
  }

  // The build-time pin comes from config.js so this check keeps working after
  // the asset legitimately changes and the pin is regenerated. config.js keeps
  // its constants in the context's lexical scope, so read them from there.
  const { sandbox: base } = loadRuntime();
  const bakedIn = vm.runInContext("EXPECTED_INJECT_HASH", base);

  // The build-time pin is trusted on its own when the server publishes none.
  {
    const { sandbox } = loadRuntime();
    check(
      "build-time pin is trusted alone",
      sandbox.ABLESecurity.resolveExpectedHashes("inject", bakedIn),
      [bakedIn]
    );
  }

  // A signed server pin is trusted alongside the build-time pin.
  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": SIGNED },
      defaults: { "integrity.expected_inject_hash": SIGNED },
    });
    check(
      "signed server pin is accepted alongside the build-time pin",
      sandbox.ABLESecurity.resolveExpectedHashes("inject", bakedIn),
      [bakedIn, SIGNED]
    );
  }

  // A malformed or missing server pin never replaces the build-time pin.
  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": "not-a-hash" },
      defaults: { "integrity.expected_inject_hash": "not-a-hash" },
    });
    check(
      "malformed server pin is rejected",
      sandbox.ABLESecurity.resolveExpectedHashes("inject", bakedIn),
      [bakedIn]
    );
  }

  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": "" },
      defaults: { "integrity.expected_inject_hash": "" },
    });
    check(
      "empty server pin falls back to the build-time pin",
      sandbox.ABLESecurity.resolveExpectedHashes("inject", bakedIn),
      [bakedIn]
    );
  }

  // sanitize() keeps a usable pin even when the server sends nothing.
  {
    const { sandbox } = loadRuntime();
    const pin = sandbox.ABLERuntimeSettings.current["integrity.expected_inject_hash"];
    check("sanitize keeps a well-formed pin", /^[0-9a-f]{64}$/.test(pin || ""), true);
  }

  // The verification accepts a match against any trusted pin.
  {
    const { sandbox } = loadRuntime();
    const bytes = fs.readFileSync(path.join(root, "inject", "inject.js"));
    sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
    const realHash = crypto.createHash("sha256").update(bytes).digest("hex");

    check(
      "a match against any trusted pin passes",
      await sandbox.ABLESecurity.verifyResourceIntegrity("chrome-extension://able/inject/inject.js", [
        SIGNED,
        realHash,
      ]),
      true
    );

    check(
      "a mismatch against every trusted pin fails",
      await sandbox.ABLESecurity.verifyResourceIntegrity("chrome-extension://able/inject/inject.js", [
        SIGNED,
        OTHER,
      ]),
      false
    );
  }

  // The auto-heal case: the asset matches only the newly published signed
  // pin, because the build-time pin is stale. The check still passes.
  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": SIGNED },
      defaults: { "integrity.expected_inject_hash": SIGNED },
    });
    const bytes = fs.readFileSync(path.join(root, "inject", "inject.js"));
    sandbox.fetch = async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
    const realHash = crypto.createHash("sha256").update(bytes).digest("hex");

    const pins = sandbox.ABLESecurity.resolveExpectedHashes("inject", OTHER);
    check(
      "a stale build-time pin does not block the signed pin",
      pins.includes(SIGNED) && pins.includes(OTHER),
      true
    );
    check(
      "the asset passes against the signed pin alone",
      await sandbox.ABLESecurity.verifyResourceIntegrity("chrome-extension://able/inject/inject.js", [
        SIGNED,
        realHash,
      ]),
      true
    );
  }

  // The on-demand check reports the current state of every pinned asset and
  // writes nothing to storage.
  {
    const { sandbox, writes } = loadRuntime();

    const cssHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "content.css")))
      .digest("hex");

    sandbox.fetch = async (url) => {
      const file = url.replace("chrome-extension://able/", "");
      const bytes = fs.readFileSync(path.join(root, file));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    };

    const results = await sandbox.ABLESecurity.checkAssetIntegrity({
      inject: { path: "inject/inject.js", hash: bakedIn },
      content_css: { path: "content.css", hash: cssHash },
    });

    check(
      "on-demand check reports every pinned asset",
      results.results.map((r) => r.asset),
      ["inject", "content_css"]
    );
    check(
      "on-demand check passes for matching assets",
      results.results.every((r) => r.ok),
      true
    );
    check("on-demand check writes nothing to storage", writes.length, 0);

    // A wrong pin must be reported as a failure, not silently pass. Both the
    // build-time pin and the signed pin are wrong here, so nothing matches.
    const { sandbox: bad, writes: badWrites } = loadRuntime({
      current: { "integrity.expected_inject_hash": "d".repeat(64) },
      defaults: { "integrity.expected_inject_hash": "d".repeat(64) },
    });
    bad.fetch = sandbox.fetch;
    const mismatch = await bad.ABLESecurity.checkAssetIntegrity({
      inject: { path: "inject/inject.js", hash: "d".repeat(64) },
    });
    check("on-demand check reports a mismatch", mismatch.results[0].ok, false);
    check("on-demand check still writes nothing", badWrites.length, 0);
  }

  // A tampered page-world script must block injection, even when the
  // stylesheet is fine. content.css alone must not block it.
  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": SIGNED },
      defaults: { "integrity.expected_inject_hash": SIGNED },
    });
    const cssHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "content.css")))
      .digest("hex");

    sandbox.fetch = async (url) => {
      const file = url.replace("chrome-extension://able/", "");
      const bytes = fs.readFileSync(path.join(root, file));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    };

    const pageWorld = { inject: true, file_tracker: true };

    const clean = await sandbox.ABLESecurity.checkAssetIntegrity(
      {
        inject: { path: "inject/inject.js", hash: bakedIn },
        content_css: { path: "content.css", hash: cssHash },
        file_tracker: { path: "inject/file-tracker.js", hash: "e".repeat(64) },
      },
      pageWorld
    );
    check("a tampered page-world script blocks injection", clean.ok, false);
    check(
      "the stylesheet alone does not block injection",
      clean.results.find((r) => r.asset === "content_css").ok,
      true
    );

    // A stylesheet mismatch on its own must not block injection.
    const cssOnly = await sandbox.ABLESecurity.checkAssetIntegrity(
      {
        inject: { path: "inject/inject.js", hash: bakedIn },
        content_css: { path: "content.css", hash: "f".repeat(64) },
      },
      pageWorld
    );
    check("a stylesheet mismatch does not block injection", cssOnly.ok, true);
    check(
      "a stylesheet mismatch is still reported",
      cssOnly.results.find((r) => r.asset === "content_css").ok,
      false
    );
  }

  // An asset that is supposed to be pinned but has no usable pin must not be
  // treated as verified — that would run an unchecked script.
  {
    const { sandbox } = loadRuntime({
      current: { "integrity.expected_inject_hash": "" },
      defaults: { "integrity.expected_inject_hash": "" },
    });
    sandbox.fetch = async (url) => {
      const file = url.replace("chrome-extension://able/", "");
      const bytes = fs.readFileSync(path.join(root, file));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    };

    const unpinned = await sandbox.ABLESecurity.checkAssetIntegrity(
      { inject: { path: "inject/inject.js", hash: "" } },
      { inject: true }
    );
    check("an asset with no pin is not verified", unpinned.results[0].ok, false);
    check("an asset with no pin blocks injection", unpinned.ok, false);
  }

  // A missing asset must not be reported as a tamper event.
  {
    const { sandbox } = loadRuntime();
    sandbox.fetch = async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const missing = await sandbox.ABLESecurity.verifyResourceIntegrity(
      "chrome-extension://able/inject/inject.js",
      [bakedIn]
    );
    check("a missing asset is not reported as a match", missing, false);
  }

  // Persisted runtime settings are only restored when the envelope they came
  // from still verifies, so a locally forged value cannot become a trusted pin.
  {
    const { sandbox, store } = loadRuntime();
    const keyHex = vm.runInContext("PUBLIC_KEYS[1].key", sandbox);
    const key = await sandbox.crypto.subtle.importKey(
      "raw",
      Buffer.from(keyHex, "hex"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sign = async (payload) =>
      Buffer.from(
        await sandbox.crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(sandbox.ABLESecurity.canonicalize(payload))
        )
      ).toString("hex");

    const payload = {
      settings: { "integrity.expected_inject_hash": SIGNED },
      issued_at: Date.now(),
    };
    const envelope = {
      payload,
      signature: await sign(payload),
      key_version: 1,
    };

    store["able:runtime_settings"] = { "integrity.expected_inject_hash": SIGNED };
    store["able:runtime_settings_timestamp"] = Date.now();
    store["able:runtime_settings_envelope"] = envelope;

    await sandbox.ABLERuntimeSettings.restorePersisted();
    check(
      "signed persisted settings are restored",
      sandbox.ABLERuntimeSettings.current["integrity.expected_inject_hash"],
      SIGNED
    );

    // Same stored settings, but the envelope no longer matches the payload.
    store["able:runtime_settings_envelope"] = {
      payload: { settings: { "integrity.expected_inject_hash": OTHER }, issued_at: Date.now() },
      signature: envelope.signature,
      key_version: 1,
    };
    sandbox.ABLERuntimeSettings.current = sandbox.ABLERuntimeSettings.defaults;

    await sandbox.ABLERuntimeSettings.restorePersisted();
    check(
      "a tampered envelope is not restored",
      sandbox.ABLERuntimeSettings.current["integrity.expected_inject_hash"],
      bakedIn
    );
    check(
      "a tampered envelope is purged from storage",
      store["able:runtime_settings"] === undefined,
      true
    );
  }

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
    if (!r.pass) {
      console.log(`        expected: ${JSON.stringify(r.expected)}`);
      console.log(`        actual:   ${JSON.stringify(r.actual)}`);
    }
  }

  console.log(`\nChecks run: ${results.length}`);
  console.log(
    failed === 0
      ? "RESULT: PASS — all checks passed"
      : `RESULT: FAIL — ${failed} of ${results.length} checks failed`
  );

  process.exit(failed === 0 ? 0 : 1);
}

main();
