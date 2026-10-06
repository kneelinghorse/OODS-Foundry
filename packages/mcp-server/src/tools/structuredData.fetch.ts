import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../lib/ajv.js';
import { withinAllowed } from '../lib/security.js';
import type {
  Stage1RollupKind,
  StructuredDataFetchInput,
  StructuredDataFetchOutput,
  StructuredDataset,
} from './types.js';
import { ToolError } from '../errors/tool-error.js';
import { readDerivedAnalysis } from '../lib/derived-analysis.js';
import { withLiveRegistry } from '../lib/live-registry.js';

/**
 * Stage1 structured artifact kinds and the schema_versions OODS currently accepts.
 * Reject anything outside this set so a mid-sprint Stage1 bump lands as a
 * fast-fail instead of a silent parse. Old versions remain accepted for
 * back-compat on archived fixtures; v1.6.0 adds ConfidenceDecomposition-bearing
 * bumps (identity_graph 1.2.0, capability_rollup 1.2.0, object_rollup 1.1.0).
 * Sprint-95 m02 adds read-side acceptance for Stage1's additive drift_report
 * side artifact at schema_version 1.0.0 without activating any downstream
 * consumer surfaces.
 *
 * s204-m03 adds object_rollup 1.2.0, on measured evidence rather than on a version bump alone:
 *
 *   - EVERY object_rollup on disk is 1.2.0. There is no 1.1.0 anywhere, so this list was stale
 *     against ALL current Stage1 output, not part of it — Forge advertised four readable kinds and
 *     could read three.
 *   - The payload is already compatible. A real 1.2.0 rollup, byte-identical except for the version
 *     string, parses under this same validator with schemaValidated true and all 84 objects intact.
 *     The list was the only thing refusing it.
 *   - Stage1 validates 1.0.0, 1.1.0 and 1.2.0 with ONE zod schema; 1.2.0 adds a single optional
 *     boolean, `requires_human_adjudication`.
 *
 * That field is one Forge wants rather than tolerates. It is true when a rollup's semantic→OODS
 * mappings are gated, marking them as PROPOSALS requiring human adjudication and never auto-apply
 * directives — the machine-readable form of the rule near.md §8 states in prose and that Phase E is
 * built around. It is surfaced on `Stage1ObjectRollup` so a consumer can read it rather than infer it.
 *
 * The fast-fail intent above is unchanged: this list still rejects anything outside it, and a future
 * Stage1 bump still lands as a refusal rather than a silent parse.
 */
type RollupKind = 'identity_graph' | 'capability_rollup' | 'object_rollup' | 'drift_report';
const ROLLUP_ALLOWED_SCHEMA_VERSIONS: Record<RollupKind, string[]> = {
  identity_graph: ['1.1.0', '1.2.0'],
  capability_rollup: ['1.1.0', '1.2.0'],
  object_rollup: ['1.0.0', '1.1.0', '1.2.0'],
  // Reviewed through Stage1's 1.4.0 raw-value contract; ratios across versions are different measurements.
  drift_report: ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0'],
};

/**
 * s205-m04 — the run-view kinds, admitted DELIBERATELY (decided at the Sprint 205 lock, #2205, recorded as one
 * decision in m04). A run view needs four things the rollup contract above does not carry, each measured on run
 * 6e435ce7 (legacy) and 09d5af73 (current), admitted by CMOS decision #2264 in s207-m01.
 * run_manifest admits unstamped shape-pinned records and schema_version 1.0.0 through 1.6.0 (s221-m03, #2482 ruling 10:
 * each Stage1 step reviewed against its contract and real runs, artifacts/product-reality/sprint-221/m03/run-manifest/;
 * every step is additive to the fields the run view reads, and a suite root is refused); a11y_report admits
 * schema_version 2.2.0/2.3.0; report_index admits 1.0.0/1.1.0; a11y_evidence uses version 1.1.0/1.2.0.
 * s225-m03 reviews Stage1 eeacc095988e17bddaa9f6b14255bff1a1a26d1d's sprint-98 contract and real release capture:
 * run_manifest 1.7.0 adds capture build, stage, sampling and per-pass browser facts; a11y_report 2.4.0 changes
 * capture-browser/first-party coverage semantics, and 2.5.0 adds optional guided state labels. Evidence 1.3.0 adds
 * complete axe targets and pass/inapplicable rule IDs; 1.4.0 adds capture tier and first-party health. Existing
 * finding, review and score fields are unchanged. Review: artifacts/product-reality/sprint-225/m03/review.md.
 * Every artifact and per-page evidence file read still requires the run manifest's sha256 attestation.
 * Other artifact kinds are not admitted by this run-view contract; index metadata is descriptive only.
 */
