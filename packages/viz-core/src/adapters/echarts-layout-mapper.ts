import type {
  LayoutConcat,
  LayoutDefinition,
  LayoutFacet,
  NormalizedVizSpec,
  SectionFilter,
} from '../spec/normalized-viz-spec.js';
import { asEChartsScaleFlags, resolveScaleBindings } from './scale-resolver.js';
import type {
  EChartsAxis,
  EChartsDataset,
  EChartsDatasetTransform,
  EChartsGrid,
  EChartsOption,
  EChartsSeries,
  LayoutRuntimeMetadata,
} from './echarts-adapter.js';

interface PanelDescriptor {
  readonly datasetId: string;
  readonly filters: SectionFilter[];
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly label: string;
}

export function applyEChartsLayout(spec: NormalizedVizSpec, option: EChartsOption): EChartsOption {
  const layout = spec.layout;

  if (!layout) {
    return option;
  }

  if (layout.trait === 'LayoutFacet') {
    return mapFacetLayout(spec, layout, option);
  }

  if (layout.trait === 'LayoutConcat') {
    return mapConcatLayout(spec, layout, option);
  }

  return annotateLayoutMetadata(option, layout);
}

function mapFacetLayout(spec: NormalizedVizSpec, layout: LayoutFacet, option: EChartsOption): EChartsOption {
  const rows = Array.isArray(spec.data.values) ? spec.data.values : undefined;
  const baseDataset = getBaseDataset(option.dataset);

  if (!rows || !baseDataset) {
    return annotateLayoutMetadata(option, layout, undefined, spec);
  }

  const panels = computeFacetPanels(rows, layout, baseDataset.id);

  if (panels.length === 0) {
    return option;
  }

  return applyPanelMapping(option, panels, layout, spec);
}

// s161 m5: THE ONE facet-panel derivation — collectFacetValues (limit-aware) × buildFacetPanels
// (maxPanels-aware), shared by mapFacetLayout (which builds the rendered ECharts datasets) AND
// facetRenderedCellFilter (which the visualMap uses to span only the RENDERED cells). One function
// so the two can never disagree on which panels/cells the ECharts render actually draws.
function computeFacetPanels(
  rows: readonly Record<string, unknown>[],
  layout: LayoutFacet,
  baseDatasetId: string
): PanelDescriptor[] {
  const rowValues = collectFacetValues(rows, layout.rows?.field, layout.rows?.limit);
  const columnValues = collectFacetValues(rows, layout.columns?.field, layout.columns?.limit);
  return buildFacetPanels(layout, baseDatasetId, rowValues, columnValues);
}

// s161 m5 (Fork-4=A): a predicate `(cell) => is-this-cell-in-a-RENDERED-panel`. A faceted ECharts
// heatmap truncates panels (layout.columns.limit / layout.maxPanels), so a cell whose facet value
// falls outside the rendered panels is drawn on NO panel. The visualMap must not legend its value
// (the s160 review's facet-limit phantom). Returns undefined for a non-faceted spec (no filtering).
// The shared a11y narrative stays at the full-data extremum — honest for the Vega-PRIMARY render,
// which draws every panel (convertFacetField ignores limit). Only ever needs '==' matching:
// buildFacetPanels emits equality filters exclusively.
export function facetRenderedCellFilter(
  spec: NormalizedVizSpec
): ((cell: Record<string, unknown>) => boolean) | undefined {
  const layout = spec.layout;
  if (!layout || layout.trait !== 'LayoutFacet') {
    return undefined;
  }
  const rows = Array.isArray(spec.data.values) ? spec.data.values : [];
  const panels = computeFacetPanels(rows, layout, '__visualmap__');
  if (panels.length === 0) {
    return undefined;
  }
  return (cell) => panels.some((panel) => panel.filters.every((filter) => matchesFacetEquality(cell, filter)));
}

// Facet panels carry only '==' equality filters (buildFacetPanels). Compare via String to match
// collectFacetValues' key semantics. Any other operator (concat-style) → don't exclude (fail-safe
// to the full, Vega-honest extent — the pre-s161 behaviour, disclosed by m5's facet scope).
function matchesFacetEquality(cell: Record<string, unknown>, filter: SectionFilter): boolean {
  if (filter.operator !== '==') {
    return true;
  }
  return String(cell[filter.field]) === String(filter.value);
}

