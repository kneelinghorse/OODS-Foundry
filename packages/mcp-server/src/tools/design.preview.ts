import { tokenCssHash } from '../lib/token-build.js';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { bindSubstitutionPackages, validateGeneratedArtifact } from '../codegen/artifact-envelope.js';
import { checkSubstitutionContracts } from '../codegen/substitution-contracts.js';
import type { SubstitutionContractReport } from '@oods/component-contracts';
import { preparePreviewComponents, refreshPreviewMappings } from '../lib/preview-components.js';
import { seedPreviewModel } from '../codegen/preview-model.js';
import { shownSampleRecord, workflowSampleRecords } from '../codegen/workflow-data-emitter.js';
import { snakeToCamel } from '../codegen/binding-utils.js';
import { assertRunMatches, readRunView, selectRunRecord, type RunView, type RunViewObject } from '../lib/run-view.js';
import { certifyPlacedCharts } from '../lib/measurements.js';
import { ToolError } from '../errors/tool-error.js';
import { readComparisonView, selectComparisonRecord, assertComparisonMatches, storeComparisonView, type ComparisonView, type ComparisonObject } from '../lib/comparison-view.js';
import { ContextRefusal, carryContextForward, objectUrn, validateContext, type StoredContext } from '../lib/preview-context.js';
import { carryObservationForward, observeForVersion, type StoredObservation } from '../lib/preview-observation.js';
import { listObjects, loadObject } from '../objects/object-loader.js';
import { appendAcceptance, attachToVersion, latestVersion, listVersions, readAccepted, readForgeHead, readVersion, resolveCompositionsDir, versionPath, writeVersion, type CompositionVersion, type PreviewBrand, type PreviewFramework, type PreviewTheme } from '../lib/composition-store.js';
import { fieldKeyOf } from './design.compose.js';
import { chartNodes } from '../codegen/chart-declaration.js';
import type { UiElement } from '../schemas/generated.js';
import type { ToolContext } from '../lib/tool-context.js';
import type { DesignPreviewInputSchema, DesignPreviewOutputSchema } from '../schemas/generated.js';
import { handle as generate } from './code.generate.js';
import { handle as compose } from './design.compose.js';
import { seedSchema } from '../compose/workflow-assembler.js';
import { DEFAULT_BRAND, knownBrands } from '../lib/brand-registry.js';

type DesignPreviewOutput = DesignPreviewOutputSchema.DesignPreviewOutput;
type RenderOutput = Exclude<DesignPreviewOutput, { action: 'compare' } | { action: 'versions' } | { action: 'accept' }>;
type CompareOutput = Extract<DesignPreviewOutput, { action: 'compare' }>;
type VersionsOutput = Extract<DesignPreviewOutput, { action: 'versions' }>;
type AcceptOutput = Extract<DesignPreviewOutput, { action: 'accept' }>;
type EditInput = NonNullable<DesignPreviewInputSchema.DesignPreviewInput['edit']>;
type PreviewEntry = RenderOutput['previews'][number];
const PROBE_TIMEOUT_MS = 3_000;
const COMPILE_TIMEOUT_MS = 60_000;
const digest = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

type HostStatus = {
  running: boolean;
  compositionsDir: string;
  platform: { supported: boolean; os: string; arch: string; reason?: string; gap?: 'unshipped' | 'incomplete' };
};

/** The bridge hosts the preview in-process and the stdio adapter starts one; both pass its URL per request. */
export function resolvePreviewHostUrl(context?: ToolContext, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromEnv = env.OODS_PREVIEW_HOST_URL?.trim();
  return context?.previewHostUrl ?? (fromEnv && fromEnv.length > 0 ? fromEnv : undefined);
}

const unreachable = (reason: string, details: Record<string, unknown>) =>
  new ToolError('OODS-N021', `design.preview: ${reason}`, { dependency: 'preview-host', ...details });

type RefusedStep = Array<{ code?: string; message?: string; hint?: string; component?: string }> | undefined;

/** The composition the preview asked for was refused: its own first error, typed and plain (s206-m03), not a JSON dump. */
function compositionRefusal(errors: RefusedStep): ToolError {
  const first = errors?.[0];
  return new ToolError(first?.code ?? 'OODS-V203', `design.preview: ${first?.message ?? 'the composition failed.'}${first?.hint ? ` ${first.hint}` : ''}`, { errors: errors ?? [] });
}

/** Generation refused: the first cause once, with the count, and the next step when the install itself is damaged. */
function generationRefusal(framework: string, errors: RefusedStep): ToolError {
  const list = errors ?? [];
  if (list.some(error => /attestation-invalid/.test(error.message ?? ''))) {
    const components = new Set(list.map(error => error.component).filter(Boolean));
    return new ToolError('OODS-N015', `design.preview could not generate the ${framework} app: this runtime's files no longer match what the release sealed, so code generation refuses (${components.size} components, evidence state: attestation-invalid). Extract the release archive again into an empty directory and restart your MCP client.`, { errors: list });
  }
  const first = list[0];
  const more = list.length > 1 ? ` (${list.length - 1} more in details)` : '';
  return new ToolError(first?.code ?? 'OODS-N015', `design.preview could not generate the ${framework} app: ${first?.message ?? 'generation failed.'}${more}`, { errors: list });
}

