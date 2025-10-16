import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunDirectory, loadPolicy } from '../lib/security.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type {
  ArtifactDetail,
  BillingSwitchFixturesInput,
  BillingProvider,
  GenericOutput,
  PlanDiff,
  ToolPreview,
} from './types.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '../../../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'domains', 'saas-billing', 'examples');
const STORIES_DIR = path.join(PROJECT_ROOT, 'apps', 'explorer', 'src', 'stories', 'Billing');

type BillingFixture = {
  provider: string;
  subscription?: Record<string, unknown>;
  invoice?: Record<string, unknown>;
};

type DiffEntry = {
  path: string;
  before?: string;
  after?: string;
};

function titleCase(value: string): string {
  return value.length ? value.replace(/\b\w/g, (char) => char.toUpperCase()) : value;
}

function normalizeProvider(value: string | undefined): BillingProvider {
  const sanitized = (value ?? 'stripe').toString().toLowerCase();
  if (sanitized === 'stripe' || sanitized === 'chargebee') {
    return sanitized;
  }
  throw new Error(`Unsupported provider "${value}". Select stripe or chargebee.`);
}

async function loadFixture(provider: BillingProvider): Promise<BillingFixture> {
  const filePath = path.join(FIXTURES_DIR, `${provider}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as BillingFixture;
  } catch (error) {
    throw new Error(`Failed to load fixture for provider "${provider}": ${(error as Error).message}`);
  }
}

function assertObject(value: unknown, provider: BillingProvider, domain: 'subscription' | 'invoice'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Fixture "${provider}" does not define ${domain} data.`);
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

function summarizeFixture(providerLabel: string, data: Record<string, unknown>): string {
  const status = typeof data.status === 'string' ? data.status : null;
  const amountMinor = typeof data.amount_minor === 'number' ? data.amount_minor : null;
  const currency = typeof data.currency === 'string' ? data.currency : null;
  const amount = formatCurrency(amountMinor, currency);
  const summaryParts = [`${providerLabel} subscription`];
  if (typeof data.subscription_id === 'string') summaryParts.push(data.subscription_id);
  if (status) summaryParts.push(`status ${status}`);
  if (amount) summaryParts.push(amount);
  return summaryParts.join(' · ');
}

type DirectoryEntry = { name: string; isDirectory(): boolean };

async function safeReadDir(dirPath: string): Promise<DirectoryEntry[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function discoverPreviousProvider(baseDir: string): Promise<BillingProvider | null> {
  const dateEntries = await safeReadDir(baseDir);
  const dateDirs = dateEntries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const dateDir of dateDirs) {
    const toolDir = path.join(baseDir, dateDir, 'billing.switchFixtures');
    const runEntries = await safeReadDir(toolDir);
    const runDirs = runEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const runDir of runDirs) {
      const statePath = path.join(toolDir, runDir, 'switch-state.json');
      try {
        const raw = await fs.readFile(statePath, 'utf8');
        const parsed = JSON.parse(raw) as { provider?: string };
        const provider = typeof parsed?.provider === 'string' ? parsed.provider.toLowerCase() : null;
        if (provider === 'stripe' || provider === 'chargebee') {
          return provider as BillingProvider;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function listBillingStoryTitles(): Promise<string[]> {
  const entries = await safeReadDir(STORIES_DIR);
  const titles = new Set<string>();
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.stories.tsx')) continue;
    const filePath = path.join(STORIES_DIR, entry.name);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const match = raw.match(/title:\s*['"]([^'"]+)['"]/);
      if (match && match[1]) {
        titles.add(match[1]);
      }
    } catch {
      continue;
    }
  }
  return Array.from(titles).sort();
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

function computeDiff(previous: Record<string, unknown>, next: Record<string, unknown>): DiffEntry[] {
  const previousMap = flattenValue(previous);
  const nextMap = flattenValue(next);
  const keys = new Set([...Object.keys(previousMap), ...Object.keys(nextMap)]);
  const diffs: DiffEntry[] = [];
  for (const key of keys) {
    const before = previousMap[key];
    const after = nextMap[key];
    if (before === after) continue;
    diffs.push({ path: key, before, after });
  }
  return diffs.sort((a, b) => a.path.localeCompare(b.path));
}

function buildDiffNotes(domain: string, previousLabel: string, nextLabel: string, entries: DiffEntry[]): string[] {
  if (!entries.length) {
    return [`${domain}: ${nextLabel} matches ${previousLabel}.`];
  }
  return entries.slice(0, 5).map((entry) => {
    if (entry.before === undefined) {
      return `${domain}: ${entry.path} added (${entry.after ?? 'n/a'}) for ${nextLabel}.`;
    }
    if (entry.after === undefined) {
      return `${domain}: ${entry.path} removed (was ${entry.before ?? 'n/a'}) in ${nextLabel}.`;
    }
    return `${domain}: ${entry.path} ${entry.before} → ${entry.after}.`;
  });
}

function toPlanDiff(domain: string, previous: BillingProvider, next: BillingProvider, entries: DiffEntry[]): PlanDiff {
  const beforeMap: Record<string, string | undefined> = {};
  const afterMap: Record<string, string | undefined> = {};
  for (const entry of entries) {
    beforeMap[entry.path] = entry.before;
    afterMap[entry.path] = entry.after;
  }
  return {
    path: `billing/switch/${domain.toLowerCase()}/${previous}-to-${next}.json`,
    status: 'modified',
    summary: {
      additions: entries.filter((entry) => entry.before === undefined).length,
      deletions: entries.filter((entry) => entry.after === undefined).length,
    },
    hunks: [],
    structured: {
      type: 'json',
      before: beforeMap,
      after: afterMap,
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

export async function handle(input: BillingSwitchFixturesInput = { provider: 'stripe', apply: false }): Promise<GenericOutput> {
  const targetProvider = normalizeProvider(input?.provider);
  const policy = loadPolicy();
  const { runDir, runId } = createRunDirectory(policy.artifactsBase, 'billing.switchFixtures');
  const startedAt = new Date();
  const artifacts: string[] = [];
  const artifactDetails: ArtifactDetail[] = [];
  const bundleEntries: Array<{ path: string; name: string; purpose: string | null }> = [];

  const previousProvider = (await discoverPreviousProvider(policy.artifactsBase)) ?? 'stripe';
  const previousFixture = await loadFixture(previousProvider);
  const nextFixture = await loadFixture(targetProvider);

  const previousLabel = titleCase(previousProvider);
  const nextLabel = titleCase(targetProvider);
  const previousSubscription = assertObject(previousFixture.subscription, previousProvider, 'subscription');
  const nextSubscription = assertObject(nextFixture.subscription, targetProvider, 'subscription');
  const previousInvoice = assertObject(previousFixture.invoice, previousProvider, 'invoice');
  const nextInvoice = assertObject(nextFixture.invoice, targetProvider, 'invoice');

  const subscriptionDiffs = computeDiff(previousSubscription, nextSubscription);
  const invoiceDiffs = computeDiff(previousInvoice, nextInvoice);

  const diffNotes = [
    ...buildDiffNotes('Subscription', previousLabel, nextLabel, subscriptionDiffs),
    ...buildDiffNotes('Invoice', previousLabel, nextLabel, invoiceDiffs),
  ];

  const planDiffs: PlanDiff[] = [
    toPlanDiff('Subscription', previousProvider, targetProvider, subscriptionDiffs),
    toPlanDiff('Invoice', previousProvider, targetProvider, invoiceDiffs),
  ];

  const storyTitles = await listBillingStoryTitles();

  const preview: ToolPreview = {
    summary: `Switch billing fixtures from ${previousLabel} to ${nextLabel}.`,
    notes: diffNotes.concat(storyTitles.length ? [`Stories to refresh: ${storyTitles.join(', ')}`] : []),
    diffs: planDiffs,
    specimens: [
      summarizeFixture(previousLabel, previousSubscription),
      summarizeFixture(nextLabel, nextSubscription),
    ],
  };

  let diagnosticsPath: string | undefined;

  if (input.apply) {
    const summaryLines = [
      `# Billing Fixture Switch`,
      '',
      `Run ID: ${runId}`,
      `Previous provider: ${previousLabel}`,
      `Next provider: ${nextLabel}`,
      '',
      '## Key differences',
      ...(diffNotes.length ? diffNotes.map((note) => `- ${note}`) : ['- No data differences detected.']),
      '',
      '## Stories refreshed',
      ...(storyTitles.length ? storyTitles.map((title) => `- ${title}`) : ['- No Storybook entries detected.']),
    ];

    await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      'switch-summary.md',
      summaryLines.join('\n'),
      'Summary of fixture switch and impacted stories.'
    );

    const statePayload = {
      runId,
      executedAt: new Date().toISOString(),
      previousProvider,
      nextProvider: targetProvider,
      stories: storyTitles,
      notes: diffNotes,
    };
    diagnosticsPath = await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      'switch-state.json',
      JSON.stringify(statePayload, null, 2),
      'Recorded provider switch metadata.'
    );

    const subscriptionDiffDoc = {
      domain: 'subscription',
      from: previousProvider,
      to: targetProvider,
      totalDifferences: subscriptionDiffs.length,
      differences: subscriptionDiffs,
    };
    await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      path.join('diffs', `${previousProvider}-to-${targetProvider}.subscription.json`),
      JSON.stringify(subscriptionDiffDoc, null, 2),
      'Field-level subscription differences.'
    );

    const invoiceDiffDoc = {
      domain: 'invoice',
      from: previousProvider,
      to: targetProvider,
      totalDifferences: invoiceDiffs.length,
      differences: invoiceDiffs,
    };
    await writeArtifact(
      runDir,
      artifacts,
      artifactDetails,
      bundleEntries,
      path.join('diffs', `${previousProvider}-to-${targetProvider}.invoice.json`),
      JSON.stringify(invoiceDiffDoc, null, 2),
      'Field-level invoice differences.'
    );
  }

  const transcriptPath = writeTranscript(runDir, {
    tool: 'billing.switchFixtures',
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

  return {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    diagnosticsPath,
    preview,
    artifactsDetail: artifactDetails.length ? artifactDetails : undefined,
  };
}
