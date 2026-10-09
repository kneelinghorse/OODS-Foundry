import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { handle as map } from '../../src/tools/map.js';
import { handle as readMap } from '../../src/tools/map.read.js';
import { handle as snapshot } from '../../src/tools/registry.snapshot.js';
import { wire, retain, repositoryRoot } from '../helpers/wire-boundary.js';

const canonical = path.join(repositoryRoot, 'artifacts/structured-data/component-mappings.json');
const before = fs.readFileSync(canonical);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s194-map-'));
const file = path.join(temp, 'component-mappings.json');
const previous = process.env.MCP_MAPPINGS_PATH;
beforeAll(() => { fs.copyFileSync(canonical, file); process.env.MCP_MAPPINGS_PATH = file; });
afterAll(() => {
  if (previous === undefined) delete process.env.MCP_MAPPINGS_PATH;
  else process.env.MCP_MAPPINGS_PATH = previous;
  expect(fs.readFileSync(canonical)).toEqual(before);
  fs.rmSync(temp, { recursive: true, force: true });
});

it('map persists and resolves external mappings; draft fields are stored, not advertised or consumed', async () => {
  wire('registry.snapshot', 'input', {});
  const first = await snapshot({});
  wire('registry.snapshot', 'output', first);
  const fixture = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'packages/mcp-server/test/fixtures/object-catalog/registry-v14-synthetic.json'), 'utf8'));
  const input = { action: 'create' as const, externalSystem: 's194-external', externalComponent: 'SaveButton', oodsTraits: ['Stateful'],
    preferred_terms: fixture.preferred_terms, disambiguation_decisions: fixture.disambiguation_decisions, capabilities: fixture.capabilities,
    propMappings: [{ externalProp: 'state', oodsProp: 'status', coercion: { type: 'enum' as const, mapping: { busy: 'pending' } } }], apply: false };
  wire('map', 'input', input);
  const dry = await map(input);
  wire('map', 'output', dry);
  expect(dry).toMatchObject({ status: 'ok', applied: false });
  expect(fs.readFileSync(file)).toEqual(before);
  const writeInput = { ...input, apply: true };
  wire('map', 'input', writeInput);
  const created: any = await map(writeInput);
  wire('map', 'output', created);
  expect(created).toMatchObject({ status: 'ok', applied: true, mapping: { oodsTraits: ['Stateful'] } });
  const changed = await snapshot({});
  wire('registry.snapshot', 'output', changed);
  expect(changed.etag).not.toBe(first.etag);
  // s221-m01: registry.snapshot no longer returns the draft review fields since s216-m03 (213e28df13, #2409; its API doc
  // says they are not advertised). map appends them to the mapping document's top-level lists, and resolution still
  // ignores them (below).
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['preferred_terms', 'disambiguation_decisions', 'capabilities'] as const) {
    expect(stored[key]).toEqual(expect.arrayContaining(fixture[key]));
    expect(changed).not.toHaveProperty(key);
  }
  const resolveInput = { action: 'resolve' as const, externalSystem: 's194-external', externalComponent: 'savebutton' };
  wire('map.read', 'input', resolveInput);
  const resolved = await readMap(resolveInput);
  wire('map.read', 'output', resolved);
  expect(resolved).toMatchObject({ status: 'ok', mapping: { id: created.mapping.id }, propTranslations: [{ externalProp: 'state', oodsProp: 'status', coercionType: 'enum', coercionDetail: { mapping: { busy: 'pending' } } }] });
  // A surfaced preferred-term label is deliberately not an executable alias.
  const preferred = await readMap({ ...resolveInput, externalComponent: fixture.preferred_terms[0].label });
  wire('map.read', 'output', preferred);
  expect(preferred).toMatchObject({ status: 'not_found' });
  const deleteInput = { action: 'delete' as const, id: created.mapping.id };
  wire('map', 'input', deleteInput);
  const deleted = await map(deleteInput);
  wire('map', 'output', deleted);
  expect(deleted).toMatchObject({ status: 'ok', deleted: { id: created.mapping.id } });
  const absent = await readMap(resolveInput);
  wire('map.read', 'output', absent);
  expect(absent).toMatchObject({ status: 'not_found' });
  const last = await snapshot({});
  wire('registry.snapshot', 'output', last);
  expect(last.etag).not.toBe(changed.etag);
  expect((await snapshot({})).etag).toBe(last.etag);
  retain('map', { input, dry, created, resolved, preferred, deleted, absent, snapshotEtags: [first.etag, changed.etag, last.etag], canonicalUnchanged: true,
    limitation: 'Draft review fields are stored with the mapping and not advertised by registry.snapshot; resolution does not consume them.' });
});
