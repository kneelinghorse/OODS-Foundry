// s174 m01 — the EXACT a11y-equivalence finding set certify emits per ECharts-primary type
// when the `data` operand is supplied.
//
// These are the replacement assertions for the two DECLARED movers of the sprint:
// echarts-determinism.spec.ts's and echarts-accuracy.spec.ts's `findings).toEqual([])`. Both
// were true only because the engine never ran on this path; warn-first makes findings
// non-empty, so the locks are TIGHTENED (exact sets, in rule order) rather than loosened to
// a shape check.
//
// Every entry is derived from the 16×8 applicability matrix (pinned in viz-core's own suite,
// a11y-equivalence-applicability-s174.spec.ts) plus the fixture's own content, and the reason
// each rule fires is named below — this is the "enumerate the warn families so the build reads
// them as designed, not as regression" clause of the charter.
//
//   A11Y-R-14 (warn)  fires on ALL EIGHT: the operand-built table has more than 2 columns and
//                     an ECharts-primary IR carries no `portability.tableColumnOrder`, so
//                     deterministic column ordering is undeclared. This is the warn-first
//                     rollout's headline finding and it is CORRECT — enforcement will require
//                     that ordering to be declared.
//   A11Y-R-09 (error) fires on an UNNAMED IR (no a11y.ariaLabel and no name). viz.render's own
//                     normalizedSpec carries the caller's name, so it does not fire there; the
//                     hand-authored terse fixture has no name, so it does.
//   A11Y-R-08 (error) fires when a11y.description is under 25 characters. The terse fixture's
//                     `${chartType} of test data.` clears 25 only for force_graph (25 exactly),
//                     which is why force_graph is the one type missing R-08 below.
//
// Nothing else fires on either shape: the remaining 13 rules are either satisfied by the
// operand-built table/narrative or NOT-APPLICABLE with their absent precondition named (the
// cartesian-only encoding rules, the mark-shaped narrative rules, the row-count rules).

import type { EChartsPrimaryType } from '../../src/tools/echarts-primary.js';

export interface ExpectedA11yFinding {
  readonly code: string;
  readonly severity: 'error' | 'warn';
}

const R08: ExpectedA11yFinding = { code: 'OODS-A11Y-R-08', severity: 'error' };
const R09: ExpectedA11yFinding = { code: 'OODS-A11Y-R-09', severity: 'error' };
const R14: ExpectedA11yFinding = { code: 'OODS-A11Y-R-14', severity: 'warn' };

/**
 * The IR viz.render emits as `normalizedSpec` for these fixtures: it carries the caller's
 * `name` and a generated description well over 25 characters, so only the column-ordering
 * warn fires. This is the shape the determinism + accuracy specs certify.
 */
export const RENDERED_IR_A11Y_FINDINGS: Readonly<Record<EChartsPrimaryType, readonly ExpectedA11yFinding[]>> = {
  treemap: [R14],
  sunburst: [R14],
  sankey: [R14],
  chord: [R14],
  force_graph: [R14],
  choropleth: [R14],
  bubble_map: [R14],
  flow_map: [R14],
};

/**
 * The hand-authored terse IR (`echartsPrimaryIr`): no name, a sub-25-character description
 * for seven of the eight types. Both error-severity rules fire here, which is what proves the
 * findings really do carry their NATIVE severity rather than a forced warn.
 */
export const TERSE_IR_A11Y_FINDINGS: Readonly<Record<EChartsPrimaryType, readonly ExpectedA11yFinding[]>> = {
  treemap: [R08, R09, R14],
  sunburst: [R08, R09, R14],
  sankey: [R08, R09, R14],
  chord: [R08, R09, R14],
  // 'force_graph of test data.' is exactly 25 characters — R-08's threshold is >= 25.
  force_graph: [R09, R14],
  choropleth: [R08, R09, R14],
  bubble_map: [R08, R09, R14],
  flow_map: [R08, R09, R14],
};

/** Findings[] entries the a11y engine produced, in emission order. */
export function a11yFindingsOf(
  findings: ReadonlyArray<{ code: string; severity: string }> | undefined,
): ExpectedA11yFinding[] {
  return (findings ?? [])
    .filter((finding) => finding.code.startsWith('OODS-A11Y-'))
    .map((finding) => ({ code: finding.code, severity: finding.severity as 'error' | 'warn' }));
}

/**
 * s175 m03 — the NOT-APPLICABLE set certify emits per type on the `a11yNotApplicable[]` channel
 * (rule order), DERIVED FROM THE CERTIFY FIXTURE rather than copied from viz-core's 16×8
 * matrix: force_graph's R-14 FIRES on the mcp-server operand fixture (its operand-built table
 * has more than 2 columns here) while it is n/a on viz-core's own fixture, so a matrix copy
 * would pin the wrong set. The spec additionally cross-checks each set against the engine run
 * over the same operand-built context, so this table cannot drift from the fixture silently.
 *
 * The same set holds for the rendered IR and the hand-authored terse IR: every precondition
 * below is about encodings, marks, row counts or interactions, none of which the name and
 * description differences between the two shapes touch.
 *
 *   R-01 (a color encoding bound to a field) · R-02 (a size encoding binding) · R-04 (a bar
 *   mark) · R-05 (an x or y positional encoding binding) · R-06 (an area mark) · R-10 (a line
 *   or area mark) · R-12 (an x, y or color encoding bound to a field) · R-13 (more than 12 data
 *   rows) · R-16 (a filter or zoom interaction) — n/a on all eight.
 *   R-11 (at least 3 data rows) — n/a on the four fixtures whose operand-built table has fewer
 *   than 3 rows (sankey, choropleth, bubble_map, flow_map).
 */
const NA_ALL_EIGHT = ['A11Y-R-01', 'A11Y-R-02', 'A11Y-R-04', 'A11Y-R-05', 'A11Y-R-06', 'A11Y-R-10'] as const;
const NA_TAIL = ['A11Y-R-12', 'A11Y-R-13', 'A11Y-R-16'] as const;
const NA_9: readonly string[] = [...NA_ALL_EIGHT, ...NA_TAIL];
const NA_10: readonly string[] = [...NA_ALL_EIGHT, 'A11Y-R-11', ...NA_TAIL];

export const CERTIFY_FIXTURE_A11Y_NOT_APPLICABLE: Readonly<Record<EChartsPrimaryType, readonly string[]>> = {
  treemap: NA_9,
  sunburst: NA_9,
  sankey: NA_10,
  chord: NA_9,
  force_graph: NA_9,
  choropleth: NA_10,
  bubble_map: NA_10,
  flow_map: NA_10,
};
