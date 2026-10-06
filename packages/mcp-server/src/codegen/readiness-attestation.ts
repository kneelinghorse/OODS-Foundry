import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { RUNTIME_MANIFEST_FILE } from '../lib/runtime-bundle.js';

import type { ReadinessEvidenceClass, TargetReadiness } from './target-readiness.js';

export const READINESS_ATTESTATION_PATH = 'packages/mcp-server/dist/registry/readiness-attestation.v1.json';
export const READINESS_DOCUMENT_PATHS = {
  react: 'packages/components-react/evidence/react-readiness.v1.json',
  vue: 'packages/components-vue/evidence/vue-readiness.v1.json',
} as const;

export type AttestedReadinessDocuments = Record<'react' | 'vue', TargetReadiness>;
type AttestedReadinessRow = {
  componentId: string;
  state: string;
  emissionEligible: boolean;
  references: Array<{
    class: ReadinessEvidenceClass;
    referenceClass: 'A' | 'B';
    path: string;
    ref: string;
    sha256: string;
  }>;
};
export type ReadinessAttestation = {
  schemaVersion: 'forge-readiness-attestation/v1';
  generatedAt: string;
  sourceHead: string;
  targets: Record<'react' | 'vue', { rows: AttestedReadinessRow[] }>;
  shippedPackageHashes: Array<{ path: string; sha256: string }>;
  sha256: string;
};

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
}

export function readinessAttestationJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

export function readinessSha256(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Bind all first-party package bytes, excluding only dependencies, this seal, and the runtime state the server writes
 * beside itself: `.oods/` is its default schema, composition and payload store (packages/mcp-server/.oods). Counting
 * that store as shipped bytes made the first design.preview of every default install refuse its own generation with
 * OODS-N015 attestation-invalid, because the preview stores its composition before it generates (s206-m03).
 */
export function shippedReadinessPackageFiles(root: string): ReadinessAttestation['shippedPackageHashes'] {
  const files: ReadinessAttestation['shippedPackageHashes'] = [];
  function visit(relative: string): void {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const entryPath = `${relative}/${entry.name}`;
      if (entry.name === 'node_modules') continue;
      if (entryPath === 'packages/mcp-server/.oods' && entry.isDirectory()) continue;
      if (entryPath === READINESS_ATTESTATION_PATH) continue;
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) {
        files.push({ path: entryPath, sha256: readinessSha256(readFileSync(path.join(root, entryPath))) });
      } else {
        throw new Error(`Readiness package binding requires regular files: ${entryPath}`);
      }
    }
  }
  visit('packages');
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const packageName of ['component-contracts', 'components-react', 'components-vue']) {
    if (!files.some((file) => file.path === `packages/${packageName}/package.json`)
      || !files.some((file) => file.path.startsWith(`packages/${packageName}/dist/`))) {
      throw new Error(`Readiness package binding is missing ${packageName} manifest or dist.`);
    }
  }
  return files;
}

/** The host and bundle must assert exactly the same rows and six evidence classes. */
export function readinessAttestationClaims(
  documents: AttestedReadinessDocuments,
  evidenceClasses: readonly ReadinessEvidenceClass[],
) {
  const targetClaims = (target: 'react' | 'vue') => {
    const document = documents[target];
    if (document.target !== target || document.rows.length === 0
      || new Set(document.rows.map((row) => row.componentId)).size !== document.rows.length) {
      throw new Error(`Invalid ${target} readiness rows.`);
    }
    return {
      rows: document.rows.map((row) => ({
        componentId: row.componentId,
        state: row.state,
        emissionEligible: row.emissionEligible,
        references: evidenceClasses.flatMap((evidenceClass) => {
          const evidence = row.evidence?.[evidenceClass];
          if (evidence?.status !== 'passed' || !Array.isArray(evidence.refs) || evidence.refs.length === 0) {
            throw new Error(`Unresolved ${target}/${row.componentId}/${evidenceClass} evidence.`);
          }
          return evidence.refs.map((ref) => ({
            class: evidenceClass,
            referenceClass: evidenceClass === 'publicDeclaration' ? 'B' as const : 'A' as const,
            path: ref.slice(0, ref.lastIndexOf('#')),
            ref,
          }));
        }),
      })),
    };
  };
  return { react: targetClaims('react'), vue: targetClaims('vue') };
}

export type ReadinessAttestationVerification =
  | { status: 'absent' }
  | { status: 'verified' }
  | { status: 'invalid'; reason: string };

/** An attestation is an integrity receipt; archive authenticity remains the release manifest's job. */
export function verifyReadinessAttestation(
  root: string,
  documents: AttestedReadinessDocuments,
  evidenceClasses: readonly ReadinessEvidenceClass[],
): ReadinessAttestationVerification {
  const attestationPath = path.join(root, READINESS_ATTESTATION_PATH);
  if (!existsSync(attestationPath)) return { status: 'absent' };
  try {
    const attestation = JSON.parse(readFileSync(attestationPath, 'utf8')) as ReadinessAttestation;
    const { sha256, ...payload } = attestation;
    if (payload.schemaVersion !== 'forge-readiness-attestation/v1'
      || !/^[a-f0-9]{40}$/.test(payload.sourceHead)
      || !Number.isFinite(Date.parse(payload.generatedAt))
      || sha256 !== readinessSha256(readinessAttestationJson(payload))) {
      throw new Error('Readiness attestation digest or version does not match.');
    }
    const manifestPath = path.join(root, RUNTIME_MANIFEST_FILE);
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { commit?: string };
      if (manifest.commit !== payload.sourceHead) throw new Error('Readiness source head does not match the release manifest.');
    }
    const attestedClaims = Object.fromEntries(Object.entries(attestation.targets).map(([target, { rows }]) => [target, {
      rows: rows.map(({ references, ...row }) => ({
        ...row,
        references: references.map(({ sha256: referenceHash, ...reference }) => {
          if (!/^[a-f0-9]{64}$/.test(referenceHash)) throw new Error('Invalid readiness reference hash.');
          const separator = reference.ref.lastIndexOf('#');
          const relative = reference.ref.slice(0, separator);
          if (reference.path !== relative || separator <= 0 || separator === reference.ref.length - 1 || relative.includes('\\')
            || path.isAbsolute(relative) || relative.split('/').some((part) => ['', '.', '..'].includes(part))) {
            throw new Error('Invalid readiness reference path.');
          }
          // Shipped declarations and any available host source still have to
          // match their attested bytes. Source/test absence is intentional.
          const referencePath = path.join(root, relative);
          if (existsSync(referencePath) && readinessSha256(readFileSync(referencePath)) !== referenceHash) {
            throw new Error(`Readiness reference hash does not match: ${reference.ref}`);
          }
          return reference;
        }),
      })),
    }]));
    if (readinessAttestationJson(attestedClaims)
      !== readinessAttestationJson(readinessAttestationClaims(documents, evidenceClasses))) {
      throw new Error('Readiness attestation claims do not match the target documents.');
    }
    if (readinessAttestationJson(attestation.shippedPackageHashes)
      !== readinessAttestationJson(shippedReadinessPackageFiles(root))) {
      throw new Error('Readiness attestation does not match the shipped package bytes.');
    }
    return { status: 'verified' };
  } catch (error) {
    return { status: 'invalid', reason: error instanceof Error ? error.message : String(error) };
  }
}