async function probeHost(hostUrl: string): Promise<HostStatus> {
  let status: HostStatus;
  try {
    const response = await fetch(`${hostUrl}/preview/status`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    status = await response.json() as HostStatus;
  } catch (error) {
    throw unreachable(`the preview host at ${hostUrl} did not answer /preview/status (${error instanceof Error ? error.message : String(error)}); call through the HTTP bridge or the stdio adapter, which host it`, { hostUrl });
  }
  if (!status.running) throw unreachable(`the preview host at ${hostUrl} reports it is not running`, { hostUrl, status });
  return status;
}

/** Open a composition version (or compose a new one) as the generated app running in the preview host; or compare two versions. */
export async function handle(input: DesignPreviewInputSchema.DesignPreviewInput, context?: ToolContext): Promise<DesignPreviewOutput> {
  const started = performance.now();
  const hostUrl = resolvePreviewHostUrl(context);
  if (!hostUrl) throw unreachable('no preview host is configured; call through the HTTP bridge or the stdio adapter, which host it, or set OODS_PREVIEW_HOST_URL to a running host', { hostUrl: null });
  const status = await probeHost(hostUrl);
  const compositionsDir = resolveCompositionsDir();
  if (path.resolve(status.compositionsDir) !== compositionsDir) {
    throw unreachable(`the preview host reads ${status.compositionsDir} but this server writes ${compositionsDir}; both must resolve the same MCP_SCHEMA_STORE_ROOT`, { hostUrl, hostCompositionsDir: status.compositionsDir, compositionsDir });
  }
  if (status.platform && !status.platform.supported) {
    // s206-m03: the cause, then what to do, which depends on why the host cannot compile.
    const next = status.platform.gap === 'incomplete'
      ? 'This install is missing a file the release shipped: extract the release archive again into an empty directory and restart your MCP client.'
      : 'design.compose, code.generate and artifact.certify work here without the preview.';
    throw unreachable(`the preview cannot compile generated screens on ${status.platform.os}-${status.platform.arch}: ${status.platform.reason ?? 'no esbuild binary is shipped for this platform'}. ${next}`, { hostUrl, platform: status.platform });
  }
  if (!input.compositionId && !(input.object && input.context)) {
    throw new ToolError('OODS-V203', 'design.preview needs either compositionId (with an optional version) or object and context', { input: Object.keys(input) });
  }
  if (input.action === 'compare') return compare(input, hostUrl, compositionsDir, started);
  if (input.action === 'versions') return versions(input, hostUrl, compositionsDir, started);
  if (input.action === 'accept') return accept(input, hostUrl, compositionsDir, started);

  // s205-m04: a run view is read FIRST, so a path that is not a run (OODS-V212), an artifact outside the admitted
  // contract (OODS-V213) or a non-capture object (OODS-V214) is refused before any version is composed or touched.
  const runPath = (input as { runPath?: string }).runPath;
  const analysisPath = input.analysisPath;
  if (analysisPath && (runPath || input.action === 'edit')) throw new ToolError('OODS-V214', 'analysisPath is a separate read-only source. Nothing was written.');
  let comparisonView: ComparisonView | undefined;
  if (analysisPath) {
    comparisonView = readComparisonView(analysisPath);
    if (!input.compositionId) {
      selectComparisonRecord(comparisonView, input.object as ComparisonObject, input.recordId);
      if (input.object === 'ComparisonSignal' && input.context !== 'list' && !input.recordId) throw new ToolError('OODS-V214', 'A signal detail requires its exact recordId. Nothing was written.');
    }
  }
  if (input.recordId !== undefined && ((!runPath && !analysisPath) || input.compositionId || !['detail', 'card', 'inline'].includes(input.context ?? ''))) throw new ToolError('OODS-V214', 'recordId requires a fresh runPath or analysisPath detail, card or inline view. Nothing was written.');
  let runView: RunView | undefined;
  if (runPath) {
    runView = await readRunView(runPath);
    if (!input.compositionId) {
      assertRunMatches(String(input.object ?? ''), runView, undefined);
      selectRunRecord(runView, input.object as RunViewObject, input.recordId);
    }
  }

  // The version to open: an existing one, the first version of a fresh composition, or the version an edit records.
  let record: CompositionVersion;
  let edit: RenderOutput['edit'] = undefined;
  if (input.action === 'edit') {
    if (!input.compositionId || !input.edit) throw new ToolError('OODS-V204', 'design.preview action edit needs compositionId (with version) and edit.operation', { input: Object.keys(input) });
    const parentVersion = input.version ?? await latestVersion(compositionsDir, input.compositionId);
    const parent = await readVersion(compositionsDir, input.compositionId, parentVersion);
    if (parent.comparisonView) throw new ToolError('OODS-V214', 'Comparison views are read-only. Nothing was written.');
    record = await applyEdit(compositionsDir, parent, input.edit);
    edit = { operation: input.edit.operation, parentVersion };
  } else if (input.compositionId) {
    const version = input.version ?? await latestVersion(compositionsDir, input.compositionId);
    record = await readVersion(compositionsDir, input.compositionId, version);
  } else {
    const theme = (input.preferences?.theme ?? 'light') as PreviewTheme;
    const brand = (input.preferences?.brand ?? DEFAULT_BRAND) as PreviewBrand;
    const composition = await compose({ object: input.object!, context: input.context!, presentation: input.presentation, preferences: { ...(input.preferences ?? {}), theme, brand } });
    if (composition.status !== 'ok' || !composition.schema || !composition.compositionId || !composition.version) throw compositionRefusal(composition.errors);
    record = await readVersion(compositionsDir, composition.compositionId, composition.version);
  }
  let mappingChanged = false;
  if (input.version === undefined && input.compositionId && input.action !== 'edit') {
    const refreshed = await refreshPreviewMappings(compositionsDir, record);
    record = refreshed.record; mappingChanged = refreshed.changed;
  }
  const object = String(record.compose.object ?? '');
  const viewContext = String(record.compose.context ?? '');
  const brand = (input.preferences?.brand ?? record.brand) as PreviewBrand;
  const theme = (input.preferences?.theme ?? record.theme) as PreviewTheme;
  // A placed chart's SVG is rendered for one brand and theme: opening another scope generates and certifies for it (Sprint 202 m01).
  const scope = `${brand}/${theme}` as const;
  const generatedScope = `${record.brand}/${record.theme}`;
  const chartScoped = chartNodes(record.schema.screens).length > 0;

  if (runView) assertRunMatches(object, runView, record.runView);
  if (record.comparisonView && !comparisonView) comparisonView = readComparisonView(record.comparisonView.analysisPath);
  if (comparisonView) {
    assertComparisonMatches(comparisonView, record.comparisonView);
    selectComparisonRecord(comparisonView, object as ComparisonObject, input.recordId ?? record.comparisonView?.recordId);
  }
  if (input.presentation && record.compose.presentation !== input.presentation) throw new ToolError('OODS-V214', 'A stored version retains its presentation; compose a fresh view to change it.');
  // A version that already shows a run keeps showing it: an edit's new version re-reads the run it carried.
  if (!runView && !record.model && record.runView) { runView = await readRunView(record.runView.runPath); assertRunMatches(object, runView, record.runView); }

  // The seed records are the version's own: the same seed drives the composition the model is drawn from — the
  // object's workflow, or its list for a read-only object (s206-m01); an embedded Chunk has none. Composed at most once.
  const seedVersion = record;
  let seeded: Promise<CompositionVersion['schema'] | undefined> | undefined;
  const workflowSeed = () => seeded ??= viewContext !== 'workflow' && object
    ? seedSchema({ object, ...(seedVersion.schema.seed ? { preferences: { seed: seedVersion.schema.seed } } : {}) }, compose)
    : Promise.resolve(undefined);
  // s211-m02: a standalone screen's placed chart is drawn from the seed record its page shows, so both are one record.
  // Read only when a chart is generated or certified.
  const shownRecord = async () => chartScoped && !runView && !comparisonView
    ? workflowSeed().then(schema => schema ? shownSampleRecord(workflowSampleRecords(schema)) : undefined)
    : undefined;

  // The deterministic field model, seeded once per version with the same policy as the design loop.
  let model = runView || comparisonView ? undefined : record.model;
  if (!model) {
    const workflowSchema = await workflowSeed();
    // The run's real records replace the seed: every row on a list, the first record on a card or detail.
    const sourceRows = comparisonView ? comparisonView.records[object as ComparisonObject] : runView?.records[object as RunViewObject];
    const records = sourceRows ? sourceRows.map(row => {
      // A capture row must name its page before opening; retain the original title on detail and in source bytes.
      const display = record.compose.presentation === 'stage1-inspection' && object === 'Finding' && viewContext === 'list'
        ? { ...row, title: `${row.title} · ${row.route}` } : row;
      return Object.fromEntries(Object.entries(display).map(([key, value]) => [snakeToCamel(key), value]));
    }) : undefined;
    const established = records ? (viewContext === 'list' ? { rows: records } : Object.fromEntries(Object.entries((comparisonView ? selectComparisonRecord(comparisonView, object as ComparisonObject, input.recordId ?? record.comparisonView?.recordId) : selectRunRecord(runView!, object as RunViewObject, input.recordId ?? record.runView?.recordId)) ?? {}).map(([key, value]) => [snakeToCamel(key), value]))) : {};
    model = seedPreviewModel({ schema: record.schema, context: viewContext, object: object || undefined, workflowSchema, established });
  }

  // Generate what the version does not carry yet; a version's artifacts are keyed by its schema hash.
  const frameworks: PreviewFramework[] = input.framework && input.framework !== 'both' ? [input.framework] : ['react', 'vue'];
  let artifacts: CompositionVersion['artifacts'] = {};
  const measurements: Record<string, unknown> = {};
  const componentContracts = { ...((record.measurements.componentContracts as Record<string, SubstitutionContractReport[]> | undefined) ?? {}) };
  const validation = { ...((record.measurements.validation as Record<string, unknown> | undefined) ?? {}) };
  const tokenBuildHash = tokenCssHash();
  for (const framework of frameworks) {
    if (record.artifacts[framework] && (!chartScoped || record.artifacts[framework]?.tokenBuildHash === tokenBuildHash)) continue;
    const generated = await generate({ schema: record.schema, framework, profile: 'build', options: { theme: record.theme, brand: record.brand } }, { shownRecord: await shownRecord(), previewHostUrl: hostUrl });
    if (generated.status !== 'ok' || !generated.artifact) throw generationRefusal(framework, generated.errors);
    const issues = validateGeneratedArtifact(generated.artifact);
    if (issues.length) throw new Error(issues.join('\n'));
    artifacts[framework] = { artifact: generated.artifact, generatedAt: new Date().toISOString(), tokenBuildHash };
    // The generation receipt is stored as code.generate returned it: the checks that ran and notChecked.
    validation[framework] = generated.validationReceipt;
    if (generated.componentContracts) componentContracts[framework] = generated.componentContracts;
    measurements.validation = validation;
  }
  const prepared = await preparePreviewComponents(hostUrl, compositionsDir, record, artifacts, input.version !== undefined && input.action !== 'edit');
  record = prepared.record;
  artifacts = prepared.artifacts;
  for (const [framework, entry] of Object.entries(artifacts)) {
    const receipt = validation[framework] as { evidence?: { artifactContentHash?: string } } | undefined;
    if (receipt?.evidence && entry) validation[framework] = { ...receipt, evidence: { ...receipt.evidence, artifactContentHash: entry.artifact.contentHash } };
  }
  if (prepared.packages) {
    measurements.validation = validation;
    if (prepared.newVersion) for (const framework of Object.keys(componentContracts)) delete componentContracts[framework];
    for (const framework of frameworks) {
      const substitutions = (artifacts[framework] ?? record.artifacts[framework])?.artifact.substitutions ?? [];
      if (!substitutions.length) continue;
      if (!componentContracts[framework] || prepared.newVersion) componentContracts[framework] = await checkSubstitutionContracts(framework, substitutions, record.schema, { previewHostUrl: hostUrl });
    }
    measurements.componentContracts = componentContracts;
  }
  // Every placed chart is certified once per version, in the scope the artifacts were generated for.
  if (!record.measurements.charts || chartScoped && Object.keys(artifacts).length > 0) measurements.charts = await certifyPlacedCharts(record.schema, { theme: record.theme, brand: record.brand }, await shownRecord());
  // Context the caller supplied: checked, keyed to this object, and stored beside the measurements so it
  // is durable. Forge fetched none of it and opens no store of anyone else's to check it — see
  // lib/preview-context.ts. A refusal here writes nothing at all, including the artifacts above.
  let storedContext: StoredContext | undefined;
  if (input.contextItems || input.contextSearched) {
    const definition = object ? loadObject(object) : undefined;
    const urn = definition ? objectUrn(definition.object.name, definition.object.version) : objectUrn(object || 'composition', '0.0.0');
    try {
      storedContext = validateContext({ items: input.contextItems, searched: input.contextSearched }, { object, urn, version: record.version });
    } catch (error) {
      if (error instanceof ContextRefusal) throw new ToolError(error.code, `design.preview: ${error.message}`, error.data);
      throw error;
    }
  }
  // A Stage1 run the caller names by path: compared against this version's own schema and stored beside
  // the context. Evidence for review, never an instruction — see lib/preview-observation.ts. A refusal
  // (OODS-V208/V209/V210) is thrown here, before anything above is written.
  let storedObservation: StoredObservation | undefined;
  if (input.observationRunPath) {
    const definition = object && listObjects().includes(object) ? loadObject(object) : undefined;
    const urn = definition ? objectUrn(definition.object.name, definition.object.version) : objectUrn(object || 'composition', '0.0.0');
    storedObservation = await observeForVersion(input.observationRunPath, { object, urn, context: viewContext, version: record.version, schema: record.schema });
  }
  const storedRunView = runView ? { runId: runView.runId, target: runView.target, runPath: runView.runPath, coverage: runView.coverage, kinds: runView.kinds, readAt: new Date().toISOString(), manifestSha256: runView.manifestSha256,
    evidence: viewContext === 'list' ? [] : (() => { const row = selectRunRecord(runView, object as RunViewObject, input.recordId ?? record.runView?.recordId); const locator = String(row?.provenance_locator ?? ''); const sha256 = runView.attestations[locator]; return sha256 ? [{ locator, sha256 }] : []; })(),
    recordId: input.recordId ?? record.runView?.recordId, presentation: record.compose.presentation as 'stage1-inspection' | undefined,
    limits: runView.records.CapturedArtifact.map(row => ({ kind: String(row.artifact_kind), state: String(row.result_state), note: String(row.result_note ?? 'No measurement limit was recorded; absence is not evidence of conformance.') })),
  } : undefined;
  const storedComparisonView = comparisonView ? storeComparisonView(comparisonView, object as ComparisonObject, viewContext, input.recordId ?? record.comparisonView?.recordId) : undefined;
  if (prepared.newVersion || mappingChanged) await writeVersion(compositionsDir, record);
  if (Object.keys(artifacts).length || !record.model || storedComparisonView || runView || Object.keys(measurements).length || storedContext || storedObservation) record = await attachToVersion(compositionsDir, record.compositionId, record.version, { artifacts, model, measurements, ...(prepared.packages ? { componentPackages: prepared.packages } : {}), ...(storedContext ? { context: storedContext } : {}), ...(storedObservation ? { observation: storedObservation } : {}), ...(storedRunView ? { runView: storedRunView } : {}), ...(storedComparisonView ? { comparisonView: storedComparisonView } : {}) });
  if (chartScoped && scope !== generatedScope) {
    const scoped = record.scopes?.[scope];
    const scopedArtifacts: CompositionVersion['artifacts'] = {};
    for (const framework of frameworks) {
      if (scoped?.artifacts[framework]?.tokenBuildHash === tokenBuildHash) continue;
      const generated = await generate({ schema: record.schema, framework, profile: 'build', options: { theme, brand } }, { shownRecord: await shownRecord(), previewHostUrl: hostUrl });
      if (generated.status !== 'ok' || !generated.artifact) throw generationRefusal(`${framework} (${scope})`, generated.errors);
      const issues = validateGeneratedArtifact(generated.artifact);
      if (issues.length) throw new Error(issues.join('\n'));
      scopedArtifacts[framework] = { artifact: bindSubstitutionPackages(generated.artifact, (record.componentPackages ?? []).filter(pkg => pkg.framework === framework)), generatedAt: new Date().toISOString(), tokenBuildHash };
    }
    const charts = scoped?.charts && Object.keys(scopedArtifacts).length === 0 ? undefined : await certifyPlacedCharts(record.schema, { theme, brand }, await shownRecord());
    if (Object.keys(scopedArtifacts).length || charts) record = await attachToVersion(compositionsDir, record.compositionId, record.version, { scopes: { [scope]: { artifacts: scopedArtifacts, ...(charts ? { charts } : {}) } } });
  }

  const base = `${hostUrl}/preview/${record.compositionId}/${record.version}`;
  const previews: PreviewEntry[] = [];
  for (const framework of frameworks) {
    const query = `framework=${framework}&brand=${brand}&theme=${theme}`;
    // The module for this scope: the scoped generation when the placed chart needed one, else the version's own artifact.
    const scopedEntry = chartScoped && scope !== generatedScope ? record.scopes?.[scope]?.artifacts[framework] : undefined;
    const served = scopedEntry ?? record.artifacts[framework]!;
    const moduleUrl = `${base}/module.js?${query}`;
    // Compile now, so a broken artifact is this call's failure rather than a blank page later.
    const response = await fetch(moduleUrl, { signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS) });
    const body = await response.text();
    if (!response.ok) throw new ToolError(record.componentPackages?.length ? 'OODS-V217' : 'OODS-N015', `The preview host could not compile the ${framework} artifact${record.componentPackages?.length ? ` with team package ${record.componentPackages.map(pkg => pkg.name).join(', ')}` : ''} (HTTP ${response.status}): ${body.slice(0, 2000)}`, { packages: record.componentPackages?.map(pkg => pkg.name) });
    if (served.artifact.substitutions?.length) {
      const frozen = await fetch(`${moduleUrl}&format=iife`, { signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS) });
      if (!frozen.ok) throw new ToolError('OODS-V217', `The preview host could not freeze the ${framework} app: ${(await frozen.text()).slice(0, 2000)}`, { packages: record.componentPackages?.map(pkg => pkg.name) });
    }
    previews.push({
      framework, url: `${base}?${query}`, appUrl: `${base}/app?${query}`, moduleUrl,
      artifactContentHash: served.artifact.contentHash,
      compiled: { bytes: Buffer.byteLength(body), sha256: digest(body) },
      generatedFor: { brand: scopedEntry || !chartScoped ? brand : record.brand, theme: scopedEntry || !chartScoped ? theme : record.theme, chartScoped },
    });
  }

  return {
    status: 'ok', action: edit ? 'edit' : 'render', ...(edit ? { edit } : {}),
    compositionId: record.compositionId, version: record.version, parentVersion: record.parentVersion, operation: record.operation, head: record.head,
    schemaHash: record.schemaHash, object, context: viewContext,
    previewUrl: previews[0]!.url, previews: previews as RenderOutput['previews'],
    host: { url: hostUrl, port: Number(new URL(hostUrl).port), compositionsDir },
    brand, theme, recordPath: versionPath(compositionsDir, record.compositionId, record.version),
    ...(Object.keys(componentContracts).length ? { componentContracts: frameworks.flatMap(framework => componentContracts[framework] ?? []), warnings: frameworks.flatMap(framework => componentContracts[framework] ?? []).filter(report => report.summary.unmet > 0).map(report => ({ code: 'OODS-V218', component: report.component, message: `${report.framework} ${report.component}: ${report.summary.unmet} unmet contract obligations; preview remains available.` })) } : {}),
    measured: summarizeMeasurements(record), editable: editableOf(record), durationMs: performance.now() - started,
  };
}

