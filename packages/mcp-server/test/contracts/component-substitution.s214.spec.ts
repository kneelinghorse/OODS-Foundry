import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle as create } from '../../src/tools/map.create.js';
import { handle as update } from '../../src/tools/map.update.js';
import { handle as list } from '../../src/tools/map.list.js';
import { handle as resolve } from '../../src/tools/map.resolve.js';
import { handle as snapshot } from '../../src/tools/registry.snapshot.js';
import { translateProps } from '../../src/tools/component-substitution.js';
import { getMappingsPath } from '../../src/tools/map.shared.js';
import { loadObject, clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/map.input.json';

let dir: string;
const implementation = { package: '@forge-test/team', export: 'TeamInput', passthrough: false,
  props: { id: { name: 'id' }, label: { name: 'caption' } } };
const record = () => ({ apply: true, externalSystem: 'team', externalComponent: 'TeamInput', oodsTraits: ['Stateful'],
  substitution: { component: 'Input', react: structuredClone(implementation), vue: structuredClone(implementation) } });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'substitution-'));
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(dir, 'mappings/component-mappings.json'));
  vi.stubEnv('OODS_MAPPINGS_DIR', path.join(dir, 'mappings'));
});
afterEach(() => { vi.unstubAllEnvs(); clearTraitCache(); clearObjectCache(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('a team mapping is an executable, validated contract (s214-m01)', () => {
  it('persists both framework imports and exposes the real user store to list, resolve and snapshot', async () => {
    const input = record();
    expect(getAjv().compile(inputSchema)({ action: 'create', ...input })).toBe(true);
    const created = await create(input);
    expect(created.mapping.substitution).toEqual(input.substitution);
    expect(getMappingsPath()).toBe(path.join(dir, 'mappings/component-mappings.json'));
    expect((await list({})).mappings[0].substitution).toEqual(input.substitution);
    expect((await resolve(input)).mapping?.substitution).toEqual(input.substitution);
    expect((await snapshot({})).maps[0].substitution).toEqual(input.substitution);
  });

  it.each([
    ['component', (x: any) => { x.substitution.component = 'Unshipped'; }],
    ['props.typo', (x: any) => { x.substitution.react.props.typo = { name: 'oops' }; }],
    ['props.label', (x: any) => { delete x.substitution.react.props.label; }],
    ['props.label', (x: any) => { x.substitution.react.props.label = 'execute(code)'; }],
    ['package', (x: any) => { x.substitution.react.package = '../outside'; }],
    ['props.label.values', (x: any) => { x.substitution.react.props.label.values = { active: { code: 'no expressions' } }; }],
    ['props.label', (x: any) => { x.substitution.react.props.label.name = 'id'; }],
    ['export', (x: any) => { x.substitution.react.export = "Bad'; import 'evil"; }],
  ])('refuses invalid %s before a write, with a typed error naming the field', async (field, change) => {
    const input = record(); change(input);
    await expect(create(input)).rejects.toMatchObject({ opiCode: 'OODS-V001', details: { field: expect.stringContaining(field) } });
    expect(fs.existsSync(getMappingsPath())).toBe(false);
  });

  it('updates validate the resulting contract atomically', async () => {
    const created = await create(record());
    const before = fs.readFileSync(getMappingsPath(), 'utf8');
    await expect(update({ id: String(created.mapping.id), updates: { substitution: { component: 'Unshipped', react: implementation } } })).rejects.toMatchObject({ opiCode: 'OODS-V001' });
    expect(fs.readFileSync(getMappingsPath(), 'utf8')).toBe(before);
  });

  it('allows identity prop coverage and preserves existing trait-only records', async () => {
    const input = record();
    input.substitution.react = { ...implementation, passthrough: true, props: {} };
    expect((await create(input)).status).toBe('ok');
    expect((await create({ apply: true, externalSystem: 'legacy', externalComponent: 'Card', oodsTraits: ['Stateful'] })).status).toBe('ok');
  });

  it('renames props and translates only declared scalar values, preserving zero, false, slots and event functions', () => {
    const onActivate = () => undefined;
    const result = translateProps({ intent: 'primary', content: 'Save', disabled: false, count: 0, children: 'Child', onActivate }, {
      package: '@forge-test/team-components/react', export: 'TeamButton',
      props: { intent: { name: 'appearance', values: { primary: 'prominent' } }, content: { name: 'caption' } },
    });
    expect(result).toEqual({ appearance: 'prominent', caption: 'Save', disabled: false, count: 0, children: 'Child', onActivate });
    expect(translateProps({ intent: 'danger', content: 'Delete', children: 'Delete', onActivate }, { ...implementation, props: { intent: { name: 'appearance', values: { primary: 'prominent' } } } })).toEqual({ appearance: 'danger', children: 'Delete', onActivate });
  });

  it('recognizes a team trait rather than warning from the frozen export', async () => {
    const traits = path.join(dir, 'traits'); fs.mkdirSync(traits);
    fs.writeFileSync(path.join(traits, 'WarehouseStock.trait.yaml'), 'trait:\n  name: WarehouseStock\n  version: 1.0.0\n  category: inventory\nschema: {}\n');
    vi.stubEnv('OODS_TRAITS_DIR', traits); clearTraitCache();
    const objects = path.join(dir, 'objects'); fs.mkdirSync(objects);
    fs.writeFileSync(path.join(objects, 'Warehouse.object.yaml'), 'object:\n  name: Warehouse\n  version: 1.0.0\n  domain: inventory\ntraits:\n  - name: inventory/WarehouseStock\nschema: {}\n');
    vi.stubEnv('OODS_OBJECTS_DIR', objects); clearObjectCache();
    const ownObject = loadObject('Warehouse');
    const input = { ...record(), oodsTraits: ownObject.traits.map(trait => trait.name) };
    expect((await create(input)).warnings ?? []).toEqual([]);
    expect((await resolve(input)).mapping?.oodsTraits).toEqual(input.oodsTraits);
  });

  it('uses the user directory when no legacy file override is set', () => {
    vi.stubEnv('MCP_MAPPINGS_PATH', '');
    expect(getMappingsPath()).toBe(path.join(dir, 'mappings/component-mappings.json'));
  });

  it('honors the legacy file override over the new directory setting', () => {
    const file = path.join(dir, 'legacy.json'); vi.stubEnv('MCP_MAPPINGS_PATH', file);
    expect(getMappingsPath()).toBe(file);
  });
});
