#!/usr/bin/env node

import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { canonicalJson, PREVIEW_PLATFORMS, RUNTIME_PACKAGES, sha256 } from "./manifest.mjs";

function bytewiseCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function dependencyRef(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.version === "string")
    return value.version;
  throw new Error(
    `unsupported pnpm dependency reference: ${JSON.stringify(value)}`,
  );
}

function isWorkspaceReference(reference) {
  return /^(?:link:|workspace:|file:)/.test(reference);
}

function snapshotKeyFor(name, value) {
  const reference = dependencyRef(value);
  if (isWorkspaceReference(reference)) return null;
  if (reference.startsWith("npm:")) {
    const alias = reference.slice(4);
    return alias.split("(", 1)[0].includes("@")
      ? alias
      : `${name}@${alias}`;
  }
  if (reference.startsWith("/")) return reference.slice(1);
  // pnpm v9 records aliased transitive dependencies as real-name@version.
  if (reference.split("(", 1)[0].includes("@")) return reference;
  return `${name}@${reference}`;
}

function stripPeerContext(snapshotKey) {
  const contextStart = snapshotKey.indexOf("(");
  return contextStart < 0 ? snapshotKey : snapshotKey.slice(0, contextStart);
}

function splitPackageIdentity(baseKey) {
  const separator = baseKey.lastIndexOf("@");
  if (separator <= 0 || separator === baseKey.length - 1) {
    throw new Error(`cannot parse pnpm package identity: ${baseKey}`);
  }
  return {
    name: baseKey.slice(0, separator),
    version: baseKey.slice(separator + 1),
  };
}

function dependencyEntries(section) {
  return Object.entries(section ?? {}).sort(([left], [right]) =>
    bytewiseCompare(left, right),
  );
}

function resolvePackageRecord(lock, fullSnapshotKey) {
  const baseKey = stripPeerContext(fullSnapshotKey);
  const record = lock.packages?.[fullSnapshotKey] ?? lock.packages?.[baseKey];
  if (!record)
    throw new Error(`pnpm package metadata missing for ${fullSnapshotKey}`);
  return { baseKey, record };
}

