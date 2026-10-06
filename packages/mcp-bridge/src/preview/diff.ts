import type { CompositionVersion, PreviewFramework } from './store.js';

/**
 * The structural what-changed between two composition versions. The shape follows the design
 * loop's receipt diff (scripts/design-loop/diff.ts: one {field, before, after} row per difference,
 * a count, JSON equality), applied to the fields a version carries: regions, slots, props, field
 * order, the seed and the artifact files whose hash moved. Nothing is claimed about pixels here.
 */
export type DiffCategory = 'regions' | 'slots' | 'nodes' | 'props' | 'fieldOrder' | 'seed' | 'artifacts' | 'definition';
export interface DiffEntry { category: DiffCategory; field: string; before: unknown; after: unknown; note: string }
export interface VersionRef { compositionId: string; version: number; schemaHash: string; parentVersion: number | null; operation: string; object: string | null; context: string | null }
export interface CompositionDiff {
  left: VersionRef;
  right: VersionRef;
  identical: boolean;
  differenceCount: number;
  summary: Record<DiffCategory, number>;
  differences: DiffEntry[];
}

type Node = { id: string; component: string; props?: Record<string, unknown>; children?: Node[]; meta?: { intent?: string } };
type Schema = { screens: Node[]; objectSchema?: Record<string, unknown> };

const CATEGORIES: DiffCategory[] = ['regions', 'slots', 'nodes', 'props', 'fieldOrder', 'seed', 'artifacts', 'definition'];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** A slot keeps its id (slot-<name>-<n>) after filling, whether or not the placeholder intent survived. */
const slotName = (node: Node): string | undefined => {
  if (typeof node.meta?.intent === 'string' && node.meta.intent.startsWith('slot:')) return node.meta.intent.slice(5);
  const match = /^slot-(.+)-\d+$/.exec(node.id);
  return match ? match[1] : undefined;
};
const CONTAINERS = new Set(['Stack', 'Card', 'Tabs']);
/** What a slot renders: its children, or the component the slot itself became; an empty container is an empty slot. */
const placedIn = (node: Node): string[] => node.children?.length ? node.children.map(child => child.component) : CONTAINERS.has(node.component) ? [] : [node.component];

/** Regions: the direct children of every screen, in order. */
function regions(schema: Schema): Array<{ key: string; component: string; node: Node }> {
  return schema.screens.flatMap(screen => (screen.children ?? []).map(node => ({ key: `${screen.id}/${node.id}`, component: node.component, node })));
}
/** Slots: slot name → the components placed in it, in order: the composer's own record when the version carries it, else read from the schema. */
function slots(record: CompositionVersion): Map<string, { placed: string[] }> {
  const found = new Map<string, { placed: string[] }>();
  if (record.slots?.length) {
    for (const slot of record.slots) found.set(slot.slotName, { placed: slot.placedComponents ?? (slot.selectedComponent ? [slot.selectedComponent] : []) });
    return found;
  }
  const walk = (node: Node) => { const name = slotName(node); if (name) { found.set(name, { placed: placedIn(node) }); return; } node.children?.forEach(walk); };
  (record.schema as Schema).screens.forEach(walk);
  return found;
}
type NodeEntry = { node: Node; region: string; tab: string; panelKey: string; fields: string[]; identity: string; screen: string };
const boundFields = (node: Node): string[] => [...new Set(Object.entries(node.props ?? {}).filter(([key, value]) => (key === 'field' || key.endsWith('Field')) && typeof value === 'string').map(([, value]) => value as string))].sort();
const subtreeFields = (node: Node): string[] => [...new Set([...boundFields(node), ...(node.children ?? []).flatMap(subtreeFields)])].sort();
const stableId = (id: string) => id.replace(/(^|-)\d+(?=-|$)/g, '');
/** A rename keeps a panel's position and most of its fields, even when generated ids renumber. */
function tabPanels(schema: Schema): Map<string, Node> {
  const panels = new Map<string, Node>();
  const walk = (node: Node, ancestors: string[]) => {
    const location = [...ancestors, stableId(node.id)];
    if (node.component === 'Tabs') node.children?.forEach((panel, index) => panels.set(JSON.stringify([...location, index]), panel));
    node.children?.forEach(child => walk(child, location));
  };
  schema.screens.forEach(screen => walk(screen, []));
  return panels;
}
/** Counters and layout wrappers may change without changing a field's on-screen identity. */
function nodes(schema: Schema, panels: Map<Node, string>): Map<string, NodeEntry> {
  const found = new Map<string, NodeEntry>();
  const ordinals = new Map<string, number>();
  const walk = (node: Node, screen: string, region: string, tab: string, panelKey: string, parent?: Node, inherited?: { field: string; position: number[] }) => {
    const own = boundFields(node), below = subtreeFields(node);
    const anchor = below.length === 1 ? { field: below[0]!, position: [] } : inherited;
    const fields = own.length ? own : anchor ? [anchor.field] : [];
    const panel = parent?.component === 'Tabs' ? String(node.props?.label ?? '') : tab;
    const key = parent?.component === 'Tabs' ? panels.get(node) ?? JSON.stringify(['label', panel]) : panelKey;
    const role = node.component === 'Stack' && node.id.endsWith('-read-field') ? 'row'
      : node.meta?.intent === 'read-only-field' ? 'value'
      : node.component === 'Text' && !own.length && parent?.id.endsWith('-read-field') ? 'label' : '';
    const slot = slotName(node);
    const identity = JSON.stringify(panels.has(node) ? ['panel', key] : slot ? ['slot', slot] : [node.component, role, fields, own.length || role === 'row' ? [] : anchor?.position ?? stableId(node.id)]);
    const base = JSON.stringify([screen, region, key, identity]);
    const ordinal = ordinals.get(base) ?? 0; ordinals.set(base, ordinal + 1);
    found.set(`${base}:${ordinal}`, { node, region, tab: panel, panelKey: key, fields, identity, screen });
    node.children?.forEach((child, index) => walk(child, screen, region, panel, key, node, anchor ? { field: anchor.field, position: [...anchor.position, index] } : undefined));
  };
  for (const screen of schema.screens) for (const child of screen.children ?? []) walk(child, screen.id, `${screen.id}/${child.id}`, '', '');
  return found;
}
/** Field order per region: the `field` props in document order, outside slots (a slot's fields belong to its placement). */
function fieldOrder(schema: Schema): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const region of regions(schema)) {
    const fields: string[] = [];
    const walk = (node: Node) => { if (slotName(node)) return; if (typeof node.props?.field === 'string') fields.push(node.props.field); node.children?.forEach(walk); };
    walk(region.node);
    found.set(region.key, fields);
  }
  return found;
}
const ref = (record: CompositionVersion): VersionRef => ({ compositionId: record.compositionId, version: record.version, schemaHash: record.schemaHash, parentVersion: record.parentVersion, operation: record.operation, object: record.compose.object ?? null, context: record.compose.context ?? null });
const seedOf = (record: CompositionVersion): unknown => (record.compose.preferences as { seed?: unknown } | undefined)?.seed ?? null;

