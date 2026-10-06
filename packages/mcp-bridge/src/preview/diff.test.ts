import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { diffVersions, sharedFrameworks } from './diff.js';
import { registerPreviewHost } from './host.js';
import type { CompositionVersion, PreviewArtifact } from './store.js';

const runtimeDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dist/preview-runtime');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const directories: string[] = [];
const servers: FastifyInstance[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

type Node = { id: string; component: string; props?: Record<string, unknown>; children?: Node[]; meta?: { intent?: string } };
type Fixture = { compose: CompositionVersion['compose']; brand: CompositionVersion['brand']; theme: CompositionVersion['theme']; schema: { screens: Node[] }; model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const raw = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8')) as Fixture;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function version(n: number, mutate: (schema: { screens: Node[] }, record: CompositionVersion) => void = () => {}): CompositionVersion {
  const schema = clone(raw.schema);
  const record: CompositionVersion = {
    recordVersion: '1', compositionId: 'cmp-0123456789ab', version: n, parentVersion: n === 1 ? null : n - 1, operation: n === 1 ? 'compose' : 'recompose', createdAt: '2026-09-15T00:00:00.000Z', head: null,
    compose: clone(raw.compose), schema, schemaHash: '', brand: raw.brand, theme: raw.theme, slots: [], model: raw.model,
    artifacts: { react: { artifact: clone(raw.frameworks.react.artifact), generatedAt: '2026-09-15T00:00:00.000Z' }, vue: { artifact: clone(raw.frameworks.vue.artifact), generatedAt: '2026-09-15T00:00:00.000Z' } }, measurements: {},
  };
  mutate(schema, record);
  record.schemaHash = `sha256:${sha256(JSON.stringify(schema))}`;
  return record;
}
const walk = (nodes: Node[], visit: (node: Node, parent?: Node) => void, parent?: Node) => { for (const node of nodes) { visit(node, parent); if (node.children) walk(node.children, visit, node); } };
const isSlot = (node: Node) => /^slot-/.test(node.id) || Boolean(node.meta?.intent?.startsWith('slot:'));
/** Walk outside slot subtrees: what the nodes, props and field-order categories see. */
const walkOutside = (nodes: Node[], visit: (node: Node) => void) => { for (const node of nodes) { if (isSlot(node)) continue; visit(node); if (node.children) walkOutside(node.children, visit); } };
const slotOf = (schema: { screens: Node[] }, name: string): Node => { let found: Node | undefined; walk(schema.screens, node => { if (node.meta?.intent === `slot:${name}`) found = node; }); if (!found) throw new Error(`no slot ${name}`); return found; };
const moveFile = (record: CompositionVersion, framework: 'react' | 'vue', contents: string) => { const artifact = record.artifacts[framework]!.artifact; artifact.files[0]!.contents = contents; artifact.files[0]!.contentHash = `sha256:${sha256(contents)}`; artifact.contentHash = `sha256:${sha256(artifact.files.map(file => file.contentHash).join('\n'))}`; };
const categories = (diff: ReturnType<typeof diffVersions>) => Object.entries(diff.summary).filter(([, count]) => count > 0).map(([category]) => category);

describe('structural what-changed between two composition versions (s201-m03)', () => {
  it('reports zero differences for a version compared with itself', () => {
    const one = version(1);
    const diff = diffVersions(one, one);
    expect(diff).toMatchObject({ identical: true, differenceCount: 0, differences: [] });
    expect(Object.values(diff.summary).every(count => count === 0)).toBe(true);
    expect(diff.left).toEqual({ compositionId: 'cmp-0123456789ab', version: 1, schemaHash: one.schemaHash, parentVersion: null, operation: 'compose', object: 'Subscription', context: 'card' });
    expect(sharedFrameworks(one, one)).toEqual(['react', 'vue']);
  });

  it('reports the swapped slot, its changed nodes and the artifact files it moved', () => {
    const one = version(1);
    const slotName = [...new Set((() => { const names: string[] = []; walk((one.schema as { screens: Node[] }).screens, node => { if (node.meta?.intent?.startsWith('slot:')) names.push(node.meta.intent.slice(5)); }); return names; })())][0]!;
    const two = version(2, (schema, record) => {
      const slot = slotOf(schema, slotName);
      slot.children = [{ id: `override-${slotName}`, component: 'Text', props: { content: 'Swapped' } }];
      moveFile(record, 'react', '// swapped\n' + raw.frameworks.react.artifact.files[0]!.contents);
      moveFile(record, 'vue', '<!-- swapped -->\n' + raw.frameworks.vue.artifact.files[0]!.contents);
    });
    const diff = diffVersions(one, two);
    expect(categories(diff)).toEqual(['slots', 'nodes', 'artifacts']);
    const slots = diff.differences.filter(entry => entry.category === 'slots');
    expect(slots).toEqual([{ category: 'slots', field: slotName, before: (slotOf(one.schema as { screens: Node[] }, slotName).children ?? []).map(node => node.component), after: ['Text'], note: 'slot components changed' }]);
    const moved = diff.differences.filter(entry => entry.category === 'artifacts').map(entry => entry.field).sort();
    expect(moved).toEqual([`react.contentHash`, `react.files.${raw.frameworks.react.artifact.files[0]!.path}`, `vue.contentHash`, `vue.files.${raw.frameworks.vue.artifact.files[0]!.path}`]);
    expect(diff.summary.nodes).toBeGreaterThan(0);
    expect(diff.differenceCount).toBe(5 + diff.summary.nodes);
    expect(diff.identical).toBe(false);
  });

  it('reports a reordered region as the region order only', () => {
    const one = version(1);
    const screen = (one.schema as { screens: Node[] }).screens[0]!;
    if ((screen.children?.length ?? 0) < 2) { const two = version(2, schema => { schema.screens[0]!.children!.push({ id: 'extra-region', component: 'Stack' }); }); expect(categories(diffVersions(one, two))).toEqual(['regions']); return; }
    const two = version(2, schema => { const children = schema.screens[0]!.children!; children.reverse(); });
    const diff = diffVersions(one, two);
    expect(categories(diff)).toEqual(['regions']);
    expect(diff.differences).toEqual([{ category: 'regions', field: 'order', before: screen.children!.map(node => `${screen.id}/${node.id}`), after: [...screen.children!].reverse().map(node => `${screen.id}/${node.id}`), note: 'regions reordered' }]);
  });

  it('reports an added region, a changed prop, a reordered field list and a changed seed each in its own category', () => {
    const one = version(1);
    const added = version(2, schema => { schema.screens[0]!.children!.push({ id: 'note-region', component: 'Text', props: { content: 'Added' } }); });
    expect(categories(diffVersions(one, added))).toEqual(['regions']);
    expect(diffVersions(one, added).differences[0]).toMatchObject({ category: 'regions', field: `${(one.schema as { screens: Node[] }).screens[0]!.id}/note-region`, before: null, after: 'Text', note: 'region added' });
    let target: Node | undefined; walkOutside((one.schema as { screens: Node[] }).screens, node => { if (!target && typeof node.props?.field === 'string') target = node; });
    if (target) {
      const prop = version(2, schema => { walk(schema.screens, node => { if (node.id === target!.id) node.props = { ...node.props, label: 'Renamed' }; }); });
      const diff = diffVersions(one, prop);
      expect(categories(diff)).toEqual(['props']);
      expect(diff.differences).toEqual([{ category: 'props', field: `${target.id}.label`, before: target.props?.label ?? null, after: 'Renamed', note: target.props && 'label' in target.props ? 'prop changed' : 'prop added' }]);
    }
    const fields: Node[] = []; walkOutside((one.schema as { screens: Node[] }).screens, node => { if (typeof node.props?.field === 'string') fields.push(node); });
    const [first, second] = fields;
    if (first && second && first.props!.field !== second.props!.field) {
      const swapped = version(2, schema => { walk(schema.screens, node => { if (node.id === first.id) node.props = { ...node.props, field: second.props!.field }; else if (node.id === second.id) node.props = { ...node.props, field: first.props!.field }; }); });
      const diff = diffVersions(one, swapped);
      expect(categories(diff).sort()).toEqual(['fieldOrder', 'props']);
      expect(diff.summary.fieldOrder).toBeGreaterThan(0);
    }
    const seeded = version(2, (_schema, record) => { record.compose = { ...record.compose, preferences: { ...(record.compose.preferences ?? {}), seed: 7 } }; });
    expect(diffVersions(one, seeded).differences).toEqual([{ category: 'seed', field: 'preferences.seed', before: null, after: 7, note: 'seed changed' }]);
  });

  it('serves the compare page with both apps, the what-changed and both measurement panels, and the diff as JSON', async () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), 'oods-compare-')), 'compositions'); directories.push(path.dirname(dir));
    const one = version(1), two = version(2, (schema, record) => { schema.screens[0]!.children!.push({ id: 'note-region', component: 'Text', props: { content: 'Added' } }); record.measurements = { validation: { react: { profile: 'build', checks: [{ name: 'schema-structure', status: 'pass' }], notChecked: ['rendered-evidence'] } } }; });
    for (const record of [one, two]) { const folder = path.join(dir, record.compositionId, 'versions'); mkdirSync(folder, { recursive: true }); writeFileSync(path.join(folder, `${record.version}.json`), JSON.stringify(record)); }
    const server = Fastify(); servers.push(server);
    await registerPreviewHost(server, { compositionsDir: dir, runtimeDir });
    const page = await server.inject('/compare/cmp-0123456789ab@1/cmp-0123456789ab@2?framework=vue&brand=A&theme=hc&width=820');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('src="/preview/cmp-0123456789ab/1/app?framework=vue&brand=A&theme=hc"');
    expect(page.body).toContain('src="/preview/cmp-0123456789ab/2/app?framework=vue&brand=A&theme=hc"');
    expect(page.body).toContain('data-oods-what-changed="true"');
    expect(page.body).toContain('<h2>What changed <span class="count">1</span></h2>');
    expect(page.body).toContain('<ul data-oods-diff="regions">');
    expect(page.body).toContain('region added');
    expect(page.body).toContain('data-oods-measurements="cmp-0123456789ab@1"');
    expect(page.body).toContain('data-oods-not-measured="validation:react"');
    expect(page.body).toContain('data-oods-measurements="cmp-0123456789ab@2"');
    expect(page.body).toContain('data-oods-measured="validation:react"');
    expect(page.body).toContain('1 checks ran (schema-structure)');
    expect(page.body).toContain('style="width:820px"');
    const same = await server.inject('/compare/cmp-0123456789ab@2/cmp-0123456789ab@2');
    expect(same.body).toContain('data-oods-identical="true"');
    const diff = await server.inject('/compare/cmp-0123456789ab@1/cmp-0123456789ab@2/diff.json');
    expect(diff.json()).toEqual(diffVersions(one, two));
    expect((await server.inject('/compare/cmp-0123456789ab@1/cmp-0123456789ab@3')).statusCode).toBe(404);
    expect((await server.inject('/compare/cmp-0123456789ab@1/nope')).statusCode).toBe(400);
    expect((await server.inject('/compare/cmp-0123456789ab@1/cmp-0123456789ab@2?framework=react')).statusCode).toBe(200);
  });
});


