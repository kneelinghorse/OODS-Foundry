/** A team's Stockable badge must name its field even when the object has no Stateful trait. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { KEPT_BESIDE_PATTERN, reconcileFormDetail } from '../../src/compose/form-detail.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const fixtures = path.resolve(import.meta.dirname, '../fixtures/team-definitions');
const all = (schema: UiSchema): UiElement[] => {
  const result: UiElement[] = [];
  const visit = (node: UiElement) => { result.push(node); node.children?.forEach(visit); };
  schema.screens.forEach(visit); return result;
};
let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s225-status-'));
  Object.assign(process.env, { OODS_OBJECTS_DIR: path.join(home, 'objects'), OODS_TRAITS_DIR: path.join(home, 'traits'), MCP_SCHEMA_STORE_ROOT: home, MCP_MAPPINGS_PATH: path.join(home, 'absent.json') });
  for (const [kind, names] of [['objects', ['ColdRoom.object.yaml', 'Warehouse.object.yaml']], ['traits', ['Stockable.trait.yaml']]] as const) {
    fs.mkdirSync(path.join(home, kind), { recursive: true });
    for (const name of names) fs.copyFileSync(path.join(fixtures, name), path.join(home, kind, name));
  }
  clearObjectCache(); clearTraitCache();
});
afterEach(() => {
  for (const key of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'MCP_SCHEMA_STORE_ROOT', 'MCP_MAPPINGS_PATH']) delete process.env[key];
  clearObjectCache(); clearTraitCache(); fs.rmSync(home, { recursive: true, force: true });
});

describe('s225: a detail badge says which field it represents', () => {
  it('labels Stockable without Stateful and orders the object fields, trait fields and record times in every generator', async () => {
    const composed = await compose({ object: 'ColdRoom', context: 'detail', options: { transient: true } } as never);
    expect(composed.status).toBe('ok');
    const nodes = all(composed.schema);
    const badge = nodes.find(node => node.component === 'StatusBadge' && node.props?.statusField === 'stock_level')!;
    expect(nodes.find(node => node.children?.includes(badge))?.children?.[0]).toMatchObject({ component: 'Text', props: { content: 'Stock level' } });
    const details = nodes.find(node => node.props?.label === 'Details')!;
    const labels = details.children!.map(row => row.children?.[0]?.props?.content);
    // s227-m01: a temperature suffix uses degrees; field ordering stays exactly as authored.
    expect(labels).toEqual(['Target temperature (°C)', 'Warehouse', 'Stock level', 'Units on hand', 'Capacity units', 'Created at', 'Updated at', 'Last event', 'Last event at']);
    for (const framework of ['react', 'vue', 'html'] as const) {
      const result = await generate({ schema: composed.schema, framework } as never);
      expect(result.status).toBe('ok');
      let previous = -1;
      for (const label of labels) {
        const offset = result.code!.indexOf(String(label), previous + 1);
        expect(offset, `${framework}: ${String(label)} follows the previous field`).toBeGreaterThan(previous);
        previous = offset;
      }
    }
  }, 120_000);

  it('keeps detail_group states as Text rows so a comparison state is not presented as a verdict badge', async () => {
    const result = await compose({ object: 'Comparison', context: 'detail', options: { transient: true } } as never);
    const nodes = all(result.schema);
    expect(nodes.filter(node => node.component === 'StatusBadge' && node.props?.statusField === 'result_state')).toEqual([]);
    expect(nodes.find(node => node.component === 'Text' && node.props?.field === 'result_state')).toBeDefined();
  });

  it('keeps one lifecycle status and its domain in the header, without a second labelled status row', async () => {
    const result = await compose({ object: 'Warehouse', context: 'detail', options: { transient: true } } as never);
    const nodes = all(result.schema);
    expect(nodes.filter(node => node.component === 'StatusBadge' && node.props?.statusField === 'status')).toHaveLength(1);
    expect(nodes.filter(node => node.id.endsWith('-read-field') && node.children?.some(child => child.props?.statusField === 'status'))).toEqual([]);
    expect(nodes.find(node => node.component === 'StatusBadge' && node.props?.statusField === 'status')?.props).toMatchObject({ domain: 'lifecycle', statusField: 'status' });
  });

  it('also exempts a custom field bound by the Stateful recipe, while still labelling another trait', () => {
    const schema = { objectSchema: { name: { type: 'string' }, phase: { type: 'string' }, stock_level: { type: 'string' } }, screens: [{ id: 'screen', component: 'Stack', children: [
      { id: 'heading', component: 'DetailHeader', props: { titleField: 'name' } },
      { id: 'body', component: 'Stack', children: [{ id: 'phase', component: 'StatusBadge', props: { statusField: 'phase', domainField: 'phase' } }, { id: 'stock', component: 'StatusBadge', props: { statusField: 'stock_level' } }] },
    ] }] } as unknown as UiSchema;
    const composed = { object: { name: 'Store' }, traits: [{ ref: { name: 'lifecycle/Stateful' }, definition: { trait: { name: 'Stateful' }, schema: { phase: { type: 'string' } }, view_extensions: { list: [{ component: 'StatusBadge', props: { field: 'phase' } }] } } }], semantics: {} };
    reconcileFormDetail(schema, 'detail', composed as never);
    expect(all(schema).filter(node => node.component === 'StatusBadge' && node.props?.statusField === 'phase')).toHaveLength(1);
    expect(all(schema).some(node => node.id === 'phase-read-field')).toBe(false);
    expect(all(schema).some(node => node.id === 'stock-read-field')).toBe(true);
  });

  it('leaves dashboard badges unchanged: bare sidebar badges stay bare and an already-kept pattern badge stays labelled', () => {
    for (const kept of [false, true]) {
      const schema = { objectSchema: { stock_level: { type: 'string' } }, screens: [{ id: 'screen', component: 'Stack', children: [{ id: 'sidebar-stock', component: 'StatusBadge', props: { statusField: 'stock_level' }, ...(kept ? { meta: { intent: KEPT_BESIDE_PATTERN } } : {}) }] }] } as unknown as UiSchema;
      reconcileFormDetail(schema, 'dashboard', { object: { name: 'Store' }, traits: [], semantics: {} } as never);
      expect(all(schema).find(node => node.id === 'sidebar-stock')?.component).toBe('StatusBadge');
      expect(all(schema).some(node => node.id === 'sidebar-stock-read-field')).toBe(kept);
    }
  });
});
