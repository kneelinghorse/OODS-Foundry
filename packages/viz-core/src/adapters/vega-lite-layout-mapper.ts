import type {
  ConcatSection,
  LayoutConcat,
  LayoutFacet,
  NormalizedVizSpec,
  SectionFilter,
} from '../spec/normalized-viz-spec.js';
import { asVegaLiteResolve, resolveScaleBindings } from './scale-resolver.js';
import type { BaseAdapterSpec, VegaLiteAdapterSpec } from './vega-lite-adapter.js';

type PrimitiveSpec = Record<string, unknown>;

interface BaseSpecFragments {
  readonly base: BaseAdapterSpec;
  readonly primitive: PrimitiveSpec;
}

export function buildVegaLiteSpec(
  spec: NormalizedVizSpec,
  fragments: BaseSpecFragments
): VegaLiteAdapterSpec {
  const layout = spec.layout;
  const { base, primitive } = fragments;
  const { width, height, ...outer } = base;
  const sizing = { width, height };
  const baseOuter = outer as BaseAdapterSpec;

  if (!layout) {
    return {
      ...baseOuter,
      ...primitive,
      ...omitUndefined(sizing),
    } as unknown as VegaLiteAdapterSpec;
  }

  const clonedPrimitive = withSizing(clonePrimitive(primitive), sizing);
  const resolve = asVegaLiteResolve(resolveScaleBindings(layout));

  if (layout.trait === 'LayoutFacet') {
    return buildFacetSpec(baseOuter, clonedPrimitive, layout, resolve);
  }

  if (layout.trait === 'LayoutConcat') {
    return buildConcatSpec(baseOuter, clonedPrimitive, layout, resolve);
  }

  if (layout.trait === 'LayoutLayer') {
    return {
      ...baseOuter,
      ...clonedPrimitive,
      resolve,
    } as unknown as VegaLiteAdapterSpec;
  }

  return {
    ...baseOuter,
    ...clonedPrimitive,
    resolve,
  } as unknown as VegaLiteAdapterSpec;
}

function buildFacetSpec(
  outer: BaseAdapterSpec,
  primitive: PrimitiveSpec,
  layout: LayoutFacet,
  resolve?: { scale: Record<string, 'shared' | 'independent'> }
): VegaLiteAdapterSpec {
  const facet: Record<string, unknown> = {};
  const values = outer.data?.values as Array<Record<string, unknown>> | undefined;
  const fields = [layout.rows, layout.columns].filter((field): field is NonNullable<typeof field> => Boolean(field?.field));
  if (values && fields.length && (layout.wrap || layout.rows?.field === layout.columns?.field)) {
    const uniqueFields = fields.filter((field, index) => fields.findIndex(other => other.field === field.field) === index);
    const allowed = uniqueFields.map(field => {
      const entries = [...new Set(values.map(row => row[field.field]))];
      if (field.sort === 'ascending' || field.sort === 'descending') entries.sort((a, b) => String(a).localeCompare(String(b)) * (field.sort === 'descending' ? -1 : 1));
      return entries.slice(0, field.limit ?? entries.length);
    });
    const key = (row: Record<string, unknown>) => JSON.stringify(uniqueFields.map(field => row[field.field]));
    const eligible = values.filter(row => uniqueFields.every((field, index) => allowed[index].includes(row[field.field])));
    const panelKeys = [...new Set(eligible.map(key))].slice(0, layout.maxPanels ?? Infinity);
    const panelSet = new Set(panelKeys);
    let facetKey = '__oods_facet';
    while (values.some(row => Object.hasOwn(row, facetKey))) facetKey += '_';
    const labels = new Map(panelKeys.map(tuple => [tuple, (JSON.parse(tuple) as unknown[]).join(' / ')]));
    const rows = eligible.filter(row => panelSet.has(key(row))).map(row => {
      const tuple = key(row), label = labels.get(tuple)!;
      const duplicates = [...labels.values()].filter(value => value === label).length;
      return { ...row, [facetKey]: duplicates > 1 ? `${label} (${tuple})` : label };
    });
    const columns = Math.max(1, Math.min(panelKeys.length, layout.columns?.limit ?? Math.ceil(Math.sqrt(panelKeys.length))));
    const gap = layout.gap ?? 16;
    const totalWidth = typeof primitive.width === 'number' ? primitive.width : undefined;
    const totalHeight = typeof primitive.height === 'number' ? primitive.height : undefined;
    const panelRows = Math.max(1, Math.ceil(panelKeys.length / columns));
    return omitUndefined({
      ...outer,
      data: { ...outer.data, values: rows },
      config: { ...outer.config, axisX: { ...(outer.config?.axisX as Record<string, unknown> | undefined), labelOverlap: true } },
      facet: { field: facetKey, type: 'nominal', title: uniqueFields.map(field => field.title ?? field.field).join(' / '), sort: [...new Set(rows.map(row => row[facetKey]))] },
      columns,
      spec: { ...primitive, ...(totalWidth ? { width: Math.max(1, (totalWidth - gap * (columns - 1)) / columns) } : {}), ...(totalHeight ? { height: Math.max(1, (totalHeight - gap * (panelRows - 1)) / panelRows) } : {}) },
      spacing: gap,
      resolve,
    }) as unknown as VegaLiteAdapterSpec;
  }

  const row = convertFacetField(layout.rows);
  const column = convertFacetField(layout.columns);

  if (row) {
    facet.row = row;
  }

  if (column) {
    facet.column = column;
  }

  return omitUndefined({
    ...outer,
    facet,
    spec: primitive,
    spacing: layout.gap,
    resolve,
  }) as unknown as VegaLiteAdapterSpec;
}

