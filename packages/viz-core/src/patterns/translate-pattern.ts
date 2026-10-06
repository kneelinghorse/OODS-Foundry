import { humanize } from '../a11y/format.js';
import sources from './viz-pattern-sources.v1.json' with { type: 'json' };
import { assertNormalizedVizSpec, type EncodingMap, type NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { BuildVizSpecInput, EncodingChannel, EncodingInput } from '../builder/spec-builder.js';
import type { ChartType } from './index.js';

export interface VizPatternSource {
  readonly id: string;
  readonly specPath: string;
  readonly specSha256: string;
  readonly baseChartType: ChartType;
  readonly portability?: NormalizedVizSpec['portability'];
  readonly spec: NormalizedVizSpec;
}

/** Generated from authored bytes; bundled by tsup with no repository-path reads. */
export const VIZ_PATTERN_SOURCES: ReadonlyArray<VizPatternSource> = sources as unknown as VizPatternSource[];

export interface PatternPresentation {
  readonly config?: NormalizedVizSpec['config'];
  readonly a11y: NormalizedVizSpec['a11y'];
  readonly portability?: NormalizedVizSpec['portability'];
  readonly encodings: EncodingMap;
  readonly markOptions?: NormalizedVizSpec['marks'][number]['options'];
}

export const RETIRED_VIZ_PATTERNS: Readonly<Record<string, string>> = {
  'pattern:viz:linked-brush-scatter': 'Drag brushing has no keyboard-equivalent interaction and duplicates correlation-scatter; use pattern:viz:correlation-scatter.',
};

export type PatternTranslation =
  | { readonly status: 'scene'; readonly baseChartType: ChartType; readonly spec: NormalizedVizSpec }
  | { readonly status: 'retired'; readonly baseChartType: ChartType; readonly reasons: ReadonlyArray<string> }
  | { readonly status: 'renderable'; readonly baseChartType: ChartType; readonly explicitInput: BuildVizSpecInput; readonly presentation: PatternPresentation }
  | { readonly status: 'authoring-only'; readonly baseChartType: ChartType; readonly reasons: ReadonlyArray<string> };

export class PatternTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatternTranslationError';
  }
}

const MARK_TYPES: Readonly<Record<string, ChartType>> = {
  MarkBar: 'bar', MarkLine: 'line', MarkArea: 'area', MarkPoint: 'scatter', MarkRect: 'heatmap',
};
const CHANNELS: ReadonlyArray<EncodingChannel> = ['x', 'y', 'color', 'size', 'shape', 'detail'];
const INPUT_BINDING_KEYS = ['field', 'aggregate', 'scale', 'timeUnit', 'sort', 'title', 'type', 'range'] as const;
// These authored option keys have existing Vega-Lite translations. Unknown keys
// remain authoring-only instead of inheriting the adapter's silent option drop.
const MARK_OPTIONS = new Set(['orientation', 'baseline', 'curve', 'opacity', 'fillOpacity', 'strokeWidth', 'strokeDash']);

