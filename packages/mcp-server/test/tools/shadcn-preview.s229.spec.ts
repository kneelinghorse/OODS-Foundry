import { inspectShadcn } from '../../src/tools/map.shadcn.js';
import { compileShadcnCss } from '../../../mcp-bridge/src/preview/shadcn.js';
import { installedShadcnFixture } from '../helpers/shadcn-fixture.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPreviewHost } from '../../../mcp-bridge/src/preview/host.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as create } from '../../src/tools/map.create.js';
import { handle as update } from '../../src/tools/map.update.js';
import { resolveCompositionsDir, readVersion } from '../../src/lib/composition-store.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/design.preview.output.json';

const root = path.resolve(import.meta.dirname, '../../../..');
let folder: string, project: string, server: FastifyInstance, url: string;
beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-preview-')); project = path.join(folder, 'project');
  fs.cpSync(path.join(root, 'tests/fixtures/shadcn-radix'), project, { recursive: true });
  fs.symlinkSync(path.join(installedShadcnFixture(root), 'node_modules'), path.join(project, 'node_modules'), 'dir');
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(folder, 'mappings.json'));
  vi.stubEnv('MCP_SCHEMA_STORE_ROOT', folder); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas');
  expect((await create({ apply: true, externalSystem: 'shadcn', externalComponent: 'Card', oodsTraits: [], substitution: { component: 'Card', react: { shadcn: { project, module: '@/components/ui/card' }, export: 'Card' } } })).status).toBe('ok');
  server = Fastify(); await registerPreviewHost(server, { compositionsDir: resolveCompositionsDir(), runtimeDir: path.join(root, 'packages/mcp-bridge/dist/preview-runtime') });
  url = await server.listen({ port: 0, host: '127.0.0.1' });
});
afterEach(async () => { await server?.close(); vi.unstubAllEnvs(); fs.rmSync(folder, { recursive: true, force: true }); });
const open = (input: Parameters<typeof preview>[0]) => preview(input, { previewHostUrl: url });

