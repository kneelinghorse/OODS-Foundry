import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installedShadcnFixture } from '../helpers/shadcn-fixture.js';
import { inspectShadcn } from '../../src/tools/map.shadcn.js';
import { draftComponents } from '../../src/intake/components.js';
import { packageShadcnApplication } from '../../src/codegen/shadcn-application.js';
import { handle as map } from '../../src/tools/map.js';
import { inspectComponentPackages } from '../../../mcp-bridge/src/preview/component-packages.js';
import { compileArtifact } from '../../../mcp-bridge/src/preview/compile.js';
import { buildGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { getAjv } from '../../src/lib/ajv.js';
import generateOutput from '../../src/schemas/code.generate.output.json' with { type: 'json' };
import { handle as generate } from '../../src/tools/code.generate.js';

const root = path.resolve(import.meta.dirname, '../../../..');
let project: string;
const write = (file: string, contents: string) => { const target = path.join(project, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, contents); };
beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 's237-vue-'));
  const installed = installedShadcnFixture(root);
  // The React CLI fixture owns CSS tooling, but Vue must be explicit: an ancestor
  // checkout must never make this Vue fixture pass with undeclared dependencies.
  for (const [name, owner] of [
    ['vue', path.join(root, 'packages/components-vue')], ['@vue/server-renderer', path.join(root, 'packages/components-vue')],
    ['tailwindcss', installed], ['@tailwindcss/vite', installed], ['typescript', installed],
  ]) {
    const target = path.join(project, 'node_modules', name!);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(owner!, 'node_modules', name!)), target, 'dir');
  }
  write('package.json', JSON.stringify({ name: 'test-vue', version: '1.0.0' }));
  write('components.json', JSON.stringify({ $schema: 'https://shadcn-vue.com/schema.json', style: 'reka-nova', typescript: true, tailwind: { css: 'theme.css' }, aliases: { components: '@/components', ui: '@/components/ui' } }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] }, skipLibCheck: true } }));
  write('theme.css', '@import "tailwindcss";');
  write('src/components/ui/button/Button.vue', '<script setup lang="ts">defineProps<{ disabled?: boolean; type?: "button" | "submit" }>();</script><template><button :disabled="disabled" :type="type" class="p-2"><slot /></button></template>');
  write('src/components/ui/button/index.ts', 'export { default as Button } from "./Button.vue";');
  vi.stubEnv('OODS_FOUNDRY_HOME', path.join(project, 'home'));
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(project, 'mappings.json'));
});
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(project, { recursive: true, force: true }); });

