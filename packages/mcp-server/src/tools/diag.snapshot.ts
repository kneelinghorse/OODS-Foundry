import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  writeTranscript,
  writeBundleIndex,
  writeDiagnostics,
  sha256File,
  type BundleIndexEntryInput,
  type DiagnosticsWriteInput,
} from '../lib/transcript.js';
import { createRunDirectory, loadPolicy } from '../lib/security.js';
import type {
  DiagnosticsBrandSummary,
  DiagnosticsInventorySummary,
  DiagnosticsPackageSummary,
  DiagnosticsTokensSummary,
  DiagnosticsVrtSummary,
} from '@oods/artifacts';
import type { BaseInput, GenericOutput, ArtifactDetail } from './types.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '../../../..');
const BRAND_COVERAGE_PATH = path.join(PROJECT_ROOT, 'docs', 'themes', 'brand-a', 'coverage.md');
const BRAND_ASSETS_DIR = path.join(PROJECT_ROOT, 'docs', 'themes', 'brand-a');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, 'apps', 'explorer', 'src', 'components');
const STORIES_ROOT = path.join(PROJECT_ROOT, 'apps', 'explorer', 'src');
const PACKAGE_SUMMARY = [
  { name: '@oods/tokens', relative: 'packages/tokens' },
  { name: '@oods/tw-variants', relative: 'packages/tw-variants' },
  { name: '@oods/a11y-tools', relative: 'packages/a11y-tools' },
] as const;

type PackageSummaryItem = typeof PACKAGE_SUMMARY[number];

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function walkFiles(root: string, matcher: (fullPath: string) => boolean): Promise<string[]> {
  const collected: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await recurse(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const full = path.join(dir, entry.name);
        if (matcher(full)) {
          collected.push(full);
        }
      }
    }
  }
  await recurse(root);
  return collected;
}

async function countPngAssets(): Promise<number> {
  const files = await walkFiles(BRAND_ASSETS_DIR, (full) => full.toLowerCase().endsWith('.png'));
  return files.length;
}

async function collectBrandSummary(): Promise<DiagnosticsBrandSummary> {
  const markdown = await readFileSafe(BRAND_COVERAGE_PATH);
  let aaPairsTotal = 0;
  let aaPassCount = 0;
  let maxDeltaL: number | null = null;
  let maxDeltaC: number | null = null;
  const notes: string[] = [];

  if (markdown) {
    const rows = markdown
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && !line.startsWith('| ---'));

    for (const row of rows) {
      const cells = row
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length < 6) continue;
      const [, , contrast, deltaL, deltaC, note] = cells;
      const ratioMatch = contrast.match(/([0-9.]+):1/);
      if (ratioMatch) {
        const ratio = Number.parseFloat(ratioMatch[1]);
        if (Number.isFinite(ratio)) {
          aaPairsTotal += 1;
          if (ratio >= 4.5) aaPassCount += 1;
        }
      }
      const deltaLMatch = deltaL.match(/[-+]?[\d.]+/);
      if (deltaLMatch) {
        const value = Number.parseFloat(deltaLMatch[0]);
        if (Number.isFinite(value)) {
          const abs = Math.abs(value);
          maxDeltaL = maxDeltaL === null ? abs : Math.max(maxDeltaL, abs);
        }
      }
      const deltaCMatch = deltaC.match(/[-+]?[\d.]+/);
      if (deltaCMatch) {
        const value = Number.parseFloat(deltaCMatch[0]);
        if (Number.isFinite(value)) {
          const abs = Math.abs(value);
          maxDeltaC = maxDeltaC === null ? abs : Math.max(maxDeltaC, abs);
        }
      }
      if (note && note !== '—') {
        notes.push(note);
      }
    }
  }

  const aaPassPct = aaPairsTotal > 0 ? Math.round((aaPassCount / aaPairsTotal) * 100) : null;
  const hcPngCount = await countPngAssets();
  const deltaGuardrailsOk =
    maxDeltaL !== null && maxDeltaC !== null ? maxDeltaL <= 0.12 && maxDeltaC <= 0.02 : null;

  return {
    aaPassPct,
    aaPairsTotal,
    deltaGuardrails:
      maxDeltaL === null && maxDeltaC === null
        ? undefined
        : {
            maxDeltaL,
            maxDeltaC,
            ok: deltaGuardrailsOk,
          },
    hcPngCount,
    notes: notes.slice(0, 4),
  };
}

async function collectInventorySummary(storyFiles: string[], componentCount: number): Promise<DiagnosticsInventorySummary> {
  return {
    components: componentCount,
    stories: storyFiles.length,
  };
}