export function diffVersions(left: CompositionVersion, right: CompositionVersion): CompositionDiff {
  const differences: DiffEntry[] = [];
  const add = (category: DiffCategory, field: string, before: unknown, after: unknown, note: string) => { if (!same(before, after)) differences.push({ category, field, before: before ?? null, after: after ?? null, note }); };
  const a = left.schema as Schema, b = right.schema as Schema;

  // Regions: added, removed, reordered.
  const ra = regions(a), rb = regions(b);
  const keysA = ra.map(region => region.key), keysB = rb.map(region => region.key);
  for (const region of ra) if (!keysB.includes(region.key)) add('regions', region.key, region.component, null, 'region removed');
  for (const region of rb) if (!keysA.includes(region.key)) add('regions', region.key, null, region.component, 'region added');
  const sharedA = keysA.filter(key => keysB.includes(key)), sharedB = keysB.filter(key => keysA.includes(key));
  add('regions', 'order', sharedA, sharedB, 'regions reordered');

  // Slots: the components placed in each slot.
  const sa = slots(left), sb = slots(right);
  for (const name of new Set([...sa.keys(), ...sb.keys()])) add('slots', name, sa.get(name)?.placed, sb.get(name)?.placed, sa.has(name) && sb.has(name) ? 'slot components changed' : sa.has(name) ? 'slot removed' : 'slot added');

  // Nodes, including slots: added or removed, unless a region change already says so. Bare layout
  // containers (Stack, Card, Tabs without a field) are chrome whose ids renumber between
  // compositions; what they hold is reported through slots, regions and the nodes inside them.
  const subsumed = (entry: NodeEntry, otherRegions: string[]) =>
    !otherRegions.includes(entry.region) || (CONTAINERS.has(entry.node.component) && typeof entry.node.props?.field !== 'string');
  const panelsA = new Map<Node, string>(), panelsB = new Map<Node, string>();
  const rightPanels = tabPanels(b);
  for (const [key, panel] of tabPanels(a)) {
    const other = rightPanels.get(key);
    if (!other) continue;
    const fieldsA = subtreeFields(panel), fieldsB = subtreeFields(other);
    const shared = fieldsA.filter(field => fieldsB.includes(field)).length;
    if (!shared || shared * 2 < Math.max(fieldsA.length, fieldsB.length)) continue;
    panelsA.set(panel, key); panelsB.set(other, key);
    add('nodes', other.id, { label: panel.props?.label }, { label: other.props?.label }, 'tab renamed');
  }
  const na = nodes(a, panelsA), nb = nodes(b, panelsB);
  const matched = new Map([...na.keys()].filter(key => nb.has(key)).map(key => [key, key]));
  const moved = new Set<string>();
  // A field crossing a tab or region is one move, not a removal and an insertion for its label and value.
  for (const [key, entry] of na) {
    if (matched.has(key) || !entry.fields.length) continue;
    const candidates = [...nb].filter(([otherKey, other]) => ![...matched.values()].includes(otherKey) && other.screen === entry.screen && other.identity === entry.identity);
    if (candidates.length !== 1) continue;
    const [otherKey, other] = candidates[0]!;
    if (entry.region === other.region && entry.panelKey === other.panelKey) continue;
    matched.set(key, otherKey);
    const field = entry.fields.join(', '), moveKey = JSON.stringify([entry.screen, field, entry.region, entry.tab, other.region, other.tab]);
    if (!moved.has(moveKey)) {
      moved.add(moveKey);
      add('nodes', field, { region: entry.region, tab: entry.tab }, { region: other.region, tab: other.tab }, 'field moved');
    }
  }
  const nodeName = (entry: NodeEntry) => entry.fields.length ? `${entry.node.id} (${entry.fields.join(', ')})` : entry.node.id;
  for (const [key, entry] of na) if (!matched.has(key) && !subsumed(entry, keysB)) add('nodes', nodeName(entry), entry.node.component, null, 'node removed');
  for (const [key, entry] of nb) if (![...matched.values()].includes(key) && !subsumed(entry, keysA)) add('nodes', nodeName(entry), null, entry.node.component, 'node added');
  for (const [key, entry] of na) {
    const other = nb.get(matched.get(key) ?? '');
    if (!other) continue;
    const node = entry.node;
    const id = other.node.id;
    add('props', `${id}.component`, node.component, other.node.component, 'component changed');
    const propsA = node.props ?? {}, propsB = other.node.props ?? {};
    for (const key of [...new Set([...Object.keys(propsA), ...Object.keys(propsB)])].sort()) {
      if (key === 'label' && panelsA.has(node)) continue; // The rename has its own single row.
      add('props', `${id}.${key}`, propsA[key], propsB[key], key in propsA && key in propsB ? 'prop changed' : key in propsA ? 'prop removed' : 'prop added');
    }
  }

  // Field order per region shared by both.
  const fa = fieldOrder(a), fb = fieldOrder(b);
  for (const key of sharedA) add('fieldOrder', key, fa.get(key), fb.get(key), 'field order changed');

  // The sample-data seed.
  add('seed', 'preferences.seed', seedOf(left), seedOf(right), 'seed changed');

  // Artifact files whose hash moved, per framework both versions carry.
  for (const framework of ['react', 'vue'] as PreviewFramework[]) {
    const artA = left.artifacts[framework]?.artifact, artB = right.artifacts[framework]?.artifact;
    if (!artA || !artB) continue;
    add('artifacts', `${framework}.contentHash`, artA.contentHash, artB.contentHash, 'artifact content hash moved');
    const filesA = Object.fromEntries(artA.files.map(file => [file.path, file.contentHash])), filesB = Object.fromEntries(artB.files.map(file => [file.path, file.contentHash]));
    for (const file of [...new Set([...Object.keys(filesA), ...Object.keys(filesB)])].sort()) add('artifacts', `${framework}.files.${file}`, filesA[file], filesB[file], file in filesA && file in filesB ? 'file hash moved' : file in filesA ? 'file removed' : 'file added');
  }

  // Definition fields affect the schema hash even when the trait places them in another context.
  const definitionA = a.objectSchema ?? {}, definitionB = b.objectSchema ?? {};
  for (const field of [...new Set([...Object.keys(definitionA), ...Object.keys(definitionB)])].sort()) add('definition', `objectSchema.${field}`, definitionA[field], definitionB[field], field in definitionA && field in definitionB ? 'field changed' : field in definitionA ? 'field removed' : 'field added');
  if (left.schemaHash !== right.schemaHash && differences.length === 0) add('definition', 'schemaHash', left.schemaHash, right.schemaHash, 'schema changed in a part compare does not itemize');

  const summary = Object.fromEntries(CATEGORIES.map(category => [category, differences.filter(entry => entry.category === category).length])) as Record<DiffCategory, number>;
  return { left: ref(left), right: ref(right), identical: left.schemaHash === right.schemaHash && differences.length === 0, differenceCount: differences.length, summary, differences };
}

/** Frameworks a compare can show side by side: generated on both versions. */
export function sharedFrameworks(left: CompositionVersion, right: CompositionVersion): PreviewFramework[] {
  return (['react', 'vue'] as PreviewFramework[]).filter(framework => left.artifacts[framework] && right.artifacts[framework]);
}
