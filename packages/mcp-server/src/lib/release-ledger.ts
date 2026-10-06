import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXTS, FRAMEWORKS, summarize, validateRuntimeLedger, type RuntimeCell, type RuntimeLedger } from './runtime-ledger.js';

export const RELEASE_OBJECTS = ['Organization', 'Subscription', 'User'] as const;
export type ReleaseCell = RuntimeCell & {
  bundleHead: string;
  archiveSha256: string;
  hostArtifactHash: string | null;
  hashEqualToHost: boolean;
};
export type ReleaseLedger = Omit<RuntimeLedger, 'head' | 'rows'> & {
  bundleHead: string;
  archiveSha256: string;
  rows: ReleaseCell[];
};
export type ReleaseSummary = RuntimeLedger['summary'] & {
  bundleHead: string;
  archiveSha256: string;
  apps: typeof RELEASE_OBJECTS;
  frameworks: typeof FRAMEWORKS;
};

/** A release claim needs the same browser gates as host runtime proof and exact artifact parity. */
export function validateReleaseLedger(ledger: ReleaseLedger): string[] {
  if (!ledger || ledger.schemaVersion !== '1.0.0' || !Array.isArray(ledger.rows) || ledger.rows.some(row => !row || !Array.isArray(row.gates) || !Array.isArray(row.components))) return ['release ledger identity or rows malformed'];
  const identities = RELEASE_OBJECTS.flatMap(object => [...CONTEXTS, 'workflow'].flatMap(context => FRAMEWORKS.map(framework => `${object}/${context}/${framework}`)));
  const issues = validateRuntimeLedger({ ...ledger, head: ledger.bundleHead }, true, identities);
  if (!/^[0-9a-f]{40}$/.test(ledger.bundleHead) || !/^[0-9a-f]{64}$/.test(ledger.archiveSha256) || typeof ledger.runId !== 'string' || !ledger.runId) issues.push('release bundle provenance is malformed');
  for (const row of ledger.rows) {
    const id = `${row.object}/${row.context}/${row.framework}`;
    if (row.bundleHead !== ledger.bundleHead || row.archiveSha256 !== ledger.archiveSha256) issues.push(`${id} belongs to a different release bundle`);
    if (row.status === 'pass' && (!/^sha256:[0-9a-f]{64}$/.test(row.artifactHash ?? '') || row.hostArtifactHash !== row.artifactHash || row.hashEqualToHost !== true)) issues.push(`${id} differs from the host artifact or lacks hash equality proof`);
    const generation = row.gates.find(gate => gate.name === 'generation')?.detail as { artifactHash?: string } | undefined;
    if (row.status === 'pass' && generation?.artifactHash !== row.artifactHash) issues.push(`${id} is not bound to its generation gate artifact`);
    if (row.status === 'typed-gap') {
      if (row.framework === 'react' || row.object === 'Subscription') issues.push(`${id} is required to execute and cannot be carried as a gap`);
      if (row.artifactHash !== null || row.hostArtifactHash !== null || row.hashEqualToHost !== false) issues.push(`${id} must not claim artifact equality without generation`);
    }
  }
  return issues;
}

export function projectReleaseSummary(value: unknown): ReleaseSummary {
  const ledger = value as ReleaseLedger;
  const issues = validateReleaseLedger(ledger);
  if (issues.length) throw new Error(`Release ledger rejected: ${issues.join('; ')}`);
  return { bundleHead: ledger.bundleHead, archiveSha256: ledger.archiveSha256, apps: RELEASE_OBJECTS, frameworks: FRAMEWORKS, ...summarize(ledger.rows) };
}

export function readReleaseSummary(): ReleaseSummary {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const canonical = path.resolve(directory, '../../registry/release-cells.v1.json');
  const shipped = path.resolve(directory, '../registry/release-cells.v1.json');
  const file = process.env.MCP_RELEASE_CELLS_PATH ?? (fs.existsSync(canonical) ? canonical : shipped);
  return projectReleaseSummary(JSON.parse(fs.readFileSync(file, 'utf8')));
}