const RUN_VIEW_KINDS = {
  a11y_report: { file: 'artifacts/a11y_report.json', payloadKind: 'a11y_report', versionField: 'schema_version', accepted: ['2.2.0', '2.3.0', '2.4.0', '2.5.0'] },
  report_index: { file: 'artifacts/report-index.json', payloadKind: 'report_index', versionField: 'schema_version', accepted: ['1.0.0', '1.1.0'] },
  a11y_evidence: { file: 'evidence/a11y/a11y_manifest.json', payloadKind: 'a11y_evidence_manifest', versionField: 'version', accepted: ['1.1.0', '1.2.0', '1.3.0', '1.4.0'] },
  run_manifest: { file: 'manifest.json', payloadKind: null, versionField: 'schema_version', accepted: ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0'] },
} as const;
export type RunViewKind = keyof typeof RUN_VIEW_KINDS;
export const RUN_VIEW_ADMITTED: Readonly<Record<RunViewKind, readonly string[]>> = {
  a11y_report: RUN_VIEW_KINDS.a11y_report.accepted, report_index: RUN_VIEW_KINDS.report_index.accepted,
  a11y_evidence: RUN_VIEW_KINDS.a11y_evidence.accepted, run_manifest: ['unversioned (shape-pinned)', ...RUN_VIEW_KINDS.run_manifest.accepted],
};
const isRunViewKind = (kind: string): kind is RunViewKind => Object.hasOwn(RUN_VIEW_KINDS, kind);

type ManifestArtifact = {
  name?: string;
  path?: string;
  file?: string;
  etag?: string;
  sizeBytes?: number;
};

type ManifestDoc = {
  generatedAt?: string;
  version?: string;
  source?: Record<string, unknown>;
  artifacts?: ManifestArtifact[];
  delta?: Record<string, unknown>;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const COMPONENT_SCHEMA_PATH = fileURLToPath(new URL('../schemas/component-schema.json', import.meta.url));

const tokensSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['generatedAt', 'layers', 'stats', 'traitOverlays'],
  properties: {
    generatedAt: { type: 'string' },
    layers: {
      type: 'object',
      required: ['reference', 'theme', 'system', 'component', 'view'],
      additionalProperties: true,
    },
    maps: { type: 'object', additionalProperties: true },
    stats: {
      type: 'object',
      required: ['referenceTokens', 'themeTokens', 'systemTokens', 'componentTokens', 'viewTokens', 'mapCount', 'traitOverlayCount'],
      properties: {
        referenceTokens: { type: 'integer', minimum: 0 },
        themeTokens: { type: 'integer', minimum: 0 },
        systemTokens: { type: 'integer', minimum: 0 },
        componentTokens: { type: 'integer', minimum: 0 },
        viewTokens: { type: 'integer', minimum: 0 },
        mapCount: { type: 'integer', minimum: 0 },
        traitOverlayCount: { type: 'integer', minimum: 0 },
      },
      additionalProperties: true,
    },
    traitOverlays: { type: 'array' },
  },
  additionalProperties: true,
};

const ajv = getAjv();
const validateComponents = ajv.compile(JSON.parse(fs.readFileSync(COMPONENT_SCHEMA_PATH, 'utf8')));
const validateTokens = ajv.compile(tokensSchema);

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableSort(entry));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const ordered: Record<string, unknown> = Object.create(null);
    for (const [key, val] of entries) {
      ordered[key] = stableSort(val);
    }
    return ordered;
  }
  return value;
}

export function computeStructuredDataEtag(payload: unknown): string {
  const base =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? Object.assign(Object.create(null), payload as Record<string, unknown>)
      : payload ?? {};
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    delete (base as Record<string, unknown>).generatedAt;
  }
  const canonical = JSON.stringify(stableSort(base));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function relativeToRepo(target: string): string {
  const rel = path.relative(REPO_ROOT, target);
  return rel.startsWith('..') ? target : rel.split(path.sep).join('/');
}

