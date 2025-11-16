import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { listPatterns } from './index.js';
import { scoreLayoutForPattern, type LayoutRecommendationBundle } from './layout-scorer.js';
import { recommendInteractions, type InteractionBundle } from './interaction-scorer.js';
import { generateScaffold, type ScaffoldFormat } from './scaffold-generator.js';
import { suggestPatterns, type PatternSuggestion, type SchemaIntent } from './suggest-chart.js';
import type { DensityPreference, IntentGoal } from './index.js';

type MutableSchemaIntent = {
  -readonly [Key in keyof SchemaIntent]: SchemaIntent[Key];
};

const DEFAULT_LIMIT = 3;

export async function runCli(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      measures: { type: 'string' },
      dimensions: { type: 'string' },
      temporals: { type: 'string' },
      goal: { type: 'string' },
      stacking: { type: 'string' },
      matrix: { type: 'boolean' },
      part: { type: 'boolean' },
      multi: { type: 'boolean' },
      grouping: { type: 'boolean' },
      negative: { type: 'boolean' },
      density: { type: 'string' },
      limit: { type: 'string' },
      schema: { type: 'string' },
      file: { type: 'string' },
      list: { type: 'boolean' },
      layout: { type: 'boolean' },
      interactions: { type: 'boolean' },
      scaffold: { type: 'boolean' },
      'scaffold-format': { type: 'string' },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  if (values.list) {
    listPatterns().forEach((pattern) => {
      console.log(`${pattern.id}\t${pattern.name} (${pattern.chartType}) → ${pattern.summary}`);
    });
    return;
  }

  const includeLayout = values.layout === true;
  const includeInteractions = values.interactions === true;
  const scaffoldRequested = values.scaffold === true;
  const scaffoldFormat = parseScaffoldFormat(values['scaffold-format']);

  try {
    const descriptorArg = typeof positionals[0] === 'string' ? positionals[0] : undefined;
    const schema = buildSchema(values, descriptorArg);
    const limitArg = typeof values.limit === 'string' ? values.limit : undefined;
    const limit = limitArg ? Number.parseInt(limitArg, 10) : DEFAULT_LIMIT;
    const suggestions = suggestPatterns(schema, { limit, minScore: -4 });
    if (suggestions.length === 0) {
      console.log('No matching patterns. Adjust schema inputs or run with --list to inspect options.');
      return;
    }
    const enriched = suggestions.map((entry) => ({
      suggestion: entry,
      layout: includeLayout || scaffoldRequested ? scoreLayoutForPattern(entry.pattern.id, schema) : undefined,
      interactions: includeInteractions || scaffoldRequested ? recommendInteractions(entry.pattern.id, schema) : undefined,
    }));
    printSuggestions(enriched, { showLayout: includeLayout, showInteractions: includeInteractions });
    if (scaffoldRequested) {
      emitScaffold(enriched[0], schema, scaffoldFormat);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`viz:suggest failed: ${message}`);
    process.exitCode = 1;
  }
}

function buildSchema(values: Record<string, unknown>, descriptor?: string): SchemaIntent {
  const segments: Array<Partial<MutableSchemaIntent>> = [];
  if (descriptor) {
    segments.push(parseDescriptor(descriptor));
  }
  if (typeof values.schema === 'string') {
    segments.push(parseDescriptor(values.schema));
  }
  if (typeof values.file === 'string' && values.file.trim().length > 0) {
    const filePath = path.resolve(values.file);
    const filePayload = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<MutableSchemaIntent>;
    segments.push(filePayload);
  }

  const explicit: Partial<MutableSchemaIntent> = {};
  if (typeof values.measures === 'string') {
    explicit.measures = Number.parseInt(values.measures, 10);
  }
  if (typeof values.dimensions === 'string') {
    explicit.dimensions = Number.parseInt(values.dimensions, 10);
  }
  if (typeof values.temporals === 'string') {
    explicit.temporals = Number.parseInt(values.temporals, 10);
  }
  if (typeof values.goal === 'string') {
    explicit.goal = parseGoals(values.goal);
  }
  if (typeof values.stacking === 'string') {
    explicit.stacking = values.stacking as SchemaIntent['stacking'];
  }
  if (typeof values.density === 'string') {
    explicit.density = parseDensity(values.density);
  }
  if (typeof values.matrix === 'boolean') {
    explicit.matrix = values.matrix;
  }
  if (typeof values.part === 'boolean') {
    explicit.partToWhole = values.part;
  }
  if (typeof values.multi === 'boolean') {
    explicit.multiMetrics = values.multi;
  }
  if (typeof values.grouping === 'boolean') {
    explicit.requiresGrouping = values.grouping;
  }
  if (typeof values.negative === 'boolean') {
    explicit.allowNegative = values.negative;
  }

  segments.push(explicit);
  const merged = segments.reduce<Partial<MutableSchemaIntent>>((acc, part) => ({ ...acc, ...part }), {});
  const measures = merged.measures ?? 1;
  const dimensions = merged.dimensions ?? 1;
  if (Number.isNaN(measures) || measures <= 0) {
    throw new Error('Provide measures count via measures=<number>');
  }
  if (Number.isNaN(dimensions) || dimensions <= 0) {
    throw new Error('Provide dimensions count via dimensions=<number>');
  }
  const goal = merged.goal ?? 'comparison';
  const temporals = merged.temporals && merged.temporals > 0 ? merged.temporals : undefined;

  return {
    measures,
    dimensions,
    temporals,
    goal,
    stacking: merged.stacking,
    matrix: merged.matrix,
    partToWhole: merged.partToWhole,
    multiMetrics: merged.multiMetrics,
    requiresGrouping: merged.requiresGrouping,
    allowNegative: merged.allowNegative,
    density: merged.density,
  } satisfies SchemaIntent;
}

