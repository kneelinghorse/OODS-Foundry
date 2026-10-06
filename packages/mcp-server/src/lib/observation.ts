/**
 * Observation against intent (Sprint 204 m04): what Stage1 observed on a live app, set beside what Forge
 * composes from the same objects, as a typed record a person reviews.
 *
 * The record is EVIDENCE FOR REVIEW. It says what was observed, what Forge composes, and that a person
 * must judge the difference; it never proposes a change, never applies one, and carries no field that
 * could be read as an instruction. Stage1 shelved automatic reconciliation after confident errors, and
 * its own object_rollup marks every semantic mapping `requires_human_adjudication` — that flag is copied
 * onto the record so the rule travels in the data, not only in this comment.
 *
 * Forge reads the run the only way it reads Stage1 at all: `structuredData.fetch` with a kind and a
 * filesystem path. It opens no other product's store. The Forge side is composed with
 * `design.compose` in transient mode, so computing a comparison records no composition version.
 *
 * Every row carries both provenances. Where one side has nothing, its provenance says what was
 * searched and that nothing was found — an absence that cannot say where it looked is not shown.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ToolError } from '../errors/tool-error.js';
import { loadObject, listObjects } from '../objects/object-loader.js';
import { handle as compose } from '../tools/design.compose.js';
import { handle as fetchStructured } from '../tools/structuredData.fetch.js';
import { objectUrn } from './preview-context.js';

export type ObservationCategory = 'observed-only' | 'composed-only' | 'agreeing' | 'disagreeing';
/**
 * What a row is about. `screen` rows record that a screen exists on one side only. The other three
 * are the axes a screen both sides have is compared on:
 *   entity      Stage1 named the object as an entity on this screen's routes, or only saw the routes
 *   input       the screen takes input (search, filter, fields) on each side
 *   data-bound  a list screen renders a repeating, data-bound collection on each side
 */
export type ObservationAxis = 'screen' | 'entity' | 'input' | 'data-bound';
export type ScreenShape = 'list' | 'detail' | 'form';
export type ForgeContext = ScreenShape | 'timeline';

export const RESEARCH_OBJECTS = ['Chunk', 'Collection', 'Document', 'Evidence', 'Mission', 'Project', 'Report'] as const;
export const COMPOSED_CONTEXTS: readonly ForgeContext[] = ['list', 'detail', 'form', 'timeline'];
/** The rollup kinds that carry screen evidence. Read through the contract, never as loose files. */
export const READ_KINDS = ['identity_graph', 'object_rollup'] as const;
type ReadKind = typeof READ_KINDS[number];

export interface Stage1Provenance {
  runId: string;
  target: string;
  artifactKind: ReadKind;
  /** The path structuredData.fetch returned for the artifact it read. */
  readPath: string;
  /** When Stage1 generated that artifact: the capture time, never re-dated. */
  capturedAt: string | null;
  /** JSON pointers into that artifact the row's observation was taken from; empty when nothing was found. */
  pointers: string[];
  /** How many observations support the row; zero on a composed-only row, which is the point of recording it. */
  found: number;
}

export interface ForgeProvenance {
  /** Null only on an observed-only row: no compared object matched what Stage1 saw. */
  object: string | null;
  context: ForgeContext | null;
  urn: string | null;
  /** sha256 of the composed schema, so the reader can re-compose and check it is the same screen. */
  schemaDigest: string | null;
  /** What Forge searched, stated on every row so an absence is a statement rather than a silence. */
  searched: string;
  found: number;
}

export interface ObservationRow {
  id: string;
  category: ObservationCategory;
  axis: ObservationAxis;
  /** The screen as Stage1's routes name it (`/missions`, `/missions/:id`), or null on a composed-only row. */
  screen: string | null;
  /** The observed routes this row is about, as Stage1 recorded them; empty on a composed-only row. */
  routes: string[];
  observed: string;
  composed: string;
  stage1: Stage1Provenance;
  forge: ForgeProvenance;
}

