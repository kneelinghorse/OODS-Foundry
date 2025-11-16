import type {
  LayoutConcat,
  LayoutDefinition,
  LayoutFacet,
  NormalizedVizSpec,
  SectionFilter,
} from '@/viz/spec/normalized-viz-spec.js';
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

  const rowValues = collectFacetValues(rows, layout.rows?.field, layout.rows?.limit);
  const columnValues = collectFacetValues(rows, layout.columns?.field, layout.columns?.limit);

  const panels = buildFacetPanels(layout, baseDataset.id, rowValues, columnValues);

  if (panels.length === 0) {
    return option;
  }

  return applyPanelMapping(option, panels, layout, spec);
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

  return filters.map((filter) => ({
    type: 'filter',
    config: {
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
    },
  }));
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
