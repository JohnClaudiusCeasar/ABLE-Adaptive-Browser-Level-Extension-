#!/usr/bin/env node
/**
 * Compute SHA-256 hashes of web-accessible extension assets so they can be
 * pasted into config.js (EXPECTED_INJECT_HASH / EXPECTED_CONTENT_CSS_HASH).
 *
 * Usage:
 *   node scripts/hash-assets.js
 *
 * Output is plain key=value lines, ready to substitute into config.js.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const targets = [
  { file: "inject.js", key: "EXPECTED_INJECT_HASH" },
  { file: "content.css", key: "EXPECTED_CONTENT_CSS_HASH" },
];

const root = path.resolve(__dirname, "..");

for (const { file, key } of targets) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`${key} = ""  # ${file} not found`);
    continue;
  }
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(full))
    .digest("hex");
  console.log(`${key} = "${hash}"`);
}