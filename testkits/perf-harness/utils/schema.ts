/**
 * Performance harness schema types and validation
 */

import { randomUUID } from 'crypto';

export interface PerformanceSnapshot {
  snapshotId: string;
  scenarioId: string;
  metricName: string;
  value: number;
  unit: 'ms' | 'seconds' | 'bytes' | 'score';
  browser: 'chromium' | 'firefox' | 'webkit';
  parameters?: Record<string, unknown>;
  isRegression?: boolean;
  baselineValue?: number;
  baselineSourceCommitSha?: string;
}

export interface PerformanceHarnessResults {
  performanceHarness: {
    version: '1.0.0';
    runTimestamp: string;
    commitSha: string;
    environment: 'CI' | 'local';
    snapshots: PerformanceSnapshot[];
  };
}

/**
 * Create a performance snapshot
 */
export function createSnapshot(
  scenarioId: string,
  metricName: string,
  value: number,
  options: {
    unit?: PerformanceSnapshot['unit'];
    browser?: PerformanceSnapshot['browser'];
    parameters?: Record<string, unknown>;
  } = {},
): PerformanceSnapshot {
  return {
    snapshotId: randomUUID(),
    scenarioId,
    metricName,
    value,
    unit: options.unit ?? 'ms',
    browser: options.browser ?? 'chromium',
    parameters: options.parameters,
  };
}

/**
 * Create performance harness results container
 */
export function createHarnessResults(
  snapshots: PerformanceSnapshot[],
  options: {
    commitSha?: string;
    environment?: 'CI' | 'local';
  } = {},
): PerformanceHarnessResults {
  return {
    performanceHarness: {
      version: '1.0.0',
      runTimestamp: new Date().toISOString(),
      commitSha: options.commitSha ?? 'local',
      environment: options.environment ?? 'local',
      snapshots,
    },
  };
}

/**
 * Write results to JSON file
 */
export async function writeResults(
  results: PerformanceHarnessResults,
  filepath: string,
): Promise<void> {
  const fs = await import('fs/promises');
  await fs.writeFile(filepath, JSON.stringify(results, null, 2), 'utf-8');
}

/**
 * Read results from JSON file
 */
export async function readResults(
  filepath: string,
): Promise<PerformanceHarnessResults> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}
