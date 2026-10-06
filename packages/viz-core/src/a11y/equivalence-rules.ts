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
  /** Internal evaluator fault, distinct from an ordinary rule finding. */
  readonly executionError?: true;
  /**
   * s174 m01 — the TRI-STATE carrier. `passed` deliberately SURVIVES as a boolean (every
   * existing `.passed` pin is a chartered non-mover); a rule whose declared positive
   * precondition is absent reports `passed: true` PLUS `notApplicable: true`, so a reader
   * that wants the third state has it and a reader that only knows `passed` is unmoved.
   *
   * A rule is not-applicable ONLY when a DECLARED precondition is absent — never on
   * judgement. Nine of the eleven declared preconditions are guard clauses that already
   * short-circuited to a trivial pass before s174 (one-line pass()→notApplicable() swaps);
   * two were ADDED by s174 m01 as pure hunks in 0e251e5 — R-05's `if (!x && !y)` and R-12's
   * `boundFields === 0` — where the implicit pass had previously fallen through. No boolean
   * moved either way (both implicit passes already returned passed:true); the provenance is
   * corrected on the record by the s175 m03 decision amending #1476.
   */
  readonly notApplicable?: true;
  /** Names the absent precondition, so "not-applicable" is never a bare assertion. */
  readonly preconditionAbsent?: string;
}

/**
 * The operand-derived evaluation context (s174 m01).
 *
 * The spec-shaped entry point below builds this from a NormalizedVizSpec, which is all a
 * CARTESIAN chart needs — its data lives in the IR. An ECharts-primary IR is metadata-only
 * by design, so its table/narrative/analysis can only be built from the `data` operand;
 * that caller builds this context itself and hands it here.
 */
export interface VizEquivalenceContext {
  readonly spec: NormalizedVizSpec;
  readonly table: AccessibleTableResult;
  readonly narrative: NarrativeResult;
  readonly analysis: VizDataAnalysis;
}

type RuleContext = VizEquivalenceContext;

interface RuleDefinition {
  readonly cause: string;
  readonly fix: string;
  /** dashboard.render may return a blocking rule finding as a warning when it omits the panel. */
  readonly returnedSeverity: 'error-or-warning' | 'warning';
  readonly id: string;
  readonly summary: string;
  readonly severity: 'error' | 'warn';
  readonly check: (context: RuleContext) => RuleCheckResult;
}

interface RuleCheckResult {
  readonly passed: boolean;
  readonly message?: string;
  readonly notApplicable?: true;
  readonly preconditionAbsent?: string;
}

/**
 * Evaluate the 16 rules over an ALREADY-BUILT context (s174 m01).
 *
 * Extracted so the certify path can evaluate over an operand-built table + narrative
 * without a NormalizedVizSpec that carries the data. The spec-shaped entry below is a thin
 * wrapper over this, so the cartesian path runs the identical code it always did.
 */
