import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  writeTranscript,
  writeBundleIndex,
  writeDiagnostics,
  type DiagnosticsWriteInput,
} from '../lib/transcript.js';
import { createRunDirectory, loadPolicy } from '../lib/security.js';
import {
  packTwiceCompare,
  analyzePackageSanity,
  generateChangelog,
  type ConventionalCommit,
} from '@oods/release-utils';
import type { ReleaseVerifyInput, ReleaseVerifyResult } from './types.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '../../../..');

const DEFAULT_PACKAGES = [
  { name: '@oods/tokens', relative: 'packages/tokens' },
  { name: '@oods/tw-variants', relative: 'packages/tw-variants' },
  { name: '@oods/a11y-tools', relative: 'packages/a11y-tools' },
] as const;

type PackageDescriptor = typeof DEFAULT_PACKAGES[number];

type VerificationRecord = ReleaseVerifyResult['results'][number];

type SelectedPackage = PackageDescriptor & { absPath: string };

function resolvePackages(requested: string[] | undefined): SelectedPackage[] {
  const requestedSet = new Set(
    (requested ?? DEFAULT_PACKAGES.map((pkg: PackageDescriptor) => pkg.name)).map((name) => name.trim()),
  );
  const selection: SelectedPackage[] = [];
  for (const pkg of DEFAULT_PACKAGES) {
    if (!requestedSet.has(pkg.name)) continue;
    const absPath = path.join(PROJECT_ROOT, pkg.relative);
    selection.push({ ...pkg, absPath });
  }
  return selection;
}

function buildSummary(results: VerificationRecord[], warnings: string[]): string {
  if (!results.length) return 'No packages selected for verification.';
  const failed = results.filter((entry) => !entry.identical);
  if (failed.length === 0 && warnings.length === 0) {
    return 'All selected packages produced identical tarballs with clean sanity checks.';
  }
  const failureNotes = failed.map((entry) => `${entry.name}@${entry.version}`);
  const warningNotes = warnings.map((line) => line);
  const parts: string[] = [];
  if (failureNotes.length) parts.push(`Non-deterministic: ${failureNotes.join(', ')}`);
  if (warningNotes.length) parts.push('Warnings recorded');
  return parts.join(' | ');
}

export async function handle(input: ReleaseVerifyInput = {}): Promise<ReleaseVerifyResult> {
  const packages = resolvePackages(input.packages);
  if (!packages.length) {
    throw new Error('No packages resolved for release verification.');
  }

  const policy = loadPolicy();
  const { runDir, runId } = createRunDirectory(policy.artifactsBase, 'release.verify');
  const startedAt = new Date();

  const results: VerificationRecord[] = [];
  const aggregateWarnings: string[] = [];

  for (const pkg of packages) {
    const verification = await packTwiceCompare({ packageDir: pkg.absPath });
    const sanity = await analyzePackageSanity(pkg.absPath);
    const combinedWarnings: string[] = [];
    for (const warning of verification.warnings) {
      combinedWarnings.push(`pack: ${warning}`);
    }
    for (const message of sanity.errors) {
      combinedWarnings.push(`sanity-error: ${message}`);
    }
    for (const message of sanity.warnings) {
      combinedWarnings.push(`sanity: ${message}`);
    }
    if (!verification.identical) {
      aggregateWarnings.push(`${verification.name}@${verification.version}: reproducibility check failed.`);
    }
    if (combinedWarnings.length) {
      for (const message of combinedWarnings) {
        aggregateWarnings.push(`${verification.name}@${verification.version}: ${message}`);
      }
    }
    results.push({
      name: verification.name,
      version: verification.version,
      identical: verification.identical,
      sha256: verification.sha256,
      sizeBytes: verification.sizeBytes,
      files: verification.files,
      warnings: combinedWarnings.length ? combinedWarnings : undefined,
    });
  }

  const changelog = await generateChangelog({ cwd: PROJECT_ROOT, baseTag: input.fromTag });
  if (changelog.warnings.length) {
    for (const line of changelog.warnings) {
      aggregateWarnings.push(`changelog: ${line}`);
    }
  }

  const summary = buildSummary(results, aggregateWarnings);

  const changelogPath = path.join(runDir, 'CHANGELOG.md');
  await fs.writeFile(changelogPath, `${changelog.markdown.trim()}
`, 'utf8');

  const resultsPath = path.join(runDir, 'results.json');
  const resultsPayload = {
    runId,
    startedAt: startedAt.toISOString(),
    summary,
    packages: results,
    changelog: {
      baseTag: changelog.baseTag ?? null,
      warnings: changelog.warnings,
    },
  };
  await fs.writeFile(resultsPath, JSON.stringify(resultsPayload, null, 2), 'utf8');

  const diagnosticsPayload: DiagnosticsWriteInput = {
    sprint: '12',
    runId,
    tool: 'release.verify',
    summary,
    notes: aggregateWarnings.length ? aggregateWarnings : undefined,
    brandA: { aaPassPct: null, hcPngCount: null },
    vrt: { totalStories: null, darkCount: null },
    inventory: { components: null, stories: null },
    tokens: { buildMs: null },
    packages: results.map((entry) => ({
      name: entry.name,
      version: entry.version,
      reproducible: entry.identical,
      sha256: entry.sha256,
      sizeBytes: entry.sizeBytes,
    })),
    release: {
      changelog: {
        baseTag: changelog.baseTag ?? null,
        warnings: changelog.warnings,
        entries: changelog.commits.map((commit: ConventionalCommit) => ({
          type: commit.type,
          scope: commit.scope,
          description: commit.description,
          breaking: commit.breaking,
        })),
      },
    },
  };

  const diagnosticsPath = writeDiagnostics(runDir, diagnosticsPayload);
  const artifacts = [diagnosticsPath, changelogPath, resultsPath];

  const transcriptPath = writeTranscript(runDir, {
    tool: 'release.verify',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });

  const transcriptRel = path.relative(runDir, transcriptPath) || 'transcript.json';
  const diagnosticsRel = path.relative(runDir, diagnosticsPath);
  const changelogRel = path.relative(runDir, changelogPath);
  const resultsRel = path.relative(runDir, resultsPath);

  const bundleIndexPath = writeBundleIndex(runDir, [
    transcriptRel,
    { path: diagnosticsRel, name: 'diagnostics.json', purpose: 'Release verification diagnostics' },
    { path: changelogRel, name: 'CHANGELOG.md', purpose: 'Draft changelog' },
    { path: resultsRel, name: 'results.json', purpose: 'Verification summary' },
  ]);

  return {
    artifacts,
    diagnosticsPath,
    transcriptPath,
    bundleIndexPath,
    results,
    changelogPath,
    summary,
    warnings: aggregateWarnings.length ? aggregateWarnings : undefined,
  };
}
