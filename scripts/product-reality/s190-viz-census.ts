#!/usr/bin/env tsx
/** Live capability measurements. Product imports are ONLY the four public handlers.
 * Operands are retained copies of the existing fidelity cases, not registry expectations.
 * Every theme and dashboard request is tested at its public JSON-schema boundary first.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { handle as render } from '../../packages/mcp-server/src/tools/viz.render.js';
import { handle as dashboard } from '../../packages/mcp-server/src/tools/dashboard.render.js';
import { handle as certify } from '../../packages/mcp-server/src/tools/artifact.certify.js';
import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';

const root = resolve(process.env.OODS_VIZ_CENSUS_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const readJson = (file: string) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
export const censusInputs: Parameters<typeof render>[0][] = readJson('scripts/product-reality/s190-viz-operands.json');
const ajv = new Ajv({ strict: false, allErrors: true });
const renderSchema = readJson('packages/mcp-server/src/schemas/viz.render.input.json');
const validRender = ajv.compile(renderSchema);
const validDashboard = ajv.compile(readJson('packages/mcp-server/src/schemas/dashboard.render.input.json'));
const composeSchema = readJson('packages/mcp-server/src/schemas/design.compose.input.json');
const validCompose = ajv.compile(composeSchema);
export function canonical(value: unknown): string {
  const sort = (item: any): any => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}

type PlacementRequest = Pick<Parameters<typeof compose>[0], 'object' | 'context' | 'layout'>;
export interface ChartPlacement {
  object: string;
  context: string | null;
  layout: string | null;
  nodeId: string;
  component: string;
  chartType: string;
  chartSource: string;
  dataField?: string;
  evidence: 'composed-declaration';
}

/** Inventory the actual UiSchema nodes. This observes placement, not executed consumer pixels. */
export function collectChartPlacements(schema: unknown, request: PlacementRequest): ChartPlacement[] {
  const placements: ChartPlacement[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    const chart = node.chart;
    if (typeof node.component === 'string' && chart?.chartType) {
      assert(typeof node.id === 'string', 'Placed chart requires a UiSchema node identity');
      placements.push({ object: request.object!, context: request.context ?? null, layout: request.layout ?? null,
        nodeId: node.id, component: node.component, chartType: chart.chartType, chartSource: chart.source,
        ...(chart.dataField ? { dataField: chart.dataField } : {}), evidence: 'composed-declaration' });
    }
    for (const value of Object.values(node)) if (typeof value === 'object') walk(value);
  };
  walk(schema);
  return placements;
}

export async function measureVizPlacements() {
  const placements: ChartPlacement[] = [];
  const requests: PlacementRequest[] = [];
  for (const object of ['Article', 'Invoice', 'Media', 'Organization', 'Plan', 'Product', 'Relationship', 'Subscription', 'Transaction', 'Usage', 'User']) {
    for (const context of composeSchema.properties.context.enum) requests.push({ object, context });
    requests.push({ object, layout: 'dashboard' });
  }
  for (const request of requests) {
    assert(validCompose(request), JSON.stringify(validCompose.errors));
    const out = await compose(request);
    assert.equal(out.status, 'ok', `${JSON.stringify(request)}: ${JSON.stringify(out.errors)}`);
    placements.push(...collectChartPlacements(out.schema, request));
  }
  return { placements, placementCompositions: requests.length, placementRequests: requests };
}