describe('shadcn preview runs the project source and theme', () => {
  it('opens the first preview at the returned composition version and then preserves its frozen shadcn bytes', async () => {
    expect((await create({ apply: true, externalSystem: 'shadcn', externalComponent: 'Input', oodsTraits: [], substitution: { component: 'Input', react: { shadcn: { project, module: '@/components/ui/input' }, export: 'Input' } } })).status).toBe('ok');
    const composed = await compose({ object: 'Plan', context: 'form' });
    expect(composed.status).toBe('ok');
    // A newcomer passes both identities from compose; version 1 has no preview package snapshot yet.
    const input = { compositionId: composed.compositionId!, version: composed.version!, framework: 'react' as const };
    const first = await open(input);
    expect(first.version).toBe(composed.version);
    const before = await (await fetch(first.previews[0]!.moduleUrl)).text();
    expect(before).toContain('data-slot');
    const record = await readVersion(resolveCompositionsDir(), first.compositionId, first.version);
    expect(record.componentPackages?.some(pkg => pkg.shadcn?.module === '@/components/ui/input')).toBe(true);
    fs.rmSync(project, { recursive: true });
    const reopened = await open(input);
    expect(reopened.version).toBe(first.version);
    expect(await (await fetch(reopened.previews[0]!.moduleUrl)).text()).toBe(before);
  }, 120_000);

  it('compiles Tailwind classes and inlines fonts, ignores unrelated edits, freezes closure changes and follows remapping', async () => {
    const first = await open({ object: 'Subscription', context: 'detail', framework: 'react' });
    const check = getAjv().compile(outputSchema); expect(check(first), JSON.stringify(check.errors)).toBe(true);
    const before = await (await fetch(first.previews[0]!.moduleUrl)).text();
    expect(before).toContain('data-slot'); expect(before).toContain('.bg-card'); expect(before).toContain('--primary: oklch(0.55 0.2 262)'); expect(before).toContain('data:font/woff2;base64,');
    fs.appendFileSync(path.join(project, 'src/App.tsx'), '\n// unrelated edit');
    expect((await open({ compositionId: first.compositionId, framework: 'react' })).version).toBe(first.version);
    fs.appendFileSync(path.join(project, 'src/components/ui/card.tsx'), '\nconsole.log("changed-shadcn-closure");');
    const second = await open({ compositionId: first.compositionId, framework: 'react' });
    expect(second.version).toBe(first.version + 1);
    expect(await (await fetch(second.previews[0]!.moduleUrl)).text()).toContain('changed-shadcn-closure');
    await update({ id: 'shadcn-card', updates: { substitution: { component: 'Card', react: { shadcn: { project, module: '@/components/ui/card' }, export: 'Card', passthrough: false } } } });
    const third = await open({ compositionId: first.compositionId, framework: 'react' });
    expect(third.version).toBe(second.version + 1);
    expect(third.previews[0]!.artifactContentHash).not.toBe(second.previews[0]!.artifactContentHash);
    const recorded = await readVersion(resolveCompositionsDir(), first.compositionId, third.version);
    expect(recorded.artifacts.react!.artifact.substitutions?.[0]?.source.shadcn?.module).toBe('@/components/ui/card');
    fs.rmSync(project, { recursive: true });
    const historic = await open({ compositionId: first.compositionId, version: first.version, framework: 'react' });
    expect(await (await fetch(historic.previews[0]!.moduleUrl)).text()).toBe(before);
  }, 120_000);

  it('inlines nested url imports and local fonts without editing the project CSS', async () => {
    fs.mkdirSync(path.join(project, 'src/nested/fonts'), { recursive: true });
    const font = fs.readFileSync(path.join(root, 'packages/tokens/src/fonts/dm-sans-latin-wght-normal.woff2'));
    fs.writeFileSync(path.join(project, 'src/nested/fonts/team.woff2'), font);
    fs.writeFileSync(path.join(project, 'src/nested/font.css'), '@font-face { font-family: Team; src: url(./fonts/team.woff2) format("woff2"); }');
    fs.writeFileSync(path.join(project, 'src/nested/theme.css'), '@import url("./font.css"); .font-proof { font-family: Team; }');
    const entry = '@import url(./nested/theme.css) layer(team);\n' + fs.readFileSync(path.join(project, 'src/index.css'), 'utf8');
    fs.writeFileSync(path.join(project, 'src/index.css'), entry);
    const source = inspectShadcn({ project, module: '@/components/ui/card' }, 'Card');
    const css = await compileShadcnCss(source, '<div className="font-proof bg-card" />');
    expect(css).toContain('data:font/woff2;base64,' + font.toString('base64'));
    expect(css).toContain('@layer team'); expect(css).not.toContain('@import');
    expect(fs.readFileSync(path.join(project, 'src/index.css'), 'utf8')).toBe(entry);
  });

  it('renames a catalog event on an ordinary package mapping and meets real click/Enter activation', async () => {
    const team = path.join(folder, 'event-package'); fs.mkdirSync(team);
    fs.writeFileSync(path.join(team, 'package.json'), JSON.stringify({ name: 'event-package', version: '1.0.0', type: 'module', main: 'index.js' }));
    fs.writeFileSync(path.join(team, 'index.js'), `import React from 'react'; export function TeamButton({children, disabled, type = 'button', onClick}) { return React.createElement('button', {disabled, type, onClick}, children); }`);
    await create({ apply: true, externalSystem: 'events', externalComponent: 'Button', oodsTraits: [], substitution: { component: 'Button', react: { package: 'event-package', version: '1.0.0', localPath: team, export: 'TeamButton', props: { onActivate: { name: 'onClick' } } } } });
    const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.09', screens: [{ id: 'button', component: 'Button', props: { content: 'Save changes' } }] } }, { previewHostUrl: url });
    const report = result.componentContracts!.find(report => report.component === 'Button')!;
    expect(report.checkedAt).toBeDefined();
    for (const id of ['event:activate', 'keyboard:Enter', 'scenario:event:0', 'accessibility:Defaults to type=button']) expect(report.obligations.find(row => row.id === id), id).toMatchObject({ status: 'met' });
  }, 60_000);

  it.each([true, false])('waits for asynchronous tab effects and still refuses a wrong event payload (correct=%s)', async correct => {
    const team = path.join(folder, 'async-tabs'); fs.mkdirSync(team);
    fs.writeFileSync(path.join(team, 'package.json'), JSON.stringify({ name: 'async-tabs', version: '1.0.0', type: 'module', main: 'index.js' }));
    fs.writeFileSync(path.join(team, 'index.js'), `import React from 'react'; export function AsyncTabs({items, defaultSelectedId, ariaLabel, onChange}) {
      const [selected, setSelected] = React.useState(defaultSelectedId);
      return React.createElement('div', {role: 'tablist', 'aria-label': ariaLabel}, items.map(item => React.createElement('button', { key: item.id, role: 'tab', 'data-tab-id': item.id, 'aria-selected': selected === item.id, tabIndex: selected === item.id ? 0 : -1,
        onKeyDown: event => { if (event.key === 'ArrowRight') setTimeout(() => { setSelected('billing'); setTimeout(() => { document.querySelector('[data-tab-id="billing"]').focus(); onChange(${correct ? "'billing'" : "'wrong'"}); }, 30); }, 30); }
      }, item.label)));
    }`);
    await create({ apply: true, externalSystem: 'async', externalComponent: 'Tabs', oodsTraits: [], substitution: { component: 'Tabs', react: { package: 'async-tabs', version: '1.0.0', localPath: team, export: 'AsyncTabs' } } });
    const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.09', screens: [{ id: 'tabs', component: 'Tabs', props: { items: [{ id: 'overview', label: 'Overview', panel: 'Summary' }, { id: 'billing', label: 'Billing', panel: 'Invoices' }] } }] } }, { previewHostUrl: url });
    const report = result.componentContracts!.find(report => report.component === 'Tabs')!;
    expect(report.checkedAt).toBeDefined();
    expect(report.obligations.find(row => row.id === 'keyboard:ArrowRight')).toMatchObject({ status: correct ? 'met' : 'unmet' });
  }, 60_000);

  it('refuses a Tailwind compiler failure with OODS-V217 and its own diagnostic', async () => {
    fs.appendFileSync(path.join(project, 'src/index.css'), '\n@utility broken { @apply this-class-does-not-exist; }\nbody { @apply this-class-does-not-exist; }');
    await expect(open({ object: 'Subscription', context: 'detail', framework: 'react' })).rejects.toMatchObject({ opiCode: 'OODS-V217', message: expect.stringContaining('this-class-does-not-exist') });
  }, 60_000);
});
