import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { generateAccessibleTable } from './table-generator.js';
import { generateNarrativeSummary } from './narrative-generator.js';
import { getEncodingBinding, type VizDataAnalysis } from './data-analysis.js';

import type { AccessibleTableResult } from './table-generator.js';
import type { NarrativeResult } from './narrative-generator.js';

export interface VizA11yRuleResult {
  readonly id: string;
  readonly summary: string;
  readonly severity: 'error' | 'warn';
  readonly passed: boolean;
  readonly message?: string;
}

interface RuleContext {
  readonly spec: NormalizedVizSpec;
  readonly table: AccessibleTableResult;
  readonly narrative: NarrativeResult;
  readonly analysis: VizDataAnalysis;
}

interface RuleDefinition {
  readonly id: string;
  readonly summary: string;
  readonly severity: 'error' | 'warn';
  readonly check: (context: RuleContext) => RuleCheckResult;
}

interface RuleCheckResult {
  readonly passed: boolean;
  readonly message?: string;
}

export function validateVizEquivalenceRules(spec: NormalizedVizSpec): VizA11yRuleResult[] {
  const table = generateAccessibleTable(spec);
  const narrative = generateNarrativeSummary(spec);
  const analysis = table.analysis;
  const context: RuleContext = { spec, table, narrative, analysis };

  return RULES.map((rule) => {
    try {
      const result = rule.check(context);
      return {
        id: rule.id,
        summary: rule.summary,
        severity: rule.severity,
        passed: result.passed,
        message: result.message,
      } satisfies VizA11yRuleResult;
    } catch (error) {
      return {
        id: rule.id,
        summary: rule.summary,
        severity: rule.severity,
        passed: false,
        message: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies VizA11yRuleResult;
    }
  });
}

export function assertVizEquivalence(spec: NormalizedVizSpec): void {
  const results = validateVizEquivalenceRules(spec);
  const failures = results.filter((result) => !result.passed && result.severity === 'error');
  if (failures.length > 0) {
    const message = failures.map((failure) => `${failure.id}: ${failure.message ?? failure.summary}`).join('\n');
    throw new Error(`Viz accessibility equivalence failed:\n${message}`);
  }
}

const RULES: readonly RuleDefinition[] = [
  {
    id: 'A11Y-R-01',
    summary: 'Color encodings must have redundant channels per RDV.4 Section 4.1.',
    severity: 'error',
    check: (context) => {
      const colorBinding = getEncodingBinding(context.spec, 'color');
      if (!colorBinding?.field) {
        return pass();
      }
      const redundantChannel = Boolean(getEncodingBinding(context.spec, 'shape') || getEncodingBinding(context.spec, 'detail'));
      const tableHasColor =
        context.table.status === 'ready' && context.table.columns.some((column) => column.field === colorBinding.field);
      if (redundantChannel || tableHasColor) {
        return pass();
      }
      return fail('Color encoding detected without redundant shape/detail or tabular representation.');
    },
  },
  {
    id: 'A11Y-R-02',
    summary: 'Size channels must remain perceptible (Δarea ≥ 1.5×) to satisfy RDV.4 glyph guidance.',
    severity: 'error',
    check: (context) => {
      const sizeBinding = getEncodingBinding(context.spec, 'size');
      if (!sizeBinding) {
        return pass();
      }
      const values = context.analysis.sizeValues;
      if (values.length < 2) {
        return fail('Size encoding configured but dataset lacks numeric values to enforce perceivable deltas.');
      }
      const min = Math.min(...values.filter((value) => value > 0));
      const max = Math.max(...values);
      if (!Number.isFinite(min) || min <= 0) {
        return fail('Size encoding uses non-positive values; cannot generate perceivable area.');
      }
      const ratio = max / min;
      if (ratio >= 1.5) {
        return pass();
      }
      return fail(`Size channel only varies by ${ratio.toFixed(2)}× (< 1.5× minimum).`);
    },
  },
  {
    id: 'A11Y-R-03',
    summary: 'Accessible table fallback must be available for every spec.',
    severity: 'error',
    check: (context) => {
      if (context.table.status === 'ready') {
        return pass();
      }
      return fail(context.table.message);
    },
  },
  {
    id: 'A11Y-R-04',
    summary: 'Category comparisons (bar/stacked) require narrative summaries of extrema.',
    severity: 'error',
    check: (context) => {
      if (context.analysis.mark !== 'bar') {
        return pass();
      }
      if (context.narrative.summary.length === 0) {
        return fail('Bar/column charts must include a narrative summary describing winners/laggards.');
      }
      if (context.narrative.keyFindings.length === 0) {
        return fail('Provide at least one key finding for bar charts to describe extrema.');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-05',
    summary: 'Positional encodings must expose axis titles for assistive tech.',
    severity: 'error',
    check: (context) => {
      const x = getEncodingBinding(context.spec, 'x');
      const y = getEncodingBinding(context.spec, 'y');
      const xLabeled = !x || Boolean(x.title && x.title.trim() !== '');
      const yLabeled = !y || Boolean(y.title && y.title.trim() !== '');
      if (xLabeled && yLabeled) {
        return pass();
      }
      return fail('Axis titles are required for encoding channels x/y per RDV.4 mapping table.');
    },
  },
  {
    id: 'A11Y-R-06',
    summary: 'Area charts must describe baselines/ranges (requires valid extrema + table fallback).',
    severity: 'error',
    check: (context) => {
      if (context.analysis.mark !== 'area') {
        return pass();
      }
      if (context.table.status !== 'ready') {
        return fail('Area/stacked charts must ship a table fallback covering the baseline range.');
      }
      if (!context.analysis.min || !context.analysis.max) {
        return fail('Area charts require numeric min/max values to narrate the band.');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-07',
    summary: 'Accessible tables require captions tied to the chart title.',
    severity: 'warn',
    check: (context) => {
      if (context.table.status !== 'ready') {
        return fail('Table fallback is missing; unable to verify caption.');
      }
      if (context.table.caption.trim().length === 0) {
        return fail('Provide a caption in a11y.tableFallback.caption to describe the dataset.');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-08',
    summary: 'Long-form description must exceed 25 characters to convey context.',
    severity: 'error',
    check: (context) => {
      return context.spec.a11y.description.trim().length >= 25
        ? pass()
        : fail('spec.a11y.description must be a meaningful paragraph (>=25 characters).');
    },
  },
  {
    id: 'A11Y-R-09',
    summary: 'Charts must expose an aria-label or visible name.',
    severity: 'error',
    check: (context) => {
      if (context.spec.a11y.ariaLabel?.trim()) {
        return pass();
      }
      if (context.spec.name?.trim()) {
        return pass();
      }
      return fail('Provide spec.a11y.ariaLabel or spec.name so assistive tech can announce the chart.');
    },
  },
  {
    id: 'A11Y-R-10',
    summary: 'Trend-based charts (line/area) need generated narratives.',
    severity: 'error',
    check: (context) => {
      if (context.analysis.mark !== 'line' && context.analysis.mark !== 'area') {
        return pass();
      }
      if (context.narrative.summary.length === 0) {
        return fail('Provide a narrative summary for trend charts (line/area).');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-11',
    summary: 'Datasets with ≥3 rows must surface at least two key findings.',
    severity: 'warn',
    check: (context) => {
      if (context.analysis.rowCount < 3) {
        return pass();
      }
      if (context.narrative.keyFindings.length >= 2) {
        return pass();
      }
      return fail('Add at least two key findings to cover maxima/minima or trends.');
    },
  },
  {
    id: 'A11Y-R-12',
    summary: 'Every encoding field must appear in each data row.',
    severity: 'error',
    check: (context) => {
      const bindings = ['x', 'y', 'color'] as const;
      for (const channel of bindings) {
        const binding = getEncodingBinding(context.spec, channel);
        if (!binding?.field) {
          continue;
        }
        const missing = context.analysis.rows.some((row) => row[binding.field as keyof typeof row] === undefined);
        if (missing) {
          return fail(`Field "${binding.field}" used by ${channel} encoding is missing from one or more rows.`);
        }
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-13',
    summary: 'Dense datasets (>12 rows) require narrative aggregation.',
    severity: 'warn',
    check: (context) => {
      if (context.analysis.rowCount <= 12) {
        return pass();
      }
      if (context.narrative.keyFindings.length > 0) {
        return pass();
      }
      return fail('Summarize dense datasets with key findings (insight equivalence).');
    },
  },
  {
    id: 'A11Y-R-14',
    summary: 'Deterministic column ordering must be declared when >2 columns exist.',
    severity: 'warn',
    check: (context) => {
      if (context.table.status !== 'ready') {
        return fail('Table fallback missing; cannot verify deterministic ordering.');
      }
      if (context.table.columns.length <= 2) {
        return pass();
      }
      const order = context.spec.portability?.tableColumnOrder ?? [];
      if (order.length > 0) {
        return pass();
      }
      return fail('Set portability.tableColumnOrder when rendering tables with more than two columns.');
    },
  },
  {
    id: 'A11Y-R-15',
    summary: 'Narrative generator must produce a ready status (three-pronged equivalence requirement).',
    severity: 'error',
    check: (context) => {
      if (context.narrative.status === 'ready') {
        return pass();
      }
      return fail('Narrative generation failed to produce output for this spec.');
    },
  },
  {
    id: 'A11Y-R-16',
    summary: 'Filter/zoom interactions must describe their announce workflow.',
    severity: 'warn',
    check: (context) => {
      const requiresNarrative = Boolean(
        context.spec.interactions?.some(
          (interaction) => interaction.rule.bindTo === 'filter' || interaction.rule.bindTo === 'zoom'
        )
      );

      if (!requiresNarrative) {
        return pass();
      }

      const summary = context.spec.a11y.narrative?.summary ?? '';
      if (summary.trim().length === 0) {
        return fail('Provide a11y.narrative.summary describing how filter/zoom results are announced.');
      }

      return pass();
    },
  },
];

function pass(): RuleCheckResult {
  return { passed: true };
}

function fail(message: string): RuleCheckResult {
  return { passed: false, message };
}
