/**
 * s223-m03 (#2527 ruling 17; the website's message 2b348bfa, ask 4): what each of health's measurements was made on.
 * scripts/product-reality/s223-measured-on.ts reads, from git, the release version each proof's head declared and writes
 * registry/measured-on.v1.json; the shipped runtime has no git, so health reads that file. A stamp counts only for the head
 * its block reports: when a ledger moves without the stamps being regenerated, the block reports measuredOn null and health
 * says so, rather than naming a version the proof was not run on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MeasuredOn {
  version: string;
  sourceHead: string;
  archiveSha256: string | null;
}
export type MeasuredBlock = 'runtime' | 'release' | 'tools' | 'html' | 'fidelity';
type MeasuredOnRegistry = { schema: 'oods-measured-on/v1'; blocks: Record<MeasuredBlock, { head: string; measuredOn: MeasuredOn }> };

const BLOCKS: readonly MeasuredBlock[] = ['runtime', 'release', 'tools', 'html', 'fidelity'];
const HEX40 = /^[0-9a-f]{40}$/;

function registryPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = path.resolve(here, '../../registry/measured-on.v1.json');
  const shipped = path.resolve(here, '../registry/measured-on.v1.json');
  return process.env.MCP_MEASURED_ON_PATH ?? (fs.existsSync(source) ? source : shipped);
}

/** The validated stamps; throws when the file is missing or malformed. */
export function readMeasuredOn(): MeasuredOnRegistry['blocks'] {
  const registry = JSON.parse(fs.readFileSync(registryPath(), 'utf8')) as MeasuredOnRegistry;
  if (registry.schema !== 'oods-measured-on/v1') throw new Error(`measured-on registry has schema ${String(registry.schema)}`);
  for (const block of BLOCKS) {
    const entry = registry.blocks?.[block];
    const on = entry?.measuredOn;
    if (!entry || !HEX40.test(entry.head) || !on || on.sourceHead !== entry.head || !/^\d+\.\d+\.\d+$/.test(on.version)
      || !(on.archiveSha256 === null || /^[0-9a-f]{64}$/.test(on.archiveSha256))) throw new Error(`measured-on registry: invalid ${block} stamp`);
  }
  return registry.blocks;
}

/** A block's stamp, when it was written for one of the heads the block reports; null (with a warning) otherwise. */
export function measuredOnFor(blocks: MeasuredOnRegistry['blocks'] | null, block: MeasuredBlock, heads: readonly (string | null | undefined)[], warnings: string[]): MeasuredOn | null {
  const entry = blocks?.[block];
  if (!entry) return null;
  if (!heads.includes(entry.head)) {
    warnings.push(`${block} proof's measuredOn stamp names ${entry.head.slice(0, 10)}, not the head the proof reports; regenerate registry/measured-on.v1.json`);
    return null;
  }
  return { ...entry.measuredOn };
}
