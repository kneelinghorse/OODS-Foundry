// dashboard.render HTML export composer (sprint-115 m03).
//
// Composes the metric-overview dashboard into ONE self-contained HTML document:
//   - Vega-Lite chart panels (trend/breakdown) -> inline SVG via @oods/viz-render;
//   - KPI tiles rendered from the computed KPI values + their a11y string;
//   - ECharts-primary panels -> normalized inline SVG through the shared worker;
//   - failed panels -> an a11y-described error placeholder.
//
// Emitted ONLY when input output.html=true; the rest of the dashboard.render payload
// is untouched (opt-in additive, seam (e)). Output is deterministic: no timestamps,
// no random ids (the per-call specRef trio is NOT embedded), SVGs are byte-stable
// (@oods/viz-render). The visual grid follows the m02 resolved abstract layout while
// DOM order follows the dashboard a11y reading order, so screen-reader traversal is
// KPI-first independent of grid position.
//
// m04 enriches this: (1) inline resolved brand tokens (a `:root` custom-property
// block + threading them to the SVG emitter), and (2) a COMPUTED a11y narrative. m03
// emits an on-brand-by-construction-ready structure with token-var defaults so m04
// only injects the values.

import { assertHcSvgPaints } from './hc-svg-paints.js';
import { renderVegaLiteToSvg, renderEChartsToSvg, normalizeEChartsSvg, type VegaLiteSpec } from '@oods/viz-render';
import { resolveTokenToColor, withCappedYTicks, withRenderWidthLabels, type TokenScope } from '@oods/viz-core';
import { contrastRatio } from '@oods/a11y-tools';
import type { DashboardRenderOutput } from '../schemas/generated.js';
import { DEFAULT_BRAND } from '../lib/brand-registry.js';
import { scopedSvgIds } from '../lib/scoped-svg-ids.js';

// Brand-token inlining (m04): map the export's CSS custom-property names to the OODS
// design-token names, resolved to concrete values via the existing token path so the
// HTML is on-brand STANDALONE (no dependency on an external token CSS bundle). A brand
// that defines chromatic status colors differentiates the +/- trend, while the a11y text
// always names the direction (so the export never relies on color alone). The compact
// JSON path is unchanged — this inlining is export-only.
//
// s169 m04: the map is now PARAMETERISED BY BRAND. It was hard-coded to `brand-a`, which
// is why `dashboard.render` could not honour a brand even though the token package has
// shipped a complete `--oods-brand-b-*` set (20 names, identical name set to brand A) for
// two sprints. `DEFAULT_EXPORT_BRAND` keeps the no-brand path byte-identical.
// s213-m04: any brand in the brand registry; the default is the registry's default brand.
export type ExportBrand = string;
const DEFAULT_EXPORT_BRAND: ExportBrand = DEFAULT_BRAND;

const EXPORT_TOKEN_SUFFIXES: Readonly<Record<string, string>> = {
  '--oods-color-fg': 'text-primary',
  '--oods-color-muted': 'text-muted',
  '--oods-color-bg': 'surface-canvas',
  '--oods-color-panel-bg': 'surface-raised',
  '--oods-color-panel-border': 'border-subtle',
  '--oods-color-accent': 'text-primary',
  '--oods-color-positive': 'status-success-text',
  '--oods-color-negative': 'status-critical-text',
};

export function exportTokenMap(brand: ExportBrand = DEFAULT_EXPORT_BRAND): Readonly<Record<string, string>> {
  const prefix = `--oods-brand-${brand.toLowerCase()}-`;
  return Object.fromEntries(
    Object.entries(EXPORT_TOKEN_SUFFIXES).map(([cssVar, suffix]) => [cssVar, `${prefix}${suffix}`]),
  );
}

export function resolveBrandTokens(brand: ExportBrand = DEFAULT_EXPORT_BRAND, theme: TokenScope['theme'] = 'light'): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [cssVar, tokenName] of Object.entries(exportTokenMap(brand))) {
    const suffix = tokenName.replace(/^--oods-brand-[ab]-/, '');
    const value = resolveTokenToColor(`--oods-theme-${suffix}`, { brand, theme });
    if (value) {
      resolved[cssVar] = value;
    }
  }
  return resolved;
}

