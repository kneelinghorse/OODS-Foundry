#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The archive is named from the product's one name source (s211-m03, #2296): configs/product/name.json.
const ARCHIVE_BASE = JSON.parse(fs.readFileSync(new URL("../../configs/product/name.json", import.meta.url), "utf8")).archiveBase;
export const RUNTIME_MANIFEST_FILE = `${ARCHIVE_BASE}.manifest.json`;
export const RUNTIME_SBOM_FILE = "runtime-sbom-lite.json";
export const RUNTIME_ARCHIVE_FILE = `${ARCHIVE_BASE}.tar.gz`;
export const RUNTIME_ARCHIVE_SHA256_FILE = `${RUNTIME_ARCHIVE_FILE}.sha256`;
export const TREE_DIGEST_ALGORITHM = "sha256:path-type-mode-size-content-v1";
// The terms travel with the archive at its root: the license, its NOTICE and the
// generated third-party notices. scripts/pkg/build.ts ships the same three beside dist/pkg.
export const TERMS_FILES = Object.freeze([
  "LICENSE",
  "NOTICE",
  "THIRD-PARTY-NOTICES.md",
]);
// The only token source that ships: the per-brand DTCG documents brand.apply reads.
export const BRAND_SOURCE_PATH = "packages/tokens/src/tokens/brands";

// The preview host compiles generated artifacts with esbuild; these four platform binaries ship
// as plain dependencies of @oods/mcp-bridge (the closure installs without optional packages).
export const PREVIEW_PLATFORMS = Object.freeze([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
]);
export const PREVIEW_RUNTIME_MANIFEST = "packages/mcp-bridge/dist/preview-runtime/manifest.json";

export const RUNTIME_PACKAGES = Object.freeze([
  "mcp-server",
  "mcp-adapter",
  "mcp-bridge",
  "tokens",
  "viz-core",
  "viz-render",
  "a11y-tools",
  "artifacts",
  "release-utils",
  "component-contracts",
  "component-styles",
  "components-react",
  "components-vue",
]);

function bytewiseCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelative(filePath) {
  return filePath.split(path.sep).join("/");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort(bytewiseCompare)) {
      sorted[key] = stableSort(value[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function walkTree(root, options = {}) {
  // Canonicalize the root before comparing resolved symlink targets. On macOS,
  // /tmp is itself a symlink to /private/tmp; comparing a real target against
  // the merely lexical root would reject valid pnpm links that remain inside
  // the payload.
  const absoluteRoot = await fsp.realpath(path.resolve(root));
  const exclude = new Set(
    [...(options.exclude ?? [])].map((entry) =>
      normalizeRelative(entry).replace(/^\.\//, ""),
    ),
  );
  const entries = [];

  async function visit(directory, relativeDirectory) {
    const names = await fsp.readdir(directory);
    names.sort(bytewiseCompare);
    for (const name of names) {
      const absolute = path.join(directory, name);
      const relative = normalizeRelative(path.join(relativeDirectory, name));
      if (exclude.has(relative)) continue;
      const stat = await fsp.lstat(absolute);
      if (stat.isDirectory()) {
        entries.push({
          absolute,
          relative,
          type: "directory",
          mode: stat.mode & 0o777,
        });
        await visit(absolute, path.join(relativeDirectory, name));
      } else if (stat.isFile()) {
        entries.push({
          absolute,
          relative,
          type: "file",
          mode: stat.mode & 0o777,
          size: stat.size,
        });
      } else if (stat.isSymbolicLink()) {
        const target = await fsp.readlink(absolute);
        assert(
          !path.isAbsolute(target),
          `absolute symlink rejected: ${relative} -> ${target}`,
        );
        const lexicalTarget = path.resolve(path.dirname(absolute), target);
        assert(
          isInside(absoluteRoot, lexicalTarget),
          `escaping symlink rejected: ${relative} -> ${target}`,
        );
        const realTarget = await fsp.realpath(lexicalTarget).catch(() => null);
        assert(
          realTarget,
          `dangling symlink rejected: ${relative} -> ${target}`,
        );
        assert(
          isInside(absoluteRoot, realTarget),
          `transitively escaping symlink rejected: ${relative} -> ${target}`,
        );
        entries.push({
          absolute,
          relative,
          type: "symlink",
          mode: stat.mode & 0o777,
          target,
        });
      } else {
        throw new Error(`unsupported filesystem entry: ${relative}`);
      }
    }
  }

  await visit(absoluteRoot, "");
  return entries;
}

export async function treeDigest(root, options = {}) {
  const hash = crypto.createHash("sha256");
  const entries = await walkTree(root, options);
  for (const entry of entries) {
    if (entry.type === "directory") {
      hash.update(`d\0${entry.relative}\0${entry.mode.toString(8)}\0`);
    } else if (entry.type === "symlink") {
      hash.update(`l\0${entry.relative}\0${entry.target}\0`);
    } else {
      hash.update(
        `f\0${entry.relative}\0${entry.mode.toString(8)}\0${entry.size}\0`,
      );
      for await (const chunk of fs.createReadStream(entry.absolute))
        hash.update(chunk);
      hash.update("\0");
    }
  }
  return {
    algorithm: TREE_DIGEST_ALGORITHM,
    sha256: hash.digest("hex"),
    entryCount: entries.length,
  };
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} failed (${code ?? signal ?? "unknown"}): ${stderr.trim()}`,
          ),
        );
    });
  });
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

function parseMinimumNodeVersion(range, packageName) {
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (!match)
    throw new Error(
      `unsupported engines.node range for ${packageName}: ${range}`,
    );
  return { range, tuple: match.slice(1).map(Number) };
}

function compareVersionTuple(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

async function gitIdentity(repoRoot) {
  const commit = (
    await runCapture("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
  ).trim();
  const date = (
    await runCapture("git", ["show", "-s", "--format=%cI", "HEAD"], {
      cwd: repoRoot,
    })
  ).trim();
  const epochText = (
    await runCapture("git", ["show", "-s", "--format=%ct", "HEAD"], {
      cwd: repoRoot,
    })
  ).trim();
  const status = await runCapture(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repoRoot },
  );
  return {
    commit,
    date,
    sourceDateEpoch: Number(epochText),
    dirty: status.length > 0,
    dirtyStatusSha256: status.length > 0 ? sha256(status) : null,
  };
}

export async function buildRuntimeManifest({
  repoRoot,
  payloadRoot,
  sbom,
  final = false,
  archiveSha256File = RUNTIME_ARCHIVE_SHA256_FILE,
  archivePacking = { method: "unspecified", determinismCertified: false },
  packageTarballs = undefined,
}) {
  const sourceRoot = path.resolve(repoRoot);
  const runtimeRoot = path.resolve(payloadRoot);
  const git = await gitIdentity(sourceRoot);
  if (final && git.dirty) {
    throw new Error(
      "final portable-runtime assembly requires a clean git worktree",
    );
  }

  assert(Number.isInteger(sbom?.summary?.packageCount) && sbom.summary.packageCount > 0,
    "SBOM-lite must measure a non-empty runtime closure");
  assert.equal(sbom.summary.integrityCount, sbom.summary.packageCount,
    "every runtime dependency must have integrity metadata");

  const packageVersions = {};
  const nodeRanges = [];
  for (const packageDirectory of RUNTIME_PACKAGES) {
    const packagePath = path.join(
      runtimeRoot,
      "packages",
      packageDirectory,
      "package.json",
    );
    const packageJson = await readJson(packagePath);
    assert.equal(
      typeof packageJson.name,
      "string",
      `${packageDirectory} package name is missing`,
    );
    assert.equal(
      typeof packageJson.version,
      "string",
      `${packageDirectory} package version is missing`,
    );
    packageVersions[packageJson.name] = packageJson.version;
    if (packageJson.engines?.node) {
      nodeRanges.push(
        parseMinimumNodeVersion(packageJson.engines.node, packageJson.name),
      );
    }
  }
  nodeRanges.sort((left, right) =>
    compareVersionTuple(left.tuple, right.tuple),
  );
  const nodeFloor = nodeRanges.at(-1)?.range;
  assert.equal(nodeFloor, ">=22.0.0", "effective runtime Node floor drifted");

  const registryPath = path.join(
    runtimeRoot,
    "packages/mcp-server/dist/tools/registry.json",
  );
  const registry = await readJson(registryPath);
  const structuredDataManifestPath = path.join(
    runtimeRoot,
    "artifacts/structured-data/manifest.json",
  );
  const sourceTokensPath = path.join(sourceRoot, "packages/tokens/dist");
  const shippedTokensPath = path.join(runtimeRoot, "packages/tokens/dist");
  const payload = await treeDigest(runtimeRoot, {
    exclude: [RUNTIME_MANIFEST_FILE],
  });
  const sourceTokens = await treeDigest(sourceTokensPath);
  const shippedTokens = await treeDigest(shippedTokensPath);
  const brandSource = await treeDigest(path.join(runtimeRoot, BRAND_SOURCE_PATH));
  const sourceBrandSource = await treeDigest(
    path.join(sourceRoot, BRAND_SOURCE_PATH),
  );
  assert.deepEqual(
    brandSource,
    sourceBrandSource,
    "shipped brand source differs from the repository brand source",
  );
  assert(brandSource.entryCount > 0, "shipped brand source tree is empty");
  const terms = [];
  for (const file of TERMS_FILES) {
    terms.push({
      path: file,
      sha256: await sha256File(path.join(runtimeRoot, file)),
    });
  }

  return {
    schemaVersion: "forge-runtime-manifest/v1",
    commit: git.commit,
    date: git.date,
    sourceDateEpoch: git.sourceDateEpoch,
    dirty: git.dirty,
    dirtyStatusSha256: git.dirtyStatusSha256,
    layout: "packages/*",
    nodeFloor,
    ciNode: 24,
    ciNodes: [24, "22.0.0"],
    thirdPartyCount: sbom.summary.packageCount,
    packageVersions,
    ...(packageTarballs ? { packageTarballs: libraryTarballs(packageTarballs, packageVersions) } : {}),
    registry: {
      path: "packages/mcp-server/dist/tools/registry.json",
      sha256: await sha256File(registryPath),
      autoCount: Array.isArray(registry.auto) ? registry.auto.length : 0,
      onDemandCount: Array.isArray(registry.onDemand)
        ? registry.onDemand.length
        : 0,
    },
    tokensSourceTree: {
      path: "packages/tokens/dist",
      ...sourceTokens,
    },
    tokensShippedTree: {
      path: "packages/tokens/dist",
      ...shippedTokens,
    },
    brandSourceTree: {
      path: BRAND_SOURCE_PATH,
      ...brandSource,
    },
    terms,
    structuredDataManifest: {
      path: "artifacts/structured-data/manifest.json",
      sha256: await sha256File(structuredDataManifestPath),
    },
    sbomLite: {
      path: RUNTIME_SBOM_FILE,
      sha256: sha256(canonicalJson(sbom)),
      packageCount: sbom.summary.packageCount,
    },
    payloadTreeSha256: payload.sha256,
    payloadTreeEntryCount: payload.entryCount,
    payloadTreeDigestAlgorithm: payload.algorithm,
    archiveSha256File,
    archivePacking,
  };
}

/**
 * s223-m03 (#2527 ruling 15; the website's message 2b348bfa, ask 2): the published libraries' tarball SHA-256, beside the
 * versions packageVersions pins (that map keeps its string values: e2e.mjs reads them). The freeze packs the five
 * libraries before it assembles the archive, so a reader can pack them from npm and compare. Exactly the five, each at
 * the version the runtime pins, sorted by name.
 */
export const PUBLISHED_LIBRARIES = Object.freeze(["@oods/component-contracts", "@oods/component-styles", "@oods/components-react", "@oods/components-vue", "@oods/tokens"]);
export function libraryTarballs(records, packageVersions) {
  const byName = new Map(records.map((record) => [record.name, record]));
  assert.deepEqual([...byName.keys()].sort(), [...PUBLISHED_LIBRARIES], "packageTarballs names exactly the five published libraries");
  return Object.fromEntries(PUBLISHED_LIBRARIES.map((name) => {
    const { version, sha256 } = byName.get(name);
    assert.equal(version, packageVersions[name], `${name}'s tarball is not the version the runtime pins`);
    assert.match(sha256, /^[0-9a-f]{64}$/, `${name}'s tarball SHA-256`);
    return [name, { version, sha256 }];
  }));
}