export interface ObservationRecord {
  kind: 'forge.observation';
  version: 1;
  /** Fixed. The record is evidence; nothing in it is proposed, applied or written anywhere. */
  nature: 'evidence-for-review';
  judgement: string;
  /** Copied from the run's object_rollup: Stage1's own statement that its mappings need a person. */
  requiresHumanAdjudication: boolean;
  generatedAt: string;
  stage1: {
    runId: string;
    target: string;
    runPath: string;
    /** When Stage1 generated the object_rollup this comparison read. */
    capturedAt: string | null;
    reads: Array<{ kind: ReadKind; schemaVersion: string; path: string; etag: string; generatedAt: string | null }>;
  };
  /** transient: every Forge screen was composed for this comparison; otherwise `supplied` names the screens a caller's own schema stood for. */
  forge: { objects: string[]; contexts: ForgeContext[]; transient: true; supplied: string[] };
  /** The interpretation Forge applied to Stage1's data, stated so the reader can disagree with it. */
  rules: Record<string, string>;
  notCompared: Array<{ axis: string; reason: string }>;
  /** Screens the composer refused, with its code: not composed, so never counted as composed-only. */
  notComposed: NotComposed[];
  scale: {
    targets: number;
    observedRoutes: number;
    observedScreens: number;
    composedScreens: number;
    pairedScreens: number;
    rows: number;
    byCategory: Record<ObservationCategory, number>;
    /** Rows dropped because one side could not say where it came from. Shown so a drop is never silent. */
    withheldForProvenance: number;
    wallMs: number;
  };
  rows: ObservationRow[];
}

export interface ObservationInput {
  runPath: string;
  objects?: readonly string[];
  /**
   * A composed schema to compare instead of composing one, keyed `<Object>:<context>` — how the preview
   * compares the version it shows rather than a fresh composition of the same object.
   */
  schemas?: Readonly<Record<string, unknown>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_COMPONENT = /(Input|Select|Selector|Checkbox|Radio|Switch|Textarea|TextArea|Form|Picker)$/;

interface ObservedScreen {
  key: string;
  resource: string;
  shape: ScreenShape | 'other';
  routes: string[];
  /** Pointers per rollup object that renders on at least one of this screen's routes, chrome excluded. */
  components: Array<{ label: string; traits: string[]; pointer: string; routes: string[] }>;
  routePointers: string[];
}

/** Route → the screen it is an instance of. Detail routes of one resource are one screen. */
export function screenOf(route: string): { key: string; resource: string; shape: ScreenShape | 'other' } {
  const segments = route.split('/').filter(Boolean);
  if (segments.length === 0) return { key: '/', resource: '', shape: 'other' };
  if (segments[0] === 'admin') return { key: route, resource: segments.join('/'), shape: 'other' };
  if (segments.length === 1) return { key: `/${segments[0]}`, resource: segments[0], shape: 'list' };
  if (segments.length === 2 && segments[1] === 'new') return { key: `/${segments[0]}/new`, resource: segments[0], shape: 'form' };
  if (segments.length === 2 && (UUID.test(segments[1]) || /^\d+$/.test(segments[1]))) return { key: `/${segments[0]}/:id`, resource: segments[0], shape: 'detail' };
  return { key: route, resource: segments.join('/'), shape: 'other' };
}

/** A compared object whose name, or its plural, is the route's resource segment. */
function objectForResource(resource: string, objects: readonly string[]): string | undefined {
  return objects.find(name => {
    const lower = name.toLowerCase();
    return resource === lower || resource === `${lower}s`;
  });
}

function refuseRun(message: string, details: Record<string, unknown>): never {
  throw new ToolError('OODS-V208', `${message} Nothing was written.`, details);
}

/** The run directory must be one Stage1 run: its manifest names the run, and every artifact read belongs to it. */
function readManifest(runPath: string): { runId: string; target: string; targets: number } {
  const absolute = path.resolve(runPath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    refuseRun(`${runPath} is not a directory, so it is not a Stage1 run.`, { runPath: absolute });
  }
  const manifestPath = path.join(absolute, 'manifest.json');
  let manifest: any;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    refuseRun(`${runPath} has no readable manifest.json, so it is not a Stage1 run.`, { runPath: absolute, looked: manifestPath });
  }
  const targets = Array.isArray(manifest?.targets) ? manifest.targets : [];
  if (typeof manifest?.run_id !== 'string' || !Array.isArray(manifest?.passes) || targets.length === 0 || !fs.existsSync(path.join(absolute, 'artifacts'))) {
    refuseRun(`${runPath} has a manifest.json that is not a Stage1 run manifest (run_id, passes, targets and an artifacts directory are all required).`, { runPath: absolute });
  }
  const target = targets[0]?.url;
  if (typeof target !== 'string') refuseRun(`${runPath}'s manifest names no target url.`, { runPath: absolute });
  return { runId: manifest.run_id, target, targets: targets.length };
}

