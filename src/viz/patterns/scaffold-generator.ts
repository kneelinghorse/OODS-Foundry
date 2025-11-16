import { extractFieldBlueprint } from './pattern-field-helpers.js';
import type { LayoutStrategy } from './chart-patterns-v2.js';
import type { ChartPattern } from './index.js';
import type { LayoutRecommendationBundle } from './layout-scorer.js';
import type { InteractionBundle, InteractionScoreEntry } from './interaction-scorer.js';
import type { PatternSuggestion, SchemaIntent } from './suggest-chart.js';
import type { InteractionTrait, LayoutDefinition, NormalizedVizSpec, TraitBinding } from '@/viz/spec/normalized-viz-spec.js';

type EncodingMap = NormalizedVizSpec['encoding'];
type MarkSpec = NormalizedVizSpec['marks'][number];

export type ScaffoldFormat = 'all' | 'spec' | 'component';

export interface ScaffoldArtifacts {
  readonly spec?: string;
  readonly component?: string;
}

export interface GenerateScaffoldOptions {
  readonly suggestion: PatternSuggestion;
  readonly schema: SchemaIntent;
  readonly layout: LayoutRecommendationBundle;
  readonly interactions: InteractionBundle;
  readonly format?: ScaffoldFormat;
}

export function generateScaffold(options: GenerateScaffoldOptions): ScaffoldArtifacts {
  const { suggestion, layout, interactions, format = 'all' } = options;
  const pattern = suggestion.pattern;
  const blueprint = extractFieldBlueprint(pattern);
  const spec = buildSpec(pattern, layout, interactions, blueprint);
  const specLiteral = JSON.stringify(spec, null, 2);
  const component = buildComponentSource(pattern, spec, interactions);

  if (format === 'spec') {
    return { spec: specLiteral };
  }
  if (format === 'component') {
    return { component };
  }
  return { spec: specLiteral, component };
}

function buildSpec(
  pattern: ChartPattern,
  layout: LayoutRecommendationBundle,
  interactions: InteractionBundle,
  blueprint: ReturnType<typeof extractFieldBlueprint>,
): NormalizedVizSpec {
  const encoding = buildEncodingMap(pattern, blueprint);
  const sampleData = buildSampleData(blueprint);
  const marks = [createMark(pattern, encoding)] as [MarkSpec, ...MarkSpec[]];
  const interactionTraits = buildInteractionTraits(interactions.primary, blueprint);
  const layoutTrait = buildLayoutTrait(layout.primary.strategy, blueprint);
  const layoutFrame = layoutFrameByChartType[pattern.chartType] ?? layoutFrameByChartType.bar;

  const spec: NormalizedVizSpec = {
    $schema: 'https://oods.dev/viz-spec/v1',
    id: `scaffold:${pattern.id}`,
    name: `${pattern.name} Scaffold`,
    data: {
      values: sampleData,
    },
    marks,
    encoding,
    interactions: interactionTraits.length > 0 ? interactionTraits : undefined,
    layout: layoutTrait,
    config: {
      theme: 'brand-a',
      layout: {
        width: layoutFrame.width,
        height: layoutFrame.height,
        padding: layoutFrame.padding,
      },
    },
    a11y: {
      ariaLabel: `${pattern.name} suggestion`,
      description: pattern.summary,
      narrative: {
        summary: `Auto-generated ${pattern.chartType} scaffold optimized for ${layout.primary.strategy} layout.`,
        keyFindings: [
          layout.primary.rationale,
          interactions.primary[0]?.rationale ?? 'Interactive exploration enabled.',
        ],
      },
      tableFallback: { enabled: true, caption: `${pattern.name} data preview` },
    },
    portability: {
      fallbackType: 'table',
      tableColumnOrder: [...blueprint.dimensions, ...blueprint.measures].map((field) => field.id),
      preferredRenderer: pattern.chartType === 'heatmap' ? 'vega-lite' : 'echarts',
    },
  };

  return spec;
}

function createMark(pattern: ChartPattern, encoding: EncodingMap): MarkSpec {
  const trait = chartMarkByType[pattern.chartType] ?? 'MarkBar';
  return {
    trait,
    encodings: encoding,
  };
}

