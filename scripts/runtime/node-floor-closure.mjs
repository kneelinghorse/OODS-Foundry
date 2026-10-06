#!/usr/bin/env node

// Every package the release archive ships accepts the Node floor the runtime declares (s206-m03).
//
// The floor comes from the first-party packages' engines (`nodeFloor`, the value install.md prints). A third-party
// package can raise the real floor without anyone noticing: Sprint 206 m02's @fastify/static 10.1.4 required
// content-disposition 3.0.0, which is ES-module-only and declares Node >= 22, so on the declared floor, 20.11.1, the
// preview host could not start while every E2E on Node 24 passed. This reads each shipped package's declared
// `engines.node` from the lockfile (the shipped closure is the bill of materials' own) and fails on any that excludes
// the floor, unless it is exempted below by exact version, with the reason nothing in the runtime loads it.
//
//   node scripts/runtime/node-floor-closure.mjs            # report
//   node scripts/runtime/node-floor-closure.mjs --check    # exit 1 on a violation

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import semver from "semver";
import { nodeFloor } from "./client-configs.mjs";
import { buildSbomLiteFromLock } from "./sbom-lite.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Shipped packages whose engines exclude the floor although the runtime never loads them, by exact version. */
export const NODE_FLOOR_EXEMPT = Object.freeze({
  "yargs@18.0.0": "only vega-lite's command-line scripts (bin/args.js) load it; the vega-lite library Forge imports never does",
  "yargs-parser@22.0.0": "yargs 18's argument parser, loaded by the same vega-lite command-line scripts only",
});

/** Each shipped package whose declared engines.node excludes `floor`, with its exemption when it has one. */
export function nodeFloorViolations({ shipped, lockPackages, floor, exempt = NODE_FLOOR_EXEMPT }) {
  const minimum = semver.coerce(floor);
  return shipped.flatMap(({ id }) => {
    const range = lockPackages[id]?.engines?.node;
    if (!range || semver.satisfies(minimum, range)) return [];
    return [{ id, engines: range, exemptBecause: exempt[id] ?? null }];
  });
}

export function checkRepositoryClosure(root = REPO_ROOT) {
  const lock = yaml.load(fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8"));
  const shipped = buildSbomLiteFromLock(lock).packages;
  const floor = nodeFloor();
  const violations = nodeFloorViolations({ shipped, lockPackages: lock.packages ?? {}, floor });
  return { floor, shipped: shipped.length, violations, blocking: violations.filter((violation) => !violation.exemptBecause) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkRepositoryClosure();
  console.log(JSON.stringify({ floor: result.floor, shipped: result.shipped, exempt: result.violations.filter((violation) => violation.exemptBecause).map((violation) => violation.id), blocking: result.blocking }));
  if (process.argv.includes("--check") && result.blocking.length) {
    for (const violation of result.blocking) console.error(`${violation.id} declares Node ${violation.engines}, which excludes the runtime floor ${result.floor}`);
    process.exitCode = 1;
  }
}