/** What an edit may name on a version: its regions, its slots with the composer's candidates, its field order, its seed. */
export function editableOf(record: CompositionVersion): RenderOutput['editable'] {
  const screen = record.schema.screens[0];
  const regions = (screen?.children ?? []).map(node => ({ id: node.id, component: node.component }));
  const fields: Record<string, string[]> = {};
  for (const region of screen?.children ?? []) {
    const names: string[] = [];
    const walk = (node: UiElement) => { for (const child of node.children ?? []) { const key = fieldKeyOf(child); if (key && !names.includes(key)) names.push(key); if (!/^slot-/.test(child.id)) walk(child); } };
    walk(region);
    fields[region.id] = names;
  }
  return {
    regions,
    slots: record.slots.map(slot => ({ slotName: slot.slotName, selectedComponent: slot.selectedComponent ?? null, candidates: slot.candidates ?? (slot.selectedComponent ? [slot.selectedComponent] : []) })),
    fields,
    seed: record.schema.seed ?? null,
  };
}

const refuse = (reason: string, details: Record<string, unknown>) => new ToolError('OODS-V204', `design.preview action edit: ${reason}`, details);

/**
 * One edit = one new version: the parent's compose inputs re-composed through the override surface
 * with exactly the operation's change, recorded with the parent and the operation. The parent's
 * file is never written. The schema is produced by the composer, never edited by hand.
 */
