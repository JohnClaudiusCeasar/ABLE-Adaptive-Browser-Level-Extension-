#!/usr/bin/env node
/**
 * Build script for ABLE extension.
 *
 * Computes SHA-256 hashes of web-accessible resources and updates config.js
 * so the integrity check always matches the deployed files.
 *
 * Usage:
 *   node scripts/build.js
 *
 * This should be run before packaging the extension for distribution.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targets = [
  { file: "inject/inject.js", key: "EXPECTED_INJECT_HASH" },
  { file: "content.css", key: "EXPECTED_CONTENT_CSS_HASH" },
];

// Compute hashes
const hashes = {};
for (const { file, key } of targets) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`ERROR: ${file} not found at ${full}`);
    process.exit(1);
  }
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(full))
    .digest("hex");
  hashes[key] = hash;
  console.log(`Computed ${key} = "${hash}"`);
}

// Update config.js
const configPath = path.join(root, "config.js");
let config = fs.readFileSync(configPath, "utf8");

for (const [key, hash] of Object.entries(hashes)) {
  const regex = new RegExp(`(${key}\\s*=\\s*")[^"]*(")`, "g");
  const match = regex.exec(config);
  if (!match) {
    console.error(`ERROR: Could not find ${key} in config.js`);
    process.exit(1);
  }
  const oldHash = match[0].replace(match[1], "").replace(match[2], "");
  if (oldHash === hash) {
    console.log(`  ${key} unchanged`);
  } else {
    config = config.replace(regex, `$1${hash}$2`);
    console.log(`  ${key} updated: ${oldHash.slice(0, 8)}... → ${hash.slice(0, 8)}...`);
  }
}

fs.writeFileSync(configPath, config, "utf8");
console.log("\nconfig.js updated successfully.");