// Contrast scan (sprint-118 m07 piece A): the brand-token colour pairs the export actually
// paints, checked at the WCAG AA normal-text threshold (4.5:1). Run over the ALREADY-RESOLVED
// hexes from resolveBrandTokens() with the pure contrastRatio() — NO filesystem read (the
// disk-reading validate-contrast loadTokenData path is deliberately NOT wired).
export const CONTRAST_PAIRS: ReadonlyArray<{ id: string; fg: string; bg: string; threshold: number }> = [
  { id: 'fg-on-bg', fg: '--oods-color-fg', bg: '--oods-color-bg', threshold: 4.5 },
  { id: 'positive-on-panel-bg', fg: '--oods-color-positive', bg: '--oods-color-panel-bg', threshold: 4.5 },
  { id: 'negative-on-panel-bg', fg: '--oods-color-negative', bg: '--oods-color-panel-bg', threshold: 4.5 },
  { id: 'muted-on-panel-bg', fg: '--oods-color-muted', bg: '--oods-color-panel-bg', threshold: 4.5 },
];

export interface ContrastFinding {
  readonly pair: string;
  readonly ratio: number;
  readonly threshold: number;
}

export interface ContrastScanResult {
  readonly findings: ContrastFinding[];
  /** How many of CONTRAST_PAIRS were actually measured. See the honesty note below. */
  readonly graded: number;
}

/**
 * ── s169 m04: THIS SCAN GRADED ZERO PAIRS IN PRODUCTION, AND SAID NOTHING ──
 *
 * `resolveTokenToColor` returns `rgb(r, g, b)` strings. `contrastRatio` accepts ONLY
 * `#rgb`/`#rrggbb` and THROWS on anything else. The `catch` below was written for CSS
 * system colours (`CanvasText`), which genuinely cannot be graded — but it swallowed the
 * rgb() failures too. MEASURED at s168's tip: `scanBrandContrast()` returned `[]` for
 * every input, on every run, since the feature shipped. `output.contrastScan: true`
 * reported "no contrast failures" having checked nothing.
 *
 * What made it invisible for three sprints: the unit test used a **hex** palette, which
 * parses fine, fails as designed, and is GREEN at HEAD — so the test proved the pair
 * logic while the production path was inert. Only an **rgb()-form** failing palette
 * discriminates, and the tests now use one.
 *
 * NORMALISATION LIVES HERE, NEVER IN `resolveBrandTokens`. That function's rgb() output is
 * also inlined verbatim into the HTML export and pinned by the sprint-115 golden
 * (`--oods-color-fg:rgb(24, 35, 60)`), so converting at the source would move a golden
 * that has nothing to do with contrast.
 *
 * And the count is REPORTED, not implied: a scan that silently skips everything must no
 * longer be able to look like a scan that passed. `graded` is asserted against
 * `CONTRAST_PAIRS.length` on the production path by the test suite.
 */
function toGradableHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(trimmed);
  if (!rgb) {
    // A CSS system colour (`CanvasText`, `Highlight`, …) is context-dependent — the user
    // agent supplies the actual colour — so no static ratio exists. Genuinely ungradable.
    return null;
  }
  // s170 m04: a TRANSLUCENT colour has no static ratio either. Its rendered appearance is the
  // composite of itself and whatever is behind it, which this function cannot see — so the
  // alpha channel was being DROPPED and the colour graded as if it were opaque, which reports
  // a ratio the user never experiences. That is the same class of defect as the inert scan
  // this file already documents: a number that looks like a measurement and is not one.
  // Skipping is the honest answer, and it is visible, because `graded` is reported.
  if (rgb[4] !== undefined && Number(rgb[4]) !== 1) {
    return null;
  }
  const channels = [rgb[1], rgb[2], rgb[3]].map((part) => Number(part));
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    return null;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Scan the export's resolved brand-token colour pairs for WCAG contrast failures (pure, no fs).
 * Pass `tokensOverride` to scan a specific palette (tests, or a non-default brand); otherwise
 * the default brand resolves.
 */