/** Translate the single-scene public subset; never flatten a richer source to its first mark. */
export function translatePattern(input: NormalizedVizSpec | string): PatternTranslation {
  const record = VIZ_PATTERN_SOURCES.find(source => source.id === (typeof input === 'string' ? input : input.id));
  if (typeof input === 'string' && !record) throw new PatternTranslationError(`Unknown pattern identity: ${input}`);
  const spec = assertNormalizedVizSpec(structuredClone(typeof input === 'string' ? record!.spec : input));
  const baseChartType = (spec.marks.length === 1 ? MARK_TYPES[spec.marks[0].trait] : undefined)
    ?? record?.baseChartType ?? MARK_TYPES[spec.marks[0].trait];
  if (!baseChartType) throw new PatternTranslationError(`Pattern has no supported Cartesian base mark: ${spec.marks[0].trait}`);

  const retirement = RETIRED_VIZ_PATTERNS[spec.id ?? ''];
  if (retirement) return { status: 'retired', baseChartType, reasons: [retirement] };
  const reasons: string[] = [];
  const scene = spec.marks.length !== 1 || Boolean(spec.layout) || Boolean(spec.interactions?.length)
    || [spec.encoding, ...spec.marks.map(mark => mark.encodings)].some(bindings => bindings?.x2 || bindings?.y2);
  if (spec.transforms?.length) reasons.push('transforms: authored transforms require a transform-aware translation; rows must not be silently substituted for transformed data.');
  if (spec.datasets && Object.keys(spec.datasets).length) reasons.push('datasets: named datasets are outside the inline single-scene pattern translation.');
  if (!spec.data.values?.length || spec.data.values.length > 5000 || spec.data.url || spec.data.name) reasons.push('data: the public pattern translation requires 1–5000 inline rows with no external or named data reference.');

  for (const mark of spec.marks) {
    if (!MARK_TYPES[mark.trait]) reasons.push(`marks.trait: ${mark.trait} has no public Cartesian chart type.`);
    if (mark.from) reasons.push(`marks.from: ${mark.from} references a separate dataset that the public pattern translation cannot preserve.`);
    for (const key of Object.keys(mark.options ?? {}).sort()) {
      if (!MARK_OPTIONS.has(key)) reasons.push(`marks.options.${key}: no preserved option mapping in the public pattern translation.`);
    }
  }
  const encodings = { ...spec.encoding, ...spec.marks[0].encodings };
  for (const channel of Object.keys(encodings)) {
    if (!CHANNELS.includes(channel as EncodingChannel) && !['x2', 'y2'].includes(channel)) reasons.push(`encoding.${channel}: secondary positional channels require a multi-bound mark translation.`);
  }
  if (!encodings.x || !encodings.y) reasons.push('encoding: the public explicit translation requires both x and y bindings.');
  if (reasons.length) return { status: 'authoring-only', baseChartType, reasons: [...new Set(reasons)] };

  if (scene) {
    for (const bindings of [spec.encoding, ...spec.marks.map(mark => mark.encodings)]) {
      for (const channel of ['x', 'y', 'color'] as const) {
        const binding = bindings?.[channel];
        if (binding && !binding.title?.trim()) binding.title = humanize(binding.field);
      }
    }
    return { status: 'scene', baseChartType, spec: assertNormalizedVizSpec(spec) };
  }

  const explicitEncodings: Partial<Record<EncodingChannel, EncodingInput>> = {};
  for (const channel of CHANNELS) {
    const binding = encodings[channel];
    if (binding) explicitEncodings[channel] = Object.fromEntries(INPUT_BINDING_KEYS.filter(key => binding[key] !== undefined).map(key => [key, structuredClone(binding[key])])) as unknown as EncodingInput;
  }
  return { status: 'renderable', baseChartType,
    explicitInput: { chartType: baseChartType, rows: structuredClone(spec.data.values!), encodings: explicitEncodings,
      ...(spec.id !== undefined ? { id: spec.id } : {}), ...(spec.name !== undefined ? { name: spec.name } : {}), description: spec.a11y.description },
    presentation: { ...(spec.config ? { config: spec.config } : {}), a11y: spec.a11y,
      ...(spec.portability ? { portability: spec.portability } : {}), encodings,
      ...(spec.marks[0].options ? { markOptions: spec.marks[0].options } : {}) } };
}

/** Preserve authored presentation on fresh builder IR before adapters and a11y/certification. */
export function applyPatternPresentation(built: NormalizedVizSpec, presentation: PatternPresentation): NormalizedVizSpec {
  if (built.marks.length !== 1) throw new PatternTranslationError('Pattern presentation requires the fresh single-mark explicit builder result.');
  const spec = structuredClone(built);
  const source = structuredClone(presentation);
  for (const channel of CHANNELS) {
    const binding = source.encodings[channel];
    // Keep builder-inferred types and accessible default titles; authored values,
    // including legends/binning and mark-specific overrides, remain authoritative.
    if (binding) spec.encoding[channel] = { ...spec.encoding[channel], ...binding };
  }
  if (source.config) spec.config = source.config;
  spec.a11y = { ...spec.a11y, ...source.a11y };
  if (source.portability) spec.portability = { ...spec.portability, ...source.portability };
  if (source.markOptions) spec.marks[0].options = { ...spec.marks[0].options, ...source.markOptions };
  return assertNormalizedVizSpec(spec);
}