function buildEncodingMap(pattern: ChartPattern, blueprint: ReturnType<typeof extractFieldBlueprint>): EncodingMap {
  const dimensions = blueprint.dimensions;
  const measures = blueprint.measures;

  const fallbackDimension = dimensions[0]?.id ?? 'category';
  const secondaryDimension = dimensions[1]?.id ?? 'segment';
  const fallbackMeasure = measures[0]?.id ?? 'metric';

  switch (pattern.chartType) {
    case 'scatter': {
      const xField = measures[0]?.id ?? fallbackMeasure;
      const yField = measures[1]?.id ?? measures[0]?.id ?? fallbackMeasure;
      const colorField = dimensions[0]?.id;
      return {
        x: createBinding(xField, 'EncodingPositionX', 'x', { scale: 'linear' }),
        y: createBinding(yField, 'EncodingPositionY', 'y', { scale: 'linear' }),
        color: colorField ? createBinding(colorField, 'EncodingColor', 'color') : undefined,
      };
    }
    case 'heatmap': {
      const yField = dimensions[0]?.id ?? fallbackDimension;
      const xField = dimensions[1]?.id ?? secondaryDimension;
      return {
        x: createBinding(xField, 'EncodingPositionX', 'x', { scale: 'band' }),
        y: createBinding(yField, 'EncodingPositionY', 'y', { scale: 'band' }),
        color: createBinding(fallbackMeasure, 'EncodingColor', 'color', { scale: 'linear' }),
      };
    }
    case 'line':
    case 'area': {
      const xField = dimensions[0]?.id ?? fallbackDimension;
      const colorField = dimensions[1]?.id;
      return {
        x: createBinding(xField, 'EncodingPositionX', 'x', { scale: 'linear' }),
        y: createBinding(fallbackMeasure, 'EncodingPositionY', 'y', { scale: 'linear' }),
        color: colorField ? createBinding(colorField, 'EncodingColor', 'color') : undefined,
      };
    }
    case 'bar':
    default: {
      const colorField = dimensions[1]?.id;
      return {
        x: createBinding(dimensions[0]?.id ?? fallbackDimension, 'EncodingPositionX', 'x', { scale: 'band' }),
        y: createBinding(fallbackMeasure, 'EncodingPositionY', 'y', { scale: 'linear' }),
        color: colorField ? createBinding(colorField, 'EncodingColor', 'color') : undefined,
      };
    }
  }
}

function createBinding(
  field: string,
  trait: TraitBinding['trait'],
  channel?: TraitBinding['channel'],
  options?: Partial<TraitBinding>,
): TraitBinding {
  return {
    field,
    trait,
    channel,
    scale: options?.scale,
    title: options?.title,
    aggregate: options?.aggregate,
  };
}

function buildSampleData(blueprint: ReturnType<typeof extractFieldBlueprint>): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = [];
  const rowCount = Math.max(3, blueprint.dimensions.length + 1);

  for (let index = 0; index < rowCount; index += 1) {
    const row: Record<string, string | number> = {};
    blueprint.dimensions.forEach((field, dimensionIndex) => {
      const base = field.label ?? `Group ${dimensionIndex + 1}`;
      const suffix = dimensionIndex === 0 ? `${index + 1}` : String.fromCharCode(65 + index);
      row[field.id] = `${base} ${suffix}`;
    });
    if (blueprint.dimensions.length === 0) {
      row.category = `Category ${index + 1}`;
    }
    if (blueprint.dimensions.length <= 1) {
      row.segment = `Segment ${String.fromCharCode(65 + (index % 3))}`;
    }
    blueprint.measures.forEach((field, measureIndex) => {
      row[field.id] = Number((measureIndex + 1) * 10 + index * 3);
    });
    if (blueprint.measures.length === 0) {
      row.metric = 10 + index * 3;
    }
    rows.push(row);
  }

  return rows;
}

function buildLayoutTrait(strategy: LayoutStrategy, blueprint: ReturnType<typeof extractFieldBlueprint>): LayoutDefinition | undefined {
  switch (strategy) {
    case 'facet': {
      const rows = blueprint.dimensions[1];
      const columns = blueprint.dimensions[0];
      if (!rows && !columns) {
        return undefined;
      }
      return {
        trait: 'LayoutFacet',
        rows: rows ? { field: rows.id, title: rows.label } : undefined,
        columns: columns ? { field: columns.id, title: columns.label } : undefined,
        gap: 16,
        wrap: 'row',
      };
    }
    case 'layer':
      return {
        trait: 'LayoutLayer',
        sharedScales: { x: 'shared', y: 'shared', color: 'independent' },
        syncInteractions: true,
      };
    case 'concat': {
      const facetField = blueprint.dimensions[0];
      if (!facetField) {
        return undefined;
      }
      const facetValue = `${facetField.label ?? facetField.id} 1`;
      return {
        trait: 'LayoutConcat',
        direction: 'horizontal',
        sections: [
          {
            id: 'overview',
            title: 'Overview',
            description: 'High-level slice auto-filtered by viz:suggest scaffolder.',
            filters: [
              {
                field: facetField.id,
                operator: 'in',
                value: [facetValue],
              },
            ],
          },
          {
            id: 'detail',
            title: 'Detail',
            description: 'Focused slice for investigatory drilling.',
            filters: [
              {
                field: facetField.id,
                operator: 'not_in',
                value: [facetValue],
              },
            ],
          },
        ],
      };
    }
    default:
      return undefined;
  }
}

