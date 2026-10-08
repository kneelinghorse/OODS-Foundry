import { withPublicEvidence } from '../lib/public-evidence.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaStore } from '../schema-store/index.js';
import { ToolError } from '../errors/tool-error.js';
import { CURRENT_VERSION, getChangelogSince, type ChangelogEntry } from '../versioning/versions.js';
import { definitionRegistryReport, listObjects, type DefinitionRegistryReport } from '../objects/object-loader.js';
import { listTraits } from '../objects/trait-loader.js';
import { readRuntimeSummary, type RuntimeSummary } from '../lib/runtime-ledger.js';
import { readReleaseSummary, type ReleaseSummary } from '../lib/release-ledger.js';
import { readToolSummary, type ToolSummary } from '../lib/tool-ledger.js';
import { liveComponentNames } from '../lib/live-registry.js';
import { readVizSummary, type VizSummary } from '../lib/viz-taxonomy.js';
import { readVisualProofSummary, proofMatchesBuild, type VisualProofSummary } from '../lib/visual-proof-ledger.js';
import { measuredOnFor, readMeasuredOn, type MeasuredOn } from '../lib/measured-on.js';
import { VIZ_RECIPES_CENSUS } from '@oods/viz-core';
import { readTokenScopes } from '../lib/token-build.js';
import { brandRegistryReport, DEFAULT_BRAND, type BrandRegistryReport } from '../lib/brand-registry.js';

type ManifestArtifact = {
  name?: string;
  file?: string;
  path?: string;
};

type ManifestDoc = {
  generatedAt?: string;
  artifacts?: ManifestArtifact[];
};

type HealthInput = {
  includeChangelog?: boolean;
  sinceVersion?: string;
};

/** 'live' moves when the registry moves; 'snapshot' is frozen at `registry.lastSync`. */
type CountSource = 'live' | 'snapshot' | 'unavailable';

type HealthOutput = {
  status: 'ok' | 'degraded';
  server: { version: string; uptime: number };
  registry: {
    components: number;
    traits: number;
    objects: number;
    lastSync: string;
    /**
     * Where each count above was read from on this call. An advertised count that cannot move is
     * worse than no count: through Sprint 203 this tool reported the object count live while traits
     * and components came from a frozen structured-data export, so it advertised 46 traits where the
     * registry held 47 and nothing said which number was which (learning #657).
     */
    countsFrom: { components: CountSource; traits: CountSource; objects: CountSource };
    /** s213-m03: the team's folders, its objects and traits, and every file not in use, with the reason. */
    definitions?: DefinitionRegistryReport;
  };
  tokens: TokenInfo;
  schemas: { savedCount: number; storeDir: string };
  latency: number;
  // s223-m03 (#2527 ruling 17): every block says what it was measured on.
  productReality: { runtime: (RuntimeSummary & { thisBuild: boolean | null; measuredOn: MeasuredOn | null }) | null; release: (ReleaseSummary & { head: string; thisBuild: boolean | null; measuredOn: MeasuredOn | null }) | null; tools: (ToolSummary & { thisBuild: boolean | null; measuredOn: MeasuredOn | null }) | null; html: (VisualProofSummary & { thisBuild: boolean | null; measuredOn: MeasuredOn | null }) | null; fidelity: (VisualProofSummary & { thisBuild: boolean | null; measuredOn: MeasuredOn | null }) | null; viz: (VizSummary & { certifiedChartTypes: number; certifiedScopes: number; measuredOn: { version: string; sourceHead: string; archiveSha256: null } }) | null };
  dslVersion?: string;
  warnings?: string[];
  changelog?: ChangelogEntry[];
};

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(CURRENT_DIR, '../../../../');
const DEFAULT_STRUCTURED_DATA_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const EPOCH_ISO = new Date(0).toISOString();

function nowMs(): number {
  return Date.now();
}

