import path from 'node:path';
import fs from 'node:fs/promises';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
  createHarnessResults,
  writeResults,
  type PerformanceHarnessResults,
  type PerformanceSnapshot,
} from './schema';
import schema from '../../../diagnostics/performance-harness.schema.json' assert { type: 'json' };

const GLOBAL_SNAPSHOT_KEY = '__PERF_SNAPSHOT_STORE__';

type GlobalWithSnapshotStore = typeof globalThis & {
  [GLOBAL_SNAPSHOT_KEY]?: PerformanceSnapshot[];
};

const globalWithStore = globalThis as GlobalWithSnapshotStore;
const snapshotStore: PerformanceSnapshot[] =
  globalWithStore[GLOBAL_SNAPSHOT_KEY] ?? [];

if (!globalWithStore[GLOBAL_SNAPSHOT_KEY]) {
  globalWithStore[GLOBAL_SNAPSHOT_KEY] = snapshotStore;
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateResults = ajv.compile<PerformanceHarnessResults>(schema);

export async function recordSnapshot(snapshot: PerformanceSnapshot): Promise<void> {
  snapshotStore.push(snapshot);
}

export function getSnapshots(): PerformanceSnapshot[] {
  return [...snapshotStore];
}

export function clearSnapshots(): void {
  snapshotStore.length = 0;
}

type FlushOptions = {
  outputPath?: string;
  commitSha?: string;
  environment?: 'CI' | 'local';
};

const defaultOutputPath = 'diagnostics/perf-results.json';

export async function flushResults(options: FlushOptions = {}): Promise<{
  results: PerformanceHarnessResults;
  outputPath: string;
}> {
  const outputFile =
    options.outputPath ?? process.env.PERF_HARNESS_OUTPUT ?? defaultOutputPath;
  let commitSha =
    options.commitSha ??
    process.env.PERF_HARNESS_COMMIT ??
    process.env.GITHUB_SHA ??
    '';

  if (!commitSha) {
    try {
      const { execSync } = await import('node:child_process');
      commitSha = execSync('git rev-parse --short HEAD', {
        encoding: 'utf8',
      }).trim();
    } catch {
      commitSha = '';
    }
  }

  commitSha = commitSha.toLowerCase();

  if (!/^[a-f0-9]{7,40}$/.test(commitSha)) {
    commitSha = '0000000';
  }

  const environment =
    options.environment ?? (process.env.CI ? 'CI' : 'local');

  const snapshots = getSnapshots();
  const resolvedOutput = path.resolve(process.cwd(), outputFile);

  let existingSnapshots: PerformanceSnapshot[] = [];
  try {
    const existingRaw = await fs.readFile(resolvedOutput, 'utf-8');
    const existingJson = JSON.parse(existingRaw) as PerformanceHarnessResults;
    const prior = existingJson?.performanceHarness?.snapshots;
    if (Array.isArray(prior)) {
      existingSnapshots = prior;
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw error;
    }
  }

  const mergedSnapshots = [...existingSnapshots, ...snapshots];
  const dedupedSnapshots = Array.from(
    new Map(mergedSnapshots.map((snapshot) => [snapshot.snapshotId, snapshot])).values(),
  );

  const results = createHarnessResults(dedupedSnapshots, {
    commitSha,
    environment,
  });

  if (!validateResults(results)) {
    const message = ajv.errorsText(validateResults.errors, {
      dataVar: 'performanceHarness',
    });
    throw new Error(
      `[perf-harness] Result validation failed against schema: ${message}`,
    );
  }

  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeResults(results, resolvedOutput);
  clearSnapshots();
  return { results, outputPath: resolvedOutput };
}