function parseDescriptor(input: string): Partial<MutableSchemaIntent> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as Partial<MutableSchemaIntent>;
  }
  const normalized = trimmed.toLowerCase();
  const descriptor: Partial<MutableSchemaIntent> = {};
  const measureMatches = normalized.match(/(\d+)q/g);
  const dimensionMatches = normalized.match(/(\d+)(n|c)/g);
  const temporalMatches = normalized.match(/(\d+)t/g);
  if (measureMatches) {
    descriptor.measures = sumMatches(measureMatches);
  }
  if (dimensionMatches) {
    descriptor.dimensions = sumMatches(dimensionMatches);
  }
  if (temporalMatches) {
    const temporalCount = sumMatches(temporalMatches);
    descriptor.temporals = temporalCount;
    descriptor.dimensions = (descriptor.dimensions ?? 0) + temporalCount;
  }
  if (normalized.includes('stack')) {
    descriptor.stacking = 'required';
  }
  if (normalized.includes('group')) {
    descriptor.requiresGrouping = true;
  }
  if (normalized.includes('matrix')) {
    descriptor.matrix = true;
  }
  if (normalized.includes('part')) {
    descriptor.partToWhole = true;
  }
  if (normalized.includes('band')) {
    descriptor.multiMetrics = true;
  }
  if (normalized.includes('bubble') || normalized.includes('multi-metric')) {
    descriptor.multiMetrics = true;
  }
  if (normalized.includes('negative') || normalized.includes('diverg')) {
    descriptor.allowNegative = true;
  }
  if (normalized.includes('dense')) {
    descriptor.density = 'dense';
  }
  if (normalized.includes('sparse')) {
    descriptor.density = 'sparse';
  }

  const tokens = normalized.split(/[\s,]+/).filter(Boolean);
  const goals = new Set<IntentGoal>();
  tokens.forEach((token) => {
    if (token.includes('=')) {
      const [rawKey, rawValue] = token.split('=');
      const key = rawKey.trim();
      const value = rawValue.trim();
      switch (key) {
        case 'measures':
          descriptor.measures = Number.parseInt(value, 10);
          break;
        case 'dimensions':
          descriptor.dimensions = Number.parseInt(value, 10);
          break;
        case 'temporals':
        case 'temporal':
          descriptor.temporals = Number.parseInt(value, 10);
          break;
        case 'goal': {
          const parsedGoals = parseGoals(value);
          const goalArray = Array.isArray(parsedGoals) ? parsedGoals : [parsedGoals];
          goalArray.forEach((goal) => goals.add(goal));
          break;
        }
        case 'stacking':
          descriptor.stacking = value as SchemaIntent['stacking'];
          break;
        case 'density':
          descriptor.density = parseDensity(value);
          break;
        case 'matrix':
          descriptor.matrix = value === 'true';
          break;
        case 'part':
          descriptor.partToWhole = value === 'true';
          break;
        case 'multi':
          descriptor.multiMetrics = value === 'true';
          break;
        case 'grouping':
          descriptor.requiresGrouping = value === 'true';
          break;
        case 'negative':
          descriptor.allowNegative = value === 'true';
          break;
        default:
          break;
      }
      return;
    }

    const goal = normalizeGoal(token);
    if (goal) {
      goals.add(goal);
    }
  });

  if (goals.size > 0) {
    descriptor.goal = [...goals];
  }

  return descriptor;
}

function parseGoals(value: string): IntentGoal | ReadonlyArray<IntentGoal> {
  const goals = value
    .split(/[;,]+/)
    .map((item) => normalizeGoal(item.trim().toLowerCase()))
    .filter((goal): goal is IntentGoal => Boolean(goal));
  if (goals.length === 0) {
    return 'comparison';
  }
  return goals.length === 1 ? goals[0] : goals;
}

function parseDensity(value: string): DensityPreference {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'dense' || normalized === 'sparse') {
    return normalized;
  }
  return 'flex';
}

function normalizeGoal(token: string): IntentGoal | undefined {
  switch (token) {
    case 'comparison':
      return 'comparison';
    case 'trend':
      return 'trend';
    case 'composition':
      return 'composition';
    case 'part':
    case 'part-to-whole':
      return 'part-to-whole';
    case 'relationship':
      return 'relationship';
    case 'intensity':
      return 'intensity';
    case 'distribution':
      return 'distribution';
    default:
      return undefined;
  }
}

