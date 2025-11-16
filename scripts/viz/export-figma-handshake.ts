import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  chartPatternsV2,
  getPatternV2ById,
  type ChartPatternV2,
} from '@/viz/patterns/chart-patterns-v2.js';

type TokenBindingValue = string | ReadonlyArray<string> | Record<string, string | ReadonlyArray<string>>;

const ASCII_REPLACEMENTS: Record<string, string> = {
  '\u00D7': 'x',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u0394': 'Delta',
  '\u2026': '...',
  '\u2013': '-',
  '\u2014': '-',
  '\u2019': '\'',
  '\u201C': '"',
  '\u201D': '"',
};

interface PrimitiveConfig {
  readonly id: string;
  readonly name: string;
  readonly figmaComponentKey: string;
  readonly figmaVariant: string;
  readonly figmaFileUrl: string;
  readonly patternId: string;
  readonly tokenBindings: Record<string, TokenBindingValue>;
  readonly componentGuidance: ReadonlyArray<string>;
  readonly datasetExample: string;
}

interface FigmaPrimitiveExport {
  readonly id: string;
  readonly name: string;
  readonly figma: {
    readonly componentKey: string;
    readonly variant: string;
    readonly fileUrl: string;
  };
  readonly pattern: {
    readonly id: string;
    readonly name: string;
    readonly chartType: ChartPatternV2['chartType'];
    readonly summary: string;
    readonly specPath: string;
    readonly heuristics: ChartPatternV2['heuristics'];
    readonly layoutProfile: ChartPatternV2['layoutProfile'];
    readonly interactionProfile: ChartPatternV2['interactionProfile'];
  };
  readonly tokenBindings: Record<string, TokenBindingValue>;
  readonly componentGuidance: ReadonlyArray<string>;
  readonly datasetExample: string;
}

const PRIMITIVES: ReadonlyArray<PrimitiveConfig> = [
  {
    id: 'viz-facet-grid',
    name: 'Viz - Facet Grid (4-up)',
    figmaComponentKey: 'FacetGrid/4up',
    figmaVariant: 'density=compact,legend=inline',
    figmaFileUrl: 'https://www.figma.com/file/OODS-Viz-Library/OODS-%E2%80%A2-Viz-Layouts?node-id=10-210',
    patternId: 'facet-small-multiples-line',
    tokenBindings: {
      seriesPalette: ['--viz-scale-categorical-01', '--viz-scale-categorical-02', '--viz-scale-categorical-03', '--viz-scale-categorical-04'],
      comparisonAccent: '--viz-scale-categorical-05',
      facetBackground: '--viz-scale-sequential-02',
      focusOutline: '--viz-size-stroke-03',
      axisStroke: '--viz-size-stroke-01',
      gutterSpacing: '--viz-margin-tight',
    },
    componentGuidance: [
      'Gutters, padding and outer frame reference var(--viz-margin-tight) to mirror Storybook Layout demos.',
      'Legends are capped at four categorical slots to stay aligned with token governance.',
      'Include per-facet captions pulled from pattern heuristics (dimensions.min/max) so designers know when to swap layouts.',
    ],
    datasetExample: 'Quarter x Segment pipeline trend (normalized per segment).',
  },
  {
    id: 'viz-layered-overlay',
    name: 'Viz - Layered Overlay (band + dual line)',
    figmaComponentKey: 'LayeredOverlay/band',
    figmaVariant: 'density=default,annotations=on',
    figmaFileUrl: 'https://www.figma.com/file/OODS-Viz-Library/OODS-%E2%80%A2-Viz-Layouts?node-id=20-410',
    patternId: 'layered-line-area',
    tokenBindings: {
      baselineSeries: '--viz-scale-diverging-pos-03',
      comparisonSeries: '--viz-scale-diverging-pos-01',
      thresholdBand: {
        fill: '--viz-scale-diverging-neutral',
        stroke: '--viz-scale-diverging-neg-01',
      },
      highlightMarker: '--viz-size-point-04',
      defaultStrokeWidth: '--viz-size-stroke-02',
      annotationStroke: '--viz-size-stroke-03',
    },
    componentGuidance: [
      'Bands reference diverging neutral fill with negative stroke to highlight breach conditions.',
      'Markers inherit var(--viz-size-point-04) for focus states and shrink to --viz-size-point-02 in dense mode.',
      'Provide text callouts for max/min per heuristics.goal to reinforce accessibility guidance.',
    ],
    datasetExample: 'ARR forecast vs plan with tolerance band.',
  },
  {
    id: 'viz-heatmap-matrix',
    name: 'Viz - Heatmap Matrix (calendar)',
    figmaComponentKey: 'HeatmapMatrix/calendar',
    figmaVariant: 'density=dense,legend=inline',
    figmaFileUrl: 'https://www.figma.com/file/OODS-Viz-Library/OODS-%E2%80%A2-Viz-Layouts?node-id=30-102',
    patternId: 'time-grid-heatmap',
    tokenBindings: {
      sequentialRamp: [
        '--viz-scale-sequential-01',
        '--viz-scale-sequential-02',
        '--viz-scale-sequential-03',
        '--viz-scale-sequential-04',
        '--viz-scale-sequential-05',
        '--viz-scale-sequential-06',
        '--viz-scale-sequential-07',
        '--viz-scale-sequential-08',
        '--viz-scale-sequential-09',
      ],
      legendStops: ['--viz-scale-sequential-02', '--viz-scale-sequential-05', '--viz-scale-sequential-08'],
      focusStroke: '--viz-size-stroke-02',
      gridGap: '--viz-margin-tight',
      axisStroke: '--viz-size-stroke-01',
    },
    componentGuidance: [
      'Sequential ramp must remain in order; designers can only adjust stop count, not hues.',
      'Legend uses three labeled stops that mirror diagnostics (min/mid/max) to keep parity with CLI + Storybook.',
      'Cells expose value labels at >= Delta L 15 to satisfy accessibility guardrails documented in docs/viz/heatmap.md.',
    ],
    datasetExample: 'Support tickets per day/hour.',
  },
];

