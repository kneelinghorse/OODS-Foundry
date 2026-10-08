#!/usr/bin/env node
/**
 * Build the npm package @oods/foundry from an assembled runtime archive (s211-m03).
 *
 *   node scripts/runtime/npm-package.mjs --archive-dir <assemble --out-dir> --out-dir <empty dir> --work-dir <empty dir>
 *
 * The package is packages/foundry (its launcher, README, authoring guide, CHANGELOG, SECURITY note and images) plus the terms files and
 * the archive with its manifest under runtime/. It ships exactly the closure the archive ships, because it carries the
 * archive itself. Nothing is packed when a package-contents rule refuses a file, in the package or inside the archive.
 * s239: runtime/ also carries what the archive's server answers to initialize and tools/list, recorded from that server
 * (scripts/runtime/first-start.mjs) and checked again on the packed tarball, for the launcher to answer while it unpacks.
 * Publishing is not this script's: the review publishes on the owner's yes.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeReceipts } from "./assemble.mjs";
import { FIRST_START_FILE } from "./first-start.mjs";
import { RUNTIME_ARCHIVE_FILE, RUNTIME_ARCHIVE_SHA256_FILE, RUNTIME_MANIFEST_FILE, TERMS_FILES } from "./manifest.mjs";
import { ownerFacts, packageContentFindings, readTree } from "./package-contents.mjs";
import { nodeFloor } from "./client-configs.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PACKAGE_DIR = "packages/foundry";
/** What the package carries from packages/foundry, beside the terms files and runtime/. */
// s223-m03 (#2527 ruling 16): facts.json publishes the README's and artifact_certify's numbers as data.
export const PACKAGE_SOURCES = ["package.json", "bin/oods-foundry.js", "README.md", "TOOL-REFERENCE.md", "OBJECTS-AND-TRAITS.md", "BRANDS.md", "COMPONENTS.md", "QUICKSTART.md", "GENERATED-APPS.md", "quickstart", "shadcn", "skills", "server.json", "facts.json", "errors.json", "CHANGELOG.md", "SECURITY.md", "images", "IMPORTING-OBJECTS.md", "object-hub.schema.json"];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** The package manifest's promises, checked against the one name source, the release version and the runtime floor. */
export function checkPackageManifest(root = REPO_ROOT) {
  const manifest = readJson(path.join(root, PACKAGE_DIR, "package.json"));
  const name = readJson(path.join(root, "configs/product/name.json"));
  assert.equal(manifest.name, name.npmPackage, "the package is named by configs/product/name.json");
  assert.equal(manifest.version, readJson(path.join(root, "package.json")).version, "the package version is the release version");
  assert.equal(manifest.license, "Apache-2.0");
  assert.equal(manifest.homepage, "https://oods-foundry.com/", "the package points to the public product homepage");
  assert.deepEqual(manifest.bugs, { url: "https://github.com/kneelinghorse/OODS-Foundry/issues" }, "feedback uses public Issues");
  assert.deepEqual(manifest.repository, { type: "git", url: "git+https://github.com/kneelinghorse/OODS-Foundry.git", directory: "packages/foundry" }, "the package identifies its public source directory");
  // s221-m03 (the site's message 02e9ea2a): agentic-design-system is dropped; agent tooling is not the main thing (#2462).
  for (const keyword of ["mcp", "design-system", "react", "vue", "charts", "accessibility", "oods", "object-oriented-design-system", "chart-accessibility"]) {
    assert(manifest.keywords?.includes(keyword), `the package is missing its ${keyword} keyword`);
  }
  assert.equal(manifest.private, undefined, "the package is publishable; the review publishes it");
  assert.deepEqual(manifest.bin, { [name.installKey]: "bin/oods-foundry.js" });
  assert.equal(manifest.engines?.node, `>=${nodeFloor()}`, "the package declares the runtime's Node floor");
  assert.equal(manifest.mcpName, "com.oods-foundry/foundry", "npm metadata must match the prepared MCP registry identity");
  assert.deepEqual(manifest.files, ["bin/oods-foundry.js", "runtime/", "images/", "README.md", "TOOL-REFERENCE.md", "OBJECTS-AND-TRAITS.md", "BRANDS.md", "COMPONENTS.md", "QUICKSTART.md", "GENERATED-APPS.md", "quickstart/", "shadcn/", "skills/", "server.json", "facts.json", "errors.json", "CHANGELOG.md", "SECURITY.md", ...TERMS_FILES, "IMPORTING-OBJECTS.md", "object-hub.schema.json"]);
  assert(fs.existsSync(path.join(root, PACKAGE_DIR, "quickstart/team-components/mappings.json")), "the batch mapping example ships beside Harbor components");
  return manifest;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = { "--archive-dir": "archiveDir", "--out-dir": "outDir", "--work-dir": "workDir" }[argv[index]];
    assert(key && argv[index + 1], `usage: npm-package.mjs --archive-dir <dir> --out-dir <dir> --work-dir <dir>`);
    args[key] = path.resolve(argv[++index]);
  }
  assert(args.archiveDir && args.outDir && args.workDir, "--archive-dir, --out-dir and --work-dir are required");
  return args;
}