function buildInteractionTraits(
  entries: ReadonlyArray<InteractionScoreEntry>,
  blueprint: ReturnType<typeof extractFieldBlueprint>,
): InteractionTrait[] {
  const traits: InteractionTrait[] = [];
  const defaultFields = [...blueprint.dimensions, ...blueprint.measures].map((field) => field.id);
  const fallbackField = defaultFields[0] ?? 'category';
  const axisEncodings = blueprint.dimensions.length > 1 ? (['x', 'y'] as ['x', 'y']) : (['x'] as ['x']);

  entries.forEach((entry) => {
    const fields = entry.fields.length > 0 ? [...entry.fields] : [...defaultFields];
    const tupleFields = toPointFieldTuple(fields, fallbackField);
    switch (entry.kind) {
      case 'filter':
        traits.push({
          id: 'scaffold-filter',
          select: {
            type: 'interval',
            on: 'drag',
            encodings: axisEncodings,
          },
          rule: { bindTo: 'filter' },
        });
        break;
      case 'zoom':
        traits.push({
          id: 'scaffold-zoom',
          select: {
            type: 'interval',
            bind: 'scales',
            on: 'wheel',
            encodings: axisEncodings,
          },
          rule: { bindTo: 'zoom' },
        });
        break;
      case 'brush':
        traits.push({
          id: 'scaffold-brush',
          select: {
            type: 'interval',
            on: 'drag',
            encodings: axisEncodings,
          },
          rule: {
            bindTo: 'visual',
            property: 'fillOpacity',
            condition: { value: 1 },
            else: { value: 0.35 },
          },
        });
        break;
      case 'details':
        traits.push({
          id: 'scaffold-details',
          select: {
            type: 'point',
            on: 'hover',
            fields: tupleFields,
          },
          rule: {
            bindTo: 'visual',
            property: 'strokeWidth',
            condition: { value: 2 },
            else: { value: 0 },
          },
        });
        break;
      case 'tooltip':
      default:
        traits.push({
          id: 'scaffold-tooltip',
          select: {
            type: 'point',
            on: 'hover',
            fields: tupleFields,
          },
          rule: {
            bindTo: 'tooltip',
            fields: tupleFields,
          },
        });
        break;
    }
  });

  return traits;
}

function toPointFieldTuple(values: ReadonlyArray<string>, fallback: string): [string, ...string[]] {
  if (values.length === 0) {
    return [fallback];
  }
  const [first, ...rest] = values;
  return [first, ...rest];
}

function buildComponentSource(
  pattern: ChartPattern,
  spec: NormalizedVizSpec,
  interactions: InteractionBundle,
): string {
  const componentMeta = componentByChartType[pattern.chartType] ?? componentByChartType.bar;
  const componentName = toComponentName(pattern.name);
  const hookPlan = prepareHookPlan(interactions.primary);
  const imports = buildImportBlock(componentMeta.component, hookPlan.requiredHooks);
  const hookImports = imports
    .map((statement) => {
      const path = hookImportPaths.get(statement);
      return path ? `import { ${statement} } from '${path}';` : '';
    })
    .filter((line) => line.length > 0)
    .join('\n');

  const fieldConstants = hookPlan.fieldConstants
    .map((constant) => `const ${constant.name} = ${formatStringArray(constant.values)} as const;`)
    .join('\n');

  const specLiteral = JSON.stringify(spec, null, 2);

  const hookDeclarations = hookPlan.hooks
    .map((hook) => {
      if (hook.fieldConstant) {
        return `  const ${hook.variable} = ${hook.hook}({ fields: ${hook.fieldConstant} });`;
      }
      return `  const ${hook.variable} = ${hook.hook}();`;
    })
    .join('\n');

  const interactionArray =
    hookPlan.hooks.length > 0
      ? `const interactions = useMemo(
    () => [${hookPlan.hooks.map((hook) => hook.variable).join(', ')}],
    [${hookPlan.hooks.map((hook) => hook.variable).join(', ')}]
  );`
      : `const interactions = useMemo(() => BASE_SPEC.interactions ?? [], []);`;

  return `import { useMemo, type JSX } from 'react';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import { ${componentMeta.component} } from '${componentMeta.importPath}';
${hookImports ? `${hookImports}\n` : ''}

${fieldConstants ? `${fieldConstants}\n` : ''}const BASE_SPEC = ${specLiteral} as NormalizedVizSpec;

export interface ${componentName}Props {
  readonly data?: ReadonlyArray<Record<string, string | number>>;
}

export function ${componentName}({ data = BASE_SPEC.data.values ?? [] }: ${componentName}Props): JSX.Element {
${hookDeclarations ? `${hookDeclarations}\n` : ''}  ${interactionArray}

  const spec = useMemo<NormalizedVizSpec>(
    () => ({
      ...BASE_SPEC,
      data: { ...BASE_SPEC.data, values: data.length > 0 ? data : BASE_SPEC.data.values },
      interactions,
    }),
    [data, interactions]
  );

  return <${componentMeta.component} spec={spec} />;
}
`;
}