function sanitizeText(value: string): string {
  return value.replace(/[^\x00-\x7F]/g, (char) => ASCII_REPLACEMENTS[char] ?? char);
}

function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const entries = Object.entries(source).map(([key, val]) => [key, sanitizeValue(val)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function buildPrimitive(config: PrimitiveConfig): FigmaPrimitiveExport {
  const pattern = getPatternV2ById(config.patternId);
  if (!pattern) {
    throw new Error(`Pattern ${config.patternId} not found. Available patterns: ${chartPatternsV2.length}`);
  }

  return {
    id: config.id,
    name: config.name,
    figma: {
      componentKey: config.figmaComponentKey,
      variant: config.figmaVariant,
      fileUrl: config.figmaFileUrl,
    },
    pattern: {
      id: pattern.id,
      name: pattern.name,
      chartType: pattern.chartType,
      summary: pattern.summary,
      specPath: pattern.specPath,
      heuristics: pattern.heuristics,
      layoutProfile: pattern.layoutProfile,
      interactionProfile: pattern.interactionProfile,
    },
    tokenBindings: config.tokenBindings,
    componentGuidance: config.componentGuidance,
    datasetExample: config.datasetExample,
  };
}

function main(): void {
  const primitives = PRIMITIVES.map((config) => buildPrimitive(config));
  const payload = {
    mission: 'B23.7',
    generatedAt: new Date().toISOString(),
    artifact: 'cmos/planning/figma/viz-handshake-library.json',
    library: {
      name: 'OODS - Viz Layouts',
      figmaFile: 'https://www.figma.com/file/OODS-Viz-Library/OODS-%E2%80%A2-Viz-Layouts',
      components: primitives.map((primitive) => ({
        id: primitive.id,
        name: primitive.name,
        componentKey: primitive.figma.componentKey,
        patternId: primitive.pattern.id,
      })),
    },
    primitives,
  };

  const outputLocation = path.resolve(process.cwd(), 'cmos/planning/figma/viz-handshake-library.json');
  mkdirSync(path.dirname(outputLocation), { recursive: true });
  const sanitizedPayload = sanitizeValue(payload);
  writeFileSync(outputLocation, `${JSON.stringify(sanitizedPayload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${outputLocation} (${sanitizedPayload.primitives.length} primitives)`); // eslint-disable-line no-console
}

main();
