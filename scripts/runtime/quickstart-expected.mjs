#!/usr/bin/env node
/**
 * s223-m03 (#2527 ruling 14; the website's message 2b348bfa, ask 1): the hashes the Harbor quickstart produces, shipped in
 * @oods/foundry as quickstart/expected.json, so a reader who runs it can check the match without the private repository.
 * Written from the release candidate's packed-quickstart runs (one per Node version), which must agree, before the freeze
 * packs @oods/foundry; the frozen package's own quickstart runs must then reproduce every value (s218-packed-quickstart).
 * Preview hashes are left out: they differ between Node versions.
 *
 *   node scripts/runtime/quickstart-expected.mjs --write <run dir> <run dir> ...
 *   node scripts/runtime/quickstart-expected.mjs --check <run dir> <run dir> ...
 *
 * A run dir is a packed-quickstart receipt folder: receipt.json and steps/chart.output.json.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const EXPECTED_FILE = "packages/foundry/quickstart/expected.json";
const SOURCES = { "release-candidate-tarballs": "release-candidate tarballs", "frozen-tarballs": "frozen tarballs", "public-npm-registry": "public npm registry" };

/** One run's hashes and identity, read from its receipts. */
export function readRun(directory) {
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, "receipt.json"), "utf8"));
  assert.equal(receipt.status, "pass", `${directory}: the run did not pass`);
  const app = (framework) => receipt.applications.find((row) => row.framework === framework)?.generatedHash;
  const chart = JSON.parse(fs.readFileSync(path.join(directory, "steps/chart.output.json"), "utf8")).contentHash;
  const foundry = receipt.packages.find((row) => row.name === "@oods/foundry");
  assert(SOURCES[receipt.installationSource], `${directory}: unknown installation source ${receipt.installationSource}`);
  return { version: foundry.version, node: receipt.node.replace(/^v/, ""), source: SOURCES[receipt.installationSource], hashes: { react: app("react"), vue: app("vue"), chart } };
}

export function expectedFrom(runs) {
  assert(runs.length >= 2, "expected.json is written from at least two runs (one per Node version)");
  const [first] = runs;
  for (const run of runs) {
    assert.equal(run.version, first.version, "the runs installed different versions");
    assert.deepEqual(run.hashes, first.hashes, `the Node ${run.node} run produced different hashes from the Node ${first.node} run`);
    for (const [name, hash] of Object.entries(run.hashes)) assert.match(String(hash), /^(sha256:)?[0-9a-f]{64}$/, `${name} hash`);
  }
  assert.equal(new Set(runs.map((run) => run.node)).size, runs.length, "each run is a different Node version");
  return {
    schema: "oods-foundry-quickstart-expected/v1",
    version: first.version,
    react: { contentHash: first.hashes.react },
    vue: { contentHash: first.hashes.vue },
    chart: { contentHash: first.hashes.chart },
    runs: runs.map((run) => ({ node: run.node, source: run.source })),
    notes: ["react and vue are the generated applications' contentHash; chart is viz_render's contentHash of the quickstart chart.", "Preview hashes are not listed: they differ between Node versions."],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...directories] = process.argv.slice(2);
  assert(mode === "--write" || mode === "--check", "usage: quickstart-expected.mjs --write|--check <run dir> <run dir> ...");
  const text = `${JSON.stringify(expectedFrom(directories.map((directory) => readRun(path.resolve(directory)))), null, 2)}\n`;
  const file = path.join(REPO_ROOT, EXPECTED_FILE);
  if (mode === "--write") { fs.writeFileSync(file, text); process.stdout.write(`Wrote ${EXPECTED_FILE}.\n`); }
  else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) { process.stderr.write(`${EXPECTED_FILE} is not what these runs produced.\n`); process.exitCode = 1; }
  else process.stdout.write(`${EXPECTED_FILE} matches the runs.\n`);
}