export async function measureVizCensus() {
  assert.deepEqual(censusInputs.map(input => input.chartType).sort(), [...renderSchema.properties.chartType.enum].sort());
  const placementResult = await measureVizPlacements();
  const { placements } = placementResult;
  const observations: any[] = [], registry: any[] = [];
  for (const input of censusInputs) {
    const request = { ...input, output: { ...input.output, svg: true, includeNormalizedSpec: true } };
    const defaultRender = await render(request);
    assert.equal(defaultRender.status, 'ok', JSON.stringify(defaultRender.errors));
    const scopes: any[] = [];
    for (const brand of ['A', 'B'] as const) for (const theme of ['light', 'dark', 'hc'] as const) {
      assert(validRender({ ...request, theme, brand }));
      const rendered = await render({ ...request, theme, brand });
      const repeated = await render({ ...request, theme, brand });
      if (rendered.status !== 'ok') {
        assert.equal(theme, 'hc', `${input.chartType}/${theme}/${brand}: existing public scope failed`);
        assert(rendered.errors?.length && rendered.errors.every(error => error.code && error.message), 'HC deferral requires a measured typed renderer failure');
        assert.equal(repeated.status, 'error');
        assert.deepEqual(repeated.errors, rendered.errors, 'HC failure must repeat deterministically');
        scopes.push({ theme, brand, status: 'typed-deferred', errors: rendered.errors });
        continue;
      }
      assert.equal(repeated.status, 'ok', JSON.stringify(repeated.errors));
      assert(rendered.svg && rendered.svgHash, 'Successful scope requires actual public SVG bytes');
      assert.equal(rendered.svg, repeated.svg, `${input.chartType}/${theme}/${brand} repeat`);
      if (theme === 'light' && brand === 'A') assert.equal(rendered.svg, defaultRender.svg, 'omitted scope equals light/A');
      const data = Object.fromEntries(['hierarchy', 'sankey', 'chord', 'network', 'geo'].filter(key => key in input).map(key => [key, (input as any)[key]]));
      const grade = await certify({ spec: rendered.normalizedSpec!, theme, brand, ...(Object.keys(data).length ? { data } : {}) });
      assert.equal(grade.status, 'ok', JSON.stringify(grade.errors));
      assert.equal(grade.determinism?.renderHash, rendered.svgHash, `${input.chartType}/${theme}/${brand} certify identity`);
      if (theme === 'hc') {
        assert.equal(grade.pillars?.contrast, 'exempt', 'HC system-color contrast belongs to the forced-colors browser proof');
        assert.equal(grade.contrastResults?.[0]?.verdict, 'exempt');
        assert.match(JSON.stringify(grade.contrastResults), /forced-colors/);
      }
      scopes.push({ theme, brand, status: 'rendered', svg: rendered.svg, svgBytes: rendered.svgBytes, svgHash: rendered.svgHash, renderHash: grade.determinism?.renderHash, repeated: true,
        render: rendered.render, a11yDescription: !!rendered.normalizedSpec?.a11y?.description,
        coverage: grade.coverage, conformant: grade.conformant, accuracyRules: grade.accuracyRules,
        accuracySummary: grade.accuracySummary, pillars: grade.pillars, findings: grade.findings,
        notes: grade.notes, contrast: grade.contrastResults![0] });
    }
    const { output: _output, rows, name, ...panelInput } = input;
    const dashboardRequest = { schemaVersion: 'v0.1', datasets: [{ id: 'data', rows: rows ?? censusInputs[0]!.rows! }],
      panels: [{ ...panelInput, ...(name ? { title: name } : {}), id: 'chart', kind: 'chart', ...(rows ? { datasetId: 'data' } : {}) }],
      output: { html: true }, a11y: { description: 'Single-panel visualization capability probe.' } };
    const dashboardAdmitted = !!validDashboard(dashboardRequest);
    const dashboardErrors = dashboardAdmitted ? [] : structuredClone(validDashboard.errors);
    if (!dashboardAdmitted) assert(dashboardErrors?.some(error => error.instancePath === '/panels/0/chartType' && error.keyword === 'enum'), JSON.stringify(dashboardErrors));
    const panel = dashboardAdmitted ? await dashboard(dashboardRequest as Parameters<typeof dashboard>[0]) : undefined;
    const drawn = panel?.status === 'ok' && /<svg\b/.test(panel.html ?? '') && !/class="[^"]*oods-placeholder/.test(panel.html ?? '');
    if (dashboardAdmitted) assert(drawn, `${input.chartType} admitted dashboard must draw`);
    const hcAdmitted = !!validRender({ ...request, theme: 'hc' });
    assert.equal(hcAdmitted, true, 'HC is part of the public scope boundary');
    const successfulScopes = scopes.filter(scope => scope.status === 'rendered');
    const establishedScopes = scopes.filter(scope => scope.theme !== 'hc');
    const hcScopes = scopes.filter(scope => scope.theme === 'hc');
    const hcDrawn = hcScopes.length === 2 && hcScopes.every(scope => scope.status === 'rendered');
    const places = placements.filter(place => place.chartType === input.chartType);
    const measured = (['light', 'dark'] as const).filter(theme => scopes.filter(scope => scope.theme === theme).every(scope => scope.contrast.measured));
    const passed = measured.filter(theme => scopes.filter(scope => scope.theme === theme).every(scope => scope.contrast.verdict === 'pass'));
    const notes = [hcDrawn ? 'HC paints are emitted from the declared token scope; contrast is forced-colors exempt and requires browser evidence.' : `HC pixels typed-deferred: ${hcScopes.filter(scope => scope.status === 'typed-deferred').flatMap(scope => scope.errors.map((error: any) => `${error.code}: ${error.message}`)).join('; ')}`];
    if (measured.length) notes.push(`Categorical contrast passes both brands in: ${passed.join(', ') || 'none'}.`);
    if (!dashboardAdmitted) notes.push('Dashboard exclusion (#881): the public panel schema does not admit this type.');
    if (!measured.length) notes.push(`Contrast verdict ${scopes[0].contrast.verdict}; no categorical canvas-ratio measurement claimed.`);
    if (places.length) {
      const scopes = [...new Set(places.map(place => `${place.object}/${place.context ?? `layout:${place.layout}`}`))];
      notes.push(`Composed chart declarations: ${scopes.join(', ')}. This census observes placement; generated React/Vue runtime proof is retained separately. Edited form data does not regenerate the static sample SVG.`);
    } else if (defaultRender.render?.engine === 'echarts') {
      const missingOperands: Record<string, string> = {
        treemap: 'treemap requires a hierarchy array; no public object declares one.',
        sunburst: 'sunburst requires a hierarchy array; no public object declares one.',
        sankey: 'sankey requires numeric link values; Relationship neighborhood edges do not declare them.',
        chord: 'chord requires numeric link values; Relationship neighborhood edges do not declare them.',
        choropleth: 'choropleth requires inline geometry and matched region values; no public object declares that operand.',
        bubble_map: 'bubble_map requires inline geometry and size-bound point values; no public object declares that operand.',
        flow_map: 'flow_map requires inline geometry and origin/destination flows; no public object declares that operand.',
      };
      assert(missingOperands[input.chartType!], `Missing placement reason for ${input.chartType}`);
      notes.push(`Not placed: ${missingOperands[input.chartType!]}`);
    } else {
      notes.push('Not placed: no public object binds this chart type through a canonical Mark chart declaration; standalone authoring preview support is separate.');
    }
    const first = scopes[0];
    assert(successfulScopes.every(scope => scope.coverage === first.coverage), `${input.chartType}: scope-dependent certification coverage`);
    if (first.coverage === 'uncertified' && first.render.engine === 'echarts') {
      assert(first.notes?.length, `${input.chartType}: uncertified operand profile needs a measured reason`);
      notes.push(`Uncertified operand profile: ${first.notes.join(' ')}`);
    }
    registry.push({ chartType: input.chartType, specEngine: first.render.engine, publicSvg: establishedScopes.every(scope => !!scope.svgHash),
      dashboardDrawn: drawn ? true : 'excluded (#881)', themes: { light: scopes.filter(scope => scope.theme === 'light').every(scope => !!scope.svgHash), dark: scopes.filter(scope => scope.theme === 'dark').every(scope => !!scope.svgHash), hc: hcDrawn },
      brands: ['A', 'B'].filter(brand => establishedScopes.filter(scope => scope.brand === brand).every(scope => !!scope.svgHash)),
      a11yDescription: successfulScopes.every(scope => scope.a11yDescription), accuracyRules: first.accuracyRules,
      certifyCoverage: first.coverage, certifyProfile: first.render.engine === 'echarts' ? 'echarts-data' : 'cartesian',
      renderScopes: scopes.map(({ theme, brand, status, svgHash, errors }) => ({ theme, brand, status, ...(svgHash ? { svgHash } : {}), ...(errors ? { errors } : {}) })),
      certifyScopes: successfulScopes.map(({ theme, brand, coverage, conformant, pillars, accuracySummary }) => ({ theme, brand, coverage, conformant, pillars, accuracySummary })),
      contrastMeasured: measured, contrastPassed: passed, chartInApp: places.length ? 'placed' : 'not-placed', notes });
    observations.push({ chartType: input.chartType, defaultEqualsLightA: true, scopes, dashboardAdmitted, dashboardErrors, dashboardDrawn: drawn, placements: places, hcAdmitted, hcDrawn });
  }
  const accuracyControls = await measureVizAccuracyControls();
  return { registry, observations, ...placementResult, accuracyControls };
}

