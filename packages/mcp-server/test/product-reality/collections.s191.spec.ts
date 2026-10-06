import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { addressCollectionSummary } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { typecheckWorkflow } from './workflow-typecheck.js';
import type { UiElement } from '../../src/schemas/generated.js';

const nodes = (elements: UiElement[]): UiElement[] => elements.flatMap(node => [node, ...nodes(node.children ?? [])]);
const root = fileURLToPath(new URL('../../../../', import.meta.url));

describe('workflow collection domain ownership (s191)', () => {
  for (const object of ['Organization', 'User']) {
    it.each(['react', 'vue'] as const)(`${object}/%s emits deterministic, strictly typed collection actions`, async framework => {
      const composition = await compose({ object, context: 'workflow' });
      expect(composition.status).toBe('ok');
      expect(composition.schema.workflow?.data.defaultAddressRole).toBe(object === 'User' ? 'home' : 'headquarters');
      const input = { schema: composition.schema, framework, profile: 'build' as const };
      const originalSchema = structuredClone(composition.schema);
      const first = await generate(input), second = await generate(input);
      expect(composition.schema).toEqual(originalSchema);
      expect(first.status, JSON.stringify(first.errors)).toBe('ok');
      expect(first.artifact).toEqual(second.artifact);
      const form = first.artifact!.files.find(file => /^src\/screens\/Form\./.test(file.path))!.contents;
      for (const state of composition.schema.workflow!.data.lifecycleStates) expect(form).toContain(state);
      const result = typecheckWorkflow(first.artifact!);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(first.artifact!.actions.find(action => action.name === 'handleChange_addresses')?.parameters).toEqual([{ name: 'address', type: 'Record<string, unknown>' }]);
    }, 60_000);
  }

  it('keeps unknown scalar domain actions unsupported', async () => {
    const { schema } = await compose({ object: 'User', context: 'workflow' });
    const editor = nodes(schema.screens).find(node => node.component === 'AddressEditor')!;
    editor.bindings!.onChange = 'handleChange_display_name';
    const result = await generate({ schema, framework: 'react', profile: 'build' });
    expect(result.status).toBe('error');
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OODS-N016', message: expect.stringContaining('handleChange_display_name') })]));
  });

  it('replaces the displayed entry when the declared default role is missing, preserves metadata, and persists only on Save', async () => {
    const { schema } = await compose({ object: 'User', context: 'workflow' });
    // A second collection name proves this is not a name-keyed addresses implementation.
    schema.objectSchema!.locations = schema.objectSchema!.addresses!;
    delete schema.objectSchema!.addresses;
    schema.objectSchema!.preferred_role = schema.objectSchema!.default_address_role!;
    for (const node of nodes(schema.screens)) {
      if (node.props?.field === 'addresses') node.props.field = 'locations';
      if (node.component === 'AddressEditor') {
        node.props!.defaultRoleField = 'preferred_role';
        node.bindings!.onChange = 'handleChange_locations';
      }
    }
    const result = await generate({ schema, framework: 'react', profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const directory = mkdtempSync(path.join(tmpdir(), 'oods-s191-collection-'));
    try {
      // s213-m01: the generated modules are transpiled to CommonJS .js, so the folder declares that scope itself; a temp
      // folder inside a "type": "module" package (the handoff keeps TMPDIR in the repository) otherwise loads them as ESM.
      writeFileSync(path.join(directory, 'package.json'), '{"type":"commonjs"}\n');
      for (const file of result.artifact!.files.filter(file => /^src\/(store|sample-data|application|actions)\.ts$/.test(file.path))) {
        writeFileSync(path.join(directory, path.basename(file.path, '.ts') + '.js'), ts.transpileModule(file.contents, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      mkdirSync(path.join(directory, 'node_modules/@oods'), { recursive: true });
      symlinkSync(path.join(root, 'packages/component-contracts'), path.join(directory, 'node_modules/@oods/component-contracts'), 'junction');
      const req = createRequire(path.join(directory, 'entry.cjs'));
      const { sampleData } = req('./sample-data.js');
      const { createWorkflow } = req('./application.js');
      const { collectionAddress, collectionSummary } = req('./store.js');
      const seed = structuredClone(sampleData);
      // s221-m01: seeds no longer invent required names or an address since s216-m05 (#2412, #2413); the test authors the
      // entry it edits. The generated save enforces no required field, so a blank name blocks nothing here.
      seed[0].locations = [{ role: schema.workflow!.data.defaultAddressRole, address: { countryCode: 'US', addressLines: ['100 Main Street'], locality: 'Springfield', administrativeArea: 'IL', postalCode: '62701' }, isDefault: true, updatedAt: '2026-09-08T12:00:00.000Z' }];
      const other = structuredClone(seed[0].locations[0]);
      const unrelated = { ...structuredClone(other), role: 'work', metadata: { source: 'import' } };
      seed[0].locations.push(unrelated);
      seed[0].preferred_role = 'shipping';
      const app = createWorkflow({ seed, latency: 0, now: () => '2026-09-10T12:00:00.000Z' });
      // Select the configured fixture explicitly; display-name sorting need not select seed[0].
      await app.navigate('form', seed[0][schema.workflow!.data.idField]);
      expect(collectionAddress(app.snapshot().draft.locations).street).toBe('100 Main Street');
      app.actions.handleChange_locations({ street: '8 Lake Road', city: 'Madison', region: 'WI', postalCode: '53703' });
      expect(app.snapshot().draft.locations).toHaveLength(2);
      expect(app.snapshot().draft.locations[0].role).toBe(other.role);
      expect(app.snapshot().draft.locations[1]).toEqual(unrelated);
      expect(collectionAddress(app.snapshot().draft.locations, 'shipping').city).toBe('Madison');
      await app.navigate('form');
      expect(app.snapshot().draft.locations).toHaveLength(2); // navigation discards unsaved edits
      app.actions.handleChange_locations({ street: '8 Lake Road', city: 'Madison', region: 'WI', postalCode: '53703' });
      app.actions.handleSubmit();
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(app.snapshot().screen).toBe('detail');
      expect(collectionSummary(app.snapshot().draft.locations)).toContain('home, 8 Lake Road, Madison');
      // s223-m02 (#2527 ruling 13i): a single screen and the HTML renderer print the same line from the contract helper.
      expect(addressCollectionSummary(app.snapshot().draft.locations)).toBe(collectionSummary(app.snapshot().draft.locations));
      const saved = app.snapshot().draft.locations[0];
      saved.metadata = { validationStatus: 'verified' };
      app.actions.handleChange_locations({ street: '9 Lake Road', city: 'Madison', region: 'WI', postalCode: '53703' });
      expect(app.snapshot().draft.locations).toHaveLength(2);
      expect(app.snapshot().draft.locations[0].metadata).toEqual({ validationStatus: 'verified' });
      expect(app.snapshot().draft.locations[0].address.countryCode).toBe('US');
      expect(app.snapshot().draft.locations[0].role).toBe(other.role);
      expect(app.snapshot().draft.locations[1]).toEqual(unrelated);
      app.dispose();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
