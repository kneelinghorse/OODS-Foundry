import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import type { BaseInput, GenericOutput } from './types.js';

export async function handle(input: BaseInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'purity.audit');
  const startedAt = new Date();
  const artifacts: string[] = [];

  if (input.apply) {
    const file = path.join(outDir, 'purity-audit.json');
    if (!withinAllowed(policy.artifactsBase, file)) throw new Error('Path not allowed');
    fs.writeFileSync(file, JSON.stringify({ violations: 0, files: [] }, null, 2));
    artifacts.push(file);
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'purity.audit',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);
  return { artifacts, transcriptPath, bundleIndexPath };
}
