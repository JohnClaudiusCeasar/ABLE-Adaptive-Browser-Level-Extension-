#!/usr/bin/env node
/**
 * Compute SHA-256 hashes of web-accessible extension assets so they can be
 * pasted into config.js (the EXPECTED_*_HASH constants).
 *
 * Usage:
 *   node scripts/hash-assets.js
 *
 * Output is plain key=value lines, ready to substitute into config.js.
 * `npm run build` writes them into config.js automatically — use this script
 * when you only want to read the values.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { root, HASH_TARGETS } = require("./hash-targets");

for (const { file, key } of HASH_TARGETS) {
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