async function applyEdit(compositionsDir: string, parent: CompositionVersion, edit: EditInput): Promise<CompositionVersion> {
  const editable = editableOf(parent);
  const { compositionId: _id, parentVersion: _parent, options: parentOptions, ...compose_ } = parent.compose as Record<string, unknown> & { options?: Record<string, unknown> };
  const preferences = { ...((compose_.preferences as Record<string, unknown> | undefined) ?? {}) };
  switch (edit.operation) {
    case 'reorder-region': {
      if (!edit.regionOrder?.length) throw refuse('reorder-region needs regionOrder', { editable: editable.regions });
      const ids = editable.regions.map(region => region.id);
      const unknown = edit.regionOrder.filter(id => !ids.includes(id));
      if (unknown.length) throw refuse(`regionOrder names regions this version does not have: ${unknown.join(', ')}`, { regionOrder: edit.regionOrder, regions: ids });
      if (JSON.stringify([...edit.regionOrder, ...ids.filter(id => !edit.regionOrder!.includes(id))]) === JSON.stringify(ids)) throw refuse('regionOrder leaves the regions where they are', { regionOrder: edit.regionOrder, regions: ids });
      preferences.regionOrder = edit.regionOrder;
      break;
    }
    case 'swap-slot': {
      if (!edit.slot || !edit.component) throw refuse('swap-slot needs slot and component', { editable: editable.slots });
      const slot = editable.slots.find(entry => entry.slotName === edit.slot);
      if (!slot) throw refuse(`this version has no slot ${edit.slot}`, { slot: edit.slot, slots: editable.slots.map(entry => entry.slotName) });
      if (!slot.candidates.includes(edit.component)) throw refuse(`${edit.component} is not one of the composer's candidates for slot ${edit.slot}`, { slot: edit.slot, component: edit.component, candidates: slot.candidates });
      if (slot.selectedComponent === edit.component) throw refuse(`slot ${edit.slot} already leads with ${edit.component}`, { slot: edit.slot, component: edit.component });
      preferences.componentOverrides = { ...((preferences.componentOverrides as Record<string, string> | undefined) ?? {}), [edit.slot]: edit.component };
      break;
    }
    case 'reorder-fields': {
      if (!edit.region || !edit.fieldOrder?.length) throw refuse('reorder-fields needs region and fieldOrder', { editable: editable.fields });
      const current = editable.fields[edit.region];
      if (!current) throw refuse(`this version has no region ${edit.region}`, { region: edit.region, regions: Object.keys(editable.fields) });
      const unknown = edit.fieldOrder.filter(field => !current.includes(field));
      if (unknown.length) throw refuse(`fieldOrder names fields region ${edit.region} does not carry: ${unknown.join(', ')}`, { region: edit.region, fieldOrder: edit.fieldOrder, fields: current });
      if (JSON.stringify([...edit.fieldOrder, ...current.filter(field => !edit.fieldOrder!.includes(field))]) === JSON.stringify(current)) throw refuse('fieldOrder leaves the fields where they are', { region: edit.region, fieldOrder: edit.fieldOrder, fields: current });
      preferences.fieldOrder = { ...((preferences.fieldOrder as Record<string, string[]> | undefined) ?? {}), [edit.region]: edit.fieldOrder };
      break;
    }
    case 'seed': {
      if (!edit.seed) throw refuse('seed needs a seed string', { seed: editable.seed });
      if (edit.seed === editable.seed) throw refuse('the seed is unchanged', { seed: edit.seed });
      preferences.seed = edit.seed;
      break;
    }
    default: throw refuse(`unknown operation ${String((edit as { operation: string }).operation)}`, { operations: ['reorder-region', 'swap-slot', 'reorder-fields', 'seed'] });
  }
  const composed = await compose({ ...(compose_ as object), preferences, compositionId: parent.compositionId, parentVersion: parent.version, options: { ...(parentOptions ?? {}), transient: false, operation: edit.operation } } as Parameters<typeof compose>[0]);
  if (composed.status !== 'ok' || !composed.compositionId || !composed.version) throw new Error(`Re-composition failed: ${JSON.stringify(composed.errors ?? composed)}`);
  // An edit produces a new version of the same object, so the context the parent carried is still about
  // it and travels with the lineage. It keeps the fetchedAt it was gathered with, so it is marked stale
  // against the version it now sits beside rather than silently re-dated to look current.
  if (parent.context) await attachToVersion(compositionsDir, composed.compositionId, composed.version, { context: carryContextForward(parent.context, composed.version) });
  // The observation compared the parent's design; the edit moved it, so every row is marked, not re-dated.
  if (parent.observation) await attachToVersion(compositionsDir, composed.compositionId, composed.version, { observation: carryObservationForward(parent.observation, composed.version) });
  // The run the parent showed stays the subject: the new version re-reads the same run (see handle).
  if (parent.runView) await attachToVersion(compositionsDir, composed.compositionId, composed.version, { runView: parent.runView });
  return readVersion(compositionsDir, composed.compositionId, composed.version);
}

