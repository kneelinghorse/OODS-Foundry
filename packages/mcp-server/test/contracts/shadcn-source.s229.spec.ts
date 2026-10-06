import { installedShadcnFixture } from '../helpers/shadcn-fixture.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectShadcn } from '../../src/tools/map.shadcn.js';
import { handle as create } from '../../src/tools/map.create.js';
import { handle as update } from '../../src/tools/map.update.js';
import { validateSubstitution } from '../../src/tools/component-substitution.js';
import { substituteGeneratedComponents } from '../../src/codegen/component-substitutions.js';
import { writePayload } from '../../src/lib/payload-store.js';
import { buildGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { screenApp } from '../../src/codegen/screen-app.js';
import { writeVersion } from '../../src/lib/composition-store.js';
import { refreshPreviewMappings } from '../../src/lib/preview-components.js';
import type { CodegenResult } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const root = path.resolve(import.meta.dirname, '../../../..');

let directory: string, project: string;
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true }); fs.writeFileSync(path.join(project, file), content); };
const implementation = () => ({ shadcn: { project, module: '@/components/ui/button' }, export: 'Button', props: { onActivate: { name: 'onClick' } } });
const mapping = () => ({ apply: true, externalSystem: 'shadcn', externalComponent: 'Button', oodsTraits: ['Actionable'], substitution: { component: 'Button', react: implementation() } });
const schema = () => ({ version: '1.0.0', screens: [{ id: 'screen', component: 'Button', props: { content: 'Save' } }] }) as unknown as UiSchema;
const generated = (): CodegenResult => ({ framework: 'react', status: 'ok', code: "import React from 'react';\nimport { Button } from '@oods/components-react';\nexport function GeneratedUI() { return <Button content=\"Save\" />; }", fileExtension: '.tsx', imports: ['react', '@oods/components-react'], warnings: [] });

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-'));
  project = path.join(directory, 'project');
  fs.cpSync(path.join(root, 'tests/fixtures/shadcn-radix'), project, { recursive: true });
  // Installed CLI fixture is a test prerequisite, never a mock Tailwind compiler.
  const installed = installedShadcnFixture(root);
  expect(fs.existsSync(path.join(installed, 'node_modules/tailwindcss/package.json'))).toBe(true);
  fs.symlinkSync(path.join(installed, 'node_modules'), path.join(project, 'node_modules'), 'dir');
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(directory, 'mappings.json'));
});
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });

describe('a team’s copied TSX is a checked portable substitution source', () => {
  it('accepts the real CLI source and catalog event rename at single create, update and both batch entry points', async () => {
    expect((await create(mapping())).status).toBe('ok');
    expect((await update({ id: 'shadcn-button', updates: { substitution: mapping().substitution } })).status).toBe('ok');
    fs.rmSync(path.join(directory, 'mappings.json'));
    const { apply: _apply, ...entry } = mapping();
    expect((await create({ apply: true, mappings: [entry] })).status).toBe('ok');
    fs.rmSync(path.join(directory, 'mappings.json'));
    fs.writeFileSync(path.join(directory, 'batch.json'), JSON.stringify({ mappings: [entry] }));
    expect((await create({ apply: true, mappingsPath: path.join(directory, 'batch.json') })).status).toBe('ok');
  });
  it.each(['aria-nova', 'unknown-style', '', undefined])('refuses unsupported style %s before reading a missing component or writing a map', async style => {
    const config = JSON.parse(fs.readFileSync(path.join(project, 'components.json'), 'utf8'));
    config.style = style; write('components.json', JSON.stringify(config));
    fs.rmSync(path.join(project, 'src/components/ui/button.tsx'));
    await expect(create(mapping())).rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringContaining(`components.json:1: unsupported shadcn style '${String(style)}'; supported bases: Radix`) });
    expect(fs.existsSync(path.join(directory, 'mappings.json'))).toBe(false);
  });
  it.each(['radix-nova', 'new-york', 'default'])('records the declared Radix style %s in portable artifact metadata', async style => {
    const config = JSON.parse(fs.readFileSync(path.join(project, 'components.json'), 'utf8'));
    config.style = style; write('components.json', JSON.stringify(config));
    await create(mapping()); const result = generated();
    const substitutions = substituteGeneratedComponents(result, schema(), true);
    expect(substitutions[0]?.source.shadcn).toMatchObject({ base: 'radix', style });
  });
  it('follows referenced tsconfigs, aliases and a barrel export, hashing only the closure and its configuration', () => {
    write('tsconfig.json', '{ "references": [{ "path": "./tsconfig.app.json" }] }');
    write('tsconfig.app.json', '{ // comments supported\n "compilerOptions": { "paths": { "@/*": ["./src/*"], }, }, }');
    write('src/components/oods/button.tsx', 'export { Button as OodsButton } from "@/components/ui/button";');
    const source = { project, module: '@/components/oods/button' };
    const initial = inspectShadcn(source, 'OodsButton');
    expect(initial.files).toContain('src/components/ui/button.tsx');
    write('src/App.tsx', 'unrelated edit');
    expect(inspectShadcn(source, 'OodsButton').closureHash).toBe(initial.closureHash);
    fs.appendFileSync(path.join(project, 'src/components/ui/button.tsx'), '\n// changed closure');
    expect(inspectShadcn(source, 'OodsButton').closureHash).not.toBe(initial.closureHash);
  });
  it.each([
    ['undeclared alias', () => { const source = implementation(); source.shadcn.module = '@/other/button'; return source; }, /components.json:1:.*alias/],
    ['undeclared TypeScript alias', () => { write('tsconfig.json', '{"compilerOptions":{"paths":{"~/*":["./src/*"]}}}'); return implementation(); }, /tsconfig.json:1:.*no TypeScript paths/],
    ['missing export', () => ({ ...implementation(), export: 'Missing' }), /button.tsx:1:.*export/],
    ['missing bare dependency', () => { write('src/components/oods/missing.tsx', 'import { nope } from "absent-team-package";\nexport const Missing = () => <button>{nope}</button>;'); return { ...implementation(), shadcn: { project, module: '@/components/oods/missing' }, export: 'Missing' }; }, /missing.tsx:1:.*node_modules/],
    ['escaping alias', () => { write('tsconfig.json', '{ "compilerOptions": { "paths": { "@/*": ["../*"] } } }'); return implementation(); }, /:1:.*inside/],
    ['wrong Tailwind', () => { fs.unlinkSync(path.join(project, 'node_modules')); fs.mkdirSync(path.join(project, 'node_modules/tailwindcss'), { recursive: true }); write('node_modules/tailwindcss/package.json', '{"name":"tailwindcss","version":"3.0.0","main":"index.js"}'); write('node_modules/tailwindcss/index.js', ''); return implementation(); }, /src\/index.css:1:.*Tailwind 4/],
  ])('refuses %s before any write, naming file and line', async (_name, make, message) => {
    const input = mapping(); input.substitution.react = make() as any;
    await expect(create(input)).rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringMatching(message) }); expect(fs.existsSync(path.join(directory, 'mappings.json'))).toBe(false);
  });
  it('refuses package+shadcn, Vue shadcn, and event value maps with named reasons', () => {
    expect(() => validateSubstitution({ component: 'Button', react: { ...implementation(), package: 'team' } })).toThrow(/components.json:1:.*exclusive/);
    expect(() => validateSubstitution({ component: 'Button', vue: implementation() })).toThrow(/components.json:1:.*React only/);
    expect(() => validateSubstitution({ component: 'Button', react: { package: 'team', export: 'Button', props: { onActivate: { name: 'onClick', values: { a: 'b' } } } } })).toThrow(/event translations may rename only/);
  });
  it('checks a nested type-only dependency and an escaping symlink, and never partially writes a batch', async () => {
    write('src/components/oods/types.ts', 'import type { Missing } from "missing-type-package"; export type Props = Missing;');
    write('src/components/oods/typed.tsx', 'import type { Props } from "./types"; export const Typed = (props: Props) => <button {...props} />;');
    const { apply: _apply, ...good } = mapping();
    const bad = { ...good, externalComponent: 'Typed', substitution: { component: 'Card', react: { shadcn: { project, module: '@/components/oods/typed' }, export: 'Typed' } } };
    const response = await create({ apply: true, mappings: [good, bad] });
    expect(response.status).toBe('error'); expect(JSON.stringify(response)).toContain('types.ts:1:');
    expect(JSON.stringify(response)).toContain('missing-type-package'); expect(fs.existsSync(path.join(directory, 'mappings.json'))).toBe(false);
    fs.writeFileSync(path.join(directory, 'outside.tsx'), 'export const Escape = () => null;');
    fs.symlinkSync(path.join(directory, 'outside.tsx'), path.join(project, 'src/components/oods/escape.tsx'));
    expect(() => inspectShadcn({ project, module: '@/components/oods/escape' }, 'Escape')).toThrow(/source must stay inside/);
  });
  it('refuses workflow application output by name instead of emitting an app without its source', async () => {
    await create(mapping()); const result = generated(); result.files = [{ path: 'src/ListPage.tsx', contents: result.code }, { path: 'package.json', contents: '{"dependencies":{}}' }];
    expect(() => substituteGeneratedComponents(result, schema(), true)).toThrow(/workflow application output are not supported/);
  });
  it('checks updates before replacing the saved mapping', async () => {
    await create(mapping()); const before = fs.readFileSync(path.join(directory, 'mappings.json'), 'utf8');
    await expect(update({ id: 'shadcn-button', updates: { substitution: { component: 'Button', react: { ...implementation(), export: 'Absent' } } } })).rejects.toMatchObject({ opiCode: 'OODS-V219' });
    expect(fs.readFileSync(path.join(directory, 'mappings.json'), 'utf8')).toBe(before);
  });
  it('emits the project module without a made-up npm dependency or an absolute path', async () => {
    await create(mapping()); const result = generated(); const substitutions = substituteGeneratedComponents(result, schema(), true);
    const artifact = buildGeneratedArtifact({ framework: 'react', code: result.code, fileExtension: '.tsx', imports: result.imports, substitutions });
    expect(result.code).toContain("from '@/components/ui/button'");
    expect(artifact.dependencies.some(item => item.name.startsWith('@/'))).toBe(false);
    expect(JSON.stringify(artifact)).not.toContain(project);
    expect(artifact.substitutions?.[0]?.source.shadcn?.file).toBe('src/components/ui/button.tsx');
  });
  it('packages source, aliases, CSS and the exact installed CSS/JS dependencies for a standalone application', async () => {
    await create(mapping()); const result = generated(); screenApp(result, schema(), { typescript: true } as any, {});
    const substitutions = substituteGeneratedComponents(result, schema(), true);
    const artifact = buildGeneratedArtifact({ framework: 'react', files: result.files!, imports: result.imports, substitutions });
    expect(artifact.files.some(file => file.path === 'src/components/ui/button.tsx')).toBe(true);
    const pkg = JSON.parse(artifact.files.find(file => file.path === 'package.json')!.contents);
    expect(pkg.dependencies).toMatchObject({ tailwindcss: '4.3.3', '@tailwindcss/vite': '4.3.3', cn: '0.4.0', 'class-variance-authority': '0.7.1', '@fontsource-variable/geist': '5.3.0' });
    expect(JSON.stringify(artifact)).not.toContain(project);
    for (const file of artifact.files) { fs.mkdirSync(path.dirname(path.join(directory, 'app', file.path)), { recursive: true }); fs.writeFileSync(path.join(directory, 'app', file.path), file.contents); }
  });
  it('allows metadata maintenance without the project but still checks a replacement source', async () => {
    await create(mapping()); fs.renameSync(project, project + '-moved');
    for (const updates of [{ notes: 'Moved repository' }, { confidence: 0.8 }, { oodsTraits: ['Actionable', 'Focusable'] }]) {
      expect((await update({ id: 'shadcn-button', updates })).status).toBe('ok');
    }
    await expect(update({ id: 'shadcn-button', updates: { substitution: { ...mapping().substitution, react: { ...implementation(), passthrough: false } } } }))
      .rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringContaining(project + '/components.json:1: project does not exist') });
  });
  it('hashes unquoted CSS imports and binary font bytes, materializing the original relative layout', async () => {
    const font = fs.readFileSync(path.join(root, 'packages/tokens/src/fonts/dm-sans-latin-wght-normal.woff2'));
    fs.mkdirSync(path.join(project, 'src/fonts'));
    fs.writeFileSync(path.join(project, 'src/fonts/team.woff2'), font);
    write('src/extra.css', '@font-face { font-family: Team; src: url(./fonts/team.woff2?v=1) format("woff2"); }');
    fs.appendFileSync(path.join(project, 'src/index.css'), '\n@import url(./extra.css);\n');
    const before = inspectShadcn(implementation().shadcn, 'Button');
    expect(before.files).toContain('src/extra.css'); expect(before.files).toContain('src/fonts/team.woff2');
    fs.appendFileSync(path.join(project, 'src/fonts/team.woff2'), Buffer.from([0xff]));
    expect(inspectShadcn(implementation().shadcn, 'Button').closureHash).not.toBe(before.closureHash);
    fs.writeFileSync(path.join(project, 'src/fonts/team.woff2'), font);
    await create(mapping()); const result = generated(); screenApp(result, schema(), { typescript: true } as any, {});
    const substitutions = substituteGeneratedComponents(result, schema(), true);
    const artifact = buildGeneratedArtifact({ framework: 'react', files: result.files!, imports: result.imports, substitutions });
    const asset = artifact.files.find(file => file.path === 'src/fonts/team.woff2')!;
    expect(asset.encoding).toBe('base64'); expect(Buffer.from(asset.contents, 'base64')).toEqual(font);
    const receipt = writePayload('font-proof', artifact.files, { MCP_SCHEMA_STORE_ROOT: directory, MCP_SCHEMA_STORE_DIR: 'schemas' });
    expect(fs.readFileSync(path.join(receipt.directory, 'src/fonts/team.woff2'))).toEqual(font);
  });
  it.each(['vue', 'html'] as const)('names dropped React-only mappings for %s without requiring the moved project', async framework => {
    await create(mapping()); fs.renameSync(project, project + '-moved');
    const result = { ...generated(), framework };
    expect(substituteGeneratedComponents(result, schema(), true)).toEqual([]);
    expect(result.warnings).toContainEqual({ code: 'OODS-V218', component: 'Button', message: expect.stringContaining("'shadcn-button'") });
    const unrelated = { ...generated(), framework };
    substituteGeneratedComponents(unrelated, { version: '1', screens: [{ id: 'text', component: 'Text' }] } as UiSchema, true);
    expect(unrelated.warnings).toEqual([]);
  });
  it.each(['vue', 'html'] as const)('warns for %s action buttons emitted outside the schema tree', async framework => {
    await create(mapping());
    const result = { ...generated(), framework, code: framework === 'vue' ? "import { Button } from '@oods/components-vue';" : '<button data-oods-component="Button">Edit</button>' };
    substituteGeneratedComponents(result, { version: '1', screens: [{ id: 'text', component: 'Text' }] } as UiSchema, true);
    expect(result.warnings).toContainEqual({ code: 'OODS-V218', component: 'Button', message: expect.stringContaining("'shadcn-button'") });
  });
  it('does not mistake HTML stylesheet selectors for substituted components', async () => {
    await create(mapping());
    const result = { ...generated(), framework: 'html' as const, code: '<style>[data-oods-component="Button"] { color: red; }</style><span>Example</span>' };
    substituteGeneratedComponents(result, { version: '1', screens: [{ id: 'text', component: 'Text' }] } as UiSchema, true);
    expect(result.warnings).toEqual([]);
  });
  it('latest remaps into a new version while unchanged mappings preserve the saved version', async () => {
    await create(mapping()); const value = schema(); const result = generated(); substituteGeneratedComponents(result, value, true);
    const record = { recordVersion: '1', compositionId: 'cmp-123456789abc', version: 1, schema: value, artifacts: {}, measurements: {}, compose: {} } as any;
    await writeVersion(directory, record);
    const first = await refreshPreviewMappings(directory, record);
    await writeVersion(directory, first.record);
    expect(first.changed).toBe(true);
    expect((await refreshPreviewMappings(directory, first.record)).changed).toBe(false);
    await update({ id: 'shadcn-button', updates: { substitution: { component: 'Button', react: { ...implementation(), props: { content: { name: 'children' } } } } } });
    const second = await refreshPreviewMappings(directory, first.record);
    expect(second.changed).toBe(true); expect(second.record.version).toBeGreaterThan(first.record.version);
  });
});