/** Missing real predicates must make the census red even when the rule roster is intact. */
export async function measureVizAccuracyControls() {
  const results = [];
  for (const [chartType, code, fieldKey] of [['bubble_map', 'OODS-V168', 'sizeField'], ['flow_map', 'OODS-V171', 'strengthField']] as const) {
    const input = structuredClone(censusInputs.find(row => row.chartType === chartType)!);
    assert(input, `${chartType}: missing accuracy control operand`);
    const rendered = await render({ ...input, brand: 'A', theme: 'light', output: { svg: true, includeNormalizedSpec: true } });
    assert.equal(rendered.status, 'ok', `${chartType}: accuracy control must start with public pixels`);
    const geo = structuredClone((input as any).geo);
    const field = geo[fieldKey];
    assert(typeof field === 'string' && geo.rows?.length, `${chartType}: accuracy control requires its declared measure`);
    geo.rows[0][field] = -1;
    const grade = await certify({ spec: rendered.normalizedSpec!, data: { geo }, brand: 'A', theme: 'light' });
    assert.equal(grade.status, 'ok', `${chartType}: accuracy control must be evaluated`);
    assert(grade.findings?.some(finding => finding.code === code), `${chartType}: census missed required ${code} accuracy finding for a negative ${fieldKey}`);
    assert.equal(grade.pillars?.accuracy, 'fail', `${chartType}: detected distortion must fail accuracy`);
    assert.equal(grade.conformant, false, `${chartType}: detected distortion must fail the operand conformance gate`);
    results.push({ chartType, expectedCode: code, field, suppliedValue: -1, grade });
  }
  return results;
}