function buildConcatSpec(
  outer: BaseAdapterSpec,
  primitive: PrimitiveSpec,
  layout: LayoutConcat,
  resolve?: { scale: Record<string, 'shared' | 'independent'> }
): VegaLiteAdapterSpec {
  const direction = layout.direction ?? 'horizontal';
  const containerKey = direction === 'vertical' ? 'vconcat' : direction === 'grid' ? 'concat' : 'hconcat';
  const sections = layout.sections ?? [];
  const sizedSections = sections.map((section) => createSectionSpec(section, primitive));

  const spec: Record<string, unknown> = {
    ...outer,
    [containerKey]: sizedSections,
    spacing: layout.gap,
    resolve,
  };

  if (direction === 'grid') {
    spec.columns = Math.ceil(Math.sqrt(sections.length));
  }

  return omitUndefined(spec) as unknown as VegaLiteAdapterSpec;
}

function createSectionSpec(section: ConcatSection, primitive: PrimitiveSpec): Record<string, unknown> {
  const cloned = clonePrimitive(primitive);
  const filters = buildFilterTransforms(section.filters);

  if (filters.length > 0) {
    cloned.transform = filters;
  }

  if (section.title) {
    cloned.title = section.title;
  }

  if (section.description) {
    cloned.description = section.description;
  }

  return omitUndefined(cloned);
}

function convertFacetField(field?: LayoutFacet['rows']): Record<string, unknown> | undefined {
  if (!field?.field) {
    return undefined;
  }

  return omitUndefined({
    field: field.field,
    sort: field.sort,
    title: field.title,
  });
}

function buildFilterTransforms(filters?: SectionFilter[]): Record<string, unknown>[] {
  if (!filters || filters.length === 0) {
    return [];
  }

  return filters.map((filter) => ({
    filter: buildFilterExpression(filter),
  }));
}

function buildFilterExpression(filter: SectionFilter): string {
  const left = `datum["${filter.field}"]`;
  const value = formatFilterValue(filter.value);

  switch (filter.operator) {
    case '==':
      return `${left} === ${value}`;
    case '!=':
      return `${left} !== ${value}`;
    case '>':
      return `${left} > ${value}`;
    case '>=':
      return `${left} >= ${value}`;
    case '<':
      return `${left} < ${value}`;
    case '<=':
      return `${left} <= ${value}`;
    case 'in':
      return `${value}.includes(${left})`;
    case 'not_in':
      return `!${value}.includes(${left})`;
    default:
      return `${left} === ${value}`;
  }
}

function formatFilterValue(value: SectionFilter['value']): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
}

function withSizing(node: PrimitiveSpec, sizing: Record<string, unknown>): PrimitiveSpec {
  const sized: PrimitiveSpec = { ...node };

  if (sizing.width !== undefined && sized.width === undefined) {
    sized.width = sizing.width;
  }

  if (sizing.height !== undefined && sized.height === undefined) {
    sized.height = sizing.height;
  }

  return sized;
}

function clonePrimitive(input: PrimitiveSpec): PrimitiveSpec {
  const cloned: PrimitiveSpec = { ...input };
  const layers = cloned.layer;

  if (Array.isArray(layers)) {
    cloned.layer = layers.map((layer) =>
      typeof layer === 'object' && layer !== null ? { ...(layer as Record<string, unknown>) } : layer
    );
  }

  return cloned;
}

function omitUndefined<T extends object>(input: T): T {
  const entries = Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
}
