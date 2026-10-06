// Scope census only: compile public chart operands without requesting any SVG.
// Renderer-created/interpolated pixels remain the explicit Sprint 199 boundary.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import Color from 'colorjs.io';
import { handle as render } from '../../packages/mcp-server/src/tools/viz.render.js';
import { SALES, CASES } from '../../packages/mcp-server/src/tools/__fixtures__/cartesian-render.js';
import { ECHARTS_OPERAND_CASES, renderInputFor } from '../../packages/mcp-server/test/tools/s172-echarts-operands.js';
import type { VizRenderInput } from '../../packages/mcp-server/src/schemas/generated.js';

const root = path.resolve(import.meta.dirname, '../..');
const bundle = createRequire(import.meta.url)(path.join(root, 'packages/tokens/dist/index.cjs'));
const canonical = (value: string): string | undefined => {
  if (/^(Canvas|CanvasText|Highlight|HighlightText|GrayText|LinkText|ButtonText|ButtonFace)$/i.test(value)) return value.toLowerCase();
  try { return new Color(value).to('srgb').toString({ format: 'hex', collapse: false }).toLowerCase(); } catch { return undefined; }
};
const embeddedColors = (value: string): string[] => value.match(/(?:rgba?|hsla?|oklch)\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) ?? [];
export function undeclaredHcPaints(roles: Array<{ role: string; value: string }>, declared: readonly string[]) {
  const allowed = new Set(declared.flatMap(value => [value, ...embeddedColors(value)]).map(canonical).filter(Boolean));
  return roles.filter(row => !canonical(row.value) || !allowed.has(canonical(row.value)));
}
function colors(node: unknown, trail = '', found: Array<{ role: string; value: string }> = []) {
  if (Array.isArray(node)) node.forEach((value, i) => colors(value, `${trail}/${i}`, found));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([key, value]) => colors(value, `${trail}/${key}`, found));
  else if (typeof node === 'string' && !['none', 'transparent', 'source', 'target', 'inherit', 'gradient'].includes(node)
    && (canonical(node) || /\/(?:background|color|[^/]*Color|fill|stroke)(?:\/\d+)?$/.test(trail))) found.push({ role: trail, value: node });
  return found;
}
async function main() {
  const inputs = [...CASES.map(({ chartType, encodings }) => ({ chartType, rows: [...SALES], encodings })), ...ECHARTS_OPERAND_CASES.map(renderInputFor)] as VizRenderInput[];
  const charts = [], components = [], declarations = [];
  const componentFiles = ['packages/component-styles/src/components.css', 'packages/component-styles/src/components-ported.css', 'packages/mcp-server/src/codegen/workflow-emitter.ts'];
  const referenced = new Set<string>();
  const literalComponentPaints: Array<{ role: string; value: string }> = [];
  for (const file of componentFiles) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/var\((--(?:oods-)?(?:sys|theme|viz|cmp)-[\w-]+)/g)) referenced.add(match[1]);
    for (const [i, line] of source.split('\n').entries()) {
      for (const value of embeddedColors(line)) literalComponentPaints.push({ role: `${file}:${i + 1}`, value });
    }
  }
  for (const brand of ['A', 'B'] as const) {
    const declared = Object.values(bundle.cssVariablesByScope[brand].hc) as string[];
    const lookup = (token: string) => bundle.cssVariablesByScope[brand].hc[token.startsWith('--oods-') ? token : `--oods-${token.slice(2)}`] as string | undefined;
    const hc = JSON.parse(await fs.readFile(path.join(root, `packages/tokens/src/tokens/brands/${brand}/hc.json`), 'utf8'));
    const scales = colors(hc.viz).filter(row => row.role.endsWith('/$value'));
    assert.equal(scales.length, 26, 'HC must explicitly own all categorical/sequential/diverging slots');
    declarations.push({ brand, scales });
    for (const input of inputs) {
      const request = { ...input, brand, theme: 'hc' as const, output: { svg: false, echarts: true, includeNormalizedSpec: true } };
      const result = await render(request);
      assert.equal(result.status, 'ok', JSON.stringify(result.errors));
      assert.equal(result.svg, undefined, 'HC census must not claim rendered pixels');
      const roles = colors({ spec: result.spec, echartsSpec: result.echartsSpec });
      assert(roles.length > 0, `${input.chartType}: no paint roles parsed`);
      charts.push({ chartType: input.chartType, brand, evidence: 'compiled-paint-declarations', roles,
        undeclared: undeclaredHcPaints(roles, declared) });
    }
    for (const token of referenced) {
      // These two are per-chart dimensions authored by the component caller.
      if (token === '--oods-viz-width' || token === '--oods-viz-height' || token.startsWith('--cmp-')) continue;
      assert(lookup(token), `Unresolved component token ${token}`);
    }
    const roles = [...referenced].flatMap(token => {
      const value = lookup(token);
      if (!value) return []; // Local --cmp-* slots point to the sys roots collected above.
      return canonical(value) ? [{ role: token, value }] : embeddedColors(value).map(paint => ({ role: `${token}/embedded`, value: paint }));
    }).concat(literalComponentPaints);
    // These roles are consumed contextually by chart chrome and app controls.
    const contextual = ['--sys-surface-canvas', '--sys-text-primary', '--sys-text-neutral', '--sys-border-subtle', '--sys-border-neutral', '--sys-focus-ring-outer', '--sys-focus-ring-inner'];
    for (const token of contextual) assert(canonical(lookup(token) ?? ''), `Missing contextual paint ${token}`);
    components.push({ brand, sourceFiles: componentFiles, roles, contextualRoles: {
      axis: ['--sys-text-primary', '--sys-border-neutral'], grid: ['--sys-border-subtle'], label: ['--sys-text-neutral'],
      tooltip: ['--sys-surface-canvas', '--sys-text-primary', '--sys-border-neutral'], legend: ['--sys-text-primary', '--sys-text-neutral'],
      focus: ['--sys-focus-ring-outer', '--sys-focus-ring-inner'] }, undeclared: undeclaredHcPaints(roles, declared) });
  }
  const sources = await Promise.all(['packages/tokens/src/tokens/brands/A/hc.json','packages/tokens/src/tokens/brands/B/hc.json', 'packages/viz-core/src/adapters/echarts/treemap-adapter.ts', ...['choropleth', 'bubble', 'flow-line'].map(name => `packages/viz-core/src/adapters/spatial/echarts-${name}-adapter.ts`), ...componentFiles].map(async file => ({ file, sha256: createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex') })));
  const undeclared = charts.reduce((sum, row) => sum + row.undeclared.length, 0) + components.reduce((sum, row) => sum + row.undeclared.length, 0);
  const report = { missionId: 's197-m04', sources, declarations, charts, components,
    summary: { chartTypes: inputs.length, scopes: charts.length, compiledPaintRoles: charts.reduce((sum, row) => sum + row.roles.length, 0), componentPaintRoles: components.reduce((sum, row) => sum + row.roles.length, 0), undeclared, renderedSvg: 0 },
    derivedPaintModes: ['source', 'target', 'inherit', 'gradient'],
    limitation: 'Sankey gradient is a renderer instruction deriving from source/target paints, not a literal color. This is a declared scope/compiled-option census. Renderer-created defaults, interpolation, compositing, forced-color geometry and the nine deferred chart types still require the Sprint 199 pixel pass. Tooltip/focus mappings declare contextual roles; no tooltip interaction or forced-colors contrast claim is made.', builderSelfCertified: false };
  await fs.writeFile(path.join(root, 'artifacts/product-reality/sprint-197/m04/hc-scope-census.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(undeclared, 0, JSON.stringify(charts.filter(row => row.undeclared.length)));
  console.log(JSON.stringify(report.summary));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(import.meta.dirname, 's197-hc-scope.ts')) void main();