/**
 * s223-m03 (#2527 ruling 17): the census says what it was measured on. Beside the registry sits its stamp: the release
 * version and source head the census ran at (archiveSha256 is null: it measures the source, not an archive), whether the
 * tree was dirty, and the registry's own SHA-256, so a registry changed after its census is caught. @oods/viz-core bundles
 * it (VIZ_RECIPES_CENSUS), so health and the package's facts.json report the scopes with it.
 */
const REGISTRY = 'packages/viz-core/src/registry/viz-recipes.v1.json';
export const CENSUS_STAMP = 'packages/viz-core/src/registry/viz-recipes.measured.json';
const sha256 = (file: string) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
function writeStamp(registry: Array<{ certifyCoverage: string; certifyScopes: Array<{ coverage: string; conformant: boolean | null }> }>): void {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(line => line && !line.endsWith(CENSUS_STAMP)).length > 0;
  const certified = registry.filter(row => row.certifyCoverage === 'certified');
  writeFileSync(resolve(root, CENSUS_STAMP), JSON.stringify({
    schema: 'oods-viz-census-stamp/v1',
    measuredOn: { version: readJson('package.json').version, sourceHead: git('rev-parse', 'HEAD'), archiveSha256: null },
    dirty,
    chartTypes: certified.length,
    certifiedScopes: certified.flatMap(row => row.certifyScopes).filter(scope => scope.coverage === 'certified' && scope.conformant === true).length,
    registrySha256: sha256(REGISTRY),
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const writeRegistry = args.includes('--write-registry');
  const stamp = args.includes('--stamp');
  assert(!(check && writeRegistry), '--check and --write-registry are separate operations');
  assert(!stamp || check, '--stamp records a passing --check: run --check --stamp');
  assert(args.every(arg => !arg.startsWith('--') || ['--check', '--write-registry', '--stamp'].includes(arg)), 'Unknown census option');
  const output = args.find(arg => !arg.startsWith('--')) ?? process.env.OODS_VIZ_CENSUS_OUTPUT;
  assert(check || output, 'Provide an explicit census output directory; historical receipts are never a default destination.');
  const result = await measureVizCensus();
  if (check) {
    assert.equal(canonical(result.registry), canonical(readJson(REGISTRY)), 'Measured viz registry differs from canonical source');
    if (stamp) writeStamp(result.registry);
    assert(existsSync(resolve(root, CENSUS_STAMP)), `${CENSUS_STAMP} is missing: run --check --stamp`);
    assert.equal(readJson(CENSUS_STAMP).registrySha256, sha256(REGISTRY), `${CENSUS_STAMP} stamps a different registry: run --check --stamp`);
  } else {
    mkdirSync(resolve(output!), { recursive: true });
    writeFileSync(resolve(output!, 'viz-census.json'), JSON.stringify(result.registry, null, 2) + '\n');
    writeFileSync(resolve(output!, 'viz-observations.json'), JSON.stringify(result, null, 2) + '\n');
    if (writeRegistry) {
      writeFileSync(resolve(root, REGISTRY), JSON.stringify(result.registry, null, 2) + '\n');
      writeStamp(result.registry);
    }
  }
  console.log(JSON.stringify({ rows: result.registry.length, scopeIdentities: result.observations.reduce((n, row) => n + row.scopes.length, 0),
    renderedScopes: result.observations.flatMap(row => row.scopes).filter(scope => scope.status === 'rendered').length,
    typedDeferredScopes: result.observations.flatMap(row => row.scopes).filter(scope => scope.status === 'typed-deferred').length,
    certified: result.registry.filter(row => row.certifyCoverage === 'certified').length,
    nonconformantScopes: result.observations.flatMap(row => row.scopes).filter(scope => scope.conformant === false).length,
    accuracyControls: result.accuracyControls.length, placements: result.placements }));
}
