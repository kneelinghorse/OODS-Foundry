import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { VizDataAnalysis } from './data-analysis.js';
import { analyzeVizSpec } from './data-analysis.js';
import { formatDimension } from './format.js';
import type { AccessibleTableColumn, AccessibleTableRow } from './table-generator.js';
import { generateAccessibleTable } from './table-generator.js';

export interface FacetDimensionValue {
  readonly key: string;
  readonly label: string;
  readonly raw: unknown;
}

export interface FacetTableGroup {
  readonly key: string;
  readonly index: number;
  readonly rowValue?: FacetDimensionValue;
  readonly columnValue?: FacetDimensionValue;
  readonly title: string;
  readonly ariaLabel: string;
  readonly rows: readonly AccessibleTableRow[];
  readonly empty: boolean;
}

export interface FacetLayoutSummary {
  readonly rowField?: string;
  readonly rowLabel?: string;
  readonly columnField?: string;
  readonly columnLabel?: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly panelCount: number;
}

export type FacetTableResult =
  | {
      readonly status: 'ready';
      readonly columns: readonly AccessibleTableColumn[];
      readonly groups: readonly FacetTableGroup[];
      readonly layout: FacetLayoutSummary;
    }
  | {
      readonly status: 'disabled' | 'unavailable';
      readonly message: string;
      readonly reason: 'table-disabled' | 'table-unavailable' | 'missing-layout';
    };

const PANEL_KEY_SEPARATOR = '__@@__';

export function generateFacetTables(spec: NormalizedVizSpec): FacetTableResult {
  const table = generateAccessibleTable(spec);
  const analysis: VizDataAnalysis = table.analysis ?? analyzeVizSpec(spec);

  if (table.status === 'disabled') {
    return {
      status: 'disabled',
      message: table.message,
      reason: 'table-disabled',
    };
  }

  if (table.status === 'unavailable') {
    return {
      status: 'unavailable',
      message: table.message,
      reason: 'table-unavailable',
    };
  }

  const layout = spec.layout;
  if (!layout || layout.trait !== 'LayoutFacet') {
    return {
      status: 'unavailable',
      message: 'Spec does not declare LayoutFacet metadata, so facet tables cannot be generated.',
      reason: 'missing-layout',
    };
  }

  const rowDimension = layout.rows?.field ? collectDimensionValues(analysis.rows, layout.rows.field, layout.rows.limit) : undefined;
  const columnDimension = layout.columns?.field
    ? collectDimensionValues(analysis.rows, layout.columns.field, layout.columns.limit)
    : undefined;

  if (!rowDimension && !columnDimension) {
    return {
      status: 'unavailable',
      message: 'LayoutFacet metadata must declare at least one dimension (rows or columns).',
      reason: 'missing-layout',
    };
  }

  const rowValues = rowDimension ?? [{ key: '__row:all__', label: 'All', raw: undefined }];
  const columnValues = columnDimension ?? [{ key: '__column:all__', label: 'All', raw: undefined }];

  const templates = createPanelTemplates(rowValues, columnValues, layout.maxPanels);
  const templateMap = new Map<string, PanelTemplate>(templates.map((template) => [template.key, template]));

  table.rows.forEach((row, index) => {
    const raw = analysis.rows[index];
    if (!raw) {
      return;
    }
    const rowKey = layout.rows?.field ? encodeFacetKey(raw[layout.rows.field]) : '__row:all__';
    const columnKey = layout.columns?.field ? encodeFacetKey(raw[layout.columns.field]) : '__column:all__';
    const key = buildPanelKey(rowKey, columnKey);
    const target = templateMap.get(key);
    if (target) {
      target.rows.push(row);
    }
  });

  const groups = templates.map<FacetTableGroup>((template, index) => {
    const titleParts: string[] = [];
    if (template.rowValue && layout.rows) {
      titleParts.push(`${layout.rows.title ?? layout.rows.field}: ${template.rowValue.label}`);
    }
    if (template.columnValue && layout.columns) {
      titleParts.push(`${layout.columns.title ?? layout.columns.field}: ${template.columnValue.label}`);
    }

    const title = titleParts.join(' • ') || spec.name || spec.id || 'Facet panel';
    const ariaLabel = `${title}${template.rows.length === 0 ? ' (no data)' : ''} – Panel ${index + 1} of ${templates.length}`;

    return {
      key: template.key,
      index,
      rowValue: template.rowValue,
      columnValue: template.columnValue,
      title,
      ariaLabel,
      rows: [...template.rows],
      empty: template.rows.length === 0,
    };
  });

  return {
    status: 'ready',
    columns: table.columns,
    groups,
    layout: {
      rowField: layout.rows?.field,
      rowLabel: layout.rows?.title ?? layout.rows?.field,
      columnField: layout.columns?.field,
      columnLabel: layout.columns?.title ?? layout.columns?.field,
      rowCount: rowDimension ? rowDimension.length : 1,
      columnCount: columnDimension ? columnDimension.length : 1,
      panelCount: groups.length,
    },
  };
}

interface PanelTemplate {
  readonly key: string;
  readonly rowValue?: FacetDimensionValue;
  readonly columnValue?: FacetDimensionValue;
  readonly rows: AccessibleTableRow[];
}

function collectDimensionValues(
  rows: readonly Record<string, unknown>[],
  field: string,
  limit?: number
): FacetDimensionValue[] | undefined {
  const values: FacetDimensionValue[] = [];
  const seen = new Set<string>();
  const max = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : undefined;

  for (const row of rows) {
    const raw = row[field];
    const key = encodeFacetKey(raw);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push({
      key,
      raw,
      label: formatDimension(raw) ?? 'Unspecified',
    });
    if (max && values.length >= max) {
      break;
    }
  }

  return values.length > 0 ? values : undefined;
}

function createPanelTemplates(
  rowValues: readonly FacetDimensionValue[],
  columnValues: readonly FacetDimensionValue[],
  maxPanels?: number
): PanelTemplate[] {
  const templates: PanelTemplate[] = [];
  const allowedPanels = typeof maxPanels === 'number' && Number.isFinite(maxPanels) ? Math.max(1, Math.floor(maxPanels)) : undefined;

  for (const rowValue of rowValues) {
    for (const columnValue of columnValues) {
      const key = buildPanelKey(rowValue.key, columnValue.key);
      templates.push({
        key,
        rowValue,
        columnValue,
        rows: [],
      });
      if (allowedPanels && templates.length >= allowedPanels) {
        return templates;
      }
    }
  }

  return templates;
}

function encodeFacetKey(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return 'nan';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return 'object';
    }
  }
  return String(value);
}

function buildPanelKey(rowKey: string, columnKey: string): string {
  return `${rowKey}${PANEL_KEY_SEPARATOR}${columnKey}`;
}
