import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll } from 'vitest';
import type { CodegenReleaseEvidenceItem } from '../../src/codegen/types.js';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-release-evidence-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
/** Real evidence bytes keep release tests on the same file/hash/status boundary as callers. */
export function passedEvidence(artifactContentHash: string, label: string): CodegenReleaseEvidenceItem {
  const bytes = JSON.stringify({ status: 'passed', artifactContentHash });
  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const reference = path.join(directory, `${label.replace(/[^a-z0-9]/gi, '-')}-${contentHash.slice(7)}.json`);
  fs.writeFileSync(reference, bytes);
  return { status: 'passed', artifactContentHash, reference, contentHash };
}
