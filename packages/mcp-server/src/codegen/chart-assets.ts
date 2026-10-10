import type { CodegenOptions } from './types.js';
import { chartMatchesPreview, chartNodes } from './chart-declaration.js';
import { handle as render } from '../tools/viz.render.js';
import { assertStaticSvg, billingDate, VIZ_SVG_PROPS } from '@oods/component-contracts';
import { canonicalize, sha256 } from '@oods/artifacts';
import { CURRENCY_FORMAT } from '@oods/viz-core';
import type { UiElement, UiSchema, UiSchemaSchema, VizRenderInput } from '../schemas/generated.js';
import { workflowSampleRecords } from './workflow-data-emitter.js';
import { scopedSvgIds } from '../lib/scoped-svg-ids.js';

type DeclaredBinding = UiSchemaSchema.ChartEncodingBinding | UiSchemaSchema.ChartColorEncodingBinding;

/** s223-m01 (#2527 ruling 2): a chart's record names its currency with an ISO 4217 code, read upper-case. */
function recordCurrency(record: Record<string, unknown>, field: string): string {
  const code = record[field];
  if (typeof code !== 'string' || !/^[A-Za-z]{3}$/.test(code)) throw new Error(`Chart currency field '${field}' requires an ISO 4217 code; the record has ${JSON.stringify(code ?? null)}.`);
  return code.toUpperCase();
}

/**
 * s223-m01 (#2527 ruling 5): a declared binding as viz.render takes it. A `titleField` names the record's field whose
 * text titles the axis (Usage's unit_label, "API calls"), so each record's chart names its own unit; a record without
 * that text takes the declared title, and a binding with neither fails rather than inventing one.
 */
function recordBinding(binding: DeclaredBinding, record: Record<string, unknown>): DeclaredBinding {
  if (typeof binding === 'string' || !('titleField' in binding) || binding.titleField === undefined) return binding;
  const { titleField, ...declared } = binding;
  const text = record[titleField];
  if (typeof text === 'string' && text.trim()) return { ...declared, title: text.trim() };
  if (declared.title) return declared;
  throw new Error(`Chart axis title field '${titleField}' has no text on this record, and the binding declares no title.`);
}

/**
 * Three authored sizes keep axis text at least its native size. CSS switches only once the next SVG fits,
 * and caps enlargement at 1.25x; all three remain under 320px tall, including Vega's padding.
 */
export const PLACED_CHART_SIZE = { width: 720, height: 240 } as const;
/** The same chart at the narrow size the figure switches to below PLACED_CHART_NARROW_BREAKPOINT px, so axis text keeps its size on a phone column instead of scaling with the SVG. */
export const PLACED_CHART_NARROW_SIZE = { width: 292, height: 240 } as const;
/** Figure inline size (CSS px) at and below which the figure shows the narrow render (component-styles' container query). */
export const PLACED_CHART_NARROW_BREAKPOINT = 729;
/**
 * s213-m01 (Sprint 212 review finding 5): the same chart drawn for a desktop column. The design render stopped at its
 * 720px width, half of a 1440 detail screen; the figure now fills its column and shows this render from
 * PLACED_CHART_WIDE_BREAKPOINT up, so axis text stays near design size (1x to 1.25x across the switch, as the narrow
 * render already is on a phone).
 */
export const PLACED_CHART_WIDE_SIZE = { width: 1120, height: 240 } as const;
/** Figure inline size (CSS px) at and above which the figure shows the wide render (component-styles' container query). */
export const PLACED_CHART_WIDE_BREAKPOINT = 1130;
/** Every placed chart renders without a painted title: the figure heading carries the chart's name (Sprint 202 m01). */
export const PLACED_CHART_OUTPUT = { svg: true, titlePlacement: 'figure', ...PLACED_CHART_SIZE } as const;
export const PLACED_CHART_NARROW_OUTPUT = { svg: true, titlePlacement: 'figure', ...PLACED_CHART_NARROW_SIZE } as const;
export const PLACED_CHART_WIDE_OUTPUT = { svg: true, titlePlacement: 'figure', ...PLACED_CHART_WIDE_SIZE } as const;

/**
 * s222-m02 (#2502 ruling 12, F7): every placed chart is drawn in each theme, so it follows the page's theme: the figure
 * shows the renders of the theme the nearest [data-theme] names (component-styles). Light renders are svg, svgNarrow and
 * svgWide at `<path>`; dark and hc renders are svgDark* and svgHc* at `<path>.dark.svg` and `<path>.hc.svg`.
 */