export function validateVizEquivalenceRulesForContext(context: VizEquivalenceContext): VizA11yRuleResult[] {
  return RULES.map((rule) => {
    try {
      const result = rule.check(context);
      return {
        id: rule.id,
        summary: rule.summary,
        severity: rule.severity,
        passed: result.passed,
        message: result.message,
        ...(result.notApplicable
          ? { notApplicable: true as const, preconditionAbsent: result.preconditionAbsent }
          : {}),
      } satisfies VizA11yRuleResult;
    } catch (error) {
      return {
        id: rule.id,
        summary: rule.summary,
        severity: rule.severity,
        passed: false,
        executionError: true,
        message: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`,
      } satisfies VizA11yRuleResult;
    }
  });
}

export function validateVizEquivalenceRules(spec: NormalizedVizSpec): VizA11yRuleResult[] {
  const table = generateAccessibleTable(spec);
  const narrative = generateNarrativeSummary(spec);
  const analysis = table.analysis;
  return validateVizEquivalenceRulesForContext({ spec, table, narrative, analysis });
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
    cause: 'A color field has neither a redundant shape or detail channel nor a ready table column.',
    fix: 'Add a redundant channel or a ready table fallback containing the color field.',
    summary: 'Color encodings must have redundant channels per RDV.4 Section 4.1.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      const colorBinding = getEncodingBinding(context.spec, 'color');
      if (!colorBinding?.field) {
        return notApplicable('a color encoding bound to a field');
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
    cause: 'A size channel lacks enough numeric values or a perceptible positive magnitude range.',
    fix: 'Use a different encoding when the data cannot support a positive size range of at least 1.5 times.',
    summary: 'Size channels must remain perceptible (Δarea ≥ 1.5×) to satisfy RDV.4 glyph guidance.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      const sizeBinding = getEncodingBinding(context.spec, 'size');
      if (!sizeBinding) {
        return notApplicable('a size encoding binding');
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
    cause: 'No ready accessible table can be generated for the chart.',
    fix: 'Provide readable rows and a supported table fallback for the chart data.',
    summary: 'Accessible table fallback must be available for every spec.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      if (context.table.status === 'ready') {
        return pass();
      }
      return fail(context.table.message);
    },
  },
  {
    id: 'A11Y-R-04',
    cause: 'A bar chart has no narrative summary or no finding describing its extrema.',
    fix: 'Provide a narrative summary and at least one finding describing the bar values.',
    summary: 'Category comparisons (bar/stacked) require narrative summaries of extrema.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      if (context.analysis.mark !== 'bar') {
        return notApplicable('a bar mark');
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
    cause: 'An x or y encoding has no non-empty axis title.',
    fix: 'Set a meaningful title on every bound x and y channel.',
    summary: 'Positional encodings must expose axis titles for assistive tech.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      const x = getEncodingBinding(context.spec, 'x');
      const y = getEncodingBinding(context.spec, 'y');
      if (!x && !y) {
        return notApplicable('an x or y positional encoding binding');
      }
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
    cause: 'An area chart lacks a ready table or numeric minimum and maximum.',
    fix: 'Provide numeric area data and a table fallback that covers its range.',
    summary: 'Area charts must describe baselines/ranges (requires valid extrema + table fallback).',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      if (context.analysis.mark !== 'area') {
        return notApplicable('an area mark');
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
    cause: 'The accessible table is unavailable or has an empty caption.',
    fix: 'Provide a ready table fallback with a non-empty caption tied to the chart.',
    summary: 'Accessible tables require captions tied to the chart title.',
    severity: 'warn',
    returnedSeverity: 'warning',
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
    cause: 'The chart description is shorter than 25 characters.',
    fix: 'Write a meaningful a11y.description of at least 25 characters.',
    summary: 'Long-form description must exceed 25 characters to convey context.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      return context.spec.a11y.description.trim().length >= 25
        ? pass()
        : fail('spec.a11y.description must be a meaningful paragraph (>=25 characters).');
    },
  },
  {
    id: 'A11Y-R-09',
    cause: 'The chart has neither a non-empty ariaLabel nor a visible name.',
    fix: 'Provide a11y.ariaLabel or a non-empty chart name.',
    summary: 'Charts must expose an aria-label or visible name.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
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
    cause: 'A line or area chart has no generated narrative summary.',
    fix: 'Provide readable trend data and a narrative summary for the chart.',
    summary: 'Trend-based charts (line/area) need generated narratives.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      if (context.analysis.mark !== 'line' && context.analysis.mark !== 'area') {
        return notApplicable('a line or area mark');
      }
      if (context.narrative.summary.length === 0) {
        return fail('Provide a narrative summary for trend charts (line/area).');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-11',
    cause: 'A dataset with at least three rows has fewer than two narrative findings.',
    fix: 'Provide at least two findings that describe the dataset\'s extrema or trends.',
    summary: 'Datasets with ≥3 rows must surface at least two key findings.',
    severity: 'warn',
    returnedSeverity: 'warning',
    check: (context) => {
      if (context.analysis.rowCount < 3) {
        return notApplicable('at least 3 data rows');
      }
      if (context.narrative.keyFindings.length >= 2) {
        return pass();
      }
      return fail('Add at least two key findings to cover maxima/minima or trends.');
    },
  },
  {
    id: 'A11Y-R-12',
    cause: 'An x, y or color encoding field is absent from one or more data rows.',
    fix: 'Supply each bound encoding field in every row or correct the field binding.',
    summary: 'Every encoding field must appear in each data row.',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      const bindings = ['x', 'y', 'color'] as const;
      let boundFields = 0;
      for (const channel of bindings) {
        const binding = getEncodingBinding(context.spec, channel);
        if (!binding?.field) {
          continue;
        }
        boundFields += 1;
        const missing = context.analysis.rows.some((row) => row[binding.field as keyof typeof row] === undefined);
        if (missing) {
          return fail(`Field "${binding.field}" used by ${channel} encoding is missing from one or more rows.`);
        }
      }
      if (boundFields === 0) {
        return notApplicable('an x, y or color encoding bound to a field');
      }
      return pass();
    },
  },
  {
    id: 'A11Y-R-13',
    cause: 'A dataset with more than twelve rows has no narrative findings.',
    fix: 'Summarize the dense dataset with meaningful narrative key findings.',
    summary: 'Dense datasets (>12 rows) require narrative aggregation.',
    severity: 'warn',
    returnedSeverity: 'warning',
    check: (context) => {
      if (context.analysis.rowCount <= 12) {
        return notApplicable('more than 12 data rows');
      }
      if (context.narrative.keyFindings.length > 0) {
        return pass();
      }
      return fail('Summarize dense datasets with key findings (insight equivalence).');
    },
  },
  {
    id: 'A11Y-R-14',
    cause: 'The accessible table is missing or a table with more than two columns has no declared column order.',
    fix: 'Provide a ready table and set portability.tableColumnOrder when it has more than two columns.',
    summary: 'Deterministic column ordering must be declared when >2 columns exist.',
    severity: 'warn',
    returnedSeverity: 'warning',
    check: (context) => {
      if (context.table.status !== 'ready') {
        return fail('Table fallback missing; cannot verify deterministic ordering.');
      }
      if (context.table.columns.length <= 2) {
        return notApplicable('a table with more than 2 columns');
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
    cause: 'The narrative generator did not produce a ready result.',
    fix: 'Correct the chart data or narrative settings until narrative generation is ready.',
    summary: 'Narrative generator must produce a ready status (three-pronged equivalence requirement).',
    severity: 'error',
    returnedSeverity: 'error-or-warning',
    check: (context) => {
      if (context.narrative.status === 'ready') {
        return pass();
      }
      return fail('Narrative generation failed to produce output for this spec.');
    },
  },
  {
    id: 'A11Y-R-16',
    cause: 'A filter or zoom interaction has no narrative explaining announcements.',
    fix: 'Set a11y.narrative.summary to describe how filter or zoom results are announced.',
    summary: 'Filter/zoom interactions must describe their announce workflow.',
    severity: 'warn',
    returnedSeverity: 'warning',
    check: (context) => {
      const requiresNarrative = Boolean(
        context.spec.interactions?.some(
          (interaction) => interaction.rule.bindTo === 'filter' || interaction.rule.bindTo === 'zoom'
        )
      );

      if (!requiresNarrative) {
        return notApplicable('a filter or zoom interaction');
      }

      const summary = context.spec.a11y.narrative?.summary ?? '';
      if (summary.trim().length === 0) {
        return fail('Provide a11y.narrative.summary describing how filter/zoom results are announced.');
      }

      return pass();
    },
  },
];

/** s225-m02: glossary metadata stays beside the rules; returned severity includes dashboard panel omission. */
export const VIZ_EQUIVALENCE_ERROR_DEFINITIONS = Object.freeze(RULES.map(({ id, summary, severity, returnedSeverity, cause, fix }) =>
  Object.freeze({ code: `OODS-${id}`, message: summary, ruleSeverity: severity === 'warn' ? 'warning' as const : 'error' as const, severity: returnedSeverity, cause, fix })));

/**
 * s223-m03 (#2527 ruling 16): the ids of the equivalence rules artifact.certify grades, in its order, so a consumer that
 * publishes them as data (@oods/foundry's facts.json) reads them from the rules themselves, never from prose.
 */
export const VIZ_EQUIVALENCE_RULE_IDS: readonly string[] = Object.freeze(RULES.map((rule) => rule.id));

function pass(): RuleCheckResult {
  return { passed: true };
}

function fail(message: string): RuleCheckResult {
  return { passed: false, message };
}

/**
 * s174 m01 — the rule's DECLARED positive precondition is absent, so it has nothing to
 * judge. `passed` stays `true` (this is exactly the branch that returned `pass()` before
 * s174, so no existing boolean moves); the two new fields carry the third state and NAME
 * the missing precondition, which is what "not-applicable" has to mean if it is to be
 * distinguishable from a meaningful pass.
 */
function notApplicable(precondition: string): RuleCheckResult {
  return { passed: true, notApplicable: true, preconditionAbsent: precondition };
}