/** The composition's versions with their lineage and the URL each opens at. */
async function versions(input: DesignPreviewInputSchema.DesignPreviewInput, hostUrl: string, compositionsDir: string, started: number): Promise<VersionsOutput> {
  if (!input.compositionId) throw new ToolError('OODS-V203', 'design.preview action versions needs compositionId', { input: Object.keys(input) });
  const entries = await listVersions(compositionsDir, input.compositionId);
  const acceptances = (await readAccepted(compositionsDir, input.compositionId))?.acceptances ?? [];
  const standing = acceptances.at(-1);
  return {
    status: 'ok', action: 'versions', compositionId: input.compositionId, latest: entries.at(-1)!.version,
    versions: entries.map(entry => ({ ...entry, url: `${hostUrl}/preview/${input.compositionId}/${entry.version}` })),
    accepted: standing ? { version: standing.version, acceptedAt: standing.acceptedAt, acceptances: acceptances.length } : null,
    host: { url: hostUrl, port: Number(new URL(hostUrl).port), compositionsDir }, durationMs: performance.now() - started,
  };
}

const refuseAccept = (reason: string, details: Record<string, unknown>) => new ToolError('OODS-V205', `design.preview action accept: ${reason}`, details);

/**
 * Accept a version (Sprint 202 m04): recorded once in the composition's accepted.json with when, the heads, the schema
 * hash and a snapshot of the measurements the version carries; a later acceptance supersedes the standing one with lineage.
 * A version that was never generated has no measurements to stand on, and the standing version cannot be accepted again.
 */