export function scanBrandContrast(tokensOverride?: Readonly<Record<string, string>>): ContrastScanResult {
  const tokens = tokensOverride ?? resolveBrandTokens();
  const findings: ContrastFinding[] = [];
  let graded = 0;
  for (const pair of CONTRAST_PAIRS) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (!fg || !bg) {
      continue;
    }
    const fgHex = toGradableHex(fg);
    const bgHex = toGradableHex(bg);
    if (!fgHex || !bgHex) {
      continue;
    }
    graded += 1;
    const ratio = Number(contrastRatio(fgHex, bgHex).toFixed(2));
    if (ratio < pair.threshold) {
      findings.push({ pair: pair.id, ratio, threshold: pair.threshold });
    }
  }
  return { findings, graded };
}

type PanelResult = DashboardRenderOutput['panels'][number];
type Placement = NonNullable<DashboardRenderOutput['layout']>[number];
type DashboardA11y = DashboardRenderOutput['a11y'];

/** Per-tabular-chart-panel data for the SR-only data-table (sprint-118 m07 piece B). */
export interface ChartTableData {
  /** The charted columns (the panel's encoding fields) — the table cells. */
  readonly columns: readonly string[];
  /** The (cross-filtered) rows fed to the chart — carry every field so the caption tally can read the quality column. */
  readonly rows: ReadonlyArray<Record<string, unknown>>;
}

export interface ComposeHtmlArgs {
  readonly brand?: ExportBrand;
  readonly theme?: TokenScope['theme'];
  readonly title?: string;
  readonly panels: readonly PanelResult[];
  readonly layout: readonly Placement[];
  readonly a11y: DashboardA11y;
  /** Grid column count (input.layout.columns, default 12). */
  readonly columns: number;
  readonly links?: DashboardRenderOutput['links'];
  /**
   * Resolved document tokens (CSS custom-property name -> value). Chart specs
   * already carry their own scoped chrome from viz.render.
   */
  readonly tokens?: Readonly<Record<string, string>>;
  /**
   * SR-only data-table rows per tabular chart panel (sprint-118 m07, output.dataTable). When a
   * panel has an entry, an oods-visually-hidden <table> is appended inside its <figure>. Undefined
   * keeps the HTML byte-identical.
   */
  readonly tableData?: ReadonlyMap<string, ChartTableData>;
  /** Column whose data-quality codes (E/I/X/blank) are tallied into each data-table <caption> (output.dataQualityField). */
  readonly dataQualityField?: string;
}

