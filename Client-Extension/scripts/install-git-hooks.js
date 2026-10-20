#!/usr/bin/env node
/**
 * Point git at the repository's .githooks directory.
 *
 * The pre-commit hook there regenerates the extension's SHA-256 integrity
 * pins, so a commit can never carry a hash that does not match the file it
 * pins. Run automatically via `npm install` (the "prepare" script); safe to
 * re-run at any time.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HOOKS_PATH = ".githooks";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function gitOrNull(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

let root;
try {
  root = git(["rev-parse", "--show-toplevel"], process.cwd());
} catch {
  console.warn("ABLE: not inside a git repository — skipping hook install.");
  process.exit(0);
}

if (!fs.existsSync(path.join(root, HOOKS_PATH, "pre-commit"))) {
  console.warn(`ABLE: ${HOOKS_PATH}/pre-commit not found — skipping hook install.`);
  process.exit(0);
}

const existing = gitOrNull(["config", "--get", "core.hooksPath"], root);

if (existing && existing !== HOOKS_PATH) {
  // Do not silently replace a hooks path the developer chose themselves.
  console.warn(
    `ABLE: core.hooksPath is already set to "${existing}" — leaving it alone. ` +
      `Copy ${HOOKS_PATH}/pre-commit into your hooks directory to enable the ` +
      "integrity pin regeneration."
  );
  process.exit(0);
}

try {
  git(["config", "core.hooksPath", HOOKS_PATH], root);
  console.log("ABLE: git hooks installed — integrity pins regenerate on commit.");
} catch (error) {
  console.warn("ABLE: could not install git hooks:", error.message);
}
