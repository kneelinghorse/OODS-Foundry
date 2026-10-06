import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packageShadcnApplication } from '../../src/codegen/shadcn-application.js';
import { buildGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import type { CodegenResult } from '../../src/codegen/types.js';
import type { EmittedSubstitution, RecordedSubstitution } from '../../src/codegen/component-substitutions.js';

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('a portable shadcn app uses the Tailwind integration the team actually installed', () => {
  it.each(['@tailwindcss/vite', '@tailwindcss/postcss'])('%s works without inventing a second integration dependency', integration => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 's230-tailwind-app-')); scratch.push(project);
    fs.writeFileSync(path.join(project, 'theme.css'), '@import "tailwindcss";');
    fs.writeFileSync(path.join(project, 'Card.tsx'), 'export const Card = () => null;');
    const source = { project, module: '@/Card', file: 'Card.tsx', css: 'theme.css', files: ['theme.css', 'Card.tsx'], hashFiles: ['theme.css', 'Card.tsx'], paths: { '@/*': ['*'] }, dependencies: { tailwindcss: '4.3.3', [integration]: '4.3.3' }, imports: ['tailwindcss'], closureHash: `sha256:${'a'.repeat(64)}`, base: 'base' as const, style: 'base-nova' };
    const substitutions: EmittedSubstitution[] = [{ mappingId: 'team-card', component: 'Card', source: { export: 'Card', shadcn: source } }];
    const mappings = [{ mappingId: 'team-card', substitution: { component: 'Card', react: { export: 'Card', shadcn: { project, module: '@/Card' } } } }] as RecordedSubstitution[];
    const result = { framework: 'react', code: '', fileExtension: '.tsx', imports: [], files: [
      { path: 'src/GeneratedUI.tsx', contents: "export { Card as GeneratedUI } from '@/Card';" },
      { path: 'src/main.tsx', contents: '' },
      { path: 'package.json', contents: JSON.stringify({ dependencies: {} }) },
      { path: 'vite.config.mjs', contents: '' },
      { path: 'tsconfig.json', contents: JSON.stringify({ compilerOptions: {} }) },
    ] } as CodegenResult;
    packageShadcnApplication(result, substitutions, mappings);
    const config = result.files!.find(file => file.path === 'vite.config.mjs')!.contents;
    const manifest = JSON.parse(result.files!.find(file => file.path === 'package.json')!.contents);
    const other = integration === '@tailwindcss/vite' ? '@tailwindcss/postcss' : '@tailwindcss/vite';
    expect(config).toContain(`from '${integration}'`);
    expect(config).toContain(integration === '@tailwindcss/vite' ? 'plugins: [tailwindcss()], resolve:' : 'css: { postcss: { plugins: [tailwindcss()] } }');
    expect(config).not.toContain(other);
    expect(manifest.dependencies).toEqual({ tailwindcss: '4.3.3', [integration]: '4.3.3' });
    expect(result.imports).toContain(integration);
    expect(result.imports).not.toContain(other);
    const artifact = buildGeneratedArtifact({ framework: 'react', files: result.files!, imports: result.imports, substitutions });
    expect(artifact.dependencies).toContainEqual(expect.objectContaining({ name: integration, version: '4.3.3' }));
    expect(artifact.dependencies.some(dependency => dependency.name === other)).toBe(false);
  });
});
