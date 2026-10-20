#!/usr/bin/env node
/**
 * Build script for ABLE extension.
 *
 * Computes SHA-256 hashes of web-accessible resources and updates config.js
 * so the integrity check always matches the deployed files.
 *
 * Usage:
 *   node scripts/build.js           # regenerate the pins in config.js
 *   node scripts/build.js --check   # report stale pins and exit 1 (CI gate)
 *
 * This should be run before packaging the extension for distribution. The
 * git pre-commit hook (see scripts/install-git-hooks.js) runs it
 * automatically, so a commit can never carry a hash that does not match the
 * file it pins.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { root, HASH_TARGETS } = require("./hash-targets");

const checkOnly = process.argv.includes("--check");

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

// Compute hashes
const hashes = {};
for (const { file, key } of HASH_TARGETS) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`ERROR: ${file} not found at ${full}`);
    process.exit(1);
  }
  const hash = sha256(full);
  hashes[key] = hash;
  console.log(`Computed ${key} = "${hash}"`);
}

// Update config.js
const configPath = path.join(root, "config.js");
let config = fs.readFileSync(configPath, "utf8");
const stale = [];

for (const [key, hash] of Object.entries(hashes)) {
  const regex = new RegExp(`(${key}\\s*=\\s*")[^"]*(")`, "g");
  const match = regex.exec(config);
  if (!match) {
    console.error(
      `ERROR: Could not find ${key} in config.js. Add the constant ` +
        `\`const ${key} = "";\` to config.js first, then run this script again.`
    );
    process.exit(1);
  }
  const oldHash = match[0].replace(match[1], "").replace(match[2], "");
  if (oldHash === hash) {
    console.log(`  ${key} unchanged`);
    continue;
  }
  stale.push({ key, oldHash, hash });
  config = config.replace(regex, `$1${hash}$2`);
  console.log(`  ${key} updated: ${oldHash.slice(0, 8)}... → ${hash.slice(0, 8)}...`);
}

if (checkOnly) {
  if (stale.length > 0) {
    console.error("\nERROR: config.js carries stale integrity hashes:");
    for (const { key, oldHash, hash } of stale) {
      console.error(`  ${key}: config.js has ${oldHash}, file hashes to ${hash}`);
    }
    console.error("\nRun `npm run build` to regenerate them.");
    process.exit(1);
  }
  console.log("\nAll integrity hashes are up to date.");
  process.exit(0);
}

if (stale.length === 0) {
  console.log("\nconfig.js already up to date.");
  process.exit(0);
}

fs.writeFileSync(configPath, config, "utf8");
console.log("\nconfig.js updated successfully.");
