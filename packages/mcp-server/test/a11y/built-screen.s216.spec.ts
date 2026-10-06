import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle as scan } from '../../src/tools/a11y.scan.js';
import { handle as validate } from '../../src/tools/repl.validate.js';
import * as tokens from '../../src/lib/token-build.js';
import * as document from '../../src/render/document.js';
import * as composer from '../../src/tools/design.compose.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { createSchemaRef } from '../../src/tools/schema-ref.js';
import { getAjv } from '../../src/lib/ajv.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const schema: UiSchema = { version: '2026.02', screens: [{ id: 'screen', component: 'Stack', children: [
  { id: 'heading', component: 'Text', props: { as: 'h1', text: 'Account' } },
  { id: 'subheading', component: 'Text', props: { as: 'h3', text: 'Contact details' } },
  { id: 'input', component: 'Input', props: { label: 'Email', 'aria-describedby': 'missing-description' } },
] }] };
afterEach(() => vi.restoreAllMocks());
describe('accessibility grades built scopes and the rendered screen', () => {
  it('visits every built brand/theme, including team scopes, and never reads the legacy token snapshot', async () => {
    const scopes = structuredClone(tokens.readTokenScopes());
    (scopes as any).Team = structuredClone(scopes.A);
    vi.spyOn(tokens, 'readTokenScopes').mockReturnValue(scopes);
    const read = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: any, ...args: any[]) => {
      if (String(file).includes('/structured-data/oods-tokens')) throw new Error('legacy snapshot must not be read');
      return (read as any)(file, ...args);
    }) as any);
    const result = await scan({});
    const report = result.structuredData as any;
    expect(report?.scopes.map((scope: any) => `${scope.brand}/${scope.theme}`).sort()).toEqual(Object.entries(scopes).flatMap(([brand, themes]) => Object.keys(themes).map(theme => `${brand}/${theme}`)).sort());
    expect(report.tokenSource).toContain('css-variables-by-scope.json');
    expect(report.rules.length).toBeGreaterThan(18);
    expect(report.notChecked).toContain('Browser-computed colour and layout');
  });

  it('new stylesheet pairs are graded from current built values, not a fixed rule table', async () => {
    const scopes = structuredClone(tokens.readTokenScopes());
    scopes.B.dark['--oods-sys-text-primary'] = '#ffffff';
    scopes.B.dark['--oods-sys-surface-canvas'] = '#ffffff';
    vi.spyOn(tokens, 'readTokenScopes').mockReturnValue(scopes);
    const read = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file: any, ...args: any[]) => {
      const bytes = (read as any)(file, ...args);
      return String(file).endsWith('/component-styles/dist/components.css')
        ? String(bytes) + '\n[data-oods-component="Text"].s216-proof { color:var(--sys-text-primary); background:var(--sys-surface-canvas); }\n'
        : bytes;
    }) as any);
    const report = (await scan({})).structuredData as any;
    expect(report?.rules).toContainEqual(expect.objectContaining({ brand: 'B', theme: 'dark', selector: '[data-oods-component="Text"].s216-proof', status: 'fail', ratio: 1 }));
    expect(report?.rules.some((rule: any) => rule.theme === 'hc' && rule.status === 'unmeasured')).toBe(true);
  });

  it('checks heading order and real ARIA targets in shared-renderer HTML', async () => {
    const report = (await scan({ schema })).structuredData as any;
    expect(report?.screen).toMatchObject({ renderer: 'repl.render/document', htmlSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(report?.screen.findings).toContainEqual(expect.objectContaining({ code: 'A11Y_HEADING_ORDER' }));
    expect(report?.screen.findings).toContainEqual(expect.objectContaining({ code: 'A11Y_ARIA_REFERENCE' }));
    expect(report.components).toEqual(expect.arrayContaining(['Stack', 'Text', 'Input']));
  });

  it('screen scans grade present components and global pairs without reporting unrelated controls', async () => {
    vi.spyOn(document, 'readComponentCssForDocument').mockReturnValue(`body { color:#111; background:#fff; }
      [data-oods-component='Text'] { color:#111; background:#fff; }
      [data-oods-component='Button'] { color:#fff; background:#fff; }`);
    const scoped = (await scan({ schema })).structuredData as any;
    expect([...new Set(scoped.rules.map((rule: any) => rule.selector))]).toEqual(['body', "[data-oods-component='Text']"]);
    expect(scoped.rules.every((rule: any) => rule.status === 'pass')).toBe(true);
    const all = (await scan({})).structuredData as any;
    expect(all.rules).toContainEqual(expect.objectContaining({ selector: "[data-oods-component='Button']", status: 'fail' }));
  });

  it('the opt-in validation path used by pipeline returns the same screen findings', async () => {
    const result = await validate({ schema, options: { checkA11y: true } });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'A11Y_HEADING_ORDER' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'A11Y_ARIA_REFERENCE' }));
  });

  it('a renderer failure is reported instead of claiming the screen was checked', async () => {
    vi.spyOn(document, 'renderDocument').mockImplementation(() => { throw new Error('render fault'); });
    await expect(scan({ schema })).rejects.toThrow(/render fault/);
  });
  it('pipeline checks the composed HTML even when its render response is skipped', async () => {
    vi.spyOn(composer, 'handle').mockResolvedValue({ status: 'ok', schema, schemaRef: createSchemaRef(schema).ref, layout: 'stack' } as any);
    const result = await pipeline({ intent: 'Account', framework: 'html', options: { checkA11y: true, skipRender: true } });
    expect(result.error).toBeUndefined();
    expect(result.validation?.warnings).toContainEqual(expect.objectContaining({ code: 'A11Y_ARIA_REFERENCE' }));
    expect(result.validation?.warnings).toContainEqual(expect.objectContaining({ code: 'A11Y_HEADING_ORDER' }));
  });

  it('nested component fallback variables resolve and active controls are not disabled exemptions', async () => {
    vi.spyOn(document, 'readComponentCssForDocument').mockReturnValue(`[data-oods-component='Button'] { color:var(--missing, var(--missing2, var(--sys-text-primary))); background:var(--sys-surface-canvas); }
      [data-oods-component='Button']:not(:disabled) { color:var(--sys-text-primary); }
      [data-oods-component='Button']:disabled { color:var(--sys-text-primary); }`);
    const report = (await scan({})).structuredData as any;
    const active = report.rules.filter((rule: any) => rule.theme === 'light' && !rule.selector.endsWith(':disabled'));
    expect(active.length).toBeGreaterThan(0);
    expect(active, JSON.stringify(active)).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'pass' })]));
    expect(active.every((rule: any) => rule.status === 'pass' && rule.ratio >= 4.5), JSON.stringify(active)).toBe(true);
    expect(report.rules.filter((rule: any) => rule.selector.endsWith(':disabled')).every((rule: any) => rule.status === 'not-applicable')).toBe(true);
  });

  it('missing built scopes fail visibly in both scan and opt-in validation', async () => {
    vi.spyOn(tokens, 'readTokenScopes').mockImplementation(() => { throw new Error('missing built scopes'); });
    await expect(scan({})).rejects.toMatchObject({ opiCode: 'OODS-N011' });
    const result = await validate({ schema, options: { checkA11y: true } });
    expect(result.status).toBe('invalid');
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'OODS-N011' }));
  });

  it('a screen preview conforms to the report schema and makes no file writes', async () => {
    const write = vi.spyOn(fs, 'writeFileSync');
    const mkdir = vi.spyOn(fs, 'mkdirSync');
    const result = await scan({ schema, apply: false });
    const check = getAjv().compile(JSON.parse(fs.readFileSync(new URL('../../src/schemas/a11y.report.json', import.meta.url), 'utf8')));
    expect(check(result.structuredData), JSON.stringify(check.errors)).toBe(true);
    expect(result.artifacts).toEqual([]);
    expect(result.transcriptPath).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('does not fabricate a parent or child colour pair from a descendant selector', async () => {
    vi.spyOn(document, 'readComponentCssForDocument').mockReturnValue(`[data-oods-component='Stack'] { color:#111; }
      [data-oods-component='Stack'] button { color:#fff; background:#111; }
      [data-oods-component='Stack'] progress { color:#111; background:#fff; }
      [data-oods-component='Stack'] progress::-webkit-progress-value { background:#111; }`);
    const report = (await scan({})).structuredData as any;
    expect(report.rules.some((rule: any) => rule.status === 'fail')).toBe(false);
    expect(report.rules.filter((rule: any) => rule.selector === "[data-oods-component='Stack']").every((rule: any) => rule.status === 'unmeasured')).toBe(true);
    expect(report.rules.some((rule: any) => rule.selector.includes('::-webkit-progress-value'))).toBe(false);
  });

});