function mapConcatLayout(spec: NormalizedVizSpec, layout: LayoutConcat, option: EChartsOption): EChartsOption {
  const baseDataset = getBaseDataset(option.dataset);

  if (!baseDataset) {
    return annotateLayoutMetadata(option, layout, undefined, spec);
  }

  const sections = layout.sections ?? [];
  const panels = sections.map((section, index) => ({
    datasetId: `${baseDataset.id}:concat:${section.id}`,
    filters: section.filters ?? [],
    rowIndex: deriveConcatRowIndex(layout.direction, index, sections.length),
    columnIndex: deriveConcatColumnIndex(layout.direction, index, sections.length),
    label: section.title ?? section.id,
  }));

  if (panels.length === 0) {
    return option;
  }

  return applyPanelMapping(option, panels, layout, spec);
}

function applyPanelMapping(
  option: EChartsOption,
  panels: PanelDescriptor[],
  layout: LayoutDefinition,
  spec: NormalizedVizSpec
): EChartsOption {
  const baseDataset = getBaseDataset(option.dataset);
  if (!baseDataset) {
    return option;
  }

  const derivedDatasets: EChartsDataset[] = panels.map((panel) => ({
    id: panel.datasetId,
    fromDatasetId: baseDataset.id,
    transform: buildDatasetTransforms(panel.filters),
  }));

  const baseSeries = option.series ?? [];
  const expandedSeries = expandSeries(baseSeries, panels);

  const { grid, xAxis, yAxis } = buildGridAndAxes(option, panels);

  const updated: EChartsOption = {
    ...option,
    dataset: [...option.dataset, ...derivedDatasets] as readonly EChartsDataset[],
    series: expandedSeries as readonly EChartsSeries[],
    grid: grid as readonly EChartsGrid[],
    xAxis,
    yAxis,
  };

  return annotateLayoutMetadata(updated, layout, panels.length, spec);
}

function expandSeries(series: readonly EChartsSeries[], panels: PanelDescriptor[]): EChartsSeries[] {
  const clones: EChartsSeries[] = [];

  panels.forEach((panel, panelIndex) => {
    series.forEach((entry) => {
      clones.push({
        ...entry,
        datasetId: panel.datasetId,
        // ECharts groups stacks across series globally, even on different axes.
        stack: entry.stack ? `${entry.stack}::${panel.datasetId}` : undefined,
        xAxisIndex: panelIndex,
        yAxisIndex: panelIndex,
        name: entry.name ? `${entry.name} (${panel.label})` : panel.label,
        id: entry.id ? `${entry.id}::${panel.label}` : undefined,
      });
    });
  });

  return clones;
}

function buildGridAndAxes(
  option: EChartsOption,
  panels: PanelDescriptor[]
): { grid: readonly EChartsGrid[]; xAxis: readonly EChartsAxis[]; yAxis: readonly EChartsAxis[] } {
  const baseXAxis = normalizeAxis(option.xAxis, 'x');
  const baseYAxis = normalizeAxis(option.yAxis, 'y');
  const gridRows = Math.max(...panels.map((panel) => panel.rowIndex)) + 1;
  const gridCols = Math.max(...panels.map((panel) => panel.columnIndex)) + 1;

  const grids = panels.map((panel) => createGrid(panel.rowIndex, panel.columnIndex, gridRows, gridCols, option.grid));

  const xAxes = panels.map((_, index) => ({
    ...baseXAxis,
    gridIndex: index,
  }));

  const yAxes = panels.map((_, index) => ({
    ...baseYAxis,
    gridIndex: index,
  }));

  return { grid: grids, xAxis: xAxes, yAxis: yAxes };
}

