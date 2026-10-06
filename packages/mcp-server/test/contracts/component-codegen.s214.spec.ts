import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadMappings, saveMappings } from '../../src/tools/map.shared.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/code.generate.output.json';
import { wire } from '../helpers/wire-boundary.js';
import { translateProps } from '../../src/tools/component-substitution.js';

let directory: string;
let previous: string | undefined;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 's214-codegen-'));
  previous = process.env.MCP_MAPPINGS_PATH;
  process.env.MCP_MAPPINGS_PATH = path.join(directory, 'mappings.json');
  const doc = loadMappings();
  doc.mappings = [{ id: 'team-button', externalSystem: 'team', externalComponent: 'TeamButton', oodsTraits: ['Stateful'], confidence: 'manual',
    substitution: { component: 'Button', ...Object.fromEntries(['react', 'vue'].map(framework => [framework, {
      package: `@forge-test/team-components/${framework}`, export: 'TeamButton', version: '1.0.0',
      props: { intent: { name: 'appearance', values: { primary: 'prominent' } } },
    }])) } }];
  doc.mappings.push({ id: 'team-badge', externalSystem: 'team', externalComponent: 'TeamStatusBadge', oodsTraits: ['Stateful'], confidence: 'manual', substitution: { component: 'StatusBadge', react: { package: '@forge-test/team-components/react', export: 'TeamStatusBadge', version: '1.0.0' } } });
  saveMappings(doc);
});
afterEach(() => {
  if (previous === undefined) delete process.env.MCP_MAPPINGS_PATH;
  else process.env.MCP_MAPPINGS_PATH = previous;
  fs.rmSync(directory, { recursive: true, force: true });
});

it.each(['react', 'vue'] as const)('emits a team %s import and exact dependency instead of silently ignoring the mapping', async framework => {
  const result = await generate({ framework, profile: 'build', schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { content: 'Save', intent: 'primary' } }] } });
  expect(result.status, JSON.stringify(result)).toBe('ok');
  expect(result.code).toContain(`from '@forge-test/team-components/${framework}'`);
  expect(result.code).toContain('appearance');
  expect(result.artifact!.dependencies).toContainEqual({ name: '@forge-test/team-components', version: '1.0.0', kind: 'dependency' });
  expect(result.install!.steps.join('\n')).toContain('@forge-test/team-components@1.0.0');
  expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
  expect(getAjv().compile(outputSchema)(result)).toBe(true);
});

it('records mapping provenance while leaving trait-selected Forge component identities intact', async () => {
  const result = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
  expect(result.status).toBe('ok');
  const nodes: any[] = [];
  const visit = (node: any) => { nodes.push(node); node.children?.forEach(visit); };
  result.schema.screens.forEach(visit);
  const badges = nodes.filter(node => node.component === 'StatusBadge');
  expect(badges.length).toBeGreaterThan(0);
  for (const node of badges) expect(node.meta?.substitution).toMatchObject({ mappingId: 'team-badge', substitution: { component: 'StatusBadge' } });
  expect(result.meta).toHaveProperty('substitutions');
  wire('design.compose', 'output', result);
});

it('groups named and default imports without allowing the team to introduce an unknown Forge component', async () => {
  const doc = loadMappings();
  doc.mappings[1]!.substitution!.react!.export = 'default';
  saveMappings(doc);
  const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.02', screens: [{ id: 'box', component: 'Stack', children: [
    { id: 'save', component: 'Button', props: { content: 'Save' } }, { id: 'status', component: 'StatusBadge', props: { status: 'active' } },
  ] }] } });
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  expect(result.code.match(/from '@forge-test\/team-components\/react'/g)).toHaveLength(1);
  // s221-m03 (#2482 ruling 8): the local alias names nothing after the product (was __ForgeTeamStatusBadge).
  expect(result.code).toContain('default as __MappedStatusBadge');
  const unknown = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.02', screens: [{ id: 'custom', component: 'UnknownTeamComponent' }] } });
  expect(unknown.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OODS-V119' })]));
});

it.each(['react', 'vue'] as const)('adds exact %s team dependencies to workflow applications', async framework => {
  const composed = await compose({ object: 'Subscription', context: 'workflow', options: { transient: true } });
  const before = JSON.stringify(composed.meta?.substitutions);
  const generated = await generate({ schema: composed.schema, framework, profile: 'build' });
  expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
  expect(JSON.stringify(composed.meta?.substitutions)).toBe(before);
  const manifest = JSON.parse(generated.artifact!.files.find(file => file.path === 'package.json')!.contents);
  expect(manifest.dependencies['@forge-test/team-components']).toBe('1.0.0');
  expect(generated.artifact!.substitutions?.length).toBeGreaterThan(0);
  expect(validateGeneratedArtifact(generated.artifact!)).toEqual([]);
  wire('code.generate', 'output', generated);
});