async function accept(input: DesignPreviewInputSchema.DesignPreviewInput, hostUrl: string, compositionsDir: string, started: number): Promise<AcceptOutput> {
  if (!input.compositionId) throw new ToolError('OODS-V203', 'design.preview action accept needs compositionId (with an optional version)', { input: Object.keys(input) });
  const version = input.version ?? await latestVersion(compositionsDir, input.compositionId);
  const record = await readVersion(compositionsDir, input.compositionId, version);
  const generated = (['react', 'vue'] as const).filter(framework => record.artifacts[framework]);
  if (!generated.length) throw refuseAccept(`${input.compositionId} version ${version} has not been generated, so it has no measurements to accept; open it with design.preview first`, { compositionId: input.compositionId, version });
  const standing = (await readAccepted(compositionsDir, input.compositionId))?.acceptances.at(-1);
  if (standing?.version === version) throw refuseAccept(`${input.compositionId} version ${version} is already the accepted version (since ${standing.acceptedAt})`, { compositionId: input.compositionId, version, acceptedAt: standing.acceptedAt });
  const scopeCharts = Object.fromEntries(Object.entries(record.scopes ?? {}).filter(([, generation]) => generation?.charts?.length).map(([scope, generation]) => [scope, generation!.charts!]));
  const { record: accepted, acceptance, file } = await appendAcceptance(compositionsDir, input.compositionId, {
    version, acceptedAt: new Date().toISOString(), head: readForgeHead(), versionHead: record.head, schemaHash: record.schemaHash,
    measurements: record.measurements, scopeCharts, measured: summarizeMeasurements(record),
  });
  return {
    status: 'ok', action: 'accept', compositionId: input.compositionId, version, parentVersion: record.parentVersion, operation: record.operation,
    object: String(record.compose.object ?? ''), context: String(record.compose.context ?? ''),
    accepted: acceptance as AcceptOutput['accepted'], acceptances: accepted.acceptances.length, acceptedPath: file, previewUrl: `${hostUrl}/preview/${input.compositionId}/${version}`,
    host: { url: hostUrl, port: Number(new URL(hostUrl).port), compositionsDir }, durationMs: performance.now() - started,
  };
}

