import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { VizDataAnalysis } from './data-analysis.js';
import { analyzeVizSpec } from './data-analysis.js';
import { formatDimension, formatValue, humanize } from './format.js';
import type { MeasureNarrativeContext } from './narrative-generator.js';

export interface AccessibleTableColumn {
  readonly field: string;
  readonly label: string;
  readonly isNumeric: boolean;
}

export interface AccessibleTableCell {
  readonly field: string;
  readonly raw: unknown;
  readonly text: string;
}

export interface AccessibleTableRow {
  readonly key: string;
  readonly cells: readonly AccessibleTableCell[];
}

export type AccessibleTableResult =
  | {
      readonly status: 'ready';
      readonly caption: string;
      readonly columns: readonly AccessibleTableColumn[];
      readonly rows: readonly AccessibleTableRow[];
      readonly analysis: VizDataAnalysis;
    }
  | {
      readonly status: 'disabled';
      readonly message: string;
      readonly analysis: VizDataAnalysis;
    }
  | {
      readonly status: 'unavailable';
      readonly message: string;
      readonly analysis: VizDataAnalysis;
    };

/**
 * A pre-built-analysis input for the input-shaped (non-cartesian) sources whose
 * data never flows through a NormalizedVizSpec (sprint-128 m01). Carries the
 * VizDataAnalysis plus the knobs the cartesian path otherwise reads off the spec
 * (column order/labels, caption, row-key prefix, fallback toggle). All optional
 * except the analysis, with the same defaults the spec path resolves to.
 */
export interface AnalysisTableInput {
  readonly analysis: VizDataAnalysis;
  /** Mirrors spec.a11y.tableFallback?.enabled — default enabled. */
  readonly tableFallbackEnabled?: boolean;
  /** Mirrors spec.portability?.tableColumnOrder. */
  readonly columnOrder?: readonly string[] | null;
  /** field → human label; mirrors the encoding/legend title resolution. */
  readonly columnLabels?: Readonly<Record<string, string>>;
  /** Mirrors resolveCaption(spec). */
  readonly caption?: string;
  /** Row-key prefix; mirrors spec.id. */
  readonly id?: string;
  /**
   * Governed-measure context (sprint-129 m01). OPTIONAL — absent === the s128 table
   * output byte-for-byte. When it carries a `unit`, the resolved caption names it so the
   * structured table is self-describing. Shares the ONE `MeasureNarrativeContext` shape
   * with the narrative input (no parallel metadata type).
   */
  readonly measureContext?: MeasureNarrativeContext;
}

interface ResolvedTableInputs {
  readonly analysis: VizDataAnalysis;
  readonly enabled: boolean;
  readonly columnOrder?: readonly string[] | null;
  readonly resolveLabel: (field: string) => string | undefined;
  readonly caption: string;
  readonly idPrefix: string;
}

/**
 * Normalize the two accepted inputs to a single shape. The spec branch is
 * byte-identical to the pre-m01 behavior (same analysis, column order, label
 * resolution, caption, id); the analysis branch supplies those from the input
 * object with the spec-path defaults.
 */
function resolveTableInputs(input: NormalizedVizSpec | AnalysisTableInput): ResolvedTableInputs {
  if ('analysis' in input) {
    return {
      analysis: input.analysis,
      enabled: input.tableFallbackEnabled !== false,
      columnOrder: input.columnOrder,
      resolveLabel: (field) => input.columnLabels?.[field],
      caption: withMeasureUnit(input.caption ?? 'Data table for Visualization', input.measureContext),
      idPrefix: input.id ?? 'viz',
    };
  }
  return {
    analysis: analyzeVizSpec(input),
    enabled: input.a11y.tableFallback?.enabled !== false,
    columnOrder: input.portability?.tableColumnOrder,
    resolveLabel: (field) => findColumnLabel(input, field),
    caption: resolveCaption(input),
    idPrefix: input.id ?? 'viz',
  };
}