function resolveStructuredDataDir(): string {
  const configured = process.env.MCP_STRUCTURED_DATA_DIR;
  if (!configured?.trim()) return DEFAULT_STRUCTURED_DATA_DIR;
  return path.resolve(configured);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/** The packaged build stamp beside this module (dist/build-revision.json); a source run has none. */
function readBuildStamp(warnings: string[]): { commit?: string; release?: string } | null {
  try { return readJson<{ commit?: string; release?: string }>(path.resolve(CURRENT_DIR, '../build-revision.json')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push(`build stamp unavailable: ${(error as Error).message}`);
    return null;
  }
}

/**
 * The release this server is part of (s211-m01), not the native package's internal 0.1.0: the version stamped at
 * build time, else the source checkout's own manifest.
 */
function readServerVersion(stamp: { release?: string } | null, warnings: string[]): string {
  if (typeof stamp?.release === 'string' && stamp.release) return stamp.release;
  try {
    const version = readJson<{ version?: string }>(path.join(REPO_ROOT, 'package.json')).version;
    if (typeof version === 'string' && version) return version;
  } catch (error) { warnings.push(`server version unavailable: ${(error as Error).message}`); }
  return 'unknown';
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ToolError('OODS-S016', 'artifact filename is empty');
  }
  if (path.isAbsolute(trimmed) || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ToolError('OODS-S017', `artifact filename is unsafe: ${trimmed}`, { filename: trimmed });
  }
  return trimmed;
}

function resolveArtifactPath(structuredDataDir: string, manifest: ManifestDoc, artifactName: string): string {
  const artifact = manifest.artifacts?.find((entry) => entry.name === artifactName);
  const filename = artifact?.file ? sanitizeFileName(artifact.file) : undefined;
  if (!filename) {
    throw new ToolError('OODS-N007', `artifact "${artifactName}" missing from manifest`, { artifact: artifactName });
  }
  const fullPath = path.join(structuredDataDir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new ToolError('OODS-N007', `artifact "${artifactName}" file not found: ${filename}`, { artifact: artifactName, filename });
  }
  return fullPath;
}

function readRegistryInfo(structuredDataDir: string): {
  components: number;
  traits: number;
  objects: number;
  lastSync: string;
  manifest: ManifestDoc;
} {
  const manifestPath = path.join(structuredDataDir, 'manifest.json');
  const manifest = readJson<ManifestDoc>(manifestPath);
  const componentsPath = resolveArtifactPath(structuredDataDir, manifest, 'components');
  const payload = readJson<Record<string, unknown>>(componentsPath);

  const stats = (typeof payload.stats === 'object' && payload.stats && !Array.isArray(payload.stats))
    ? payload.stats as Record<string, unknown>
    : {};
  const components = typeof stats.componentCount === 'number'
    ? stats.componentCount
    : Array.isArray(payload.components) ? payload.components.length : 0;
  const traits = typeof stats.traitCount === 'number'
    ? stats.traitCount
    : Array.isArray(payload.traits) ? payload.traits.length : 0;
  const objects = typeof stats.objectCount === 'number'
    ? stats.objectCount
    : Array.isArray(payload.objects) ? payload.objects.length : 0;
  const lastSync = typeof payload.generatedAt === 'string'
    ? payload.generatedAt
    : typeof manifest.generatedAt === 'string'
      ? manifest.generatedAt
      : EPOCH_ISO;

  return {
    components: Number.isFinite(components) ? components : 0,
    traits: Number.isFinite(traits) ? traits : 0,
    objects: Number.isFinite(objects) ? objects : 0,
    lastSync,
    manifest,
  };
}

type TokenInfo = {
  built: boolean;
  brands: string[];
  themes: string[];
  scopes: Record<string, string[]>;
  defaultScope: { brand: string; theme: string; source: 'env' | 'default' } | null;
  /** s213-m04: the brands this server can use and the brands folder compared with the build. */
  registry?: BrandRegistryReport;
};

function readTokenInfo(): TokenInfo {
  const built = readTokenScopes();
  const brands = Object.keys(built).sort();
  const scopes = Object.fromEntries(brands.map(brand => [brand, Object.keys(built[brand as keyof typeof built]).sort()]));
  const themes = [...new Set(Object.values(scopes).flat())].sort();
  const brand = process.env.MCP_BRAND ?? DEFAULT_BRAND;
  const theme = process.env.MCP_THEME ?? 'light';
  // This is configured default metadata, never an observed consumer scope.
  const requestedBuilt = scopes[brand]?.includes(theme);
  const fallbackBrand = scopes[DEFAULT_BRAND]?.includes('light') ? DEFAULT_BRAND : brands[0];
  const fallbackTheme = fallbackBrand === DEFAULT_BRAND && scopes[DEFAULT_BRAND].includes('light') ? 'light' : scopes[fallbackBrand]?.[0];
  const defaultScope = requestedBuilt
    ? { brand, theme, source: process.env.MCP_BRAND || process.env.MCP_THEME ? 'env' as const : 'default' as const }
    : fallbackBrand && fallbackTheme ? { brand: fallbackBrand, theme: fallbackTheme, source: 'default' as const } : null;
  return { built: brands.length > 0 && themes.length > 0, brands, themes, scopes, defaultScope };
}

async function readSchemaInfo(): Promise<{ savedCount: number; storeDir: string }> {
  const store = new SchemaStore({
    ...(process.env.MCP_SCHEMA_STORE_ROOT ? { projectRoot: process.env.MCP_SCHEMA_STORE_ROOT } : {}),
    ...(process.env.MCP_SCHEMA_STORE_DIR ? { storeDir: process.env.MCP_SCHEMA_STORE_DIR } : {}),
  });
  const saved = await store.list();
  return {
    savedCount: saved.length,
    storeDir: store.storeDir,
  };
}

export async function handle(input?: HealthInput): Promise<HealthOutput> {
  const started = nowMs();
  const warnings: string[] = [];
  const structuredDataDir = resolveStructuredDataDir();

  let registry: HealthOutput['registry'] = {
    components: 0, traits: 0, objects: 0, lastSync: EPOCH_ISO,
    countsFrom: { components: 'unavailable', traits: 'unavailable', objects: 'unavailable' },
  };
  let tokenInfo: TokenInfo = { built: false, brands: [], themes: [], scopes: {}, defaultScope: null };
  try { tokenInfo = readTokenInfo(); }
  catch (error) { warnings.push(`tokens subsystem unavailable: ${(error as Error).message}`); }
  try {
    tokenInfo.registry = brandRegistryReport();
    for (const issue of tokenInfo.registry.issues) warnings.push(`brand registry: ${issue.message}`);
  } catch (error) { warnings.push(`brand registry unavailable: ${(error as Error).message}`); }
  try {
    const registryInfo = readRegistryInfo(structuredDataDir);
    registry = { ...registry, components: registryInfo.components, traits: registryInfo.traits,
      objects: registryInfo.objects, lastSync: registryInfo.lastSync,
      countsFrom: { components: 'snapshot', objects: 'snapshot', traits: 'snapshot' } };
  } catch (error) {
    warnings.push(`registry export unavailable: ${(error as Error).message}`);
  }
  // Each live loader is independent of the historical export and of the other loaders.
  for (const [name, read] of [['components', liveComponentNames], ['objects', listObjects], ['traits', listTraits]] as const) {
    try {
      registry[name] = read().length;
      registry.countsFrom[name] = 'live';
    } catch (error) {
      warnings.push(`${name} registry unavailable: ${(error as Error).message}; count source is ${registry.countsFrom[name]}.`);
    }
  }
  if (registry.countsFrom.objects === 'live' && registry.countsFrom.traits === 'live') {
    try {
      registry.definitions = definitionRegistryReport();
      const unused = registry.definitions.issues.filter(issue => issue.severity === 'error');
      if (unused.length) warnings.push(`${unused.length} object or trait file${unused.length === 1 ? ' is' : 's are'} not in use: ${unused.map(issue => issue.message).join(' ')}`);
    } catch (error) { warnings.push(`definition registry report unavailable: ${(error as Error).message}`); }
  }

  let schemaInfo = { savedCount: 0, storeDir: path.resolve(process.cwd(), '.oods/schemas') };
  try {
    schemaInfo = await readSchemaInfo();
  } catch (error) {
    warnings.push(`schema store unavailable: ${(error as Error).message}`);
  }

  const stamp = readBuildStamp(warnings);
  // s223-m03 (#2527 ruling 17): each measurement says what it was made on (version, source head, archive or null).
  let measured: ReturnType<typeof readMeasuredOn> | null = null;
  try { measured = readMeasuredOn(); }
  catch (error) { warnings.push(`measurement stamps unavailable: ${(error as Error).message}`); }
  let runtime: HealthOutput['productReality']['runtime'] = null;
  try { const summary = readRuntimeSummary(); runtime = { ...summary, thisBuild: proofMatchesBuild(summary.head, stamp?.commit), measuredOn: measuredOnFor(measured, 'runtime', [summary.head], warnings) }; }
  catch (error) { warnings.push(`runtime proof unavailable: ${(error as Error).message}`); }

  // The reference-app proof names the archive it measured; thisBuild says whether that is the build answering (s211-m01).
  // A shipped proof is always measured before the archive that carries it, so it is labelled, not silently implied.
  const version = readServerVersion(stamp, warnings);
  let release: HealthOutput['productReality']['release'] = null;
  try { const summary = readReleaseSummary(); release = { ...summary, head: summary.bundleHead, thisBuild: proofMatchesBuild(summary.bundleHead, stamp?.commit), measuredOn: measuredOnFor(measured, 'release', [summary.bundleHead], warnings) }; }
  catch (error) { warnings.push(`release proof unavailable: ${(error as Error).message}`); }

  let tools: HealthOutput['productReality']['tools'] = null;
  try {
    const summary = readToolSummary();
    tools = { ...summary, thisBuild: proofMatchesBuild(summary.portable?.dirty ? null : summary.portable?.bundleHead ?? null, stamp?.commit),
      measuredOn: measuredOnFor(measured, 'tools', [summary.portable && !summary.portable.dirty ? summary.portable.bundleHead : summary.head], warnings) };
  }
  catch (error) { warnings.push(`tool proof unavailable: ${(error as Error).message}`); }

  const visual = (kind: 'html' | 'fidelity') => {
    try { const summary = readVisualProofSummary(kind); return { ...summary, thisBuild: proofMatchesBuild(summary.head, stamp?.commit), measuredOn: measuredOnFor(measured, kind, [summary.head, ...summary.heads], warnings) }; }
    catch (error) { warnings.push(`${kind} proof unavailable: ${(error as Error).message}`); return null; }
  };
  const html = visual('html'), fidelity = visual('fidelity');
  let viz: HealthOutput['productReality']['viz'] = null;
  try {
    // s223-m03 (#2527 ruling 17): the certified chart scopes, with what the census that measured them ran on.
    viz = { ...readVizSummary(), certifiedChartTypes: VIZ_RECIPES_CENSUS.chartTypes, certifiedScopes: VIZ_RECIPES_CENSUS.certifiedScopes, measuredOn: { ...VIZ_RECIPES_CENSUS.measuredOn } };
  }
  catch (error) { warnings.push(`viz taxonomy unavailable: ${(error as Error).message}`); }

  const latency = Math.max(0, nowMs() - started);
  const status: HealthOutput['status'] = warnings.length > 0 ? 'degraded' : 'ok';

  const result: HealthOutput = {
    status,
    server: {
      version,
      uptime: Math.max(0, Math.round(process.uptime() * 1000)),
    },
    registry,
    tokens: tokenInfo,
    schemas: schemaInfo,
    latency,
    productReality: withPublicEvidence({ runtime, release, tools, html, fidelity, viz }),
    dslVersion: CURRENT_VERSION,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  if (input?.includeChangelog) {
    result.changelog = getChangelogSince(input.sinceVersion);
  }

  return result;
}