function createGrid(
  rowIndex: number,
  columnIndex: number,
  totalRows: number,
  totalColumns: number,
  existing?: EChartsGrid | readonly EChartsGrid[]
): EChartsGrid {
  const template = Array.isArray(existing) ? existing[0] : existing;
  const width = 100 / totalColumns;
  const height = 100 / totalRows;

  return {
    containLabel: true,
    ...template,
    left: `${columnIndex * width}%`,
    top: `${rowIndex * height}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

function buildDatasetTransforms(filters: SectionFilter[]): readonly EChartsDatasetTransform[] | undefined {
  if (filters.length === 0) {
    return undefined;
  }

  return filters.map((filter) => {
    const dimension = filter.field;
    let config: Record<string, unknown>;
    if (filter.operator === 'in' || filter.operator === 'not_in') {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      const membership = values.length ? { or: values.map((value) => ({ dimension, eq: value })) } : { and: [false] };
      config = filter.operator === 'not_in' ? { not: membership } : membership;
    } else {
      const operator = filter.operator === '==' ? 'eq' : filter.operator === '!=' ? 'ne' : filter.operator;
      config = { dimension, [operator]: filter.value };
    }
    return { type: 'filter', config };
  });
}

function getBaseDataset(datasets?: readonly EChartsDataset[]): EChartsDataset | undefined {
  const [first] = datasets ?? [];
  return first && first.id ? first : undefined;
}

function collectFacetValues(
  rows: readonly Record<string, unknown>[],
  field?: string,
  limit?: number
): readonly (string | number | boolean)[] {
  if (!field) {
    return ['__single__'];
  }

  const values: Array<string | number | boolean> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const value = row[field];

    if (value === undefined || value === null) {
      continue;
    }

    const key = String(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(value as string | number | boolean);

    if (limit && values.length >= limit) {
      break;
    }
  }

  return values.length > 0 ? values : ['__single__'];
}

function buildFacetPanels(
  layout: LayoutFacet,
  baseDatasetId: string,
  rowValues: readonly (string | number | boolean)[],
  columnValues: readonly (string | number | boolean)[]
): PanelDescriptor[] {
  const panels: PanelDescriptor[] = [];
  const maxPanels = layout.maxPanels && layout.maxPanels > 0 ? layout.maxPanels : undefined;

  for (let rowIndex = 0; rowIndex < Math.max(rowValues.length, 1); rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < Math.max(columnValues.length, 1); columnIndex += 1) {
      const rowValue = rowValues[rowIndex];
      const columnValue = columnValues[columnIndex];
      const filters: SectionFilter[] = [];

      if (layout.rows?.field && rowValue !== undefined) {
        filters.push({ field: layout.rows.field, operator: '==', value: rowValue });
      }

      if (layout.columns?.field && columnValue !== undefined) {
        filters.push({ field: layout.columns.field, operator: '==', value: columnValue });
      }

      panels.push({
        datasetId: `${baseDatasetId}:facet:${panels.length + 1}`,
        filters,
        rowIndex,
        columnIndex,
        label: [rowValue, columnValue].filter(Boolean).join(' · ') || `panel-${panels.length + 1}`,
      });

      if (maxPanels && panels.length >= maxPanels) {
        return panels;
      }
    }
  }

  return panels;
}

function deriveConcatRowIndex(direction: LayoutConcat['direction'], index: number, total: number): number {
  if (direction === 'vertical') {
    return index;
  }

  if (direction === 'grid') {
    const columns = Math.ceil(Math.sqrt(total));
    return Math.floor(index / columns);
  }

  return 0;
}

function deriveConcatColumnIndex(direction: LayoutConcat['direction'], index: number, total: number): number {
  if (direction === 'vertical') {
    return 0;
  }

  if (direction === 'grid') {
    const columns = Math.ceil(Math.sqrt(total));
    return index % columns;
  }

  return index;
}

function annotateLayoutMetadata(
  option: EChartsOption,
  layout: LayoutDefinition,
  panelCount?: number,
  spec?: NormalizedVizSpec
): EChartsOption {
  const baseUserMeta = option.usermeta?.oods;
  if (!baseUserMeta) {
    return option;
  }

  const scales = resolveScaleBindings(layout);
  const flags = asEChartsScaleFlags(scales);
  const runtimeMetadata: LayoutRuntimeMetadata = {
    trait: layout.trait,
    panelCount,
    sharedScales: scales,
    shareX: flags.shareX,
    shareY: flags.shareY,
    shareColor: flags.shareColor,
    projection: layout.projection ?? spec?.layout?.projection,
  };

  const updatedUserMeta = {
    oods: {
      ...baseUserMeta,
      layoutRuntime: runtimeMetadata,
    },
  };

  return {
    ...option,
    usermeta: updatedUserMeta,
  };
}

function normalizeAxis(axis: EChartsOption['xAxis'], fallback: 'x' | 'y'): EChartsAxis {
  if (isAxisCollection(axis)) {
    const [first] = axis;
    if (first) {
      return first;
    }
  }

  if (axis && !isAxisCollection(axis)) {
    return axis;
  }

  if (fallback === 'x') {
    return {
      type: 'category',
      boundaryGap: true,
    };
  }

  return {
    type: 'value',
  };
}

function isAxisCollection(axis: EChartsOption['xAxis']): axis is readonly EChartsAxis[] {
  return Array.isArray(axis);
}
