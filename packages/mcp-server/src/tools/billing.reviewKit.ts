import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunDirectory, loadPolicy } from '../lib/security.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type {
  ArtifactDetail,
  BillingReviewKitInput,
  BillingProvider,
  GenericOutput,
  PlanDiff,
  ToolPreview,
} from './types.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '../../../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'domains', 'saas-billing', 'examples');

type BillingObjectKey = 'subscription' | 'invoice' | 'plan' | 'usage';

type BillingFixture = {
  provider: string;
  subscription?: Record<string, unknown>;
  invoice?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  usage?: Record<string, unknown>;
};

type Specimen = {
  provider: BillingProvider;
  providerLabel: string;
  data: Record<string, unknown>;
};

type DiffEntry = {
  path: string;
  before?: string;
  after?: string;
};

const OBJECT_LABELS: Record<BillingObjectKey, string> = {
  subscription: 'Subscription',
  invoice: 'Invoice',
  plan: 'Plan',
  usage: 'Usage',
};

const VALID_PROVIDERS: readonly BillingProvider[] = ['stripe', 'chargebee'] as const;

function titleCase(value: string): string {
  return value.length ? value.replace(/\b\w/g, (char) => char.toUpperCase()) : value;
}

function normalizeObjectName(value: string | undefined): { key: BillingObjectKey; label: string } {
  const sanitized = (value ?? 'Subscription').toString().toLowerCase();
  if (sanitized === 'subscription') return { key: 'subscription', label: OBJECT_LABELS.subscription };
  if (sanitized === 'invoice') return { key: 'invoice', label: OBJECT_LABELS.invoice };
  if (sanitized === 'plan') return { key: 'plan', label: OBJECT_LABELS.plan };
  if (sanitized === 'usage') return { key: 'usage', label: OBJECT_LABELS.usage };
  throw new Error(`Unsupported billing object "${value}". Expected Subscription, Invoice, Plan, or Usage.`);
}

function normalizeFixtures(fixtures: BillingProvider[] | undefined): BillingProvider[] {
  const requested = fixtures && Array.isArray(fixtures) && fixtures.length ? fixtures : [...VALID_PROVIDERS];
  const seen = new Set<BillingProvider>();
  const normalized: BillingProvider[] = [];
  for (const entry of requested) {
    if (typeof entry !== 'string') continue;
    const lower = entry.toLowerCase() as BillingProvider;
    if (!VALID_PROVIDERS.includes(lower)) {
      throw new Error(`Unknown fixture provider "${entry}". Supported fixtures: ${VALID_PROVIDERS.join(', ')}`);
    }
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(lower);
    }
  }
  if (!normalized.length) {
    throw new Error('At least one fixture provider must be selected.');
  }
  return normalized;
}

async function loadFixture(provider: BillingProvider): Promise<BillingFixture> {
  const filePath = path.join(FIXTURES_DIR, `${provider}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as BillingFixture;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to load fixture for provider "${provider}": ${(error as Error).message}`);
  }
}