async function readKind(kind: ReadKind, runPath: string, runId: string) {
  let result: any;
  try {
    result = await fetchStructured({ kind, runPath } as any);
  } catch (error) {
    if (error instanceof ToolError && error.opiCode === 'OODS-N007' && (error.details as any)?.accepted) {
      const details = error.details as { schemaVersion: string; accepted: string[] };
      throw new ToolError(
        'OODS-V209',
        `${kind} in this run is schema_version ${details.schemaVersion}, outside the accepted ${details.accepted.join(', ')}. OODS Foundry compares only what its contract reads; nothing was written.`,
        { kind, runPath, schemaVersion: details.schemaVersion, accepted: details.accepted },
      );
    }
    if (error instanceof ToolError && error.opiCode === 'OODS-N007') {
      refuseRun(`${runPath} does not carry a readable ${kind}: ${error.message}`, { kind, runPath, cause: error.details });
    }
    throw error;
  }
  if (result.runId !== runId) {
    refuseRun(`${kind} belongs to run ${result.runId}, not the manifest's ${runId}; a comparison reads one run.`, { kind, runPath, artifactRunId: result.runId, manifestRunId: runId });
  }
  return result as { payload: any; schemaVersion: string; path: string; etag: string; generatedAt: string | null };
}

interface Composed {
  object: string;
  context: ForgeContext;
  urn: string;
  schemaDigest: string;
  inputs: string[];
  dataBound: boolean;
}

/** A screen Forge will not compose, with the composer's own refusal, so its absence is stated rather than papered over. */
export interface NotComposed { object: string; context: ForgeContext; code: string; message: string }

async function composeScreen(object: string, context: ForgeContext, supplied?: unknown): Promise<Composed | NotComposed> {
  let schema: any = supplied;
  if (schema === undefined) {
    const result: any = await compose({ object, context, options: { transient: true, validate: false } } as any);
    // design.compose can return a schema alongside status "error" (Chunk outside inline, OODS-V003).
    // A refused screen is not a screen Forge composes, so it must not become a composed-only row.
    if (result.status !== 'ok') {
      const error = (result.errors ?? [])[0] ?? {};
      return { object, context, code: String(error.code ?? 'unknown'), message: String(error.message ?? `design.compose returned status ${result.status}`) };
    }
    schema = result.schema;
  }
  const definition = loadObject(object);
  const root = schema?.screens?.[0] ?? schema;
  const inputs = new Set<string>();
  let dataBound = false;
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.component === 'string' && INPUT_COMPONENT.test(node.component)) inputs.add(node.component);
    if (typeof node.id === 'string' && /(^|-)list-items-\d+$/.test(node.id)) dataBound = true;
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return {
    object,
    context,
    urn: objectUrn(definition.object.name, definition.object.version),
    schemaDigest: createHash('sha256').update(JSON.stringify(schema)).digest('hex'),
    inputs: [...inputs].sort(),
    dataBound,
  };
}

