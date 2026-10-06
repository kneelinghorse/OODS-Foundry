#!/usr/bin/env node

// The advisory gate (s220-m02, audit F01): what the runtime archive ships is checked against npm's advisory data.
//
// @oods/foundry's own manifest declares no dependencies, because the runtime and everything it loads travel inside
// runtime/oods-foundry-runtime.tar.gz. An audit of the outer manifest therefore sees nothing. This gate reads what the
// archive actually carries: the package roots under its node_modules and its SBOM, audited as one union, so a package
// on disk that the SBOM omits is still checked. It asks npm's bulk advisory endpoint about every name and version,
// matches each advisory's vulnerable range against each shipped version, and fails on a high or critical match unless
// scripts/runtime/advisory-exceptions.json names that package, version and advisory with a reason.
//
//   node scripts/runtime/advisory-gate.mjs --archive <runtime.tar.gz> [--out receipt.json]
//   node scripts/runtime/advisory-gate.mjs --runtime-dir <extracted runtime> [--out receipt.json]

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import semver from "semver";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ADVISORY_ENDPOINT = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
export const BLOCKING_SEVERITIES = Object.freeze(["high", "critical"]);
export const EXCEPTIONS_FILE = "scripts/runtime/advisory-exceptions.json";
const SBOM_FILE = "runtime-sbom-lite.json";

/** Every package root under a node_modules folder (scoped or not, nested or in pnpm's store), as name@version. */
export function nodeModulesPackages(root) {
  const found = new Map();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      const child = path.join(directory, entry.name);
      if (entry.name.startsWith("@") && path.basename(directory) === "node_modules") { visit(child); continue; }
      if (entry.name === ".pnpm") { for (const store of fs.readdirSync(child, { withFileTypes: true })) if (store.isDirectory()) walk(path.join(child, store.name)); continue; }
      const manifest = path.join(child, "package.json");
      if (fs.existsSync(manifest)) {
        const { name, version } = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (typeof name === "string" && typeof version === "string") found.set(`${name}@${version}`, { name, version });
      }
      walk(child);
    }
  };
  const walk = (directory) => {
    const nested = path.join(directory, "node_modules");
    if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) visit(nested);
  };
  walk(root);
  return [...found.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
}

/** The SBOM's name and version pairs, when the runtime carries one. */
export function sbomPackages(root) {
  const file = path.join(root, SBOM_FILE);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")).packages.map(({ name, version }) => ({ name, version }));
}

/** npm's advisories for each named package, asked about every shipped version at once. */
export async function queryAdvisories(packages, fetchImpl = fetch) {
  const body = {};
  for (const { name, version } of packages) (body[name] ??= []).includes(version) || body[name].push(version);
  const response = await fetchImpl(ADVISORY_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`npm advisory endpoint answered ${response.status}`);
  return response.json();
}

/**
 * Each advisory whose vulnerable range includes a shipped version, one row per package version. The endpoint answers
 * per package: an advisory for style-dictionary comes back whenever any listed version is affected.
 */
export function matchAdvisories(packages, advisories, exceptions = []) {
  const rows = [];
  for (const { name, version } of packages) {
    for (const advisory of advisories[name] ?? []) {
      if (!semver.satisfies(version, advisory.vulnerable_versions, { includePrerelease: true })) continue;
      const exception = exceptions.find((entry) => entry.package === name && entry.versions.includes(version) && entry.advisory === advisory.url);
      rows.push({ package: name, version, id: advisory.id, url: advisory.url, title: advisory.title, severity: advisory.severity,
        vulnerableVersions: advisory.vulnerable_versions, blocking: BLOCKING_SEVERITIES.includes(advisory.severity) && !exception,
        ...(exception ? { exceptedBecause: exception.reason, decision: exception.decision } : {}) });
    }
  }
  return rows.sort((a, b) => `${a.package}@${a.version}`.localeCompare(`${b.package}@${b.version}`) || String(a.url).localeCompare(String(b.url)));
}

export function readExceptions(root = REPO_ROOT) {
  const { exceptions } = JSON.parse(fs.readFileSync(path.join(root, EXCEPTIONS_FILE), "utf8"));
  for (const entry of exceptions) {
    if (!entry.package || !Array.isArray(entry.versions) || !entry.advisory || !entry.reason?.trim() || !entry.decision) {
      throw new Error(`${EXCEPTIONS_FILE}: every exception names a package, its versions, the advisory URL, a reason and a decision`);
    }
  }
  return exceptions;
}

/** Audit an extracted runtime: the union of its node_modules package roots and its SBOM. */
export async function auditRuntime(runtimeDir, { fetchImpl = fetch, exceptions = readExceptions() } = {}) {
  const onDisk = nodeModulesPackages(runtimeDir);
  const listed = sbomPackages(runtimeDir);
  const key = ({ name, version }) => `${name}@${version}`;
  const union = new Map([...onDisk, ...(listed ?? [])].map((entry) => [key(entry), entry]));
  const audited = [...union.values()].sort((a, b) => key(a).localeCompare(key(b)));
  const advisories = await queryAdvisories(audited, fetchImpl);
  const matches = matchAdvisories(audited, advisories, exceptions);
  const blocking = matches.filter((row) => row.blocking);
  const listedKeys = new Set((listed ?? []).map(key));
  return {
    schema: "oods-foundry-advisory-gate/v1", status: blocking.length ? "fail" : "pass", endpoint: ADVISORY_ENDPOINT, queriedAt: new Date().toISOString(),
    blockingSeverities: BLOCKING_SEVERITIES, audited: audited.length, onDisk: onDisk.length, sbom: listed?.length ?? null,
    onDiskNotInSbom: listed ? onDisk.map(key).filter((id) => !listedKeys.has(id)) : null,
    matches, blocking, excepted: matches.filter((row) => row.exceptedBecause),
  };
}

function extractArchive(archive) {
  const target = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "oods-advisory-gate-"));
  const run = spawnSync("tar", ["-xzf", archive, "-C", target], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`could not extract ${archive}: ${run.stderr}`);
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = (name) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
  const archive = option("--archive");
  const runtimeDir = option("--runtime-dir");
  if (Boolean(archive) === Boolean(runtimeDir)) throw new Error("Give exactly one of --archive <runtime.tar.gz> or --runtime-dir <extracted runtime>.");
  const root = archive ? extractArchive(archive) : runtimeDir;
  try {
    const result = await auditRuntime(root);
    const receipt = { ...result, ...(archive ? { archive: { path: path.relative(REPO_ROOT, path.resolve(archive)), sha256: crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex") } } : { runtimeDir: path.relative(REPO_ROOT, path.resolve(runtimeDir)) }) };
    const out = option("--out");
    if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`); }
    console.log(JSON.stringify({ status: receipt.status, audited: receipt.audited, onDisk: receipt.onDisk, sbom: receipt.sbom, onDiskNotInSbom: receipt.onDiskNotInSbom?.length ?? null, matches: receipt.matches.length, blocking: receipt.blocking.map((row) => `${row.package}@${row.version} ${row.severity} ${row.url}`), excepted: receipt.excepted.length }));
    if (receipt.status !== "pass") process.exitCode = 1;
  } finally {
    if (archive) fs.rmSync(root, { recursive: true, force: true });
  }
}
