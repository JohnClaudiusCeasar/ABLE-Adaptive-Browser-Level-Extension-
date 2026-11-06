/*
 * Verifies the server URL selection in config.js.
 *
 * - an unpacked build (no Chrome update_url) is a development build and must
 *   talk to the local Laravel server;
 * - a store-installed build (Chrome supplies update_url) must talk to
 *   production.
 *
 * This guards the fix for "the local server receives no visits/policies":
 * the extension was always pointing at production, so nothing reached the
 * local database.
 *
 * Run: npm run verify:dev-routing
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const source =
  fs.readFileSync(path.join(ROOT, "config.js"), "utf8") +
  "\n;globalThis.__serverUrl = SERVER_URL;globalThis.__allowedOrigins = ALLOWED_ORIGINS;";

function loadConfig(manifest) {
  const sandbox = {
    console,
    URL,
    chrome: {
      runtime: {
        getManifest: () => manifest,
      },
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "config.js" });

  return sandbox;
}

const failures = [];
let checks = 0;

function check(label, condition, detail) {
  checks++;
  if (!condition) failures.push(label + (detail ? " — " + detail : ""));
}

const dev = loadConfig({});
check(
  "unpacked build targets localhost",
  dev.__serverUrl === "http://localhost:8000",
  dev.__serverUrl,
);
check(
  "unpacked build allows only the localhost origin",
  JSON.stringify(dev.__allowedOrigins) ===
    JSON.stringify(["http://localhost:8000"]),
  JSON.stringify(dev.__allowedOrigins),
);

const store = loadConfig({
  update_url: "https://clients2.google.com/service/update2/crx",
});
check(
  "store build targets production",
  store.__serverUrl === "https://able-shadow-security.onrender.com",
  store.__serverUrl,
);
check(
  "store build allows only the production origin",
  JSON.stringify(store.__allowedOrigins) ===
    JSON.stringify(["https://able-shadow-security.onrender.com"]),
  JSON.stringify(store.__allowedOrigins),
);

console.log("\nABLE dev-routing verification");
console.log("=".repeat(60));
console.log("Checks run: " + checks);
if (failures.length === 0) {
  console.log("RESULT: PASS — all " + checks + " checks passed");
} else {
  console.log("RESULT: FAIL — " + failures.length + " failure(s)");
  failures.forEach((failure) => console.log("  x " + failure));
}
process.exit(failures.length === 0 ? 0 : 1);