export async function verifyEmbeddedManifest(payloadRoot) {
  const runtimeRoot = path.resolve(payloadRoot);
  const manifestPath = path.join(runtimeRoot, RUNTIME_MANIFEST_FILE);
  const manifestBytes = await fsp.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, "forge-runtime-manifest/v1");
  assert.equal(manifest.archiveSha256File, RUNTIME_ARCHIVE_SHA256_FILE);
  assert.equal(typeof manifest.archivePacking?.method, "string");
  assert.equal(typeof manifest.archivePacking?.determinismCertified, "boolean");
  assert.equal(manifest.payloadTreeDigestAlgorithm, TREE_DIGEST_ALGORITHM);
  const payload = await treeDigest(runtimeRoot, {
    exclude: [RUNTIME_MANIFEST_FILE],
  });
  assert.equal(
    payload.sha256,
    manifest.payloadTreeSha256,
    "embedded payload tree digest mismatch",
  );
  assert.equal(
    payload.entryCount,
    manifest.payloadTreeEntryCount,
    "embedded payload tree entry count mismatch",
  );
  const sbomPath = path.join(runtimeRoot, RUNTIME_SBOM_FILE);
  assert.equal(
    await sha256File(sbomPath),
    manifest.sbomLite.sha256,
    "embedded SBOM-lite digest mismatch",
  );
  const registryPath = path.join(runtimeRoot, manifest.registry.path);
  assert.equal(
    await sha256File(registryPath),
    manifest.registry.sha256,
    "embedded registry digest mismatch",
  );
  const structuredPath = path.join(
    runtimeRoot,
    manifest.structuredDataManifest.path,
  );
  assert.equal(
    await sha256File(structuredPath),
    manifest.structuredDataManifest.sha256,
    "structured-data manifest digest mismatch",
  );
  const shippedTokens = await treeDigest(
    path.join(runtimeRoot, manifest.tokensShippedTree.path),
  );
  assert.deepEqual(
    shippedTokens,
    {
      algorithm: manifest.tokensShippedTree.algorithm,
      sha256: manifest.tokensShippedTree.sha256,
      entryCount: manifest.tokensShippedTree.entryCount,
    },
    "shipped token tree digest mismatch",
  );
  assert.equal(
    manifest.brandSourceTree?.path,
    BRAND_SOURCE_PATH,
    "brand source path drifted",
  );
  const brandSource = await treeDigest(
    path.join(runtimeRoot, manifest.brandSourceTree.path),
  );
  assert.deepEqual(
    brandSource,
    {
      algorithm: manifest.brandSourceTree.algorithm,
      sha256: manifest.brandSourceTree.sha256,
      entryCount: manifest.brandSourceTree.entryCount,
    },
    "shipped brand source digest mismatch",
  );
  assert.deepEqual(
    (manifest.terms ?? []).map((entry) => entry.path),
    [...TERMS_FILES],
    "terms roster drifted",
  );
  for (const entry of manifest.terms) {
    assert.equal(
      await sha256File(path.join(runtimeRoot, entry.path)),
      entry.sha256,
      `${entry.path} digest mismatch`,
    );
  }
  return { manifest, manifestBytes, payload };
}

