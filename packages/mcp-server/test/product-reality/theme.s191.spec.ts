import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { resolveTokenToColor } from '@oods/viz-core';
import { toHex } from '../../../viz-core/src/tokens/categorical-palette.js';
import { typecheckWorkflow } from './workflow-typecheck.js';
import { themeChartPath } from '../../src/codegen/chart-assets.js';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/code.generate.input.json' assert { type: 'json' };

describe('generated applications own their token scope (s191)', () => {
  it.each(['react', 'vue'] as const)('%s shell, mount, styles and embedded chart share dark/B', async framework => {
    const composition = await compose({ object: 'Subscription', context: 'workflow' });
    const input = { schema: composition.schema, framework, profile: 'build' as const, options: { theme: 'dark' as const, brand: 'B' as const } };
    expect(getAjv().compile(inputSchema)(input)).toBe(true);
    const first = await generate(input), second = await generate(input);
    expect(first.status, JSON.stringify(first.errors)).toBe('ok');
    expect(first.artifact).toEqual(second.artifact);
    const files = Object.fromEntries(first.artifact!.files.map(file => [file.path, file.contents]));
    expect(files['index.html']).toMatch(/<html[^>]*data-theme="dark" data-brand="B"/);
    expect(files['index.html']).toMatch(/<body[^>]*data-theme="dark" data-brand="B"/);
    const main = files[framework === 'react' ? 'src/main.tsx' : 'src/main.ts'];
    expect(main).toContain('[document.documentElement, document.body]');
    // s206-m01: the generated scope is the default; a host that mounted the app in a scope keeps it.
    expect(main).toContain('host.theme ?? "dark"');
    expect(main).toContain('host.brand ?? "B"');
    expect(files['src/app.css']).toContain(':root[data-theme="dark"] { color-scheme: dark; }');
    expect(files['src/app.css']).not.toMatch(/#[0-9a-f]{3,8}\b|:\s*white\b/);
    const canvas = toHex(resolveTokenToColor('--sys-surface-canvas', input.options)!);
    // #2411 metadata precedes the canvas. s222-m02 (F7): the dark render is the one at the dark theme's path.
    expect(files[themeChartPath('src/charts/payment-001.svg', 'dark')]).toMatch(new RegExp(`^<svg[^>]*>(?:<title>[^<]*</title><desc>[^<]*</desc>)?\\s*<rect[^>]*fill="${canvas}"`));
    const compilation = typecheckWorkflow(first.artifact!);
    expect(compilation.status, compilation.stdout + compilation.stderr).toBe(0);
    const implicit = await generate({ schema: composition.schema, framework });
    const explicit = await generate({ schema: composition.schema, framework, options: { theme: 'light', brand: 'A' } });
    expect(implicit.artifact).toEqual(explicit.artifact);
  }, 60_000);
  it('HTML preserves unscoped compatibility and propagates an explicit application scope', async () => {
    const composition = { schema: { version: '1.0', screens: [{ id: 'screen', component: 'Text', props: { text: 'Theme proof' } }] } };
    const legacy = await generate({ schema: composition.schema, framework: 'html' });
    expect(legacy.code).toContain('data-brand="default"');
    const light = await generate({ schema: composition.schema, framework: 'html', options: { theme: 'light' } });
    expect(light.code).toContain('data-brand="A"');
    expect(light.code).not.toContain('data-brand="default"');
    const dark = await generate({ schema: composition.schema, framework: 'html', options: { theme: 'dark', brand: 'B' } });
    expect(dark.code).toContain('data-theme="dark" data-brand="B"');
  });
});
