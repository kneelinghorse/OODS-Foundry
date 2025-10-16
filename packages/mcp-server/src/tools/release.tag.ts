import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import { createRunDirectory, loadPolicy } from '../lib/security.js';
import { runCommand } from '@oods/release-utils';
import type { ReleaseTagInput, ReleaseTagResult } from './types.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '../../../..');
const TAG_PATTERN = /^v\d+\.\d+\.\d+-internal\.\d{8}$/i;

export async function handle(input: ReleaseTagInput): Promise<ReleaseTagResult> {
  if (!input || !input.tag || typeof input.tag !== 'string') {
    throw new Error('Tag is required.');
  }
  const tag = input.tag.trim();
  if (!TAG_PATTERN.test(tag)) {
    throw new Error(`Tag must follow pattern vX.Y.Z-internal.YYYYMMDD (received: ${tag}).`);
  }

  const policy = loadPolicy();
  const { runDir } = createRunDirectory(policy.artifactsBase, 'release.tag');
  const startedAt = new Date();

  const existing = await runCommand('git', ['tag', '--list', tag], { cwd: PROJECT_ROOT });
  const alreadyExists = existing.stdout.trim().length > 0;
  if (alreadyExists && input.apply) {
    throw new Error(`Tag ${tag} already exists.`);
  }

  const head = (await runCommand('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT })).stdout.trim();
  const status = await runCommand('git', ['status', '--porcelain'], { cwd: PROJECT_ROOT });
  const dirty = status.stdout.trim().length > 0;
  const warnings: string[] = [];
  if (dirty) {
    warnings.push('Working tree has uncommitted changes.');
  }
  if (alreadyExists) {
    warnings.push(`Tag ${tag} already exists.`);
  }

  let created = false;
  if (input.apply && !alreadyExists) {
    await runCommand('git', ['tag', tag], { cwd: PROJECT_ROOT });
    created = true;
  }

  const resultPath = path.join(runDir, 'tag.json');
  await fs.writeFile(
    resultPath,
    JSON.stringify(
      {
        tag,
        created,
        head,
        timestamp: startedAt.toISOString(),
        warnings,
      },
      null,
      2
    ),
    'utf8'
  );

  const artifacts = [resultPath];
  const transcriptPath = writeTranscript(runDir, {
    tool: 'release.tag',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });

  const transcriptRel = path.relative(runDir, transcriptPath) || 'transcript.json';
  const resultRel = path.relative(runDir, resultPath);

  const bundleIndexPath = writeBundleIndex(runDir, [
    transcriptRel,
    { path: resultRel, name: 'tag.json', purpose: 'Tag creation result' },
  ]);

  return {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    tag,
    created,
    warnings: warnings.length ? warnings : undefined,
  };
}
