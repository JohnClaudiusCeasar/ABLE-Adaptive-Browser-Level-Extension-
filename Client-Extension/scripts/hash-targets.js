/**
 * Web-accessible extension resources that are pinned by SHA-256 in config.js.
 *
 * Every file listed here is executed in the page world (injected as a
 * <script> tag) or loaded as a content-script stylesheet, so all of them are
 * reachable by a hostile page and must be tamper-checked.
 *
 * Shared by scripts/build.js (which writes the pins) and scripts/hash-assets.js
 * (which prints them) so the two lists can never drift apart. If a new
 * web-accessible resource needs tamper detection, add it here and both tools
 * pick it up automatically.
 */
const path = require("path");

const root = path.resolve(__dirname, "..");

const HASH_TARGETS = [
  { file: "inject/inject.js", key: "EXPECTED_INJECT_HASH" },
  { file: "content.css", key: "EXPECTED_CONTENT_CSS_HASH" },
  { file: "core/synthetic-names.js", key: "EXPECTED_SYNTHETIC_NAMES_HASH" },
  { file: "inject/file-extractor.js", key: "EXPECTED_FILE_EXTRACTOR_HASH" },
  { file: "inject/network-interceptor.js", key: "EXPECTED_NETWORK_INTERCEPTOR_HASH" },
  { file: "inject/file-tracker.js", key: "EXPECTED_FILE_TRACKER_HASH" },
];

module.exports = { root, HASH_TARGETS };