export const PLACED_CHART_THEMES = ['light', 'dark', 'hc'] as const;
export type PlacedChartTheme = (typeof PLACED_CHART_THEMES)[number];
export const themeChartPath = (path: string, theme: PlacedChartTheme): string => (theme === 'light' ? path : path.replace(/\.svg$/, `.${theme}.svg`));

/** One theme's three renders of a placed chart. */
export interface PlacedChartRenders {
  path: string;
  request: VizRenderInput;
  /** The same request at the narrow size, rendered to `<path>.narrow.svg` and shown by the figure below the breakpoint. */
  narrow: { path: string; request: VizRenderInput };
  /** The same request at the wide size, rendered to `<path>.wide.svg` and shown by the figure from the wide breakpoint up. */
  wide: { path: string; request: VizRenderInput };
}
/** A placed chart: its renders in the generation theme (what measurement certifies), and in every theme. */
export interface PlacedChartRequest extends PlacedChartRenders {
  index: number;
  recordId: string;
  source: string;
  themes: Record<PlacedChartTheme, PlacedChartRenders>;
}
export const narrowChartPath = (path: string): string => path.replace(/\.svg$/, '.narrow.svg');
export const wideChartPath = (path: string): string => path.replace(/\.svg$/, '.wide.svg');
const rendersAt = (path: string, request: VizRenderInput): PlacedChartRenders => ({
  path, request,
  narrow: { path: narrowChartPath(path), request: { ...request, output: { ...PLACED_CHART_NARROW_OUTPUT } } },
  wide: { path: wideChartPath(path), request: { ...request, output: { ...PLACED_CHART_WIDE_OUTPUT } } },
});
/** The props a theme's renders fill on the chart node (svg*, svgDark*, svgHc*). */
const themeProps = (theme: PlacedChartTheme): readonly [string, string, string] => {
  const [design, narrow, wide] = VIZ_SVG_PROPS.slice(PLACED_CHART_THEMES.indexOf(theme) * 3);
  return [design!, narrow!, wide!];
};

/**
 * The viz.render requests behind every placed chart of a schema, one per sample record, with the
 * artifact path each renders to. Generation renders them; measurement re-renders the same request
 * with the normalized spec and certifies it, so what is certified is what was placed.
 *
 * s211-m02: a standalone screen whose caller shows a seed record (design.preview's `shownSampleRecord`) draws its
 * chart from that record, so the chart and the page it sits on are the same data.
 */
