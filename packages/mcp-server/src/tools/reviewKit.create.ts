import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import type { BaseInput, GenericOutput } from './types.js';

export async function handle(input: BaseInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'reviewKit.create');
  const startedAt = new Date();
  const artifacts: string[] = [];

  if (input.apply) {
    const file = path.join(outDir, 'review-kit.txt');
    if (!withinAllowed(policy.artifactsBase, file)) throw new Error('Path not allowed');
    fs.writeFileSync(file, 'Review kit placeholder');
    artifacts.push(file);
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'reviewKit.create',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);
  return { artifacts, transcriptPath, bundleIndexPath };
}
