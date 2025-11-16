import type {
  ConcatSection,
  LayoutConcat,
  LayoutFacet,
  NormalizedVizSpec,
  SectionFilter,
} from '@/viz/spec/normalized-viz-spec.js';
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
  const { width, height, padding, ...outer } = base;
  const sizing = { width, height, padding };
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

  if (sizing.padding !== undefined && sized.padding === undefined) {
    sized.padding = sizing.padding;
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