function resolvePath(target: string): string {
  if (path.isAbsolute(target)) return target;
  const trimmed = target.startsWith('OODS-Foundry-mcp/') ? target.replace(/^OODS-Foundry-mcp\//, '') : target;
  return path.resolve(REPO_ROOT, trimmed);
}

function resolveStructuredDataPath(source: string): string | null {
  const resolved = resolvePath(source);
  if (!withinAllowed(REPO_ROOT, resolved)) return null;
  if (withinAllowed(ARTIFACT_DIR, resolved)) {
    return resolved;
  }
  return null;
}

function formatErrors(errors: Array<{ instancePath?: string; message?: string }> | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((err) => `${err.instancePath || '/'} ${err.message || ''}`.trim());
}

function loadManifest(): { manifest?: ManifestDoc; path?: string } {
  const manifestPath = path.join(ARTIFACT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return { manifest: readJson(manifestPath) as ManifestDoc, path: manifestPath };
  } catch (error) {
    throw new ToolError('OODS-S005', `Cannot read structured-data manifest: ${(error as Error).message}`, { path: manifestPath });
  }
}

function findArtifact(manifest: ManifestDoc | undefined, dataset: StructuredDataset): ManifestArtifact | undefined {
  if (!manifest?.artifacts) return undefined;
  return manifest.artifacts.find((entry) => entry.name === dataset);
}

function datasetPath(dataset: StructuredDataset, manifest: ManifestDoc | undefined): { path?: string; manifestArtifact?: ManifestArtifact } {
  if (dataset === 'manifest') {
    return { path: path.join(ARTIFACT_DIR, 'manifest.json') };
  }
  const manifestArtifact = findArtifact(manifest, dataset);
  const source = manifestArtifact?.path
    ?? (manifestArtifact?.file ? path.join(ARTIFACT_DIR, manifestArtifact.file) : undefined);
  const resolved = source ? resolveStructuredDataPath(source) : null;
  return { ...(resolved ? { path: resolved } : {}), manifestArtifact };
}

function datasetFilePrefix(dataset: StructuredDataset): string {
  return dataset === 'components' ? 'oods-components' : 'oods-tokens';
}

export function listAvailableVersions(dataset: StructuredDataset): string[] {
  if (dataset === 'manifest') return [];
  if (!fs.existsSync(ARTIFACT_DIR)) return [];

  const prefix = datasetFilePrefix(dataset);
  const pattern = new RegExp(`^${prefix}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
  const dates: string[] = [];

  for (const entry of fs.readdirSync(ARTIFACT_DIR)) {
    const match = entry.match(pattern);
    if (match?.[1]) dates.push(match[1]);
  }

  return dates.sort();
}

function resolveVersionedPath(
  dataset: StructuredDataset,
  version: string,
): { path: string; resolvedVersion: string; exact: boolean } | null {
  if (dataset === 'manifest') return null;

  const prefix = datasetFilePrefix(dataset);
  const exactFile = path.join(ARTIFACT_DIR, `${prefix}-${version}.json`);
  if (fs.existsSync(exactFile) && withinAllowed(ARTIFACT_DIR, exactFile)) {
    return { path: exactFile, resolvedVersion: version, exact: true };
  }

  // Nearest-available: find closest date
  const available = listAvailableVersions(dataset);
  if (available.length === 0) return null;

  // Find closest earlier or later date
  let nearest: string | undefined;
  for (let i = available.length - 1; i >= 0; i--) {
    if (available[i] <= version) {
      nearest = available[i];
      break;
    }
  }
  if (!nearest) nearest = available[0]; // All dates are after requested; use earliest

  const nearestFile = path.join(ARTIFACT_DIR, `${prefix}-${nearest}.json`);
  if (fs.existsSync(nearestFile) && withinAllowed(ARTIFACT_DIR, nearestFile)) {
    return { path: nearestFile, resolvedVersion: nearest, exact: false };
  }

  return null;
}

function validatePayload(dataset: StructuredDataset, payload: Record<string, unknown>): { ok: boolean; errors: string[] } {
  if (dataset === 'components') {
    const valid = Boolean(validateComponents(payload));
    return { ok: valid, errors: valid ? [] : formatErrors(validateComponents.errors as any) };
  }
  if (dataset === 'tokens') {
    const valid = Boolean(validateTokens(payload));
    return { ok: valid, errors: valid ? [] : formatErrors(validateTokens.errors as any) };
  }
  return { ok: true, errors: [] };
}

function metaFor(dataset: StructuredDataset, payload: Record<string, any>): Record<string, unknown> | undefined {
  if (dataset === 'components') {
    const stats = payload?.stats || {};
    return {
      componentCount: stats.componentCount ?? (Array.isArray(payload?.components) ? payload.components.length : undefined),
      traitCount: stats.traitCount ?? (Array.isArray(payload?.traits) ? payload.traits.length : undefined),
      objectCount: stats.objectCount ?? (Array.isArray(payload?.objects) ? payload.objects.length : undefined),
      domainCount: stats.domainCount ?? (Array.isArray(payload?.domains) ? payload.domains.length : undefined),
      patternCount: stats.patternCount ?? (Array.isArray(payload?.patterns) ? payload.patterns.length : undefined),
      traitOverlayCount: stats.traitOverlayCount ?? (Array.isArray(payload?.traitOverlays) ? payload.traitOverlays.length : undefined),
    };
  }
  if (dataset === 'tokens') {
    const stats = payload?.stats || {};
    return {
      traitOverlayCount: stats.traitOverlayCount ?? (Array.isArray(payload?.traitOverlays) ? payload.traitOverlays.length : undefined),
      tokenCounts: stats,
    };
  }
  const artifacts = payload?.artifacts;
  return artifacts ? { artifactCount: Array.isArray(artifacts) ? artifacts.length : undefined } : undefined;
}

function resolveRollupArtifactPath(kind: Stage1RollupKind, runPath: string): string {
  const absolute = path.isAbsolute(runPath) ? runPath : path.resolve(REPO_ROOT, runPath);
  const filename = `${kind}.json`;

  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    const basename = path.basename(absolute);
    if (basename !== filename) {
      throw new ToolError(
        'OODS-N007',
        `runPath points at "${basename}" but kind "${kind}" expects "${filename}".`,
        { kind, runPath: absolute },
      );
    }
    return absolute;
  }

  const candidates = [
    path.join(absolute, filename),
    path.join(absolute, 'artifacts', filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  throw new ToolError(
    'OODS-N007',
    `Stage1 rollup artifact not found for kind "${kind}" near runPath.`,
    { kind, runPath: absolute, looked: candidates },
  );
}

function validateRollupPayload(
  kind: Stage1RollupKind,
  payload: Record<string, unknown>,
): { schemaVersion: string; runId?: string } {
  const payloadKind = typeof payload.kind === 'string' ? (payload.kind as string) : undefined;
  if (payloadKind !== kind) {
    throw new ToolError(
      'OODS-N007',
      `Artifact kind mismatch: requested "${kind}" but payload reports "${payloadKind ?? 'none'}".`,
      { requestedKind: kind, payloadKind: payloadKind ?? null },
    );
  }

  const schemaVersion = typeof payload.schema_version === 'string' ? (payload.schema_version as string) : undefined;
  if (!schemaVersion) {
    throw new ToolError(
      'OODS-N007',
      `Stage1 rollup "${kind}" is missing schema_version.`,
      { kind },
    );
  }

  const allowed = ROLLUP_ALLOWED_SCHEMA_VERSIONS[kind as RollupKind];
  if (!allowed.includes(schemaVersion)) {
    throw new ToolError(
      'OODS-N007',
      `Unsupported schema_version "${schemaVersion}" for kind "${kind}". Accepted: ${allowed.join(', ')}.`,
      { kind, schemaVersion, accepted: allowed },
    );
  }

  const runId = typeof payload.run_id === 'string' ? (payload.run_id as string) : undefined;
  return { schemaVersion, runId };
}

function rollupMeta(kind: Stage1RollupKind, payload: Record<string, any>): Record<string, unknown> {
  if (kind === 'identity_graph') {
    return { nodeCount: Array.isArray(payload.nodes) ? payload.nodes.length : 0 };
  }
  if (kind === 'capability_rollup') {
    return { capabilityCount: Array.isArray(payload.capabilities) ? payload.capabilities.length : 0 };
  }
  if (kind === 'drift_report') {
    return { signalCount: Array.isArray(payload.signals) ? payload.signals.length : 0 };
  }
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  let variantCount = 0;
  for (const obj of objects) {
    if (obj && Array.isArray((obj as any).projection_variants)) {
      variantCount += (obj as any).projection_variants.length;
    }
  }
  return { objectCount: objects.length, projectionVariantCount: variantCount };
}

async function handleRollupFetch(
  input: StructuredDataFetchInput,
): Promise<StructuredDataFetchOutput> {
  const kind = input.kind as Stage1RollupKind;
  if (!input.runPath) {
    throw new ToolError('OODS-V202', `structuredData.fetch requires runPath when kind is set.`, { kind });
  }
  if (input.listVersions) {
    throw new ToolError('OODS-V202', 'structuredData.fetch: listVersions is not supported in kind mode.', { kind });
  }
  if (input.version) {
    throw new ToolError('OODS-V202', 'structuredData.fetch: version is not supported in kind mode.', { kind });
  }

  const includePayload = input.includePayload !== false;
  const dataPath = resolveRollupArtifactPath(kind, input.runPath);
  const payload = readJson(dataPath);
  const { schemaVersion, runId } = validateRollupPayload(kind, payload);
  const etag = computeStructuredDataEtag(payload);
  const matched = Boolean(input.ifNoneMatch && input.ifNoneMatch === etag);
  const payloadIncluded = includePayload && !matched;
  const sizeBytes = fs.statSync(dataPath).size;
  const generatedAt = typeof (payload as any).generated_at === 'string' ? (payload as any).generated_at : null;

  return {
    kind,
    schemaVersion,
    ...(runId ? { runId } : {}),
    generatedAt,
    etag,
    matched,
    payloadIncluded,
    path: relativeToRepo(dataPath),
    sizeBytes,
    schemaValidated: true,
    meta: rollupMeta(kind, payload as Record<string, any>),
    payload: payloadIncluded ? payload : undefined,
  };
}

/** The run directory a run-view kind is read from: the directory holding manifest.json, or runPath/artifacts' parent. */
function resolveRunDirectory(runPath: string): string {
  const absolute = path.isAbsolute(runPath) ? runPath : path.resolve(REPO_ROOT, runPath);
  const candidates = [absolute, path.dirname(absolute)];
  const found = candidates.find(candidate => fs.existsSync(path.join(candidate, 'manifest.json')));
  if (!found) {
    // s206-m03: a path that is not there is said so, apart from a directory that holds no run.
    if (!fs.existsSync(absolute)) throw new ToolError('OODS-N007', 'runPath does not exist.', { runPath: absolute, exists: false });
    throw new ToolError('OODS-N007', `No Stage1 run manifest (manifest.json) at or above runPath.`, { runPath: absolute, looked: candidates.map(candidate => path.join(candidate, 'manifest.json')) });
  }
  return found;
}

const sha256File = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Both the historical unstamped manifest and every admitted version must carry the shape the view reads. */
function validateRunManifest(manifest: Record<string, any>): void {
  if (Object.hasOwn(manifest, 'analysis')) throw new ToolError('OODS-N007', 'Derived analysis is not a captured run; use kind derived_analysis.');
  // From run_manifest 1.4.0 a suite's root records its targets in inputs.suite, and each target is its own run under
  // targets/<id>: the root is not one captured run, so it is never read as its first target (s221-m03).
  if (manifest.inputs && typeof manifest.inputs === 'object' && Object.hasOwn(manifest.inputs, 'suite')) {
    throw new ToolError('OODS-N007', 'This is a suite\'s root, which records its targets; each target is its own run. Point runPath at one of them, targets/<id>.', { kind: 'run_manifest', mode: manifest.mode ?? null, targets: Array.isArray(manifest.targets) ? manifest.targets.length : null });
  }
  if (manifest.schema_version !== undefined && !(RUN_VIEW_KINDS.run_manifest.accepted as readonly unknown[]).includes(manifest.schema_version)) {
    throw new ToolError('OODS-N007', `Unsupported schema_version "${String(manifest.schema_version)}" for kind "run_manifest". Accepted: ${RUN_VIEW_ADMITTED.run_manifest.join(', ')}.`, { kind: 'run_manifest', schemaVersion: manifest.schema_version, accepted: RUN_VIEW_ADMITTED.run_manifest });
  }
  const missing = [
    typeof manifest.run_id !== 'string' && 'run_id',
    typeof manifest.mode !== 'string' && 'mode',
    !(Array.isArray(manifest.targets) && manifest.targets.length > 0 && manifest.targets.every((t: any) => typeof t?.name === 'string' && typeof t?.url === 'string')) && 'targets[{name,url}]',
    !(Array.isArray(manifest.passes) && manifest.passes.every((p: any) => typeof p?.id === 'string' && typeof p?.version === 'string' && typeof p?.status === 'string')) && 'passes[{id,version,status}]',
    typeof manifest.environment?.timestamp !== 'string' && 'environment.timestamp',
    !(manifest.hashes && typeof manifest.hashes === 'object' && !Array.isArray(manifest.hashes)) && 'hashes',
  ].filter(Boolean);
  if (missing.length) {
    throw new ToolError('OODS-N007', `Stage1 run manifest does not have the shape a run view reads; missing ${missing.join(', ')}.`, { kind: 'run_manifest', missing });
  }
}

async function handleRunViewFetch(input: StructuredDataFetchInput & { kind: RunViewKind }): Promise<StructuredDataFetchOutput> {
  const kind = input.kind;
  if (!input.runPath) throw new ToolError('OODS-V202', `structuredData.fetch requires runPath when kind is set.`, { kind });
  if (input.listVersions || input.version) throw new ToolError('OODS-V202', `structuredData.fetch: version and listVersions are not supported in kind mode.`, { kind });
  const spec = RUN_VIEW_KINDS[kind];
  const runDir = resolveRunDirectory(input.runPath);
  const manifestBytes = fs.readFileSync(path.join(runDir, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Record<string, any>;
  const manifestSha256 = crypto.createHash('sha256').update(manifestBytes).digest('hex');
  validateRunManifest(manifest);

  const dataPath = path.join(runDir, spec.file);
  if (!fs.existsSync(dataPath)) throw new ToolError('OODS-N007', `Stage1 artifact not found for kind "${kind}": ${spec.file}.`, { kind, runPath: runDir, looked: [dataPath] });
  let payload = readJson(dataPath) as Record<string, any>;
  let schemaVersion = manifest.schema_version ?? 'unversioned (shape-pinned)';
  let meta: Record<string, unknown>;
  if (kind !== 'run_manifest') {
    if (payload.kind !== spec.payloadKind) {
      throw new ToolError('OODS-N007', `Artifact kind mismatch: requested "${kind}" but payload reports "${payload.kind ?? 'none'}".`, { requestedKind: kind, payloadKind: payload.kind ?? null });
    }
    const version = payload[spec.versionField];
    if (typeof version !== 'string') throw new ToolError('OODS-N007', `Stage1 artifact "${kind}" is missing ${spec.versionField}.`, { kind });
    if (!(spec.accepted as readonly string[]).includes(version)) {
      throw new ToolError('OODS-N007', `Unsupported ${spec.versionField} "${version}" for kind "${kind}". Accepted: ${spec.accepted.join(', ')}.`, { kind, schemaVersion: version, accepted: spec.accepted });
    }
    schemaVersion = version;
    // Every artifact the run view reads is under the run's own attestation, and is refused if the bytes differ.
    const attested = manifest.hashes[spec.file];
    if (typeof attested !== 'string' || attested !== sha256File(dataPath)) {
      throw new ToolError('OODS-N007', `${spec.file} is not under the run manifest's attestation (${typeof attested === 'string' ? 'sha256 differs' : 'not attested'}).`, { kind, file: spec.file });
    }
  }
  if (kind === 'a11y_evidence') {
    // The per-page axe files, each read only once its sha256 matches the manifest's attestation for that path.
    const pages = (Array.isArray(payload.pages) ? payload.pages : []).map((page: Record<string, any>) => {
      const file = String(page.axe_results_path ?? '');
      const absolute = path.join(runDir, file);
      const attested = manifest.hashes[file];
      if (!file.startsWith('evidence/a11y/') || !fs.existsSync(absolute) || typeof attested !== 'string' || attested !== sha256File(absolute)) {
        throw new ToolError('OODS-N007', `Evidence file ${file || '(none)'} is not under the run manifest's attestation.`, { kind, file, attested: typeof attested === 'string' });
      }
      return { route: page.route, url: page.url, evidencePath: file, sha256: attested, evidence: readJson(absolute) };
    });
    payload = { ...payload, pages };
    meta = { pageCount: pages.length, attestedFiles: pages.length + 1, violationCount: pages.reduce((n: number, page: any) => n + (Array.isArray(page.evidence?.violations) ? page.evidence.violations.length : 0), 0) };
  } else if (kind === 'a11y_report') {
    meta = { pageCount: Array.isArray(payload.pages) ? payload.pages.length : 0, violationCount: payload.rollup?.violation_count ?? null };
  } else if (kind === 'report_index') {
    const states = ['measured', 'measured_zero', 'not_measured', 'not_applicable', 'needs_review'];
    if (payload.artifacts?.some((entry: Record<string, any>) => entry.result_state !== undefined && !states.includes(entry.result_state))) {
      throw new ToolError('OODS-N007', 'report_index contains an unsupported result_state.', { kind, accepted: states });
    }
    meta = { artifactCount: Array.isArray(payload.artifacts) ? payload.artifacts.length : 0 };
  } else {
    meta = { passCount: manifest.passes.length, targetCount: manifest.targets.length, attestedCount: Object.keys(manifest.hashes).length };
  }

  const includePayload = input.includePayload !== false;
  const etag = computeStructuredDataEtag(payload);
  const matched = Boolean(input.ifNoneMatch && input.ifNoneMatch === etag);
  const payloadIncluded = includePayload && !matched;
  return {
    kind, schemaVersion, runId: manifest.run_id,
    generatedAt: typeof payload.generated_at === 'string' ? payload.generated_at : typeof payload.captured_at === 'string' ? payload.captured_at : manifest.environment.timestamp,
    etag, matched, payloadIncluded, path: relativeToRepo(dataPath), sizeBytes: fs.statSync(dataPath).size, schemaValidated: true, meta: { ...meta, manifestSha256 },
    payload: payloadIncluded ? payload : undefined,
  };
}

