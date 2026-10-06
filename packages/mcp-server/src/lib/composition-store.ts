import { randomBytes } from 'node:crypto';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { GeneratedArtifact } from '../codegen/types.js';
import { ToolError } from '../errors/tool-error.js';
import { SchemaStore } from '../schema-store/index.js';
import type { UiSchema } from '../schemas/generated.js';

/** cmp- plus twelve hex characters; the preview host applies the same rule to URLs. */
export const COMPOSITION_ID_PATTERN = /^cmp-[a-f0-9]{12}$/;
export const COMPOSITION_RECORD_VERSION = '1';
export type CompositionOperation = 'compose' | 'recompose' | 'reorder-region' | 'swap-slot' | 'reorder-fields' | 'seed';
export type PreviewFramework = 'react' | 'vue';
export type PreviewTheme = 'light' | 'dark' | 'hc';
/** A brand in the brand registry (s213-m04): the token build's brands, not a list in code. */
export type PreviewBrand = string;
export type PreviewScope = `${PreviewBrand}/${PreviewTheme}`;
export interface ComponentPackage { framework: PreviewFramework; name: string; version: string; directory: string; contentHash: string; shadcn?: import('../tools/map.shadcn.js').InspectedShadcn }

/** Artifacts and placed-chart certifications generated for a brand and theme other than the version's own (Sprint 202 m01). */
export interface ScopedGeneration {
  artifacts: Partial<Record<PreviewFramework, { artifact: GeneratedArtifact; generatedAt: string; tokenBuildHash?: string }>>;
  /** certifyPlacedCharts for this scope, stored once. */
  charts?: unknown[];
}

import type { StoredContext } from './preview-context.js';
import type { StoredObservation } from './preview-observation.js';
import type { StoredRunView } from './run-view.js';
import type { StoredComparisonView } from './comparison-view.js';

export interface CompositionVersion {
  componentPackages?: ComponentPackage[];
  recordVersion: typeof COMPOSITION_RECORD_VERSION;
  compositionId: string;
  version: number;
  /** The version this one was produced from; null for the first. */
  parentVersion: number | null;
  operation: CompositionOperation;
  createdAt: string;
  /** The Forge head that produced it (dist/build-revision.json), null from a source run. */
  head: string | null;
  /** The compose inputs, replayable. */
  compose: Record<string, unknown>;
  schema: UiSchema;
  schemaHash: string;
  /** What the artifacts were generated for; the page can re-mount in any scope. */
  brand: PreviewBrand;
  theme: PreviewTheme;
  /** Slot name → leading component, for lineage and compare. */
  slots: Array<{ slotName: string; selectedComponent?: string; placedComponents?: string[]; candidates?: string[] }>;
  /** Attached by design.preview: the deterministic field model the page mounts with. */
  model?: Record<string, unknown>;
  /** Attached by design.preview: the generated artifact per framework, keyed by the same schemaHash. */
  artifacts: Partial<Record<PreviewFramework, { artifact: GeneratedArtifact; generatedAt: string; tokenBuildHash?: string }>>;
  /** Attached by measurement (m04). */
  measurements: Record<string, unknown>;
  /**
   * Attached by design.preview's contextItems input (s203 m05): the decisions and evidence the caller
   * found about this object, keyed to it, stored here so they are durable and travel with the lineage.
   * Forge fetches none of it — see lib/preview-context.ts.
   */
  context?: StoredContext;
  /**
   * Attached by design.preview's observationRunPath input (s204 m05): the rows of a Stage1-against-Forge
   * comparison about this object, read from a run on disk through structuredData.fetch. Evidence for
   * review; see lib/preview-observation.ts.
   */
  observation?: StoredObservation;
  /** s205-m04: the Stage1 run whose real records this version shows (lib/run-view.ts); its target never changes underneath it. */
  runView?: StoredRunView;
  comparisonView?: StoredComparisonView;
  /** Attached when a brand or theme switch needs the placed charts rendered for that scope, keyed brand/theme. */
  scopes?: Partial<Record<PreviewScope, ScopedGeneration>>;
}

export interface CompositionVersionSummary { version: number; parentVersion: number | null; operation: CompositionOperation; createdAt: string; schemaHash: string; head: string | null; artifacts: PreviewFramework[] }