function assertObject(value: unknown, provider: BillingProvider, objectKey: BillingObjectKey): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Fixture "${provider}" does not define object "${objectKey}".`);
  }
  return value as Record<string, unknown>;
}

function formatCurrency(minor: number | null | undefined, currency: string | null | undefined): string | null {
  if (minor == null || Number.isNaN(minor)) return null;
  const denom = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: denom }).format(minor / 100);
  } catch {
    return `${minor / 100} ${denom}`;
  }
}

function summarizeSpecimen(objectKey: BillingObjectKey, specimen: Specimen): string {
  const { data, providerLabel } = specimen;
  const status = typeof data.status === 'string' ? data.status : null;
  const amountMinor = typeof data.amount_minor === 'number' ? data.amount_minor : null;
  const currency = typeof data.currency === 'string' ? data.currency : null;
  const amount = formatCurrency(amountMinor, currency);
  const primaryId =
    typeof data.subscription_id === 'string'
      ? data.subscription_id
      : typeof data.invoice_id === 'string'
      ? data.invoice_id
      : typeof data.plan_id === 'string'
      ? data.plan_id
      : typeof data.usage_id === 'string'
      ? data.usage_id
      : null;
  const segments: string[] = [`${providerLabel} ${OBJECT_LABELS[objectKey]}`];
  if (primaryId) segments.push(primaryId);
  if (status) segments.push(`status ${status}`);
  if (amount) segments.push(amount);
  return segments.join(' · ');
}

function flattenValue(value: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (value === null || value === undefined) {
    if (prefix) result[prefix] = 'null';
    return result;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (prefix) result[prefix] = String(value);
    return result;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      if (prefix) result[prefix] = '[]';
      return result;
    }
    value.forEach((entry, index) => {
      const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
      Object.assign(result, flattenValue(entry, nextPrefix));
    });
    return result;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    if (prefix) result[prefix] = '{}';
    return result;
  }
  for (const [key, entry] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (entry === null || entry === undefined) {
      result[nextPrefix] = 'null';
    } else if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      result[nextPrefix] = String(entry);
    } else {
      Object.assign(result, flattenValue(entry, nextPrefix));
    }
  }
  return result;
}

function computeDiff(base: Specimen, candidate: Specimen): DiffEntry[] {
  const baseMap = flattenValue(base.data);
  const candidateMap = flattenValue(candidate.data);
  const keys = new Set([...Object.keys(baseMap), ...Object.keys(candidateMap)]);
  const diffs: DiffEntry[] = [];
  for (const key of keys) {
    const before = baseMap[key];
    const after = candidateMap[key];
    if (before === after) continue;
    diffs.push({
      path: key,
      before,
      after,
    });
  }
  return diffs.sort((a, b) => a.path.localeCompare(b.path));
}

function buildPreview(objectLabel: string, specimens: Specimen[], diffNotes: string[], diffs: PlanDiff[]): ToolPreview {
  const summaryFixtures = specimens.map((specimen) => specimen.providerLabel).join(', ');
  return {
    summary: `Billing review kit for ${objectLabel} using fixtures: ${summaryFixtures}.`,
    notes: diffNotes.length ? diffNotes.slice(0, 6) : undefined,
    diffs: diffs.length ? diffs : undefined,
    specimens: specimens.map((specimen) => summarizeSpecimen(objectLabel.toLowerCase() as BillingObjectKey, specimen)),
  };
}

function toDiffNotes(base: Specimen, candidate: Specimen, entries: DiffEntry[]): string[] {
  if (!entries.length) {
    return [`${candidate.providerLabel}: No differences versus ${base.providerLabel}.`];
  }
  return entries.slice(0, 6).map((entry) => {
    if (entry.before === undefined || entry.before === null) {
      return `${candidate.providerLabel}: ${entry.path} added (${entry.after ?? 'n/a'}).`;
    }
    if (entry.after === undefined || entry.after === null) {
      return `${candidate.providerLabel}: ${entry.path} removed (was ${entry.before ?? 'n/a'}).`;
    }
    return `${candidate.providerLabel}: ${entry.path} ${entry.before} → ${entry.after}.`;
  });
}

function buildPlanDiff(objectKey: BillingObjectKey, base: Specimen, candidate: Specimen, entries: DiffEntry[]): PlanDiff {
  const changesBefore: Record<string, string | undefined> = {};
  const changesAfter: Record<string, string | undefined> = {};
  for (const entry of entries) {
    changesBefore[entry.path] = entry.before;
    changesAfter[entry.path] = entry.after;
  }
  return {
    path: `billing/review-kit/${objectKey}/${base.provider}-vs-${candidate.provider}.json`,
    status: 'modified',
    summary: {
      additions: entries.filter((entry) => entry.before === undefined).length,
      deletions: entries.filter((entry) => entry.after === undefined).length,
    },
    hunks: [],
    structured: {
      type: 'json',
      before: changesBefore,
      after: changesAfter,
    },
  };
}

async function writeArtifact(
  runDir: string,
  artifacts: string[],
  details: ArtifactDetail[],
  bundleEntries: Array<{ path: string; name: string; purpose: string | null }>,
  relativePath: string,
  contents: string,
  purpose: string
): Promise<string> {
  const filePath = path.join(runDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
  artifacts.push(filePath);
  const stat = await fs.stat(filePath);
  details.push({
    path: filePath,
    name: path.basename(filePath),
    purpose,
    sha256: sha256File(filePath),
    sizeBytes: stat.size,
  });
  bundleEntries.push({
    path: relativePath.split(path.sep).join('/'),
    name: path.basename(filePath),
    purpose,
  });
  return filePath;
}

export async function handle(input: BillingReviewKitInput = { apply: false, object: 'Subscription' }): Promise<GenericOutput> {
  const { key: objectKey, label: objectLabel } = normalizeObjectName(input.object);
  const fixtures = normalizeFixtures(input.fixtures);
  const loaded = await Promise.all(fixtures.map((provider) => loadFixture(provider)));

  const specimens: Specimen[] = loaded.map((fixture) => {
    const provider = fixture.provider?.toString().toLowerCase() as BillingProvider | undefined;
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      throw new Error(`Fixture file declared unsupported provider "${fixture.provider ?? '<missing>'}".`);
    }
    const data = assertObject(fixture[objectKey], provider, objectKey);
    return {
      provider,
      providerLabel: titleCase(provider),
      data,
    };
  });

  const base = specimens[0];
  const planDiffs: PlanDiff[] = [];
  const diffNotes: string[] = [];
  let totalDiffCount = 0;

  for (let i = 1; i < specimens.length; i += 1) {
    const candidate = specimens[i];
    const diffs = computeDiff(base, candidate);
    totalDiffCount += diffs.length;
    planDiffs.push(buildPlanDiff(objectKey, base, candidate, diffs));
    diffNotes.push(...toDiffNotes(base, candidate, diffs));
  }

  if (specimens.length === 1) {
    diffNotes.push('Single fixture selected; no comparisons generated.');
  }

  const preview = buildPreview(objectLabel, specimens, diffNotes, planDiffs);

  const policy = loadPolicy();
  const { runDir, runId } = createRunDirectory(policy.artifactsBase, 'billing.reviewKit');
  const startedAt = new Date();
  const artifacts: string[] = [];
  const artifactDetails: ArtifactDetail[] = [];
  const bundleEntries: Array<{ path: string; name: string; purpose: string | null }> = [];
  let diagnosticsPath: string | undefined;

  if (input.apply) {
    const headerLines = [
      `# Billing Review Kit · ${objectLabel}`,
      '',
      `Run ID: ${runId}`,
      `Fixtures: ${specimens.map((specimen) => specimen.providerLabel).join(', ')}`,
      `Comparisons: ${totalDiffCount} differing paths`,
      '',
      '## Highlights',
      ...(diffNotes.length ? diffNotes.map((note) => `- ${note}`) : ['- No differences detected between fixtures.']),
    ];
    await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      'summary.md',
      headerLines.join('\n'),
      'High-level summary of review kit comparison.'
    );

    const indexPayload = {
      object: objectLabel,
      runId,
      fixtures: specimens.map((specimen) => ({
        provider: specimen.provider,
        label: specimen.providerLabel,
        status: typeof specimen.data.status === 'string' ? specimen.data.status : null,
      })),
      diffCount: totalDiffCount,
      generatedAt: new Date().toISOString(),
    };
    await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      'index.json',
      JSON.stringify(indexPayload, null, 2),
      'Index of fixtures and comparison metadata.'
    );

    for (const specimen of specimens) {
      await writeArtifact(
        runDir,
        artifacts,
        artifactDetails,
        bundleEntries,
        path.join('specimens', `${specimen.provider}.${objectKey}.json`),
        JSON.stringify(specimen.data, null, 2),
        `Source specimen for ${specimen.providerLabel}.`
      );
    }

    for (let i = 1; i < specimens.length; i += 1) {
      const candidate = specimens[i];
      const diffEntries = computeDiff(base, candidate);
      const diffDoc = {
        object: objectLabel,
        base: base.provider,
        compare: candidate.provider,
        totalDifferences: diffEntries.length,
        differences: diffEntries,
      };
      await writeArtifact(
        runDir,
        artifacts,
        artifactDetails,
        bundleEntries,
        path.join('diffs', `${base.provider}-vs-${candidate.provider}.${objectKey}.json`),
        JSON.stringify(diffDoc, null, 2),
        `Field-level differences between ${base.providerLabel} and ${candidate.providerLabel}.`
      );
    }

    const diagnostics = {
      object: objectLabel,
      runId,
      fixtures: specimens.map((specimen) => ({
        provider: specimen.provider,
        status: typeof specimen.data.status === 'string' ? specimen.data.status : null,
        amountMinor: typeof specimen.data.amount_minor === 'number' ? specimen.data.amount_minor : null,
        currency: typeof specimen.data.currency === 'string' ? specimen.data.currency : null,
        metricCount: Object.keys(specimen.data).length,
      })),
      diffCount: totalDiffCount,
      generatedAt: new Date().toISOString(),
    };
    diagnosticsPath = await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      'diagnostics.json',
      JSON.stringify(diagnostics, null, 2),
      'Aggregate billing diagnostics for the selected fixtures.'
    );
  }

  const transcriptPath = writeTranscript(runDir, {
    tool: 'billing.reviewKit',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  bundleEntries.push({ path: 'transcript.json', name: 'transcript.json', purpose: 'Run transcript' });
  const bundleIndexPath = writeBundleIndex(
    runDir,
    bundleEntries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      purpose: entry.purpose,
    }))
  );

  const result: GenericOutput = {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    diagnosticsPath,
    preview,
    artifactsDetail: artifactDetails.length ? artifactDetails : undefined,
  };

  return result;
}
