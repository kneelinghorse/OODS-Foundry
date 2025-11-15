import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { VizDataAnalysis } from './data-analysis.js';
import { analyzeVizSpec } from './data-analysis.js';
import { formatDimension, formatValue } from './format.js';

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

export function generateAccessibleTable(spec: NormalizedVizSpec): AccessibleTableResult {
  const analysis = analyzeVizSpec(spec);
  if (spec.a11y.tableFallback?.enabled === false) {
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

  const columns = deriveColumns(spec, analysis.rows);
  if (columns.length === 0) {
    return {
      status: 'unavailable',
      message: 'Unable to derive columns from spec.portability.tableColumnOrder or data keys.',
      analysis,
    };
  }

  const rows = analysis.rows.map<AccessibleTableRow>((row, index) => ({
    key: `${spec.id ?? 'viz'}:row:${index}`,
    cells: columns.map((column) => ({
      field: column.field,
      raw: row[column.field],
      text: formatValue(row[column.field]),
    })),
  }));

  const caption = resolveCaption(spec);

  return {
    status: 'ready',
    caption,
    columns,
    rows,
    analysis,
  };
}

function deriveColumns(spec: NormalizedVizSpec, rows: readonly Record<string, unknown>[]): AccessibleTableColumn[] {
  const order = normalizeColumnOrder(spec.portability?.tableColumnOrder);
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
    label: findColumnLabel(spec, field) ?? humanize(field),
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

function humanize(value: string): string {
  const withSpaces = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function resolveCaption(spec: NormalizedVizSpec): string {
  if (spec.a11y.tableFallback?.caption) {
    return spec.a11y.tableFallback.caption;
  }
  const label = spec.name ?? spec.id ?? 'Visualization';
  return `Data table for ${label}`;
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
