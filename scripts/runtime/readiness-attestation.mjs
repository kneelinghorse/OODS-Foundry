import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { verifyReadinessRefs } from "../product-reality/verify-readiness-refs.mjs";

/** Run after pruning and package stamping, before deriving the release manifest. */
export async function assembleReadinessAttestation({ repositoryRoot, bundleRoot, sourceHead, generatedAt }) {
  const root = path.resolve(repositoryRoot);
  const payloadRoot = path.resolve(bundleRoot);
  sourceHead ??= execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.match(sourceHead, /^[a-f0-9]{40}$/, "Readiness source head must be a full commit hash.");
  generatedAt ??= execFileSync("git", ["show", "-s", "--format=%cI", sourceHead], { cwd: root, encoding: "utf8" }).trim();
  assert(Number.isFinite(Date.parse(generatedAt)), "Readiness generation date must be a source commit date.");
  const readiness = await import(pathToFileURL(path.join(root, "packages/mcp-server/dist/codegen/target-readiness.js")).href);
  const helpers = await import(pathToFileURL(path.join(root, "packages/mcp-server/dist/codegen/readiness-attestation.js")).href);
  // The independent AST oracle also checks named exports, so a comment or
  // obsolete truthy evidence flag cannot turn into a portable readiness claim.
  const oracle = verifyReadinessRefs(root, "s196-m02");
  assert.equal(oracle.status, "passed", `Source readiness verification failed: ${JSON.stringify(oracle.failures)}`);
  const documents = Object.fromEntries(Object.entries(helpers.READINESS_DOCUMENT_PATHS).map(([target, relative]) => {
    const sourceBytes = fs.readFileSync(path.join(root, relative));
    assert(sourceBytes.equals(fs.readFileSync(path.join(payloadRoot, relative))), `Shipped ${target} readiness differs from the host.`);
    return [target, JSON.parse(sourceBytes.toString("utf8"))];
  }));
  const sourceCache = new Map();
  for (const [target, document] of Object.entries(documents)) {
    for (const row of document.rows) {
      const failures = readiness.resolveReadinessRowReferences(row, { repositoryRoot: root }, sourceCache);
      assert.deepEqual(failures, [], `Unresolved ${target}/${row.componentId} readiness.`);
    }
  }
  const sourceHashes = new Map();
  const targets = Object.fromEntries(Object.entries(helpers.readinessAttestationClaims(documents, readiness.READINESS_EVIDENCE_CLASSES))
    .map(([target, { rows }]) => [target, {
      rows: rows.map(({ references, ...row }) => ({
        ...row,
        references: references.map((reference) => {
          const relative = reference.path;
          if (!sourceHashes.has(relative)) {
            sourceHashes.set(relative, helpers.readinessSha256(fs.readFileSync(path.join(root, relative))));
          }
          return { ...reference, sha256: sourceHashes.get(relative) };
        }),
      })),
    }]));
  const payload = {
    schemaVersion: "forge-readiness-attestation/v1",
    generatedAt,
    sourceHead,
    targets,
    shippedPackageHashes: helpers.shippedReadinessPackageFiles(payloadRoot),
  };
  const attestation = { ...payload, sha256: helpers.readinessSha256(helpers.readinessAttestationJson(payload)) };
  const destination = path.join(payloadRoot, helpers.READINESS_ATTESTATION_PATH);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, helpers.readinessAttestationJson(attestation), { flag: "wx", mode: 0o644 });
  assert.deepEqual(
    helpers.verifyReadinessAttestation(payloadRoot, documents, readiness.READINESS_EVIDENCE_CLASSES),
    { status: "verified" },
    "Generated readiness attestation did not verify against the shipped package bytes.",
  );
  return {
    path: helpers.READINESS_ATTESTATION_PATH,
    sha256: helpers.readinessSha256(fs.readFileSync(destination)),
    payloadSha256: attestation.sha256,
    generatedAt,
    sourceHead,
    targets: Object.fromEntries(Object.entries(targets).map(([target, { rows }]) => [target, { rows: rows.length, emissionEligible: rows.filter((row) => row.emissionEligible).length }])),
    references: Object.values(targets).flatMap(({ rows }) => rows.flatMap(({ references }) => references)).length,
    sourceFiles: sourceHashes.size,
    packageFiles: payload.shippedPackageHashes.length,
  };
}
