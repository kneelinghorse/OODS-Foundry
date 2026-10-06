import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { CompositionVersion } from './store.js';

export interface RunInspection {
  runId: string;
  runPath: string;
  target: string;
  manifestSha256: string;
  recordId?: string;
  presentation?: 'stage1-inspection';
  evidence?: Array<{ locator: string; sha256: string }>;
  limits?: Array<{ kind: string; state: string; note: string }>;
}
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Check the pinned capture before navigation creates another view. */
export async function assertInspectionIdentity(run: RunInspection): Promise<void> {
  const root = await fs.realpath(run.runPath);
  const file = await fs.realpath(path.join(root, 'manifest.json'));
  if (path.dirname(file) !== root) throw new Error('Capture manifest escaped its run.');
  const bytes = await fs.readFile(file);
  if (hash(bytes) !== run.manifestSha256 || JSON.parse(bytes.toString('utf8')).run_id !== run.runId) throw new Error('Capture changed; open a fresh run view.');
}

/** Open only this detail's attested operand; recheck identity and bytes on every request. */
export async function readInspectionEvidence(record: CompositionVersion, locator: string): Promise<Buffer> {
  const run = record.runView;
  const attested = run?.evidence?.find(item => item.locator === locator);
  if (!run || !attested) throw new Error('Evidence is not attested for this selected record.');
  if (!locator || path.isAbsolute(locator) || locator.split(/[\\/]/).includes('..')) throw new Error('Evidence must remain inside the capture run.');
  const root = await fs.realpath(run.runPath);
  const confined = async (relative: string) => {
    const file = await fs.realpath(path.join(root, relative));
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Evidence must remain inside the capture run.');
    return fs.readFile(file);
  };
  const manifestBytes = await confined('manifest.json');
  if (hash(manifestBytes) !== run.manifestSha256) throw new Error('Capture manifest changed since this view was read.');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.run_id !== run.runId) throw new Error('Capture identity changed.');
  const expected = locator === 'manifest.json' ? run.manifestSha256 : manifest.hashes?.[locator];
  if (expected !== attested.sha256) throw new Error('Evidence no longer has the recorded attestation.');
  const bytes = await confined(locator);
  if (hash(bytes) !== expected) throw new Error('Evidence SHA-256 does not match the capture manifest.');
  return bytes;
}