/**
 * Compute the comparison. Throws a typed refusal before anything is produced when the run is not a
 * Stage1 run (OODS-V208), an artifact's schema_version is outside the contract (OODS-V209), or an
 * object named for comparison is not in the registry (OODS-V210).
 */
export async function computeObservation(input: ObservationInput, now: () => number = Date.now): Promise<ObservationRecord> {
  const started = now();
  const registry = new Set(listObjects());
  // The research defaults are repository integrations, absent from the published runtime. An implicit comparison
  // reports that absence; an explicitly requested unknown object still refuses instead of silently dropping it.
  const unavailableDefaults = input.objects === undefined ? RESEARCH_OBJECTS.filter(name => !registry.has(name)) : [];
  const objects = [...(input.objects ?? RESEARCH_OBJECTS.filter(name => registry.has(name)))];
  const unknown = objects.filter(name => !registry.has(name));
  if (unknown.length) {
    throw new ToolError('OODS-V210', `The registry holds no object named ${unknown.join(', ')}; a comparison names only objects OODS Foundry can compose. Nothing was written.`, { unknown, registry: [...registry] });
  }

  const manifest = readManifest(input.runPath);
  const identity = await readKind('identity_graph', input.runPath, manifest.runId);
  const rollup = await readKind('object_rollup', input.runPath, manifest.runId);
  const rollupRead = { kind: 'object_rollup' as const, path: rollup.path, capturedAt: rollup.generatedAt ?? null };
  const identityRead = { kind: 'identity_graph' as const, path: identity.path, capturedAt: identity.generatedAt ?? null };

  // ── The observed side ────────────────────────────────────────────────
  const rollupObjects: Array<{ label: string; traits: string[]; pointer: string; routes: string[] }> = [];
  (rollup.payload.objects ?? []).forEach((object: any, index: number) => {
    const routes = new Set<string>();
    for (const variant of object.projection_variants ?? []) for (const route of variant?.metadata?.routes ?? []) routes.add(route);
    rollupObjects.push({ label: String(object.canonical_label ?? object.canonical_id), traits: object.oods_traits ?? [], pointer: `/objects/${index}`, routes: [...routes].sort() });
  });
  const entities = new Map<string, { pointer: string; routes: Set<string> }>();
  (identity.payload.nodes ?? []).forEach((node: any, index: number) => {
    if (node?.identity_class !== 'entity') return;
    const routes = new Set<string>();
    for (const member of node.member_candidates ?? []) {
      for (const route of [...(member?.attributes?.source_endpoints ?? []), ...(member?.attributes?.domain_hints ?? [])]) routes.add(route);
    }
    entities.set(String(node.canonical_label), { pointer: `/nodes/${index}`, routes });
  });

  const allRoutes = new Set<string>();
  for (const object of rollupObjects) for (const route of object.routes) allRoutes.add(route);
  for (const entity of entities.values()) for (const route of entity.routes) allRoutes.add(route);
  // A component on every observed route is the app's chrome, not any one screen.
  const chromeFloor = allRoutes.size;
  const screenComponents = rollupObjects.filter(object => object.routes.length > 0 && object.routes.length < chromeFloor);

  const screens = new Map<string, ObservedScreen>();
  for (const route of [...allRoutes].sort()) {
    const where = screenOf(route);
    const screen = screens.get(where.key) ?? { ...where, routes: [], components: [], routePointers: [] };
    screen.routes.push(route);
    screens.set(where.key, screen);
  }
  for (const screen of screens.values()) {
    screen.components = screenComponents.filter(object => object.routes.some(route => screen.routes.includes(route)));
    screen.routePointers = rollupObjects.filter(object => object.routes.some(route => screen.routes.includes(route))).map(object => object.pointer);
  }

  // ── The composed side ────────────────────────────────────────────────
  const composed = new Map<string, Composed>();
  const notComposed: NotComposed[] = [];
  for (const object of objects) {
    for (const context of COMPOSED_CONTEXTS) {
      const screen = await composeScreen(object, context, input.schemas?.[`${object}:${context}`]);
      if ('code' in screen) notComposed.push(screen);
      else composed.set(`${object}:${context}`, screen);
    }
  }

  const stage1 = (read: { kind: ReadKind; path: string; capturedAt: string | null }, pointers: string[]): Stage1Provenance => ({
    runId: manifest.runId, target: manifest.target, artifactKind: read.kind, readPath: read.path, capturedAt: read.capturedAt, pointers, found: pointers.length,
  });
  const forge = (screen: Composed, searched: string): ForgeProvenance => ({
    object: screen.object, context: screen.context, urn: screen.urn, schemaDigest: screen.schemaDigest, searched, found: 1,
  });
  const rows: ObservationRow[] = [];
  const paired = new Set<string>();
  // Say which Forge screen a row compared: the caller's own schema (the version on screen) or a fresh composition.
  const forgeSource = (object: string, context: ForgeContext): string => input.schemas?.[`${object}:${context}`] !== undefined
    ? `the supplied ${object} ${context} schema (the version on screen)`
    : `design.compose ${object} context ${context}, transient`;
  const searchedObjects = `the ${objects.length} compared objects (${objects.join(', ')}) by name and plural against the route's resource segment`;

  for (const screen of screens.values()) {
    const object = screen.shape === 'other' ? undefined : objectForResource(screen.resource, objects);
    if (!object) {
      rows.push({
        id: `observed-only:screen:${screen.key}`,
        category: 'observed-only',
        axis: 'screen',
        screen: screen.key,
        routes: screen.routes,
        observed: `Stage1 observed ${screen.key} (${screen.routes.length} route${screen.routes.length === 1 ? '' : 's'}).`,
        composed: screen.shape === 'other'
          ? `No compared object composes this screen: ${screen.key} is not a list, detail or form route of a named resource.`
          : `No compared object is named ${JSON.stringify(screen.resource)}.`,
        stage1: stage1(rollupRead, screen.routePointers),
        forge: { object: null, context: screen.shape === 'other' ? null : screen.shape, urn: null, schemaDigest: null, searched: searchedObjects, found: 0 },
      });
      continue;
    }
    const mine = composed.get(`${object}:${screen.shape}`);
    if (!mine) {
      // Stage1 saw the screen and Forge will not compose it: observed-only, with the composer's refusal as Forge's side.
      const refusal = notComposed.find(entry => entry.object === object && entry.context === screen.shape)!;
      rows.push({
        id: `observed-only:screen:${screen.key}`,
        category: 'observed-only',
        axis: 'screen',
        screen: screen.key,
        routes: screen.routes,
        observed: `Stage1 observed ${screen.key} (${screen.routes.length} route${screen.routes.length === 1 ? '' : 's'}).`,
        composed: `OODS Foundry does not compose ${object} ${screen.shape}: ${refusal.code} ${refusal.message}`,
        stage1: stage1(rollupRead, screen.routePointers),
        forge: { object, context: screen.shape as ScreenShape, urn: null, schemaDigest: null, searched: `design.compose ${object} context ${screen.shape}, transient`, found: 0 },
      });
      continue;
    }
    paired.add(`${object}:${screen.shape}`);
    const searched = forgeSource(object, screen.shape as ScreenShape);

    // entity: did Stage1 name this object as an entity on this screen's routes?
    const entity = entities.get(object);
    const named = entity ? screen.routes.filter(route => entity.routes.has(route)) : [];
    rows.push({
      id: `${named.length ? 'agreeing' : 'disagreeing'}:entity:${object}:${screen.shape}`,
      category: named.length ? 'agreeing' : 'disagreeing',
      axis: 'entity',
      screen: screen.key,
      routes: screen.routes,
      observed: named.length
        ? `Stage1 names ${object} as an entity on ${named.length} of ${screen.routes.length} route(s) of this screen.`
        : `Stage1 saw ${screen.routes.length} route(s) of this screen but names no ${object} entity for them.`,
      composed: `OODS Foundry holds ${object} and composes its ${screen.shape} screen.`,
      stage1: named.length ? stage1(identityRead, [entity!.pointer]) : { ...stage1(identityRead, []), found: 0 },
      forge: forge(mine, searched),
    });

    // input: does the screen take input on each side?
    const observedInputs = screen.components.filter(component => component.traits.includes('input'));
    const composedInputs = mine.inputs.length > 0;
    const inputAgree = (observedInputs.length > 0) === composedInputs;
    rows.push({
      id: `${inputAgree ? 'agreeing' : 'disagreeing'}:input:${object}:${screen.shape}`,
      category: inputAgree ? 'agreeing' : 'disagreeing',
      axis: 'input',
      screen: screen.key,
      routes: screen.routes,
      observed: observedInputs.length
        ? `Stage1 observed ${observedInputs.length} input-bearing component(s) on this screen: ${observedInputs.map(c => c.label).join(', ')}.`
        : 'Stage1 observed no input-bearing component on this screen beyond the app chrome.',
      composed: composedInputs ? `OODS Foundry composes input on this screen: ${mine.inputs.join(', ')}.` : 'OODS Foundry composes no input on this screen.',
      stage1: observedInputs.length ? stage1(rollupRead, observedInputs.map(c => c.pointer)) : { ...stage1(rollupRead, []), found: 0 },
      forge: forge(mine, searched),
    });

    // data-bound: a list renders a repeating collection on each side.
    if (screen.shape === 'list') {
      const observedBound = screen.components.filter(component => component.traits.includes('data-bound'));
      const boundAgree = (observedBound.length > 0) === mine.dataBound;
      rows.push({
        id: `${boundAgree ? 'agreeing' : 'disagreeing'}:data-bound:${object}:list`,
        category: boundAgree ? 'agreeing' : 'disagreeing',
        axis: 'data-bound',
        screen: screen.key,
        routes: screen.routes,
        observed: observedBound.length
          ? `Stage1 observed a data-bound component on this list: ${observedBound.map(c => c.label).join(', ')}.`
          : 'Stage1 observed no data-bound component on this list beyond the app chrome.',
        composed: mine.dataBound ? 'OODS Foundry composes a repeating, data-bound item list.' : 'OODS Foundry composes no repeating item list.',
        stage1: observedBound.length ? stage1(rollupRead, observedBound.map(c => c.pointer)) : { ...stage1(rollupRead, []), found: 0 },
        forge: forge(mine, searched),
      });
    }
  }

  const searchedRoutes = `every route in object_rollup projection variants and identity_graph entity endpoints (${allRoutes.size} routes, ${screens.size} screens)`;
  for (const [key, mine] of composed) {
    if (paired.has(key)) continue;
    rows.push({
      id: `composed-only:screen:${mine.object}:${mine.context}`,
      category: 'composed-only',
      axis: 'screen',
      screen: null,
      routes: [],
      observed: mine.context === 'timeline'
        ? `Stage1 observed no route of a timeline shape for ${mine.object}; a timeline has no route form OODS Foundry can match.`
        : `Stage1 observed no ${mine.context} route for ${mine.object}.`,
      composed: `OODS Foundry composes ${mine.object} ${mine.context}.`,
      stage1: { ...stage1(rollupRead, []), found: 0 },
      forge: { ...forge(mine, forgeSource(mine.object, mine.context)), searched: searchedRoutes },
    });
  }

  // A row that cannot say where both sides came from is not shown — and the count of any withheld is.
  const provenanced = (row: ObservationRow): boolean =>
    Boolean(row.stage1.runId && row.stage1.target && row.stage1.artifactKind && row.stage1.readPath)
    && Boolean(row.forge.searched) && (row.forge.found === 0 || Boolean(row.forge.object && row.forge.context && row.forge.urn));
  const shown = rows.filter(provenanced).sort((a, b) => a.id.localeCompare(b.id));
  const byCategory: Record<ObservationCategory, number> = { 'observed-only': 0, 'composed-only': 0, agreeing: 0, disagreeing: 0 };
  for (const row of shown) byCategory[row.category] += 1;

  return {
    kind: 'forge.observation',
    version: 1,
    nature: 'evidence-for-review',
    judgement: 'Every row is evidence a person judges. Nothing here is proposed, applied or written anywhere, and neither side is assumed to be right.',
    requiresHumanAdjudication: rollup.payload.requires_human_adjudication === true,
    generatedAt: new Date(started).toISOString(),
    stage1: {
      runId: manifest.runId,
      target: manifest.target,
      runPath: path.resolve(input.runPath),
      capturedAt: rollup.generatedAt ?? null,
      reads: [
        { kind: 'identity_graph', schemaVersion: identity.schemaVersion, path: identity.path, etag: identity.etag, generatedAt: identity.generatedAt ?? null },
        { kind: 'object_rollup', schemaVersion: rollup.schemaVersion, path: rollup.path, etag: rollup.etag, generatedAt: rollup.generatedAt ?? null },
      ],
    },
    forge: { objects, contexts: [...COMPOSED_CONTEXTS], transient: true, supplied: Object.keys(input.schemas ?? {}).filter(key => composed.has(key)).sort() },
    rules: {
      screens: 'A route is a screen of its resource: /x is list, /x/new is form, /x/<uuid or number> is detail (all instances are one screen); / and /admin/* and deeper routes are other.',
      objects: 'A screen belongs to a compared object when its resource segment is the object name or its plural, lower-cased.',
      chrome: 'A Stage1 component present on every observed route is the app chrome and is not attributed to any one screen.',
      input: 'Observed: a non-chrome object_rollup component with the oods trait "input" on the screen\'s routes. Composed: a component whose name ends in Input, Select, Selector, Checkbox, Radio, Switch, Textarea, Form or Picker.',
      dataBound: 'List screens only. Observed: a non-chrome component with the oods trait "data-bound". Composed: a list-items region.',
    },
    notCompared: [
      ...(unavailableDefaults.length ? [{ axis: 'objects', reason: `Default research objects are not installed: ${unavailableDefaults.join(', ')}. Only installed defaults were compared; pass objects to compare other registered objects.` }] : []),
      { axis: 'fields', reason: 'Stage1\'s entities in this run are route-derived and carry no fields, so field-level agreement cannot be computed from it.' },
      { axis: 'capability_rollup, drift_report', reason: 'Readable under the contract but carry no route or screen evidence to set beside a composition; not read.' },
    ],
    notComposed,
    scale: {
      targets: manifest.targets,
      observedRoutes: allRoutes.size,
      observedScreens: screens.size,
      composedScreens: composed.size,
      pairedScreens: paired.size,
      rows: shown.length,
      byCategory,
      withheldForProvenance: rows.length - shown.length,
      wallMs: now() - started,
    },
    rows: shown,
  };
}

/**
 * Write a computed record. Written whole or not at all: a temp file beside the target, renamed into
 * place, so a reader never sees half a record. A refusal happens in computeObservation, before this is
 * reached, which is how a refused comparison writes nothing.
 */
export function writeObservation(record: ObservationRecord, outPath: string): string {
  const target = path.resolve(outPath);
  if (target.startsWith(`${path.resolve(record.stage1.runPath)}${path.sep}`)) {
    refuseRun('A comparison is never written into the Stage1 run it read.', { outPath: target, runPath: record.stage1.runPath });
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(temp, target);
  return target;
}

/** Compute, then write. A refusal throws before the write, so the out path is never touched. */
export async function runObservation(input: ObservationInput, outPath: string): Promise<ObservationRecord> {
  const record = await computeObservation(input);
  writeObservation(record, outPath);
  return record;
}