/** Compositions live beside the saved-schema store: <store>/../compositions, so the same env moves both. */
export function resolveCompositionsDir(env: NodeJS.ProcessEnv = process.env): string {
  const store = new SchemaStore({
    ...(env.MCP_SCHEMA_STORE_ROOT ? { projectRoot: env.MCP_SCHEMA_STORE_ROOT } : {}),
    ...(env.MCP_SCHEMA_STORE_DIR ? { storeDir: env.MCP_SCHEMA_STORE_DIR } : {}),
  });
  return path.resolve(store.storeDir, '..', 'compositions');
}

export const newCompositionId = (): string => `cmp-${randomBytes(6).toString('hex')}`;
export const isSafeCompositionId = (value: unknown): value is string => typeof value === 'string' && COMPOSITION_ID_PATTERN.test(value);
export const isSafeVersion = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1_000_000;

const notFound = (compositionId: string, version?: number) =>
  new ToolError('OODS-N022', version === undefined ? `Composition ${compositionId} is not in the store` : `Composition ${compositionId} has no version ${version}`, { compositionId, ...(version === undefined ? {} : { version }) });

export function versionPath(directory: string, compositionId: string, version: number): string {
  if (!isSafeCompositionId(compositionId)) throw new ToolError('OODS-V203', `Composition ids are cmp- plus twelve hex characters, not ${JSON.stringify(compositionId)}`, { compositionId });
  if (!isSafeVersion(version)) throw new ToolError('OODS-V203', `Composition versions are positive integers, not ${JSON.stringify(version)}`, { compositionId, version });
  return path.join(directory, compositionId, 'versions', `${version}.json`);
}

export async function listVersions(directory: string, compositionId: string): Promise<CompositionVersionSummary[]> {
  const folder = path.dirname(versionPath(directory, compositionId, 1));
  let names: string[];
  try { names = await fsp.readdir(folder); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound(compositionId); throw error; }
  const versions = names.map(name => /^(\d+)\.json$/.exec(name)?.[1]).filter((value): value is string => Boolean(value)).map(Number).sort((a, b) => a - b);
  const summaries: CompositionVersionSummary[] = [];
  for (const version of versions) {
    const record = await readVersion(directory, compositionId, version);
    summaries.push({ version: record.version, parentVersion: record.parentVersion, operation: record.operation, createdAt: record.createdAt, schemaHash: record.schemaHash, head: record.head, artifacts: Object.keys(record.artifacts ?? {}) as PreviewFramework[] });
  }
  return summaries;
}

export async function latestVersion(directory: string, compositionId: string): Promise<number> {
  const versions = await listVersions(directory, compositionId);
  const last = versions.at(-1);
  if (!last) throw notFound(compositionId);
  return last.version;
}

export async function readVersion(directory: string, compositionId: string, version: number): Promise<CompositionVersion> {
  const file = versionPath(directory, compositionId, version);
  let raw: string;
  try { raw = await fsp.readFile(file, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw notFound(compositionId, version); throw error; }
  const record = JSON.parse(raw) as CompositionVersion;
  if (record.recordVersion !== COMPOSITION_RECORD_VERSION || record.compositionId !== compositionId || record.version !== version) throw new Error(`Malformed composition record: ${file}`);
  return record;
}

/** A version is written once (flag wx): no operation ever overwrites an existing version's schema. */
export async function writeVersion(directory: string, record: CompositionVersion): Promise<string> {
  const file = versionPath(directory, record.compositionId, record.version);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return file;
}

/** The next free version number and the parent it derives from. */
export async function nextVersion(directory: string, compositionId: string, parentVersion?: number): Promise<{ version: number; parentVersion: number }> {
  const versions = await listVersions(directory, compositionId);
  const latest = versions.at(-1)!.version;
  const parent = parentVersion ?? latest;
  if (!versions.some(entry => entry.version === parent)) throw notFound(compositionId, parent);
  return { version: latest + 1, parentVersion: parent };
}

/**
 * Attach derived, deterministic data (artifacts, model, measurements) to an existing version. The
 * schema is asserted unchanged; the file is replaced atomically.
 */
export async function attachToVersion(directory: string, compositionId: string, version: number, patch: Partial<Pick<CompositionVersion, 'artifacts' | 'model' | 'measurements' | 'scopes' | 'context' | 'observation' | 'runView' | 'comparisonView' | 'componentPackages'>>): Promise<CompositionVersion> {
  const record = await readVersion(directory, compositionId, version);
  const scopes = { ...(record.scopes ?? {}) } as NonNullable<CompositionVersion['scopes']>;
  for (const [key, generation] of Object.entries(patch.scopes ?? {}) as Array<[PreviewScope, ScopedGeneration]>) {
    const existing = scopes[key];
    scopes[key] = { artifacts: { ...(existing?.artifacts ?? {}), ...generation.artifacts }, ...(generation.charts ?? existing?.charts ? { charts: generation.charts ?? existing?.charts } : {}) };
  }
  // Context replaces rather than merges: a panel is what one call attached, so a later call supplying
  // fewer items must not leave the earlier ones standing beside a design they were not fetched for.
  const updated: CompositionVersion = { ...record, ...(patch.componentPackages ? { componentPackages: patch.componentPackages } : {}), ...(patch.model ? { model: patch.model } : {}), artifacts: { ...record.artifacts, ...(patch.artifacts ?? {}) }, measurements: { ...record.measurements, ...(patch.measurements ?? {}) }, ...(Object.keys(scopes).length ? { scopes } : {}), ...(patch.context ? { context: patch.context } : {}), ...(patch.observation ? { observation: patch.observation } : {}), ...(patch.runView ? { runView: patch.runView } : {}), ...(patch.comparisonView ? { comparisonView: patch.comparisonView } : {}) };
  const file = versionPath(directory, compositionId, version);
  const temporary = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(updated, null, 2) + '\n');
  await fsp.rename(temporary, file);
  return updated;
}