it('pins a composed mapping so editing the live store cannot silently change a saved screen', async () => {
  const composed = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
  const first = await generate({ schema: composed.schema, framework: 'react', profile: 'build' });
  const doc = loadMappings(); doc.mappings[1]!.substitution!.react!.export = 'NewBadge'; saveMappings(doc);
  const next = await generate({ schema: composed.schema, framework: 'react', profile: 'build' });
  expect(next.artifact!.contentHash).toBe(first.artifact!.contentHash);
  expect(next.code).toContain('TeamStatusBadge as');
});

it.each(['missing-version', 'duplicate-owner', 'conflicting-versions'] as const)('refuses %s instead of guessing a consumer dependency', async failure => {
  const doc = loadMappings();
  if (failure === 'missing-version') delete doc.mappings[0]!.substitution!.react!.version;
  if (failure === 'duplicate-owner') doc.mappings.push({ ...structuredClone(doc.mappings[0]!), id: 'another-owner' });
  if (failure === 'conflicting-versions') doc.mappings[1]!.substitution!.react!.version = '2.0.0';
  saveMappings(doc);
  const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.02', screens: [
    { id: 'save', component: 'Button', props: { content: 'Save' } }, { id: 'status', component: 'StatusBadge', props: { status: 'active' } },
  ] } });
  expect(result.status).toBe('error');
  expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OODS-N016' })]));
});

it('binds substitution imports and versions into the artifact hash and refuses unrecorded imports', async () => {
  const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } });
  const artifact = structuredClone(result.artifact!);
  artifact.substitutions![0]!.source.version = '2.0.0';
  expect(validateGeneratedArtifact(artifact).join(' ')).toContain('invalid contentHash');
  delete artifact.substitutions;
  expect(validateGeneratedArtifact(artifact).join(' ')).toContain('not supported');
});

it.each(['react', 'vue'] as const)('supports untyped %s screens without leaking TypeScript into generated adapters', async framework => {
  const result = await generate({ framework, profile: 'build', options: { typescript: false }, schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } });
  expect(result.status).toBe('ok');
  expect(result.code).not.toContain('Record<string,');
  expect(result.code).not.toContain('as unknown as');
});


it('resolves exact versions from installed ESM-only packages that hide package.json', async () => {
  const name = `s214-installed-team-${process.pid}`;
  const packageDirectory = path.join(process.cwd(), 'node_modules', name);
  fs.mkdirSync(packageDirectory);
  try {
    fs.writeFileSync(path.join(packageDirectory, 'package.json'), JSON.stringify({ name, version: '2.3.4+team.1', type: 'module', exports: { '.': { import: './index.js' } } }));
    fs.writeFileSync(path.join(packageDirectory, 'index.js'), 'export const TeamButton = () => null;');
    const doc = loadMappings();
    doc.mappings[0]!.substitution!.react = { package: name, export: 'TeamButton' }; saveMappings(doc);
    const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(result.artifact!.dependencies).toContainEqual({ name, version: '2.3.4+team.1', kind: 'dependency' });
  } finally { fs.rmSync(packageDirectory, { recursive: true, force: true }); }
});

it('translates Vue controlled modelValue through the shared value mapping without dropping update listeners', async () => {
  const doc = loadMappings();
  doc.mappings.push({ id: 'team-input', externalSystem: 'team', externalComponent: 'TeamInput', oodsTraits: ['Stateful'], confidence: 'manual', substitution: {
    component: 'Input', vue: { package: '@forge-test/team-components/vue', export: 'TeamInput', version: '1.0.0', passthrough: false,
      props: { id: { name: 'id' }, label: { name: 'caption' }, value: { name: 'currentValue' } } },
  } });
  saveMappings(doc);
  const composed = await compose({ object: 'Subscription', context: 'workflow', options: { transient: true } });
  const result = await generate({ schema: composed.schema, framework: 'vue', profile: 'build' });
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  const source = result.artifact!.files.find(file => file.path === 'src/screens/Form.vue')!.contents;
  const emittedConfigurations = [...source.matchAll(/JSON.parse\(("(?:\\.|[^"\\])*")\)/g)].map(match => JSON.parse(JSON.parse(match[1]!)));
  const input = emittedConfigurations.find(configuration => configuration.props?.label?.name === 'caption');
  const update = () => undefined;
  expect(translateProps({ id: 'field', label: 'Name', modelValue: 'Edited', 'onUpdate:modelValue': update, title: 'unmapped' }, input))
    .toEqual({ id: 'field', caption: 'Name', currentValue: 'Edited', 'onUpdate:modelValue': update });
});