export function generateAccessibleTable(input: NormalizedVizSpec | AnalysisTableInput): AccessibleTableResult {
  const { analysis, enabled, columnOrder, resolveLabel, caption, idPrefix } = resolveTableInputs(input);

  if (!enabled) {
    return {
      status: 'disabled',
      message: 'Table fallback disabled in spec.a11y.tableFallback.enabled.',
      analysis,
    };
  }

  if (analysis.rows.length === 0) {
    return {
      status: 'unavailable',
      message: 'No inline data values available to generate a table (spec.data.values is empty).',
      analysis,
    };
  }

  const columns = deriveColumns(analysis.rows, columnOrder, resolveLabel);
  if (columns.length === 0) {
    return {
      status: 'unavailable',
      message: 'Unable to derive columns from spec.portability.tableColumnOrder or data keys.',
      analysis,
    };
  }

  const rows = analysis.rows.map<AccessibleTableRow>((row, index) => ({
    key: `${idPrefix}:row:${index}`,
    cells: columns.map((column) => ({
      field: column.field,
      raw: row[column.field],
      text: formatValue(row[column.field]),
    })),
  }));

  return {
    status: 'ready',
    caption,
    columns,
    rows,
    analysis,
  };
}

function deriveColumns(
  rows: readonly Record<string, unknown>[],
  columnOrder: readonly string[] | null | undefined,
  resolveLabel: (field: string) => string | undefined,
): AccessibleTableColumn[] {
  const order = normalizeColumnOrder(columnOrder);
  const discovered = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      discovered.add(key);
    });
  });

  const orderedFields: string[] = [];
  for (const field of order) {
    if (discovered.delete(field)) {
      orderedFields.push(field);
    }
  }
  discovered.forEach((field) => {
    orderedFields.push(field);
  });

  return orderedFields.map((field) => ({
    field,
    label: resolveLabel(field) ?? humanize(field),
    isNumeric: rows.every((row) => typeof row[field] === 'number' || typeof row[field] === 'undefined'),
  }));
}

function normalizeColumnOrder(order?: readonly string[] | null): string[] {
  if (!order) {
    return [];
  }
  return order.filter((value) => typeof value === 'string' && value.trim() !== '');
}

function findColumnLabel(spec: NormalizedVizSpec, field: string): string | undefined {
  const maps = [spec.encoding, ...spec.marks.map((mark) => mark.encodings).filter(Boolean)];
  for (const encoding of maps) {
    if (!encoding) {
      continue;
    }
    for (const binding of Object.values(encoding)) {
      if (!binding || typeof binding !== 'object') {
        continue;
      }
      if (binding.field === field) {
        if (binding.title) {
          return binding.title;
        }
        const legendTitle = typeof binding.legend === 'object' ? binding.legend?.title : undefined;
        if (typeof legendTitle === 'string' && legendTitle.trim() !== '') {
          return legendTitle;
        }
      }
    }
  }
  return undefined;
}

function resolveCaption(spec: NormalizedVizSpec): string {
  if (spec.a11y.tableFallback?.caption) {
    return spec.a11y.tableFallback.caption;
  }
  const label = spec.name ?? spec.id ?? 'Visualization';
  return `Data table for ${label}`;
}

/**
 * Append the governed measure unit to a caption so the structured table is
 * self-describing (sprint-129 m01). Byte-identical when no measure unit is present.
 */
function withMeasureUnit(caption: string, ctx?: MeasureNarrativeContext): string {
  return ctx?.unit ? `${caption} (${ctx.unit})` : caption;
}

export function summarizeRow(row: Record<string, unknown>, dimensionField?: string, measureField?: string): string {
  const dimension = dimensionField ? formatDimension(row[dimensionField]) : undefined;
  const measure = measureField ? formatValue(row[measureField]) : undefined;
  if (dimension && measure) {
    return `${dimension}: ${measure}`;
  }
  if (measure) {
    return measure;
  }
  return JSON.stringify(row);
}