function assertNoFindings(label, findings) {
  assert.equal(findings.length, 0, `${label} refused:\n${findings.map((finding) => `${finding.rule} ${finding.path}: ${finding.detail}`).join("\n")}`);
}

export function buildPackage({ archiveDir, outDir, workDir }) {
  for (const [label, directory] of [["--out-dir", outDir], ["--work-dir", workDir]]) {
    fs.mkdirSync(directory, { recursive: true });
    assert.equal(fs.readdirSync(directory).length, 0, `${label} must be empty: ${directory}`);
  }
  const manifest = checkPackageManifest();
  // s239: the hub contract ships twice under one $id, beside IMPORTING-OBJECTS.md and in the runtime, where the importer
  // compiles it. 0.9.0 to 0.10.1 updated only the runtime copy, so the package published a contract the importer contradicted.
  assert(fs.readFileSync(path.join(REPO_ROOT, PACKAGE_DIR, "object-hub.schema.json")).equals(fs.readFileSync(path.join(REPO_ROOT, "schemas/import/object-hub.schema.json"))),
    "object-hub.schema.json beside IMPORTING-OBJECTS.md must be the hub contract the importer compiles, schemas/import/object-hub.schema.json");
  const archivePath = path.join(archiveDir, RUNTIME_ARCHIVE_FILE);
  const runtimeManifest = readJson(path.join(archiveDir, RUNTIME_MANIFEST_FILE));
  const digest = sha256(archivePath);
  assert.equal(runtimeManifest.archive?.sha256, digest, "the archive does not match its manifest");
  assert.equal(fs.readFileSync(path.join(archiveDir, RUNTIME_ARCHIVE_SHA256_FILE), "utf8"), `${digest}  ${RUNTIME_ARCHIVE_FILE}\n`);

  // Stage exactly what ships.
  const stage = path.join(workDir, "package");
  for (const source of PACKAGE_SOURCES) fs.cpSync(path.join(REPO_ROOT, PACKAGE_DIR, source), path.join(stage, source), { recursive: true });
  for (const terms of TERMS_FILES) fs.copyFileSync(path.join(REPO_ROOT, terms), path.join(stage, terms));
  fs.mkdirSync(path.join(stage, "runtime"));
  fs.copyFileSync(archivePath, path.join(stage, "runtime", RUNTIME_ARCHIVE_FILE));
  fs.copyFileSync(path.join(archiveDir, RUNTIME_MANIFEST_FILE), path.join(stage, "runtime", RUNTIME_MANIFEST_FILE));

  // Every file inside the archive, then the package's own files, its first-start answers among them.
  const owner = ownerFacts(REPO_ROOT);
  const cdnBase = `https://cdn.jsdelivr.net/npm/${manifest.name}@${manifest.version}/`;
  const unpacked = path.join(workDir, "unpacked");
  fs.mkdirSync(unpacked);
  const tar = spawnSync("tar", ["-xzf", archivePath, "-C", unpacked], { encoding: "utf8" });
  assert.equal(tar.status, 0, `tar could not unpack the archive: ${tar.stderr}`);
  assertNoFindings("archive contents", packageContentFindings(readTree(unpacked), { ...owner, receipts: runtimeReceipts() }));
  // s239: what this archive's server answers to initialize and tools/list, which the launcher answers while it unpacks.
  const firstStart = (args) => spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts/runtime/first-start.mjs"), ...args, "--runtime", unpacked], { encoding: "utf8" });
  const recorded = firstStart(["write", "--archive-sha256", digest, "--out", path.join(stage, "runtime", FIRST_START_FILE)]);
  assert.equal(recorded.status, 0, `the first-start answers could not be recorded: ${recorded.stderr}`);
  assertNoFindings("package contents", packageContentFindings(readTree(stage), { ...owner, cdnBase }));

  // Pack with a throwaway npm cache and empty user and global npm configuration (npm refuses one file for both).
  for (const config of ["npmrc-user", "npmrc-global"]) fs.writeFileSync(path.join(workDir, config), "");
  const env = { ...process.env, npm_config_cache: path.join(workDir, "npm-cache"), npm_config_userconfig: path.join(workDir, "npmrc-user"), npm_config_globalconfig: path.join(workDir, "npmrc-global"), npm_config_update_notifier: "false" };
  const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", outDir], { cwd: stage, env, encoding: "utf8" });
  assert.equal(packed.status, 0, `npm pack failed: ${packed.stderr}`);
  const [report] = JSON.parse(packed.stdout);
  const tarball = path.join(outDir, report.filename);
  const shipped = report.files.map((file) => file.path).sort();
  const staged = readTree(stage).map((entry) => entry.path).sort();
  assert.deepEqual(shipped, staged, "the tarball must hold exactly the staged files");
  // The release check, on the packed bytes: the answers it ships are what its archive's server answers.
  const checked = firstStart(["check", "--package", tarball]);
  assert.equal(checked.status, 0, `the packed first-start answers are not the server's: ${checked.stderr}`);
  return { tarball, sha256: sha256(tarball), size: fs.statSync(tarball).size, unpackedSize: report.unpackedSize, entryCount: report.entryCount,
    name: report.name, version: report.version, archiveSha256: digest, files: shipped, firstStart: JSON.parse(checked.stdout) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildPackage(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`npm-package: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
