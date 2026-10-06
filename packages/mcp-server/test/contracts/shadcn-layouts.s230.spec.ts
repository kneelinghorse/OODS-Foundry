import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectShadcn } from '../../src/tools/map.shadcn.js';
import { handle as create } from '../../src/tools/map.create.js';
import { substituteGeneratedComponents } from '../../src/codegen/component-substitutions.js';
import type { CodegenResult } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const root = path.resolve(import.meta.dirname, '../../../..');
let directory: string, project: string;
const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const pkg = (modules: string, name: string, version: string, hidden = false) => {
  const folder = path.join(modules, name);
  write(path.join(folder, 'package.json'), JSON.stringify({ name, version, main: 'index.js', ...(hidden ? { exports: { '.': './index.js' } } : {}) }));
  write(path.join(folder, 'index.js'), 'module.exports = {};');
};
const source = () => ({ project, module: '@/components/ui/button' });
const schema = () => ({ version: '1.0.0', screens: [{ id: 'screen', component: 'Button' }] }) as UiSchema;
const generated = (): CodegenResult => ({ framework: 'react', status: 'ok', code: "import React from 'react';\nimport { Button } from '@oods/components-react';\nexport function GeneratedUI() { return <Button />; }", fileExtension: '.tsx', imports: ['react', '@oods/components-react'], warnings: [] });
const mapping = (react: object = { shadcn: source(), export: 'Button' }) => ({ apply: true, externalSystem: 'layout', externalComponent: 'Button', oodsTraits: [], substitution: { component: 'Button', react } });
beforeEach(() => {
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  directory = fs.mkdtempSync(path.join(root, '.tmp/s230-layout-test-'));
  project = path.join(directory, 'apps/web');
  write(path.join(project, 'components.json'), JSON.stringify({ style: 'base-nova', tsx: true, rsc: true, aliases: { ui: '@/components/ui' }, tailwind: { css: 'app/globals.css' } }));
  write(path.join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }));
  write(path.join(project, 'app/globals.css'), '@import "tailwindcss";');
  write(path.join(project, 'components/ui/button.tsx'), 'import { value } from "team-part";\nexport const Button = () => <button>{value}</button>;');
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(directory, 'mappings.json'));
});
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(directory, { force: true, recursive: true }); });
function install(layout: string) {
  const modules = path.join(layout === 'hoisted' ? directory : project, 'node_modules');
  for (const [name, version] of [['tailwindcss', '4.2.0'], ['@tailwindcss/postcss', '4.2.0'], ['team-part', '2.3.4']]) {
    if (layout === 'isolated') {
      const store = path.join(directory, '.pnpm', `${name.replace('/', '+')}@${version}`, 'node_modules');
      pkg(store, name!, version!, name === 'team-part');
      fs.mkdirSync(path.dirname(path.join(modules, name!)), { recursive: true });
      fs.symlinkSync(path.join(store, name!), path.join(modules, name!), 'dir');
    } else pkg(modules, name!, version!, name === 'team-part');
  }
  return modules;
}
describe('shadcn uses the importing file’s installed dependency graph', () => {
  it.each(['flat', 'hoisted', 'isolated'])('accepts %s PostCSS and freezes actual dependency versions', async layout => {
    install(layout);
    const closure = inspectShadcn(source(), 'Button');
    expect(closure.dependencies).toEqual({ tailwindcss: '4.2.0', '@tailwindcss/postcss': '4.2.0', 'team-part': '2.3.4' });
    expect((await create(mapping())).status).toBe('ok');
    // A nearer dependency belongs to the importing source, even when the workspace has another version.
    pkg(path.join(project, 'components/node_modules'), 'team-part', '3.4.5', true);
    const changed = inspectShadcn(source(), 'Button');
    expect(changed.dependencies['team-part']).toBe('3.4.5');
    expect(changed.closureHash).not.toBe(closure.closureHash);
  });
  it.each(['flat', 'hoisted'])('names Tailwind 3 and missing imports with source line in %s layout', async layout => {
    const modules = install(layout);
    pkg(modules, 'tailwindcss', '3.4.17');
    await expect(create(mapping())).rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringContaining('app/globals.css:1: Tailwind 4 is required; found 3.4.17') });
    pkg(modules, 'tailwindcss', '4.2.0');
    write(path.join(project, 'components/ui/button.tsx'), '\nimport { missing } from "s230-absent-closure-package";\nexport const Button = () => <button>{missing}</button>;');
    await expect(create(mapping())).rejects.toMatchObject({ opiCode: 'OODS-V219', message: expect.stringContaining("button.tsx:2: cannot resolve dependency 's230-absent-closure-package'") });
  });
  it('puts the client boundary first only when a React module uses a shadcn mapping', async () => {
    install('flat');
    const original = generated();substituteGeneratedComponents(original, schema(), true);
    expect(original.code).not.toContain('use client');
    await create(mapping({ package: 'team-components', version: '1.2.3', export: 'Button' }));
    const ordinary = generated();substituteGeneratedComponents(ordinary, schema(), true);
    expect(ordinary.code).not.toContain('use client');
    fs.rmSync(path.join(directory, 'mappings.json'));
    await create(mapping());
    const mapped = generated();mapped.files = [{ path: 'GeneratedUI.tsx', contents: mapped.code }];
    substituteGeneratedComponents(mapped, schema(), true);
    expect(mapped.code).toMatch(/^'use client';\n/);
    expect(mapped.files[0].contents).toMatch(/^'use client';\n/);
  });
});
