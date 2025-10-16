import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import type { BaseInput, GenericOutput } from './types.js';

export async function handle(input: BaseInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'vrt.run');
  const startedAt = new Date();
  const artifacts: string[] = [];

  if (input.apply) {
    const file = path.join(outDir, 'vrt-summary.json');
    if (!withinAllowed(policy.artifactsBase, file)) throw new Error('Path not allowed');
    fs.writeFileSync(file, JSON.stringify({ diffs: 0 }, null, 2));
    artifacts.push(file);
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'vrt.run',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);
  return { artifacts, transcriptPath, bundleIndexPath };
}