describe('compare tells the truth about the published 0.4.4 reproductions (s227-m01)', () => {
  const fixtures = new URL('../../../../artifacts/product-reality/sprint-227/planning/versions/', import.meta.url);
  const read = (file: string): CompositionVersion => JSON.parse(readFileSync(new URL(file, fixtures), 'utf8'));
  const pairs = readdirSync(fixtures).filter(file => file.endsWith('.v1.json')).map(file => file.replace('.v1.json', ''));
  const pair = (name: string) => [read(`${name}.v1.json`), read(`${name}.v2.json`)] as const;
  it.each([false, true])('s229: a tab rename is one row, alongside only an added field when present (%s)', added => {
    const [one, originalTwo] = pair('last-counted-edit-Warehouse-detail');
    const two = clone(added ? originalTwo : one);
    two.schemaHash = 'renamed-tab';
    let panelId = '';
    walk((two.schema as { screens: Node[] }).screens, (node, parent) => {
      if (parent?.component === 'Tabs' && node.props?.label === 'Details') { node.props.label = 'Overview'; panelId = node.id; }
    });
    expect(panelId).not.toBe('');
    const rename = { category: 'nodes', field: panelId, before: { label: 'Details' }, after: { label: 'Overview' }, note: 'tab renamed' };
    const diff = diffVersions(one, two);
    const baseline = added ? diffVersions(one, originalTwo).differences : [];
    expect(diff.differences).toEqual(expect.arrayContaining([rename, ...baseline]));
    expect(diff.differenceCount).toBe(baseline.length + 1);
    expect(diff.differences.filter(row => row.note === 'field moved')).toEqual([]);
  });

  it('s229: a replacement panel with fewer than half its fields shared is not presented as a rename', () => {
    const field = (name: string): Node => ({ id: name, component: 'Text', props: { field: name } });
    const one = version(1, schema => { schema.screens = [{ id: 'screen', component: 'Stack', children: [{ id: 'main', component: 'Tabs', children: [{ id: 'panel', component: 'Stack', props: { label: 'Details' }, children: ['city', 'name', 'state'].map(field) }] }] }]; });
    const two = clone(one); two.schemaHash = 'replaced-panel';
    const panel = (two.schema as { screens: Node[] }).screens[0].children![0].children![0];
    panel.props!.label = 'Stock'; panel.children = ['stock', 'capacity', 'city'].map(field);
    expect(diffVersions(one, two).differences.some(row => row.note === 'tab renamed')).toBe(false);
  });

  it('names the changed showIcon prop on the Warehouse list slot itself', () => {
    const diff = diffVersions(...pair('show-icon-flip-Warehouse-list'));
    expect(diff.identical).toBe(false);
    expect(diff.differences).toContainEqual({ category: 'props', field: 'slot-toolbar-actions-3.showIcon', before: false, after: true, note: 'prop changed' });
  });
  it.each(['Warehouse', 'ColdRoom'])('%s detail reports only the new field nodes, not ids the composer renumbered (s228-m01)', name => {
    const diff = diffVersions(...pair(`last-counted-edit-${name}-detail`));
    const nodes = diff.differences.filter(entry => entry.category === 'nodes');
    expect(nodes).toHaveLength(2);
    expect(nodes.every(entry => entry.field.includes('last_counted_at') && entry.note === 'node added')).toBe(true);
    expect(diff.summary.fieldOrder).toBe(1);
    expect(diff.summary.definition).toBe(1);
    expect(diff.summary.props).toBe(0);
    expect(diff.differences.some(entry => /city|updated_at|stock_level/.test(entry.field))).toBe(false);
  });
  it('reports a field moved to a different tab once, including its inherited label identity', () => {
    const one = version(1, schema => { schema.screens = [{ id: 'screen', component: 'Stack', children: [{ id: 'main', component: 'Tabs', children: [
      { id: 'panel-1', component: 'Stack', props: { label: 'Details' }, children: [{ id: 'field-1-read-field', component: 'Stack', children: [{ id: 'field-1-label', component: 'Text', props: { content: 'City' } }, { id: 'field-1-value', component: 'Text', props: { field: 'city' }, meta: { intent: 'read-only-field' } }] }] },
      { id: 'panel-2', component: 'Stack', props: { label: 'Address' }, children: [] },
    ] }] }]; });
    const two = clone(one); two.schemaHash = 'moved-city';
    const panels = (two.schema as { screens: Node[] }).screens[0]!.children![0]!.children!;
    panels[1]!.children!.push(panels[0]!.children!.pop()!);
    expect(diffVersions(one, two).differences.filter(entry => entry.category === 'nodes')).toEqual([{ category: 'nodes', field: 'city', before: { region: 'screen/main', tab: 'Details' }, after: { region: 'screen/main', tab: 'Address' }, note: 'field moved' }]);
  });
  it.each(['Warehouse-list', 'Warehouse-form', 'ColdRoom-list'])('explains that %s kept its screen while its definition gained a field', name => {
    const diff = diffVersions(...pair(`last-counted-edit-${name}`));
    expect(diff.identical).toBe(false);
    expect(diff.differenceCount).toBe(1);
    expect(diff.differences[0]).toMatchObject({ category: 'definition', field: 'objectSchema.last_counted_at', before: null, note: 'field added' });
  });
  it.each(pairs)('%s can only be identical when its hashes agree, and unchanged versions stay identical', name => {
    const [one, two] = pair(name);
    const diff = diffVersions(one, two);
    if (diff.identical) expect(one.schemaHash).toBe(two.schemaHash);
    else expect(diff.differenceCount).toBeGreaterThan(0);
    expect(diffVersions(one, { ...one, version: 3 })).toMatchObject({ identical: true, differenceCount: 0, differences: [] });
  });
  it('compares props inside a slot, and catches schema changes it cannot itemize', () => {
    const one = version(1, schema => { schema.screens[0]!.children!.push({ id: 'slot-example-1', component: 'Stack', children: [{ id: 'nested', component: 'Text', props: { content: 'Before' } }] }); });
    const two = clone(one); two.schemaHash = 'changed';
    walk((two.schema as { screens: Node[] }).screens, node => { if (node.id === 'nested') node.props!.content = 'After'; });
    expect(diffVersions(one, two).differences).toEqual([{ category: 'props', field: 'nested.content', before: 'Before', after: 'After', note: 'prop changed' }]);
    expect(diffVersions(one, { ...one, schemaHash: 'unitemized' }).differences).toEqual([{ category: 'definition', field: 'schemaHash', before: one.schemaHash, after: 'unitemized', note: 'schema changed in a part compare does not itemize' }]);
  });
  it('names removed and changed definition fields without inventing screen changes', () => {
    const [one, two] = pair('last-counted-edit-Warehouse-list');
    expect(diffVersions(two, one).differences[0]).toMatchObject({ category: 'definition', field: 'objectSchema.last_counted_at', after: null, note: 'field removed' });
    const changed = clone(two); changed.schemaHash = 'changed-definition';
    (changed.schema as any).objectSchema.last_counted_at = { type: 'string', description: 'Changed' };
    expect(diffVersions(two, changed).differences).toHaveLength(1);
    expect(diffVersions(two, changed).differences[0]).toMatchObject({ category: 'definition', field: 'objectSchema.last_counted_at', note: 'field changed' });
  });
  it('does not flood an added region with rows for renumbered bare containers', () => {
    const one = version(1, schema => { schema.screens = [{ id: 'screen', component: 'Stack', children: [{ id: 'main', component: 'Stack', children: [{ id: 'stack-1', component: 'Stack', children: [{ id: 'name', component: 'Text', props: { field: 'name' } }] }] }] }]; });
    const two = clone(one); two.schemaHash = 'added-region';
    const screen = (two.schema as { screens: Node[] }).screens[0]!;
    screen.children![0]!.children![0]!.id = 'stack-2';
    screen.children!.unshift({ id: 'header', component: 'Stack', children: [{ id: 'stack-1', component: 'Stack' }] });
    expect(diffVersions(one, two).differences).toEqual([{ category: 'regions', field: 'screen/header', before: null, after: 'Stack', note: 'region added' }]);
  });
});