/** Render the opt-in self-contained HTML export for a composed dashboard. */
export async function composeDashboardHtml(args: ComposeHtmlArgs): Promise<string> {
  const { title, panels, layout, a11y, columns, tokens, tableData, dataQualityField } = args;
  // m04: resolve the brand tokens once. Caller override wins; else the default brand.
  const resolvedTokens = tokens ?? resolveBrandTokens(args.brand, args.theme);

  const placementById = new Map<string, Placement>(layout.map((p) => [p.id, p]));
  const byId = new Map<string, PanelResult>(panels.map((p) => [p.id, p]));
  const order = a11y?.panelOrder?.length ? a11y.panelOrder : panels.map((p) => p.id);

  const cells: string[] = [];
  for (const id of order) {
    const panel = byId.get(id);
    if (!panel) {
      continue;
    }
    cells.push(await renderPanelCell(panel, placementById.get(id), columns, tableData?.get(id), dataQualityField, { theme: args.theme, brand: args.brand }, cells.length));
  }

  const docTitle = title ?? 'Dashboard';
  const ariaLabel = a11y?.ariaLabel ?? docTitle;

  const lines: string[] = [
    '<!DOCTYPE html>',
    `<html lang="en"${args.theme === 'dark' ? ' class="dark"' : ''} data-theme="${args.theme ?? 'light'}" data-brand="${args.brand ?? DEFAULT_BRAND}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(docTitle)}</title>`,
    `<style>${rootTokenBlock(resolvedTokens)}${styleBlock(columns)}</style>`,
    '</head>',
    '<body>',
    `<main class="oods-dashboard" role="region" aria-label="${esc(ariaLabel)}">`,
  ];
  if (title) {
    lines.push(`<h1 class="oods-dashboard-title">${esc(title)}</h1>`);
  }
  if (a11y?.description) {
    lines.push(`<p class="oods-dashboard-summary">${esc(a11y.description)}</p>`);
  }
  lines.push(...narrativeBlock(a11y));
  lines.push('<div class="oods-dashboard-grid">');
  lines.push(...cells);
  lines.push('</div>');
  if (args.links?.length) {
    lines.push('<section class="oods-dashboard-links" aria-label="Declared panel links"><h2>Declared panel links</h2><p>Reference relationships. This static export does not apply filters when clicked.</p><ul>');
    for (const link of args.links) {
      const source = byId.get(String(link.source)), target = byId.get(String(link.target));
      const from = source?.title ?? String(link.source), to = target?.title ?? String(link.target);
      const fields = link.sourceField ? `: ${from}.${String(link.sourceField)} ${String(link.operator ?? 'in')} ${to}.${String(link.targetField ?? link.sourceField)}` : '';
      lines.push(`<li>${esc(from)} → ${esc(to)}${esc(fields)}</li>`);
    }
    lines.push('</ul></section>');
  }
  lines.push('</main>');
  lines.push('</body>');
  lines.push('</html>');
  return lines.join('\n') + '\n';
}

// s149 F6a (Approach B): the nominal px budget the abstract grid maps onto when sizing
// a chart panel's SVG to its span. Width scales with the panel's column fraction
// (p.w/columns), height with its row span (p.h) — both deterministic, export-only. So a
// 6/12 × 2-row chart renders wide-and-short (filling its cell) instead of at Vega's
// intrinsic narrow-tall step width. Applied only on the emitter clone (never panel.spec).
const NOMINAL_DASHBOARD_WIDTH_PX = 1200;
const NOMINAL_ROW_HEIGHT_PX = 160;
/** Vega's default padding, which sits outside a fit size. */
const VEGA_PADDING_PX = 5;
/** s222-m02 follow-up: the chart marks whose discrete x labels the export keeps level when they fit the panel. */
const LEVEL_LABEL_MARKS = ['bar', 'line', 'area'] as const;
/** 360px viewport less page padding, panel padding and borders; never scale below authored text size. */
const PHONE_CHART_PX = { width: 302, height: 260 } as const;

async function renderPanelCell(
  panel: PanelResult,
  placement: Placement | undefined,
  columns: number,
  table: ChartTableData | undefined,
  dataQualityField: string | undefined,
  scope: TokenScope,
  position: number,
): Promise<string> {
  const style = placement ? ` style="${gridStyle(placement)}"` : '';

  if (panel.kind === 'kpi') {
    return kpiCell(panel, style);
  }
  if (panel.kind === 'error') {
    return placeholderCell(panel.title, panel.a11yDescription, style, 'error');
  }
  // s149 F6a: size the SVG to the panel's grid span (Approach B). Only when we have a placement + a positive column
  // count; otherwise fall back to the renderer's intrinsic size.
  const span = placement && columns > 0
    ? { width: Math.round((placement.w / columns) * NOMINAL_DASHBOARD_WIDTH_PX), height: placement.h * NOMINAL_ROW_HEIGHT_PX }
    : undefined;
  const wide = span ?? { width: 600, height: 320 };
  const boxes = [PHONE_CHART_PX, ...(wide.width > 600 ? [{ width: 600, height: wide.height }] : []), ...(wide.width > PHONE_CHART_PX.width ? [wide] : [])];
  const variants = [];
  for (const [index, box] of boxes.entries()) variants.push({ width: box.width,
    svg: assertHcSvgPaints(scopedSvgIds(await drawChart(panel, box), `panel-${position}-${index}`), scope) });
  return chartCell(panel.title, panel.a11yDescription, variants, position, style, table, dataQualityField);
}