/** One acceptance of a composition version (Sprint 202 m04): what was accepted, when, by which head, and what it measured then. */
export interface CompositionAcceptance {
  version: number;
  acceptedAt: string;
  /** The Forge head that recorded the acceptance, null from a source run. */
  head: string | null;
  /** The Forge head that produced the version. */
  versionHead: string | null;
  schemaHash: string;
  /** The version's stored measurements at acceptance: generation receipts, placed-chart certifications, axe-core per framework and scope. */
  measurements: Record<string, unknown>;
  /** Placed-chart certifications stored for scopes other than the version's own, keyed brand/theme. */
  scopeCharts: Record<string, unknown[]>;
  /** The summary design.preview reports as measured, at acceptance. */
  measured: unknown;
  /** The acceptance this one supersedes; null for the first. */
  supersedes: { version: number; acceptedAt: string } | null;
}
export interface AcceptedRecord { recordVersion: typeof COMPOSITION_RECORD_VERSION; compositionId: string; acceptances: CompositionAcceptance[] }

/** <compositions>/<id>/accepted.json, beside versions/ and never listed as a version. */
export function acceptedPath(directory: string, compositionId: string): string {
  return path.join(path.dirname(path.dirname(versionPath(directory, compositionId, 1))), 'accepted.json');
}

export async function readAccepted(directory: string, compositionId: string): Promise<AcceptedRecord | null> {
  const file = acceptedPath(directory, compositionId);
  let raw: string;
  try { raw = await fsp.readFile(file, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  const record = JSON.parse(raw) as AcceptedRecord;
  if (record.recordVersion !== COMPOSITION_RECORD_VERSION || record.compositionId !== compositionId || !Array.isArray(record.acceptances)) throw new Error(`Malformed acceptance record: ${file}`);
  return record;
}

/** Record one acceptance: appended to accepted.json, replaced atomically; the previous acceptance stays and is named as superseded. */
export async function appendAcceptance(directory: string, compositionId: string, entry: Omit<CompositionAcceptance, 'supersedes'>): Promise<{ record: AcceptedRecord; acceptance: CompositionAcceptance; file: string }> {
  const file = acceptedPath(directory, compositionId);
  const current = await readAccepted(directory, compositionId);
  const previous = current?.acceptances.at(-1);
  const acceptance: CompositionAcceptance = { ...entry, supersedes: previous ? { version: previous.version, acceptedAt: previous.acceptedAt } : null };
  const record: AcceptedRecord = { recordVersion: COMPOSITION_RECORD_VERSION, compositionId, acceptances: [...(current?.acceptances ?? []), acceptance] };
  const temporary = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(record, null, 2) + '\n');
  await fsp.rename(temporary, file);
  return { record, acceptance, file };
}

/** The packaged build head, when this module runs from dist; a source checkout reports null. */
export function readForgeHead(): string | null {
  const stamp = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../build-revision.json');
  if (!fs.existsSync(stamp)) return null;
  const revision = JSON.parse(fs.readFileSync(stamp, 'utf8')) as { commit?: string };
  return typeof revision.commit === 'string' && /^[0-9a-f]{40}$/.test(revision.commit) ? revision.commit : null;
}