function prepareHookPlan(entries: ReadonlyArray<InteractionScoreEntry>) {
  const requiredHooks = new Set<string>();
  const hooks: Array<{ hook: string; variable: string; fieldConstant?: string }> = [];
  const fieldConstants: Array<{ name: string; values: ReadonlyArray<string> }> = [];
  let fieldIndex = 1;

  entries.slice(0, 3).forEach((entry) => {
    entry.hooks.forEach((hookName) => {
      const hook = hookName;
      requiredHooks.add(hook);
      const variable = `${entry.kind}${capitalize(hook.replace('use', ''))}Interaction`;
      let fieldConstant: string | undefined;
      if ((hook === 'useTooltip' || hook === 'useHighlight') && entry.fields.length > 0) {
        fieldConstant = `${hook.replace('use', '').toUpperCase()}_${fieldIndex}_FIELDS`;
        fieldConstants.push({ name: fieldConstant, values: [...entry.fields] });
        fieldIndex += 1;
      }
      hooks.push({ hook, variable, fieldConstant });
    });
  });

  return { requiredHooks, hooks, fieldConstants };
}

function buildImportBlock(_: string, hooks: ReadonlySet<string>): string[] {
  const statements: string[] = [];
  hooks.forEach((hook) => {
    statements.push(`${hook}`);
  });
  return statements;
}

function formatStringArray(values: ReadonlyArray<string>): string {
  if (values.length === 0) {
    return '[]';
  }
  return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

function toComponentName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!normalized) {
    return 'VizSuggestScaffold';
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join('')
    .concat('Scaffold');
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const chartMarkByType: Record<ChartPattern['chartType'], MarkSpec['trait']> = {
  bar: 'MarkBar',
  line: 'MarkLine',
  area: 'MarkArea',
  scatter: 'MarkPoint',
  heatmap: 'MarkRect',
};

const layoutFrameByChartType: Record<ChartPattern['chartType'], { width: number; height: number; padding: number }> = {
  bar: { width: 720, height: 400, padding: 24 },
  line: { width: 720, height: 360, padding: 24 },
  area: { width: 720, height: 360, padding: 24 },
  scatter: { width: 720, height: 420, padding: 24 },
  heatmap: { width: 720, height: 420, padding: 24 },
};

const componentByChartType: Record<
  ChartPattern['chartType'],
  { component: string; importPath: string }
> = {
  bar: { component: 'BarChart', importPath: '@/components/viz/BarChart.js' },
  line: { component: 'LineChart', importPath: '@/components/viz/LineChart.js' },
  area: { component: 'AreaChart', importPath: '@/components/viz/AreaChart.js' },
  scatter: { component: 'ScatterChart', importPath: '@/components/viz/ScatterChart.js' },
  heatmap: { component: 'Heatmap', importPath: '@/components/viz/Heatmap.js' },
};

const hookImportPaths = new Map<string, string>([
  ['useFilter', '@/viz/hooks/useFilter.js'],
  ['useBrush', '@/viz/hooks/useBrush.js'],
  ['useZoom', '@/viz/hooks/useZoom.js'],
  ['useTooltip', '@/viz/hooks/useTooltip.js'],
  ['useHighlight', '@/viz/hooks/useHighlight.js'],
]);