function sumMatches(matches: RegExpMatchArray): number {
  return matches
    .map((match) => Number.parseInt(match, 10))
    .filter((value) => !Number.isNaN(value))
    .reduce((total, value) => total + value, 0);
}

interface EnrichedSuggestion {
  readonly suggestion: PatternSuggestion;
  readonly layout?: LayoutRecommendationBundle;
  readonly interactions?: InteractionBundle;
}

interface PrintOptions {
  readonly showLayout: boolean;
  readonly showInteractions: boolean;
}

function printSuggestions(suggestions: EnrichedSuggestion[], options: PrintOptions): void {
  console.log('Chart Pattern Suggestions');
  console.log('==========================');
  suggestions.forEach((suggestion, index) => {
    const { pattern, score, signals } = suggestion.suggestion;
    console.log(`${index + 1}. ${pattern.name} [${pattern.chartType}] — score ${score.toFixed(1)}`);
    console.log(`   Summary: ${pattern.summary}`);
    console.log(`   Spec: ${pattern.specPath}`);
    console.log(`   Composition: ${pattern.composition[0]}`);
    console.log(`   Suggested use: ${pattern.usage.bestFor[0] ?? 'See docs/viz/pattern-library.md'}`);
    console.log('   Fit signals:');
    signals.slice(0, 3).forEach((signal) => console.log(`      • ${signal}`));
    if (options.showLayout && suggestion.layout) {
      const layout = suggestion.layout;
      console.log(
        `   Layout: ${layout.primary.strategy} (${formatPercent(layout.primary.score)}) — ${layout.primary.rationale}`,
      );
      if (layout.alternates.length > 0) {
        const alt = layout.alternates[0];
        console.log(`           Alt: ${alt.strategy} (${formatPercent(alt.score)})`);
      }
    }
    if (options.showInteractions && suggestion.interactions) {
      const interactions = suggestion.interactions.primary.slice(0, 2);
      if (interactions.length > 0) {
        const labels = interactions.map(
          (entry) => `${entry.kind} (${formatPercent(entry.score)})`,
        );
        console.log(`   Interactions: ${labels.join(', ')}`);
      }
    }
    console.log('');
  });
  console.log('Docs → docs/viz/pattern-library.md | Decision guide → docs/viz/chart-selection-guide.md');
}

function emitScaffold(entry: EnrichedSuggestion | undefined, schema: SchemaIntent, format: ScaffoldFormat): void {
  if (!entry) {
    console.log('Unable to scaffold without a suggestion.');
    return;
  }
  const layout = entry.layout ?? scoreLayoutForPattern(entry.suggestion.pattern.id, schema);
  const interactions = entry.interactions ?? recommendInteractions(entry.suggestion.pattern.id, schema);
  const artifacts = generateScaffold({
    suggestion: entry.suggestion,
    schema,
    layout,
    interactions,
    format,
  });
  if (artifacts.spec) {
    console.log('\nGenerated Spec (JSON)');
    console.log('=====================');
    console.log(artifacts.spec);
  }
  if (artifacts.component) {
    console.log('\nGenerated Component (TypeScript)');
    console.log('================================');
    console.log(artifacts.component);
  }
}

function parseScaffoldFormat(input: unknown): ScaffoldFormat {
  if (typeof input !== 'string') {
    return 'all';
  }
  const normalized = input.trim().toLowerCase();
  if (normalized === 'spec') {
    return 'spec';
  }
  if (normalized === 'component') {
    return 'component';
  }
  return 'all';
}

function formatPercent(value: number): string {
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}

function printHelp(): void {
  console.log(`Usage: pnpm viz:suggest [descriptor]

Examples:
  pnpm viz:suggest "1Q+2N goal=trend"
  pnpm viz:suggest --measures 1 --dimensions 3 --temporals 1 --goal composition
  pnpm viz:suggest --file schema.json

Flags:
  --help            Show this message
  --list            Print all patterns
  --measures        Count of quantitative fields
  --dimensions      Count of discrete dimensions (includes temporal)
  --temporals       Count of temporal fields
  --goal            Desired goal (comparison|trend|composition|part-to-whole|relationship|intensity|distribution)
  --stacking        required|preferred|avoid
  --density         dense|sparse|flex
  --matrix          Expect matrix layout
  --part            Part-to-whole emphasis
  --multi           Requires multi-metric encoding
  --grouping        Needs grouped series dimension
  --negative        Allow negative values
  --limit           Number of suggestions (default 3)
  --file            Path to JSON schema descriptor
  --layout          Include layout scoring hints
  --interactions    Include interaction recommendations
  --scaffold        Generate scaffolded spec/component for the top suggestion
  --scaffold-format spec|component|all (default all)
`);
}

const isDirectExecution = fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  void runCli(process.argv.slice(2));
}