/** What the version carries as measured, and what it does not; the panel says the same. */
export function summarizeMeasurements(record: CompositionVersion): RenderOutput['measured'] {
  const validation = (record.measurements.validation as Record<string, unknown> | undefined) ?? {};
  type Certified = { path: string; certification: { conformant: boolean | null }; narrow?: { certification: { conformant: boolean | null } }; wide?: { certification: { conformant: boolean | null } } };
  const charts = (record.measurements.charts as Certified[] | undefined) ?? [];
  const axe = (record.measurements.axe as Record<string, Record<string, unknown>> | undefined) ?? {};
  // A placed chart is conformant when every render (design size, narrow and wide) is; a null on any leaves it uncertified.
  const verdict = (chart: Certified): boolean | null => {
    const values = [chart.certification.conformant, ...(chart.narrow ? [chart.narrow.certification.conformant] : []), ...(chart.wide ? [chart.wide.certification.conformant] : [])];
    return values.some(value => value === false) ? false : values.every(value => value === true) ? true : null;
  };
  const scopes = charts.length ? [`${record.brand}/${record.theme}`, ...Object.entries(record.scopes ?? {}).filter(([, generation]) => generation?.charts?.length).map(([key]) => key)] : [];
  return {
    validation: (['react', 'vue'] as const).filter(framework => validation[framework]),
    charts: { placed: charts.length, conformant: charts.filter(chart => verdict(chart) === true).length, notConformant: charts.filter(chart => verdict(chart) === false).length, uncertified: charts.filter(chart => verdict(chart) === null).length, scopes },
    axe: Object.entries(axe).flatMap(([framework, scopes]) => Object.keys(scopes).sort().map(scope => `${framework}:${scope}`)),
    notMeasured: [
      ...(['react', 'vue'] as const).filter(framework => record.artifacts[framework] && !validation[framework]).map(framework => `validation:${framework}`),
      ...(record.measurements.charts ? [] : ['charts']),
      // s221-m03 (the website's defect (b)): every scope the preview can be measured in, which is each brand this server
      // renders (the preview's brand switch offers them) and the version's own, in light, dark and hc. The bridge's
      // measurement panel lists the same (packages/mcp-bridge/src/preview/measurements.ts measurableScopes).
      ...(['react', 'vue'] as const).filter(framework => record.artifacts[framework]).flatMap(framework => [...new Set([...knownBrands(), record.brand])].flatMap(brand => (['light', 'dark', 'hc'] as const).map(theme => `${brand}/${theme}`)).filter(scope => !axe[framework]?.[scope]).map(scope => `axe:${framework}:${scope}`)),
    ],
  };
}