export async function handle(input: StructuredDataFetchInput): Promise<StructuredDataFetchOutput> {
  if (input.kind === 'derived_analysis') {
    if (!input.runPath || input.listVersions || input.version) throw new ToolError('OODS-V202', 'structuredData.fetch derived_analysis requires runPath and does not support version/listVersions.');
    const view = readDerivedAnalysis(path.resolve(REPO_ROOT, input.runPath));
    const payload = { manifest: view.manifest, analysis: view.analysis, sourceManifest: view.sourceManifest, report: view.report, index: view.index, ...(view.figTokens ? { figTokens: view.figTokens } : {}) };
    const etag = computeStructuredDataEtag(payload);
    const matched = input.ifNoneMatch === etag;
    const payloadIncluded = input.includePayload !== false && !matched;
    return { kind: input.kind, schemaVersion: view.analysis.schema_version, runId: view.analysis.analysis_run_id, generatedAt: view.analysis.analyzed_at,
      etag, matched, payloadIncluded, path: relativeToRepo(path.join(view.runPath, 'manifest.json')), sizeBytes: Buffer.byteLength(JSON.stringify(payload)), schemaValidated: true,
      meta: { manifestSha256: view.manifestSha256, sourceRunId: view.analysis.source.run_id, capturedAt: view.analysis.source.captured_at, sourceManifestAt: view.sourceManifest.environment.timestamp, analyzedAt: view.analysis.analyzed_at,
        signalCount: view.report.signals.length, resultState: view.resultState, resultNote: view.resultNote, attestedFiles: Object.keys(view.manifest.hashes).length, checked: view.checked, notChecked: view.notChecked },
      payload: payloadIncluded ? payload : undefined };
  }
  if (input.kind && isRunViewKind(input.kind)) {
    return handleRunViewFetch(input as StructuredDataFetchInput & { kind: RunViewKind });
  }
  if (input.kind) {
    return handleRollupFetch(input);
  }

  if (!input.dataset) {
    throw new ToolError(
      'OODS-V202',
      'structuredData.fetch requires either dataset (components|tokens|manifest) or kind+runPath.',
      { input },
    );
  }

  const dataset = input.dataset;
  const includePayload = input.includePayload !== false;
  const manifestInfo = loadManifest();
  const warnings: string[] = [];

  // --- listVersions mode ---
  if (input.listVersions) {
    const versions = listAvailableVersions(dataset);
    const versionListEtag = computeStructuredDataEtag({ dataset, versions });
    return {
      dataset,
      version: manifestInfo.manifest?.version ?? null,
      etag: versionListEtag,
      matched: false,
      payloadIncluded: false,
      path: relativeToRepo(ARTIFACT_DIR),
      sizeBytes: 0,
      schemaValidated: true,
      availableVersions: versions,
      requestedVersion: null,
      resolvedVersion: null,
    };
  }

  // --- Version resolution ---
  let dataPath: string | undefined;
  let manifestArtifact: ManifestArtifact | undefined;
  let requestedVersion: string | null = input.version ?? null;
  let resolvedVersion: string | null = null;

  if (input.version && dataset !== 'manifest') {
    const versionResult = resolveVersionedPath(dataset, input.version);
    if (!versionResult) {
      throw new ToolError('OODS-N007', `No versioned artifact found for "${dataset}" near version "${input.version}".`, { dataset, version: input.version });
    }
    dataPath = versionResult.path;
    resolvedVersion = versionResult.resolvedVersion;
    if (!versionResult.exact) {
      warnings.push(
        `Exact version "${input.version}" not found for ${dataset}. Resolved to nearest: "${versionResult.resolvedVersion}".`,
      );
    }
    // No manifest artifact for versioned requests — ETag will be computed fresh
  } else {
    if (input.version && dataset === 'manifest') {
      warnings.push('Version parameter is not supported for the manifest dataset; returning latest.');
    }
    const resolved = datasetPath(dataset, manifestInfo.manifest);
    dataPath = resolved.path;
    manifestArtifact = resolved.manifestArtifact;
  }

  if (!dataPath || !fs.existsSync(dataPath)) {
    throw new ToolError('OODS-N007', `Dataset not found for "${dataset}".`, { dataset });
  }

  const stored = dataset === 'manifest' && manifestInfo.manifest ? manifestInfo.manifest : readJson(dataPath);
  const live = dataset === 'components' && !input.version;
  // s222-m03 (#2502 ruling 15): the live projection lists internal objects only with includeInternal.
  const payload = live ? withLiveRegistry(stored, { includeInternal: input.includeInternal === true }) : stored;
  const etag = computeStructuredDataEtag(payload);
  const matched = Boolean(input.ifNoneMatch && input.ifNoneMatch === etag);
  const payloadIncluded = includePayload && !matched;
  const validation = validatePayload(dataset, payload);
  const generatedAt = (payload as Record<string, any>).generatedAt ?? manifestInfo.manifest?.generatedAt ?? null;

  if (manifestArtifact?.etag && manifestArtifact.etag !== computeStructuredDataEtag(stored)) {
    warnings.push(`Manifest ETag mismatch for ${dataset}: expected ${manifestArtifact.etag}, computed ${computeStructuredDataEtag(stored)}`);
  }

  const sizeBytes = live ? Buffer.byteLength(JSON.stringify(payload)) : fs.statSync(dataPath).size;
  const output: StructuredDataFetchOutput = {
    dataset,
    version: resolvedVersion ?? manifestInfo.manifest?.version ?? null,
    generatedAt,
    etag,
    matched,
    payloadIncluded,
    path: relativeToRepo(dataPath),
    manifestPath: manifestInfo.path ? relativeToRepo(manifestInfo.path) : null,
    sizeBytes,
    schemaValidated: validation.ok,
    validationErrors: validation.errors.length ? validation.errors : undefined,
    warnings: warnings.length ? warnings : undefined,
    meta: { ...metaFor(dataset, payload as Record<string, any>), source: live ? 'live-registry' : 'committed-export' },
    payload: payloadIncluded ? (payload as Record<string, unknown>) : undefined,
    ...(requestedVersion !== null ? { requestedVersion } : {}),
    ...(resolvedVersion !== null ? { resolvedVersion } : {}),
  };

  return output;
}