/** A chart panel with a non-empty `spec`, a Vega-Lite spec the export renders to SVG; otherwise an ECharts option. */
function isVegaPanel(panel: Extract<PanelResult, { kind: 'chart' }>): boolean {
  return Boolean(panel.spec && Object.keys(panel.spec).length > 0);
}

/** A chart panel drawn to fill a box (the SVG's own size), or at its renderer's intrinsic size. */
async function drawChart(panel: Extract<PanelResult, { kind: 'chart' }>, box: { width: number; height: number } | undefined): Promise<string> {
  if (panel.spec && isVegaPanel(panel)) {
    // s222-m02 (#2502 ruling 12): the drawn chart is the box itself, at most 320px tall for two rows (Vega's padding sat
    // outside the fit size, so the SVG was 610x330 on a 600x320 span), with capped y ticks and discrete x labels level
    // when they fit the panel.
    const padding = typeof panel.spec.padding === 'number' ? panel.spec.padding : VEGA_PADDING_PX;
    const dims = box ? { width: box.width - 2 * padding, height: box.height - 2 * padding } : {};
    const capped = withCappedYTicks(panel.spec as Record<string, unknown>);
    const exported = dims.width !== undefined ? withRenderWidthLabels(capped, dims.width, LEVEL_LABEL_MARKS) : capped;
    const svg = await renderVegaLiteToSvg(exported as unknown as VegaLiteSpec, { ...dims });
    return svg;
  }
  if (panel.echartsSpec) {
    return normalizeEChartsSvg(await renderEChartsToSvg(panel.echartsSpec, box));
  }
  throw new Error('Chart panel has no renderable spec.');
}

function kpiCell(panel: Extract<PanelResult, { kind: 'kpi' }>, style: string): string {
  const title = panel.title ?? '';
  const valueText = panel.formatted ?? String(panel.value);
  const trend = panel.trendDirection;
  const deltaText =
    panel.delta === null || panel.delta === undefined
      ? `(${trend})`
      : `${panel.delta >= 0 ? '+' : ''}${panel.delta} (${trend})`;
  const parts: string[] = [
    `<section class="oods-panel oods-kpi"${style}${ariaLabelAttr(title || panel.a11yDescription)}>`,
  ];
  if (title) {
    parts.push(`<h3 class="oods-kpi-title">${esc(title)}</h3>`);
  }
  parts.push(`<p class="oods-kpi-value">${esc(valueText)}</p>`);
  parts.push(`<p class="oods-kpi-delta oods-trend-${esc(trend)}">${esc(deltaText)}</p>`);
  const series = panel.sparkline?.filter(Number.isFinite) ?? [];
  if (series.length) {
    const min = Math.min(...series), max = Math.max(...series);
    const points = series.map((value, index) => `${series.length === 1 ? 100 : 4 + index * 192 / (series.length - 1)},${max === min ? 24 : 44 - (value - min) * 40 / (max - min)}`);
    parts.push(`<svg class="oods-kpi-sparkline" role="img" viewBox="0 0 200 48"><title>${esc(`${title || 'Metric'} series: ${series.join(', ')}`)}</title><polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>${series.length === 1 ? '<circle cx="100" cy="24" r="3" fill="currentColor"/>' : ''}</svg>`);
  }
  if (panel.thresholdBreached) parts.push('<p class="oods-kpi-breach"><span aria-hidden="true">▲</span> Threshold breached</p>');
  if (panel.anomaly) parts.push('<p class="oods-kpi-anomaly">Anomaly detected</p>');
  if (panel.a11yDescription) {
    parts.push(`<p class="oods-visually-hidden">${esc(panel.a11yDescription)}</p>`);
  }
  parts.push('</section>');
  return parts.join('');
}

