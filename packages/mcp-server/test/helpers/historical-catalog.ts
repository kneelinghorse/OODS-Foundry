import { execFileSync } from 'node:child_process';
import { expect } from 'vitest';
import { GENERATED_DEPENDENCY_CATALOG } from '../../src/codegen/artifact-envelope.js';
import { repositoryRoot } from './wire-boundary.js';

/**
 * s221-m01: the validation issues a retained generation response from before publication must carry. It pinned each
 * @oods package at the version that package had at the response's own head (0.1.0); the exact catalog now pins the
 * released version (0.3.x since 728e3489b, #2432). Only those pins may differ, and each must equal the package.json version
 * at that head, so a response that was wrong when it was made still fails.
 */
export function historicalCatalogIssues(artifact: { dependencies?: Array<{ name: string; version: string }> }, head: string): string[] {
  const issues: string[] = [];
  for (const dependency of artifact.dependencies ?? []) {
    if (!dependency.name.startsWith('@oods/')) continue;
    const current = (GENERATED_DEPENDENCY_CATALOG as Record<string, { version: string }>)[dependency.name];
    if (current?.version === dependency.version) continue;
    const manifest = execFileSync('git', ['show', `${head}:packages/${dependency.name.slice('@oods/'.length)}/package.json`], { cwd: repositoryRoot, encoding: 'utf8' });
    expect(dependency.version, `${dependency.name} as it was at ${head}`).toBe((JSON.parse(manifest) as { version: string }).version);
    issues.push(`Dependency '${dependency.name}' does not match its exact catalog entry.`);
  }
  return issues;
}