export function placedChartRequests(input: UiSchema, options: Pick<CodegenOptions, 'theme' | 'brand'> = {}, shown?: Record<string, unknown>): PlacedChartRequest[] {
  if (!chartNodes(input.screens).length) return [];
  const schema = input;
  const nodes = chartNodes(schema.screens);
  for (const candidate of nodes) {
    if (!chartMatchesPreview(candidate)) throw new Error(`Chart type '${candidate.chart!.chartType}' does not match preview '${candidate.component}'.`);
  }
  const node = nodes[0]!;
  const chart = node.chart!;
  if (nodes.some(candidate => canonicalize(candidate.chart) !== canonicalize(chart)
    || candidate.props?.title !== node.props?.title || candidate.props?.description !== node.props?.description)) {
    throw new Error('Only one distinct chart declaration and presentation is supported per generated object.');
  }
  if (chart.source === 'payment-events') {
    for (const field of [...chart.dateFields, chart.amountField, chart.currencyField]) {
      if (!schema.objectSchema?.[field]) throw new Error(`Payment chart field '${field}' is absent from objectSchema.`);
    }
  } else {
    const field = schema.objectSchema?.[chart.dataField];
    if (!field) throw new Error(`Chart field '${chart.dataField}' is absent from objectSchema.`);
    if (field.type !== 'array' && !field.type.endsWith('[]')) throw new Error(`Chart field '${chart.dataField}' must be a declared array.`);
    // s223-m01: the record fields a record-array chart reads its currency and axis titles from are declared ones.
    if (chart.source === 'record-array') {
      const titleFields = Object.values(chart.encodings).flatMap(binding => typeof binding === 'object' && 'titleField' in binding && binding.titleField ? [binding.titleField] : []);
      for (const recordField of [...(chart.currencyField ? [chart.currencyField] : []), ...titleFields]) {
        if (!schema.objectSchema?.[recordField]) throw new Error(`Chart field '${recordField}' is absent from objectSchema.`);
      }
    }
  }
  const theme = options.theme ?? schema.theme ?? 'light';
  if (theme !== 'light' && theme !== 'dark' && theme !== 'hc') throw new Error(`Payment chart theme '${theme}' is not supported.`);
  const records = shown && !schema.workflow ? [shown] : workflowSampleRecords(schema);
  const requests: PlacedChartRequest[] = [];
  for (const [index, record] of records.entries()) {
    let request: VizRenderInput;
    if (chart.source === 'payment-events') {
      const history = record.payment_history ?? [];
      if (!Array.isArray(history)) throw new Error('Payment history must be an array.');
      if (history.length === 0) continue;
      const payments = history.map(payment => ({ date: payment.at, amount: payment.amount / chart.minorUnits }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (payments.some(row => !Number.isFinite(row.amount) || !Number.isFinite(Date.parse(row.date)))) {
        throw new Error('Payment chart requires a finite amount and valid payment dates.');
      }
      // s220-m01 (#2461): bars read as payments, one per recorded payment, each labelled with its date and in date order.
      // An area over a steady price filled the whole plot as one block; on a time axis a few bars sat on the plot's edges.
      const bars = chart.chartType === 'bar';
      const rows = bars ? payments.map(row => ({ payment: billingDate(row.date), amount: row.amount })) : payments;
      // s223-m01 (#2527 ruling 2): the amount axis reads in the record's currency ($12,000, €19), not plain numbers.
      const currency = recordCurrency(record, chart.currencyField);
      const amount = { field: 'amount', aggregate: 'sum', currency, format: CURRENCY_FORMAT } as const;
      request = {
        chartType: chart.chartType,
        name: String(node.props?.title ?? 'Payment amounts'),
        // s223-m01 (#2527 ruling 5): the chart's words describe the record, without unit jargon.
        description: `Payments recorded for this subscription, in ${currency}.`,
        theme,
        brand: options.brand ?? chart.brand ?? 'A',
        rows: [rows[0]!, ...rows.slice(1)],
        encodings: bars
          ? { x: { field: 'payment', type: 'ordinal', sort: 'none', title: 'Payment date' }, y: { ...amount, title: 'Amount' } }
          : { x: { field: 'date', scale: 'temporal' }, y: amount },
        output: { ...PLACED_CHART_OUTPUT },
      };
    } else if (chart.source === 'edge-array') {
      request = {
        chartType: 'force_graph', network: edgeArrayToNetwork(record[chart.dataField], chart.edges),
        name: String(node.props?.title ?? 'Connected relationships'),
        ...(typeof node.props?.description === 'string' ? { description: node.props.description } : {}),
        theme, brand: options.brand ?? chart.brand ?? 'A', output: { ...PLACED_CHART_OUTPUT },
      };
    } else {
      const rows = record[chart.dataField];
      if (!Array.isArray(rows) || !rows.length || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
        throw new Error(`Chart field '${chart.dataField}' requires non-empty object rows.`);
      }
      for (const binding of Object.values(chart.encodings)) {
        const field = typeof binding === 'string' ? binding : binding.field;
        if (rows.some(row => !Object.hasOwn(row, field))) throw new Error(`Chart encoding field '${field}' is missing from '${chart.dataField}' rows.`);
      }
      // s223-m01 (#2527 ruling 5): an axis may take its title from the record (titleField: Usage's unit_label).
      const encodings = Object.fromEntries(Object.entries(chart.encodings).map(([channel, binding]) => [channel, recordBinding(binding, record)])) as Record<string, ReturnType<typeof recordBinding>>;
      let chartRows: Array<Record<string, unknown>> = rows;
      let description = typeof node.props?.description === 'string' ? node.props.description : undefined;
      // s223-m01 (#2527 ruling 2): declared money plots major units in the record's currency, as the payment-events
      // branch does: each row's y value divided by minorUnits, the y axis formatted in the record's currency, and the
      // accessible description naming that currency. Invoice's line items read 1,080,000 minor units for $10,800.
      if (chart.minorUnits !== undefined || chart.currencyField !== undefined) {
        if (chart.minorUnits === undefined || chart.currencyField === undefined) throw new Error('A record-array chart declares money with both minorUnits and currencyField.');
        const minorUnits = chart.minorUnits;
        const currency = recordCurrency(record, chart.currencyField);
        const y = encodings.y!;
        const field = typeof y === 'string' ? y : y.field;
        chartRows = rows.map(row => {
          const value = (row as Record<string, unknown>)[field];
          if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Chart money field '${field}' requires a finite number in every '${chart.dataField}' row.`);
          return { ...row, [field]: value / minorUnits };
        });
        encodings.y = { ...(typeof y === 'string' ? { field: y } : y), currency, format: CURRENCY_FORMAT };
        description = `${description ? `${description} ` : ''}Amounts are in ${currency}.`;
      }
      request = {
        chartType: chart.chartType,
        name: String(node.props?.title ?? `${chart.chartType} chart`),
        ...(description !== undefined ? { description } : {}),
        theme,
        brand: options.brand ?? chart.brand ?? 'A',
        rows: [chartRows[0]!, ...chartRows.slice(1)],
        encodings: encodings as VizRenderInput['encodings'],
        output: { ...PLACED_CHART_OUTPUT },
      };
    }
    const id = schema.workflow ? String(record[schema.workflow.data.idField]) : 'seed';
    const path = `src/charts/${chart.source === 'payment-events' ? 'payment' : chart.chartType}-${String(index + 1).padStart(3, '0')}.svg`;
    const themes = Object.fromEntries(PLACED_CHART_THEMES.map(each => [each, rendersAt(themeChartPath(path, each), { ...request, theme: each })])) as Record<PlacedChartTheme, PlacedChartRenders>;
    requests.push({ index, recordId: id, source: chart.source, ...themes[theme as PlacedChartTheme], themes });
  }
  return requests;
}

/**
 * Render once at generation time; emitted consumers need no chart runtime. Every placed chart is rendered at the design
 * size, the narrow size and the wide size, all without a painted title (the figure heading names the chart), so the figure
 * fills its column with legible axis text at every width; and (s222-m02, F7) in the light, dark and hc themes, so it
 * follows the page's theme: nine renders.
 */
export async function prepareChartAssets(input: UiSchema, options: Pick<CodegenOptions, 'theme' | 'brand'> = {}, shown?: Record<string, unknown>): Promise<{
  schema: UiSchema;
  files: Array<{ path: string; contents: string }>;
}> {
  const requests = placedChartRequests(input, options, shown);
  if (!chartNodes(input.screens).length) return { schema: input, files: [] };
  const schema = structuredClone(input);
  const nodes = chartNodes(schema.screens);
  const chart = nodes[0]!.chart!;
  const files: Array<{ path: string; contents: string }> = [];
  // Every render prop's SVG per record (svg, svgNarrow, svgWide, then the dark and hc ones), for the workflow store.
  const byRecord: Record<string, Record<string, string>> = Object.fromEntries(VIZ_SVG_PROPS.map(prop => [prop, {}]));
  const renderStatic = async (request: VizRenderInput, scope: string): Promise<string> => {
    const result = await render(request);
    if (result.status !== 'ok' || !result.svg) throw new Error(`${chart.source === 'payment-events' ? 'Payment chart' : 'Chart'} render failed: ${JSON.stringify(result.errors)}`);
    return assertStaticSvg(scopedSvgIds(result.svg, scope));
  };
  for (const { index, recordId, themes } of requests) {
    const props: Record<string, string> = {};
    // s222-m02 (F7): each theme's three renders, light first; the light files keep their paths.
    for (const theme of PLACED_CHART_THEMES) {
      const renders = themes[theme];
      const [design, narrow, wide] = themeProps(theme);
      // The authored record key is safe in SVG/CSS even with punctuation; the ordinal distinguishes repeated ids.
      const scope = `record-${index + 1}-${sha256(recordId).slice(0, 12)}-${theme}`;
      props[design] = await renderStatic(renders.request, `${scope}-design`);
      props[narrow] = await renderStatic(renders.narrow.request, `${scope}-narrow`);
      props[wide] = await renderStatic(renders.wide.request, `${scope}-wide`);
      files.push({ path: renders.path, contents: props[design] }, { path: renders.narrow.path, contents: props[narrow] }, { path: renders.wide.path, contents: props[wide] });
    }
    if (index === 0) for (const candidate of nodes) candidate.props = { ...candidate.props, ...props, ...PLACED_CHART_SIZE };
    for (const [prop, svg] of Object.entries(props)) byRecord[prop]![recordId] = svg;
  }
  // Absence is a visible empty state, not invented payments sent to viz.render. It paints in the text colour, so one set
  // of renders serves every theme.
  if (chart.source === 'payment-events') {
    const records = shown && !schema.workflow ? [shown] : workflowSampleRecords(schema);
    // s219-m01: the empty state is one line tall at each render width. The figure takes its height from the SVG's
    // aspect ratio, so drawing it at the chart's height left a 530px blank panel on a 1440 detail screen.
    const emptySvg = ({ width }: { width: number; height: number }, height = 48): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="No recorded payments" aria-description="No payment history was supplied for this sample record."><title>No recorded payments</title><desc>No payment history was supplied for this sample record.</desc><text x="50%" y="50%" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-size="16">No recorded payments</text></svg>`;
    for (const [index, record] of records.entries()) {
      const recordId = schema.workflow ? String(record[schema.workflow.data.idField]) : 'seed';
      if (Object.hasOwn(byRecord.svg!, recordId)) continue;
      const path = `src/charts/payment-${String(index + 1).padStart(3, '0')}.svg`;
      const svg = emptySvg(PLACED_CHART_SIZE), svgNarrow = emptySvg(PLACED_CHART_NARROW_SIZE), svgWide = emptySvg(PLACED_CHART_WIDE_SIZE);
      byRecord.svg![recordId] = svg; byRecord.svgNarrow![recordId] = svgNarrow; byRecord.svgWide![recordId] = svgWide;
      files.push({ path, contents: svg }, { path: narrowChartPath(path), contents: svgNarrow }, { path: wideChartPath(path), contents: svgWide });
      if (index === 0) for (const candidate of nodes) candidate.props = { ...candidate.props, svg, svgNarrow, svgWide, ...PLACED_CHART_SIZE };
    }
  }
  if (schema.workflow) {
    // Named as workflow-data-emitter.ts imports them: svg -> chartSvgByRecord, svgDarkNarrow -> chartSvgDarkNarrowByRecord.
    const maps = VIZ_SVG_PROPS.map(prop => `export const chart${prop[0]!.toUpperCase()}${prop.slice(1)}ByRecord: Readonly<Record<string, string>> = ${JSON.stringify(byRecord[prop], null, 2)};`);
    files.push({ path: 'src/chart-assets.ts', contents: `// Static chart assets (viz.render output or a named empty state), keyed by the seed record identity: the design-size render, the narrow render the figure shows below ${PLACED_CHART_NARROW_BREAKPOINT}px and the wide render it shows from ${PLACED_CHART_WIDE_BREAKPOINT}px, in the light theme and then (Dark, Hc) the dark and high-contrast themes; the figure shows the theme its page is in. A record with no dark or hc render (an empty state) shows its one render in every theme.\n${maps.join('\n')}\n` });
  }
  return { schema, files };
}

/** Preserve authored direction/order; symmetric and repeated pairs share one link. */
export function edgeArrayToNetwork(rows: unknown, edges: Extract<NonNullable<UiElement['chart']>, { source: 'edge-array' }>['edges']): NonNullable<VizRenderInput['network']> {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Graph requires non-empty edge-array rows.');
  const ids = new Set<string>();
  const seen = new Set<string>();
  const links: Array<{ source: string; target: string }> = [];
  const append = (source: string, target: string) => {
    const key = JSON.stringify([source, target]);
    if (!seen.has(key)) { seen.add(key); links.push({ source, target }); }
  };
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Graph requires object edge rows.');
    for (const field of [edges.source, edges.target]) {
      if (!Object.hasOwn(row, field) || typeof row[field] !== 'string' || !row[field].trim()) throw new Error(`Graph edge field '${field}' requires a non-empty string id.`);
    }
    if (edges.bidirectionalField && (!Object.hasOwn(row, edges.bidirectionalField) || typeof row[edges.bidirectionalField] !== 'boolean')) throw new Error(`Graph edge field '${edges.bidirectionalField}' requires a boolean.`);
    const source = row[edges.source], target = row[edges.target];
    ids.add(source); ids.add(target); append(source, target);
    if (edges.bidirectionalField && row[edges.bidirectionalField]) append(target, source);
  }
  const nodes = [...ids].sort().map(id => ({ id }));
  return { nodes: [nodes[0]!, ...nodes.slice(1)], links };
}