function chartCell(
  title: string | undefined,
  a11yDescription: string | undefined,
  variants: Array<{ width: number; svg: string }>,
  position: number,
  style: string,
  table: ChartTableData | undefined,
  dataQualityField: string | undefined,
): string {
  const parts: string[] = [
    `<figure class="oods-panel oods-chart" data-chart-panel="${position}" role="figure"${style}${ariaLabelAttr(a11yDescription ?? title)}>`,
  ];
  if (title) {
    parts.push(`<figcaption>${esc(title)}</figcaption>`);
  }
  for (const [index, variant] of variants.entries()) parts.push(`<div class="oods-chart-size-${index}"${index ? ' style="display:none"' : ''}>${variant.svg}</div>`);
  // Each larger render takes over only when its intrinsic width fits. No chart text is scaled down at the breakpoints.
  const rules = variants.slice(1).map((variant, index) => {
    const selector = `[data-chart-panel="${position}"]>`;
    return `@container(min-width:${variant.width}px){${selector}.oods-chart-size-${index}{display:none!important}${selector}.oods-chart-size-${index + 1}{display:block!important}}`;
  });
  parts.push(`<style>${rules.join('')}</style>`);
  // SR-only data-table (m07 piece B) — the chart's data, accessible to a screen reader.
  if (table) {
    parts.push(dataTableHtml(table, dataQualityField));
  }
  parts.push('</figure>');
  return parts.join('');
}

/** A screen-reader-only data-table for a chart panel (sprint-118 m07). */
function dataTableHtml(table: ChartTableData, dataQualityField: string | undefined): string {
  const parts: string[] = ['<table class="oods-visually-hidden oods-chart-data">'];
  // E/I/X tally caption (m07 piece C) — only when a data-quality column is named.
  if (dataQualityField) {
    parts.push(`<caption>${esc(tallyDataQuality(table.rows, dataQualityField))}</caption>`);
  }
  parts.push(
    `<thead><tr>${table.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>`,
  );
  parts.push('<tbody>');
  for (const row of table.rows) {
    parts.push(`<tr>${table.columns.map((c) => `<td>${esc(formatCell(row[c]))}</td>`).join('')}</tr>`);
  }
  parts.push('</tbody></table>');
  return parts.join('');
}

/** Tally FAOSTAT-style data-quality flags (E=estimated / I=imputed / X=external / blank=official). */
function tallyDataQuality(rows: ReadonlyArray<Record<string, unknown>>, field: string): string {
  let estimated = 0;
  let imputed = 0;
  let external = 0;
  let official = 0;
  for (const row of rows) {
    const code = String(row[field] ?? '').trim().toUpperCase();
    if (code === 'E') estimated += 1;
    else if (code === 'I') imputed += 1;
    else if (code === 'X') external += 1;
    else official += 1; // blank / 'A' / official
  }
  return `Data quality: ${official} official, ${estimated} estimated, ${imputed} imputed, ${external} external.`;
}

function formatCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function placeholderCell(
  title: string | undefined,
  a11yDescription: string | undefined,
  style: string,
  variant: 'error',
): string {
  const note = a11yDescription ?? 'Panel could not be rendered.';
  const parts: string[] = [
    `<section class="oods-panel oods-placeholder oods-placeholder-${variant}" role="img"${style}${ariaLabelAttr(note)}>`,
  ];
  if (title) {
    parts.push(`<h3 class="oods-placeholder-title">${esc(title)}</h3>`);
  }
  parts.push(`<p class="oods-placeholder-note">${esc(note)}</p>`);
  parts.push('</section>');
  return parts.join('');
}

function narrativeBlock(a11y: DashboardA11y): string[] {
  const narrative = a11y?.narrative;
  if (!narrative || (!narrative.summary && !(narrative.keyFindings && narrative.keyFindings.length))) {
    return [];
  }
  const lines: string[] = ['<section class="oods-dashboard-narrative" aria-label="Key findings">'];
  if (narrative.summary) {
    lines.push(`<p class="oods-narrative-summary">${esc(narrative.summary)}</p>`);
  }
  if (narrative.keyFindings && narrative.keyFindings.length) {
    lines.push('<ul class="oods-narrative-findings">');
    for (const finding of narrative.keyFindings) {
      lines.push(`<li>${esc(finding)}</li>`);
    }
    lines.push('</ul>');
  }
  lines.push('</section>');
  return lines;
}

