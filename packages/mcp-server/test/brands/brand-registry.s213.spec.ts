/**
 * s213-m04: the server's brands come from the token build, not from a list in code.
 *
 * The website's blocking message (202e01fa, part a) asked whether a team can use its own brand. Before this mission
 * every tool schema held an ["A", "B"] enum and some fifty server and build sites listed A and B, so a new brand's
 * token files reached no tool. These specs pin what replaced that: a brand is usable when the token build carries it;
 * every brand field is checked against that at call time with an error naming the known brands; a brand the build
 * adds is accepted by compose, generate, render and certify with no schema or code edit; and health compares the
 * brands folder with the build instead of trusting either.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import tokensBundle from '@oods/tokens';
import { resolveTokenToColor } from '@oods/viz-core';
import { assertKnownBrand, brandRegistryReport, DEFAULT_BRAND, isKnownBrand, knownBrands } from '../../src/lib/brand-registry.js';
import { tokenPackageRoot } from '../../src/lib/token-build.js';
import { getAjv } from '../../src/lib/ajv.js';
import { formatSchemaInputError } from '../../src/security/schema-errors.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as vizRender } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { handle as tokensBuild } from '../../src/tools/tokens.build.js';
import { handle as health } from '../../src/tools/health.js';
import { repositoryRoot, wire } from '../helpers/wire-boundary.js';

const SCHEMAS = path.join(repositoryRoot, 'packages/mcp-server/src/schemas');
const scopes = tokensBundle.cssVariablesByScope as Record<string, Record<string, Record<string, string>>>;

/** Brand C as the token build would carry it: its own scoped values, here brand B's with a marked light canvas. */
function holdBrandC(): void {
  scopes.C = JSON.parse(JSON.stringify(scopes.B));
  scopes.C!.light!['--oods-sys-surface-canvas'] = 'oklch(0.98 0.02 150)';
}
afterEach(() => { delete scopes.C; delete process.env.MCP_BRAND_SOURCE_ROOT; });