export function buildSbomLiteFromLock(
  lock,
  { lockfileSha256, expectedCount } = {},
) {
  assert(
    lock && typeof lock === "object",
    "pnpm lockfile must parse as an object",
  );
  assert.equal(
    String(lock.lockfileVersion),
    "9.0",
    "portable runtime requires pnpm lockfile v9.0",
  );

  const importerPaths = RUNTIME_PACKAGES.map((name) => `packages/${name}`);
  for (const importerPath of importerPaths) {
    assert(
      lock.importers?.[importerPath],
      `pnpm importer is missing: ${importerPath}`,
    );
  }

  const queue = [];
  for (const importerPath of importerPaths) {
    const importer = lock.importers[importerPath];
    for (const [name, value] of [
      ...dependencyEntries(importer.dependencies),
    ]) {
      const key = snapshotKeyFor(name, value);
      if (key) queue.push(key);
    }
  }

  const visitedSnapshots = new Set();
  const normalizedPackages = new Map();
  let peerContextSnapshotCount = 0;

  while (queue.length > 0) {
    const snapshotKey = queue.shift();
    if (visitedSnapshots.has(snapshotKey)) continue;
    const snapshot = lock.snapshots?.[snapshotKey];
    if (!snapshot) throw new Error(`pnpm snapshot is missing: ${snapshotKey}`);
    visitedSnapshots.add(snapshotKey);
    if (snapshotKey.includes("(")) peerContextSnapshotCount += 1;

    const { baseKey, record } = resolvePackageRecord(lock, snapshotKey);
    const { name, version } = splitPackageIdentity(baseKey);
    const integrity = record.resolution?.integrity;
    if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) {
      throw new Error(`sha512 integrity missing for ${baseKey}`);
    }
    const existing = normalizedPackages.get(baseKey);
    if (existing && existing.integrity !== integrity) {
      throw new Error(`conflicting integrity values for ${baseKey}`);
    }
    normalizedPackages.set(baseKey, {
      id: baseKey,
      name,
      version,
      integrity,
      optional: record.optional === true,
      // pnpm's post-install lock keeps os but drops cpu, so the SBOM records one normalized
      // marker instead of the raw arrays and stays identical between the two locks.
      ...(Array.isArray(record.os) || Array.isArray(record.cpu) ? { platformSpecific: true } : {}),
    });

    const peerDependencyNames = new Set(
      Object.keys(record.peerDependencies ?? {}),
    );
    for (const [dependencyName, value] of [
      ...dependencyEntries(snapshot.dependencies),
    ]) {
      // pnpm injects peer resolutions into snapshot dependency maps. They are
      // requirements supplied by a consumer, not packages in this production
      // bundle, unless a runtime importer reaches them independently.
      if (peerDependencyNames.has(dependencyName)) continue;
      const dependencyKey = snapshotKeyFor(dependencyName, value);
      if (dependencyKey && !visitedSnapshots.has(dependencyKey))
        queue.push(dependencyKey);
    }
  }

  const packages = [...normalizedPackages.values()].sort((left, right) =>
    bytewiseCompare(left.id, right.id),
  );
  const optionalCount = packages.filter((entry) => entry.optional).length;
  const platformSpecificCount = packages.filter(
    (entry) => entry.platformSpecific,
  ).length;
  const integrityCount = packages.filter((entry) =>
    entry.integrity.startsWith("sha512-"),
  ).length;

  const measuredCount = expectedCount ?? packages.length;
  assert(measuredCount > 0, "runtime closure must not be empty");
  assert.equal(
    visitedSnapshots.size,
    measuredCount,
    `reachable pnpm snapshot count must be ${measuredCount}`,
  );
  assert.equal(
    packages.length,
    measuredCount,
    `normalized third-party package count must be ${measuredCount}`,
  );
  assert.equal(
    integrityCount,
    measuredCount,
    `sha512 integrity count must be ${measuredCount}`,
  );
  assert.equal(
    optionalCount,
    0,
    "portable runtime closure gained optional packages",
  );
  // Sprint 201: a closure that ships esbuild (the preview host) carries exactly its four binaries and nothing else platform-bound.
  if (packages.some((entry) => entry.name === "esbuild")) assert.deepEqual(
    packages.filter((entry) => entry.platformSpecific).map((entry) => entry.name).sort(bytewiseCompare),
    PREVIEW_PLATFORMS.map((platform) => `@esbuild/${platform}`).sort(bytewiseCompare),
    "portable runtime closure platform-specific packages must be the shipped esbuild binaries",
  );

  return {
    schemaVersion: "forge-runtime-sbom-lite/v1",
    label: "the bundle Forge built",
    packageManager: "pnpm@9.12.2",
    lockfileVersion: String(lock.lockfileVersion),
    source: {
      path: "pnpm-lock.yaml",
      sha256: lockfileSha256 ?? null,
      importers: importerPaths,
    },
    summary: {
      packageCount: packages.length,
      snapshotCount: visitedSnapshots.size,
      integrityCount,
      optionalCount,
      platformSpecificCount,
      peerContextSnapshotCount,
    },
    packages,
  };
}

export async function buildSbomLiteFromFile(lockfilePath, options = {}) {
  const lockfileBytes = await fsp.readFile(lockfilePath, "utf8");
  const lock = yaml.load(lockfileBytes);
  return buildSbomLiteFromLock(lock, {
    lockfileSha256: sha256(lockfileBytes),
    expectedCount: options.expectedCount,
  });
}

export async function buildSbomLite(repoRoot, options = {}) {
  const lockfilePath = path.join(path.resolve(repoRoot), "pnpm-lock.yaml");
  return buildSbomLiteFromFile(lockfilePath, options);
}

function parseArgs(argv) {
  const parsed = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (["--repo-root", "--out", "--expected-count"].includes(arg)) {
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
  const repoRoot = path.resolve(args.repo_root ?? process.cwd());
  const sbom = await buildSbomLite(repoRoot, {
    expectedCount: args.expected_count
      ? Number(args.expected_count)
      : undefined,
  });
  const bytes = canonicalJson(sbom);
  if (!args.out) {
    process.stdout.write(bytes);
    return;
  }
  const outPath = path.resolve(args.out);
  if (args.check) {
    const actual = await fsp.readFile(outPath, "utf8");
    assert.equal(actual, bytes, `${outPath} is stale`);
    process.stdout.write(`${outPath}: current\n`);
    return;
  }
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, bytes, {
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
      `sbom-lite: ${error.stack ?? error.message ?? String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