describe('Vue source is inspected as Vue and packaged without losing its compiler or events', () => {
  it('detects Reka, follows SFC barrel exports, and hashes template changes', () => {
    const source = { project, module: '@/components/ui/button' };
    const first = inspectShadcn(source, 'Button', 'vue');
    expect(first).toMatchObject({ skipLibCheck: true, framework: 'vue', base: 'reka', style: 'reka-nova' });
    expect(first.files).toContain('src/components/ui/button/Button.vue');
    expect(first.dependencies['@vue/server-renderer']).toBe(first.dependencies.vue);
    write('src/unrelated.vue', '<template>Unrelated</template>');
    expect(inspectShadcn(source, 'Button', 'vue').closureHash).toBe(first.closureHash);
    fs.appendFileSync(path.join(project, 'src/components/ui/button/Button.vue'), '\n<!-- template changed -->');
    expect(inspectShadcn(source, 'Button', 'vue').closureHash).not.toBe(first.closureHash);
    expect(() => inspectShadcn(source, 'Button', 'react')).toThrow(/expected react.*found vue/);
    expect(() => inspectShadcn(source, 'Absent', 'vue')).toThrow(/does not statically export/);
  });
  it.each([true, false])('reads referenced compiler settings even when the root owns aliases (skipLibCheck=%s)', skipLibCheck => {
    write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } }, references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] }));
    write('tsconfig.app.json', JSON.stringify({ compilerOptions: { skipLibCheck } }));
    write('tsconfig.node.json', JSON.stringify({ compilerOptions: { skipLibCheck: true } }));
    const source = inspectShadcn({ project, module: '@/components/ui/button' }, 'Button', 'vue');
    expect(source.skipLibCheck === true).toBe(skipLibCheck);
    expect(source.hashFiles).toContain('tsconfig.app.json');
    expect(source.paths).toEqual({ '@/*': ['src/*'] });
  });
  it('drafts a reviewed Vue adapter from typed structure and refuses framework masquerading', () => {
    const draft = draftComponents({ project, format: 'shadcn' });
    const button = draft.proposals.find(proposal => proposal.mapping.substitution?.component === 'Button')!;
    expect(button.mapping.substitution?.vue).toMatchObject({ export: 'default', shadcn: { module: '@/components/oods/button.vue' } });
    expect(button.files[0].contents).toContain("emit('activate', event)");
    expect(fs.existsSync(path.join(project, button.files[0].path))).toBe(false);
    const config = JSON.parse(fs.readFileSync(path.join(project, 'components.json'), 'utf8')); config.style = 'base-nova'; write('components.json', JSON.stringify(config));
    expect(() => inspectShadcn({ project, module: '@/components/ui/button' }, 'Button', 'vue')).toThrow(/unsupported shadcn style/);
  });
  it.each(['<style scoped>.x { color: red }</style>', '<script src="./external.ts"></script>', '<template src="./external.html" />'])('refuses unsupported SFC external/style blocks before acceptance: %s', block => {
    write('src/components/ui/Unsafe.vue', block);
    expect(() => inspectShadcn({ project, module: '@/components/ui/Unsafe.vue' }, 'default', 'vue')).toThrow(/styles in tailwind.css|inline|parse|<template> or <script>/i);
  });
  it('does not execute setup code when drafting or applying', async () => {
    const marker = path.join(project, 'executed');
    write('src/components/ui/button/Button.vue', `<script setup lang="ts">defineProps<{disabled?:boolean; type?:string}>(); throw new Error(${JSON.stringify(marker)});</script><template><button :disabled="disabled" :type="type"><slot /></button></template>`);
    const draft: any = await map({ action: 'draft', source: { project, format: 'shadcn' } });
    expect(draft.proposals.some((entry: any) => entry.component === 'Button')).toBe(true);
    // Direct mapping acceptance inspects the SFC; its throwing setup is never evaluated.
    const accepted = await map({ action: 'create', apply: true, externalSystem: 'test', externalComponent: 'Button', oodsTraits: [], substitution: { component: 'Button', vue: { shadcn: { project, module: '@/components/ui/button' }, export: 'Button' } } });
    expect(accepted.status).toBe('ok'); expect(fs.existsSync(marker)).toBe(false);
  });
  it('keeps routed Vue applications, source bytes, aliases and entry stylesheet imports', () => {
    const framework = 'vue';
    const ext = 'vue', main = 'ts';
    const closure = inspectShadcn({ project, module: '@/components/ui/button' }, 'Button', 'vue');
    const result: any = { framework, imports: [], files: [
      { path: `src/ListPage.${ext}`, contents: 'routed-screen' }, { path: `src/main.${main}`, contents: '' },
      { path: 'vite.config.mjs', contents: '' }, { path: 'tsconfig.json', contents: '{"compilerOptions":{}}' }, { path: 'package.json', contents: '{"dependencies":{}}' },
    ] };
    packageShadcnApplication(result, [{ mappingId: 'test-button', component: 'Button', source: { export: 'Button', shadcn: closure } }], [{ mappingId: 'test-button', substitution: { component: 'Button', [framework]: { export: 'Button', shadcn: { project, module: '@/components/ui/button' } } } }] as any);
    expect(result.files.find((file: any) => file.path === 'src/components/ui/button/Button.vue').encoding).toBeUndefined();
    expect(result.files.find((file: any) => file.path === `src/main.${main}`).contents).toContain('../theme.css');
    expect(() => packageShadcnApplication({ ...result, framework: 'react' }, [{ mappingId: 'test-button', component: 'Button', source: { export: 'Button', shadcn: closure } }], [])).toThrow(/framework/);
    expect(JSON.parse(result.files.find((file: any) => file.path === 'tsconfig.json').contents).compilerOptions.skipLibCheck).toBe(true);
    const config = result.files.find((file: any) => file.path === 'vite.config.mjs').contents;
    expect(config.includes("from '@vitejs/plugin-vue'")).toBe(framework === 'vue');
    expect(result.files.some((file: any) => file.path === `src/ListPage.${ext}`)).toBe(true);
  });
  it('lets generated source compiler metadata cross the MCP output boundary without weakening the closed contract', async () => {
    const accepted = await map({ action: 'create', apply: true, externalSystem: 'test', externalComponent: 'Button', oodsTraits: [], substitution: { component: 'Button', vue: { shadcn: { project, module: '@/components/ui/button' }, export: 'Button' } } });
    expect(accepted.status).toBe('ok');
    const result = await generate({ framework: 'vue', profile: 'build', schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { label: 'Save' } }] } });
    expect(result.status).toBe('ok');
    const source = result.artifact!.substitutions![0]!.source.shadcn!;
    expect(source.skipLibCheck).toBe(true);
    const validate = getAjv().compile(generateOutput);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    source.skipLibCheck = false;
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    delete source.skipLibCheck;
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    Object.assign(source, { skipLibCheck: 'true' });
    expect(validate(result)).toBe(false);
    delete source.skipLibCheck;
    Object.assign(source, { undocumentedCompilerOption: true });
    expect(validate(result)).toBe(false);
  });
  it.each([false, true])('compiles a checked SFC preview (template-only=%s) and rejects a closure claimed by the wrong framework', async templateOnly => {
    if (templateOnly) write('src/components/ui/button/Button.vue', '<template><button class="p-2"><slot /></button></template>');
    const source = inspectShadcn({ project, module: '@/components/ui/button' }, 'Button', 'vue');
    const request = { framework: 'vue' as const, specifier: source.module, version: source.closureHash, shadcn: source };
    const packages = inspectComponentPackages([request]);
    expect(() => inspectComponentPackages([{ ...request, framework: 'react' }])).toThrow(/framework/);
    const artifact = buildGeneratedArtifact({ framework: 'vue', code: `<script setup lang="ts">import {Button} from '@/components/ui/button';</script><template><Button>Save</Button></template>`, fileExtension: '.vue', imports: [source.module], substitutions: [{ mappingId: 'test-button', component: 'Button', source: { export: 'Button', shadcn: source }, packageContentHash: source.closureHash }] as any });
    const compiled = await compileArtifact(artifact as any, { componentPackages: packages });
    expect(compiled.code).toContain('Save'); expect(compiled.code).toContain('.p-2');
  }, 60_000);
});
