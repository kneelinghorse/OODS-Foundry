import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssVariablesByScope } from '@oods/tokens';
import { census, contractFailures, parseVars, resolveValue } from '../../../scripts/product-reality/s192-token-resolution.mjs';

describe('component token-resolution contract (#1884)', () => {
  it('resolves every colour role and every unguarded legacy name in all six scopes', () => {
    const report = census();
    expect(report.rows.map(row => `${row.brand}/${row.theme}`)).toEqual(['A/light', 'A/dark', 'A/hc', 'B/light', 'B/dark', 'B/hc']);
    expect(contractFailures(report, 14)).toEqual([]);
  });

  it('follows only selected fallbacks, including nested functions and cycles', () => {
    expect(parseVars('var(--a, rgb(1, 2, 3)) var(--b)').map(call => call.name)).toEqual(['--a', '--b']);
    expect(resolveValue('var(--a, var(--b, Canvas))', { '--a': '#fff' }).systemFallbacks).toEqual([]);
    expect(resolveValue('var(--a, var(--b, Canvas))', { '--b': '#fff' }).systemFallbacks).toEqual([]);
    expect(resolveValue('var(--a, var(--b, Canvas))', {}).systemFallbacks).toEqual(['Canvas']);
    expect(resolveValue('var(--a)', {}, { '--a': 'var(--b)', '--b': 'var(--a)' }).missing).toEqual(['--a']);
    expect(resolveValue('var(--a, CanvasText)', {}, { '--a': 'var(--a)' }).systemFallbacks).toEqual(['CanvasText']);
    expect(resolveValue('var(--semantic-hc)', { '--semantic-hc': 'Canvas' }).systemFallbacks).toEqual([]);
  });

  it('does not count unreachable nested colours or forced-colors declarations as leaks', () => {
    const sources = [{ file: 'fixture.css', css: '.card { color: var(--missing, var(--defined, CanvasText)); } @media (forced-colors: active) { .card { color: var(--absent, CanvasText); } }' }];
    const report = census({ sources, scopes: { A: { light: { '--defined': '#fff' } } } });
    expect(report.rows[0].counts.reachableSystemColourFallbacks).toBe(0);
  });

  it('deleting both the Card alias and its semantic fallback fails at the affected rule', () => {
    const scopes = structuredClone(cssVariablesByScope);
    for (const themes of Object.values(scopes)) for (const tokens of Object.values(themes)) { delete tokens['--oods-cmp-surface-panel']; delete tokens['--oods-sys-surface-raised']; delete tokens['--sys-surface-raised']; }
    const failures = contractFailures(census({ scopes }), 14);
    expect(failures.some(failure => failure.includes('.oods-card') && failure.includes('--sys-surface-raised'))).toBe(true);
  });

  it('authors component defaults as aliases of semantic tokens', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const roles = JSON.parse(fs.readFileSync(path.join(root, 'packages/tokens/src/tokens/component/roles.json'), 'utf8')).cmp;
    for (const [name, token] of Object.entries(roles) as Array<[string, { $value: string }]>) {
      expect(token.$value, name).toMatch(/^\{sys\.[\w.-]+\}$/);
    }
  });
});