async function collectVrtSummary(storyFiles: string[]): Promise<DiagnosticsVrtSummary> {
  if (storyFiles.length === 0) {
    return {
      totalStories: 0,
      darkCount: 0,
      allowlistCount: 0,
      flakePct: null,
      runUrl: null,
    };
  }

  const contents = await Promise.all(storyFiles.map((file) => readFileSafe(file)));
  let darkCount = 0;
  let allowlistCount = 0;
  for (const source of contents) {
    if (!source) continue;
    if (/\bdark\b/.test(source) || /data-theme\s*=\s*["']dark["']/.test(source)) {
      darkCount += 1;
    }
    if (/brand-a-(light|dark|hc)/i.test(source)) {
      allowlistCount += 1;
    }
  }

  return {
    totalStories: storyFiles.length,
    darkCount,
    allowlistCount,
    flakePct: null,
    runUrl: null,
  };
}

async function collectTokensSummary(): Promise<DiagnosticsTokensSummary> {
  return {
    buildMs: null,
    lastBuildAt: null,
  };
}

async function collectPackageSummary(): Promise<DiagnosticsPackageSummary[]> {
  const entries: DiagnosticsPackageSummary[] = [];
  for (const pkg of PACKAGE_SUMMARY as readonly PackageSummaryItem[]) {
    const dir = path.join(PROJECT_ROOT, pkg.relative);
    const pkgPath = path.join(dir, 'package.json');
    const raw = await readFileSafe(pkgPath);
    if (!raw) continue;
    let parsed: { version?: string | null; publishConfig?: { provenance?: boolean } } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    let stat;
    try {
      stat = await fs.stat(pkgPath);
    } catch {
      stat = null;
    }
    entries.push({
      name: pkg.name,
      version: parsed.version ?? null,
      reproducible: Boolean(parsed.publishConfig?.provenance),
      sha256: sha256File(pkgPath),
      sizeBytes: stat?.size ?? null,
    });
  }
  return entries;
}

async function collectStoryFiles(): Promise<string[]> {
  return walkFiles(STORIES_ROOT, (file) => file.endsWith('.stories.tsx'));
}

async function countComponents(): Promise<number> {
  const files = await walkFiles(COMPONENTS_DIR, (file) => file.endsWith('.tsx'));
  return files.length;
}

function buildPreview({
  inventory,
  vrt,
  brand,
}: {
  inventory: DiagnosticsInventorySummary;
  vrt: DiagnosticsVrtSummary;
  brand: DiagnosticsBrandSummary;
}): string {
  const pieces: string[] = [];
  if (inventory.components !== null && inventory.stories !== null) {
    pieces.push(`Inventory ${inventory.components} components / ${inventory.stories} stories`);
  }
  if (vrt.totalStories !== null && vrt.darkCount !== null) {
    pieces.push(`VRT coverage ${vrt.totalStories} total / ${vrt.darkCount} dark-ready`);
  }
  if (brand.aaPassPct !== null) {
    pieces.push(`Brand A AA pass ${brand.aaPassPct}%`);
  }
  return pieces.join(' · ');
}

export async function handle(_input: BaseInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const { runDir, runId } = createRunDirectory(policy.artifactsBase, 'diag.snapshot');
  const startedAt = new Date();

  const [storyFiles, componentCount, brand, packages, tokens] = await Promise.all([
    collectStoryFiles(),
    countComponents(),
    collectBrandSummary(),
    collectPackageSummary(),
    collectTokensSummary(),
  ]);
  const inventory = await collectInventorySummary(storyFiles, componentCount);
  const vrt = await collectVrtSummary(storyFiles);
  const packageNote = packages.length
    ? packages.map((pkg: DiagnosticsPackageSummary) => pkg.name).join(', ')
    : 'none';

  const diagnostics: DiagnosticsWriteInput = {
    sprint: '12',
    runId,
    tool: 'diag.snapshot',
    summary: buildPreview({ inventory, vrt, brand }),
    notes: [
      `Story inventory scanned at ${new Date().toISOString()}`,
      `Packages analyzed: ${packageNote}`,
    ],
    brandA: brand,
    vrt,
    inventory,
    tokens,
    packages,
  };

  fs.mkdir(runDir, { recursive: true }).catch(() => undefined);
  const diagnosticsPath = writeDiagnostics(runDir, diagnostics);
  const artifacts: string[] = [diagnosticsPath];
  const details: ArtifactDetail[] = [];

  try {
    const stat = await fs.stat(diagnosticsPath);
    details.push({
      path: diagnosticsPath,
      name: 'diagnostics.json',
      purpose: 'Consolidated diagnostics snapshot',
      sha256: sha256File(diagnosticsPath),
      sizeBytes: stat.size,
    });
  } catch {
    // ignore stat failures; verification will flag missing files later
  }

  const transcriptPath = writeTranscript(runDir, {
    tool: 'diag.snapshot',
    input: {},
    apply: false,
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });

  const toRunRelative = (filePath: string, fallback: string): string => {
    const relative = path.relative(runDir, filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return fallback;
    }
    return relative.split(path.sep).join('/');
  };

  const transcriptRelative = toRunRelative(transcriptPath, 'transcript.json');
  const diagnosticsRelative = toRunRelative(diagnosticsPath, 'diagnostics.json');

  const bundleEntries: BundleIndexEntryInput[] = [
    transcriptRelative,
    {
      path: diagnosticsRelative,
      name: 'diagnostics.json',
      purpose: 'Consolidated diagnostics snapshot',
      sizeBytes: details[0]?.sizeBytes ?? undefined,
    },
  ];
  const bundleIndexPath = writeBundleIndex(runDir, bundleEntries);

  return {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    diagnosticsPath,
    preview: { summary: diagnostics.summary },
    artifactsDetail: details.length ? details : undefined,
  };
}