/** The same what-changed the compare page shows, from the host that computes it over the two version records. */
async function compare(input: DesignPreviewInputSchema.DesignPreviewInput, hostUrl: string, compositionsDir: string, started: number): Promise<CompareOutput> {
  if (!input.compositionId || !input.against) throw new ToolError('OODS-V203', 'design.preview action compare needs compositionId (with version) on the left and against.version on the right', { input: Object.keys(input) });
  const leftVersion = input.version ?? await latestVersion(compositionsDir, input.compositionId);
  const rightId = input.against.compositionId ?? input.compositionId;
  let left = await readVersion(compositionsDir, input.compositionId, leftVersion);
  let right = await readVersion(compositionsDir, rightId, input.against.version);
  // A compare link must open both screens even when the caller only composed them. Read both
  // first so an invalid right-hand version cannot cause writes to the valid left-hand version.
  const requested: PreviewFramework[] = input.framework && input.framework !== 'both' ? [input.framework] : ['react', 'vue'];
  for (const record of [left, right]) {
    if (requested.some(framework => !record.artifacts[framework])) {
      await handle({ compositionId: record.compositionId, version: record.version, framework: input.framework ?? 'both' }, { previewHostUrl: hostUrl });
    }
  }
  // Generation contributes artifact-file differences; the tool and browser page read the same final records.
  left = await readVersion(compositionsDir, input.compositionId, leftVersion);
  right = await readVersion(compositionsDir, rightId, input.against.version);
  const frameworks = (['react', 'vue'] as PreviewFramework[]).filter(framework => left.artifacts[framework] && right.artifacts[framework]);
  const pair = `${left.compositionId}@${left.version}/${right.compositionId}@${right.version}`;
  const diffUrl = `${hostUrl}/compare/${pair}/diff.json`;
  const response = await fetch(diffUrl, { signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS) });
  if (!response.ok) throw unreachable(`the preview host could not compare ${pair} (HTTP ${response.status}): ${(await response.text()).slice(0, 500)}`, { hostUrl, pair });
  const diff = await response.json() as CompareOutput['diff'];
  const brand = (input.preferences?.brand ?? left.brand) as PreviewBrand;
  const theme = (input.preferences?.theme ?? left.theme) as PreviewTheme;
  const framework = input.framework && input.framework !== 'both' && frameworks.includes(input.framework) ? input.framework : frameworks[0];
  return {
    status: 'ok', action: 'compare', left: diff.left, right: diff.right,
    compareUrl: `${hostUrl}/compare/${pair}${framework ? `?framework=${framework}&brand=${brand}&theme=${theme}` : ''}`, diffUrl, frameworks,
    identical: diff.identical, differenceCount: diff.differenceCount, diff,
    host: { url: hostUrl, port: Number(new URL(hostUrl).port), compositionsDir }, durationMs: performance.now() - started,
  };
}