describe('s213-m04: brands from the token build', () => {
  it('knows the brands the token build carries, in its order, and brand A is the default', () => {
    const built = JSON.parse(fs.readFileSync(path.join(tokenPackageRoot(), 'dist/brands.json'), 'utf8')) as { brands: string[] };
    expect(built.brands).toEqual(['A', 'B']);
    expect(knownBrands()).toEqual(built.brands);
    expect(DEFAULT_BRAND).toBe('A');
    expect(isKnownBrand('B')).toBe(true);
    expect(isKnownBrand('C')).toBe(false);
  });

  it('every brand field in every tool schema is checked against the registry, never an enum', () => {
    const fields: string[] = [];
    const walk = (node: unknown, where: string): void => {
      if (Array.isArray(node)) { node.forEach((child, index) => walk(child, `${where}[${index}]`)); return; }
      if (!node || typeof node !== 'object') return;
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'brand' && child && typeof child === 'object' && !Array.isArray(child)) {
          fields.push(`${where}.brand`);
          expect(child, `${where}.brand`).toMatchObject({ type: 'string', format: 'oods-brand' });
          expect((child as { enum?: unknown }).enum, `${where}.brand`).toBeUndefined();
        }
        walk(child, `${where}.${key}`);
      }
    };
    for (const file of fs.readdirSync(SCHEMAS).filter(name => name.endsWith('.json'))) {
      const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS, file), 'utf8'));
      // The contribution format and the fidelity overlay name a brand as free text by design (their descriptions say so);
      // health reports what is on disk, including a brand built after this server started, so it is not checked. So does the
      // a11y report (s216-m04, #2411): it grades every scope in the built css-variables-by-scope.json, read at call time.
      if (['style-library-contribution.schema.json', 'fidelity.preview.input.json', 'health.output.json', 'a11y.report.json'].includes(file)) continue;
      walk(schema, file);
    }
    // The eighteen that held ["A", "B"]: design.compose, design.preview (input and two in its output), code.generate,
    // viz.render and dashboard.render (input and output), artifact.certify (input and output), tokens.build,
    // brand.apply, repl and repl.render, and the UI schema's three chart declarations.
    // s213-m05 adds two: brand.intake's template starts from an existing brand (from.brand, input and output).
    expect(fields).toHaveLength(20);
  });

  it('an unknown brand is refused at call time, and the answer names the brands there are', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS, 'design.compose.input.json'), 'utf8'));
    const validate = getAjv().compile(schema);
    const input = { object: 'Subscription', context: 'detail', preferences: { brand: 'Z' } };
    expect(validate(input)).toBe(false);
    const error = formatSchemaInputError('design.compose', validate.errors as never, input);
    // Before this mission the enum said "must be one of: A, B" and a brand built later could never be named.
    expect(error.message).toBe('Input validation failed: Unknown brand "Z" at preferences.brand; known brands are A, B.');
    expect(error.expected).toEqual({ 'preferences.brand': 'one of A, B (the brand registry; health lists it)' });
    expect(error.details).toEqual([{ field: 'preferences.brand', keyword: 'brand', message: 'Unknown brand "Z" at preferences.brand; known brands are A, B.' }]);
    expect(() => assertKnownBrand('Z', 'brand')).toThrow('Unknown brand "Z" at brand; known brands are A, B.');
  });

  it('handlers called directly refuse an unknown brand with the same typed error, never a silent fallback to A', async () => {
    await expect(compose({ object: 'Subscription', context: 'detail', preferences: { brand: 'Z' } } as never)).rejects.toMatchObject({ opiCode: 'OODS-V001', message: 'Unknown brand "Z" at preferences.brand; known brands are A, B.' });
    await expect(tokensBuild({ brand: 'Z', theme: 'dark' })).rejects.toMatchObject({ opiCode: 'OODS-V001', details: { brand: 'Z', knownBrands: ['A', 'B'] } });
    const refused = await certify({ brand: 'Z', spec: {} } as never);
    expect(refused).toMatchObject({ status: 'error', errors: [{ code: 'OODS-V126', message: 'Certification supports themes light/dark/hc and the brands in the brand registry (A, B).' }] });
    expect(() => resolveTokenToColor('--oods-sys-surface-canvas', { brand: 'Z', theme: 'light' })).toThrow('Unknown brand "Z"; the token build has A, B.');
  });

  it('a brand the token build adds is accepted by compose, generate, render and certify with no schema or code edit', async () => {
    expect(() => wire('design.compose', 'input', { object: 'Subscription', context: 'detail', preferences: { brand: 'C' } })).toThrow();
    holdBrandC();
    expect(knownBrands()).toEqual(['A', 'B', 'C']);

    const composed = await compose(wire('design.compose', 'input', { object: 'Subscription', context: 'detail', preferences: { brand: 'C', theme: 'dark' }, options: { transient: true } }) as never);
    expect(composed.status).toBe('ok');
    const generated = await generate(wire('code.generate', 'input', { schema: composed.schema, framework: 'react', options: { brand: 'C', theme: 'dark' } }) as never);
    expect(generated.status).toBe('ok');

    const rendered = await vizRender(wire('viz.render', 'input', { chartType: 'bar', brand: 'C', theme: 'dark', rows: [{ region: 'North', revenue: 10 }, { region: 'South', revenue: 20 }], encodings: { x: 'region', y: 'revenue' }, output: { svg: true, includeNormalizedSpec: true } }) as never);
    expect(rendered.render).toMatchObject({ brand: 'C', theme: 'dark' });
    const certified = await certify(wire('artifact.certify', 'input', { brand: 'C', theme: 'dark', spec: rendered.normalizedSpec }) as never);
    expect(certified.status).toBe('ok');
    expect(certified.pillars?.contrast).toBe('pass');

    // Charts read brand C's own values, not another brand's.
    expect(resolveTokenToColor('--oods-sys-surface-canvas', { brand: 'C', theme: 'light' })).not.toBe(resolveTokenToColor('--oods-sys-surface-canvas', { brand: 'B', theme: 'light' }));
    delete scopes.C;
    expect(isKnownBrand('C')).toBe(false);
  });

  it('health lists the registry and compares the brands folder with the build, reporting every mismatch', async () => {
    const shipped = await health({});
    expect(shipped.tokens.registry).toMatchObject({ brands: ['A', 'B'], default: 'A', issues: [] });
    expect(shipped.tokens.registry!.folder).toBe(path.join(tokenPackageRoot(), 'src/tokens/brands'));

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 's213-brand-health-'));
    try {
      fs.cpSync(path.join(tokenPackageRoot(), 'src/tokens/brands'), path.join(root, 'src/tokens/brands'), { recursive: true });
      fs.mkdirSync(path.join(root, 'dist/css'), { recursive: true });
      const built = JSON.parse(fs.readFileSync(path.join(tokenPackageRoot(), 'dist/brands.json'), 'utf8'));
      fs.writeFileSync(path.join(root, 'dist/brands.json'), JSON.stringify({ brands: [...built.brands, 'E'], sources: { ...built.sources, E: built.sources.B } }));
      fs.writeFileSync(path.join(root, 'dist/css-variables-by-scope.json'), fs.readFileSync(path.join(tokenPackageRoot(), 'dist/css-variables-by-scope.json')));
      fs.cpSync(path.join(root, 'src/tokens/brands/B'), path.join(root, 'src/tokens/brands/D'), { recursive: true });
      fs.appendFileSync(path.join(root, 'src/tokens/brands/A/base.json'), '\n');
      process.env.MCP_BRAND_SOURCE_ROOT = root;

      const report = brandRegistryReport();
      expect(report.brands).toEqual(['A', 'B']);
      expect(report.issues.map(issue => `${issue.kind} ${issue.brand}`).sort()).toEqual([
        'built-after-start E', 'changed-since-build A', 'no-source-folder E', 'not-built D',
      ]);
      const degraded = await health({});
      expect(degraded.status).toBe('degraded');
      expect(degraded.warnings).toEqual(expect.arrayContaining([
        'brand registry: Brand D has a folder but is not in the token build; run the token build, which names anything wrong with the folder.',
        "brand registry: Brand A's base.json changed after the token build; run the token build.",
        'brand registry: Brand E was built after this server started; restart the server to use it.',
      ]));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