function parseArgs(argv) {
  const parsed = { final: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--final") parsed.final = true;
    else if (arg === "--check") parsed.check = true;
    else if (
      [
        "--repo-root",
        "--payload-root",
        "--sbom",
        "--out",
        "--archive-sha256-file",
      ].includes(arg)
    ) {
      const value = argv[++index];
      if (!value) throw new Error(`missing value for ${arg}`);
      parsed[arg.slice(2).replaceAll("-", "_")] = value;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo_root || !args.payload_root) {
    throw new Error(
      "usage: manifest.mjs --repo-root <dir> --payload-root <dir> [--sbom <file>] [--out <file>] [--check] [--final]",
    );
  }
  const sbomPath = path.resolve(
    args.sbom ?? path.join(args.payload_root, RUNTIME_SBOM_FILE),
  );
  const outPath = path.resolve(
    args.out ?? path.join(args.payload_root, RUNTIME_MANIFEST_FILE),
  );
  const sbom = await readJson(sbomPath);
  const currentManifest = args.check ? await readJson(outPath) : null;
  const manifest = await buildRuntimeManifest({
    repoRoot: args.repo_root,
    payloadRoot: args.payload_root,
    sbom,
    final: args.final,
    archiveSha256File: args.archive_sha256_file ?? RUNTIME_ARCHIVE_SHA256_FILE,
    archivePacking: currentManifest?.archivePacking,
  });
  // Archive facts live in the detached manifest: embedding an archive's own
  // digest/byte size would create a self-reference.
  if (currentManifest?.archive) {
    const archivePath = path.join(path.dirname(outPath), RUNTIME_ARCHIVE_FILE);
    manifest.archive = {
      file: RUNTIME_ARCHIVE_FILE,
      byteSize: (await fsp.stat(archivePath)).size,
      sha256: await sha256File(archivePath),
    };
  }
  const expected = canonicalJson(manifest);
  if (args.check) {
    const actual = await fsp.readFile(outPath, "utf8");
    assert.equal(actual, expected, `${outPath} is stale`);
    process.stdout.write(`${outPath}: current\n`);
    return;
  }
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, expected, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644,
  });
  process.stdout.write(`${outPath}\n`);
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    process.stderr.write(
      `manifest: ${error.stack ?? error.message ?? String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