function gridStyle(p: Placement): string {
  // CSS grid lines are 1-based; the resolved layout is 0-based (x/y >= 0).
  return `grid-column:${p.x + 1}/span ${p.w};grid-row:${p.y + 1}/span ${p.h}`;
}

function ariaLabelAttr(label: string | undefined): string {
  return label ? ` aria-label="${esc(label)}"` : '';
}

// Inline the resolved brand tokens as a :root custom-property block so the
// stylesheet's var(--oods-color-*, fallback) references resolve on-brand standalone.
function rootTokenBlock(tokens: Readonly<Record<string, string>>): string {
  const decls = Object.entries(tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return decls ? `:root{${decls}}` : '';
}

function styleBlock(columns: number): string {
  // Token-var defaults: m04 injects a `:root` custom-property block to drive these
  // on-brand; the fallbacks keep the export legible standalone in the meantime.
  return [
    `body{margin:0;background:var(--oods-color-bg,#ffffff)}`,
    `.oods-dashboard{font-family:var(--oods-font-sans,system-ui,-apple-system,sans-serif);color:var(--oods-color-fg,#1a1a1a);background:var(--oods-color-bg,#ffffff);margin:0;padding:16px}`,
    `.oods-dashboard-title{font-size:18px;margin:0 0 4px}`,
    `.oods-dashboard-summary{margin:0 0 12px;font-size:14px;color:var(--oods-color-muted,#555)}`,
    `.oods-dashboard-narrative{margin:0 0 12px;font-size:13px;color:var(--oods-color-muted,#555)}`,
    `.oods-dashboard-grid{display:grid;grid-template-columns:repeat(${columns},1fr);gap:12px}`,
    `@media(max-width:1024px){.oods-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.oods-dashboard-grid>.oods-panel{grid-column:1/-1!important;grid-row:auto!important;min-width:0;margin:0}.oods-dashboard-grid>.oods-kpi{grid-column:auto!important}}`,
    `.oods-panel{background:var(--oods-color-panel-bg,#ffffff);border:1px solid var(--oods-color-panel-border,#e2e2e2);border-radius:8px;padding:12px;box-sizing:border-box}`,
    `.oods-dashboard-links{grid-column:1/-1;font-size:13px}.oods-dashboard-links h2{font-size:16px}`,
    `.oods-kpi-sparkline{display:block;width:100%;max-width:200px;height:48px;color:var(--oods-color-accent)}`,
    `.oods-kpi-breach,.oods-kpi-anomaly{color:var(--oods-color-negative);font-size:13px;margin:4px 0}`,
    `.oods-kpi-title{margin:0 0 4px;font-size:13px;color:var(--oods-color-muted,#555)}`,
    `.oods-kpi-value{margin:0;font-size:28px;font-weight:600;color:var(--oods-color-accent,#1a1a1a)}`,
    `.oods-kpi-delta{margin:4px 0 0;font-size:13px}`,
    `.oods-trend-increasing{color:var(--oods-color-positive,#1a7f37)}`,
    `.oods-trend-decreasing{color:var(--oods-color-negative,#b42318)}`,
    `.oods-trend-flat{color:var(--oods-color-muted,#555)}`,
    `.oods-chart figcaption{font-size:13px;color:var(--oods-color-muted,#555);margin-bottom:8px}`,
    `.oods-chart{container-type:inline-size;margin:0;min-width:0}.oods-chart>[class^="oods-chart-size-"]>svg{display:block;max-width:100%;height:auto;margin-inline:auto}`,
    `.oods-placeholder-title{margin:0 0 4px;font-size:13px}`,
    `.oods-placeholder-note{margin:0;font-size:13px;color:var(--oods-color-muted,#555)}`,
    `.oods-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`,
  ].join('');
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}
