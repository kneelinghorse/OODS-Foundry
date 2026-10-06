// Sprint-170 m01 — R1 (non-zero bar baseline) and R3 (area encodes linear).
//
// Both read exactly one property of the compiled spec: whether the value axis a bar/area
// draws its extent on is a LINEAR ZERO-ANCHORED scale. They share `nonLinearZeroCauses` so
// the two can never drift on what "zero-anchored" means, and R3 is R1's predicate over
// MarkArea minus the band exclusion (memo §3 m01.4).

import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import {
  compiledUnitViews,
  describeCauses,
  isRangedView,
  nonLinearZeroCauses,
  unitViewMarkType,
  valueAxisChannels,
  type CompiledUnitView,
  type NonLinearZeroCause,
} from './compiled-spec.js';
import type { AccuracyRuleOutcome } from './types.js';

/** The shared unresolvable-operand note — R1/R3/R2 all read the compiled spec. */
export const UNREADABLE_COMPILED_NOTE =
  'the compiled Vega-Lite spec could not be read, so no compiled-scale rule was evaluated';

interface Offender {
  readonly channel: 'x' | 'y';
  readonly causes: readonly NonLinearZeroCause[];
}

function offendersIn(view: CompiledUnitView): Offender[] {
  const offenders: Offender[] = [];
  for (const channel of valueAxisChannels(view)) {
    const causes = nonLinearZeroCauses(view.encoding[channel]);
    if (causes.length > 0) {
      offenders.push({ channel, causes });
    }
  }
  return offenders;
}

function describeOffenders(markLabel: string, offenders: readonly Offender[]): string {
  const parts = offenders.map(
    (offender) => `the ${offender.channel} axis is not a linear zero-anchored scale: ${describeCauses(offender.causes)}`,
  );
  return `${markLabel}: ${parts.join(' | ')}`;
}

/**
 * The body both rules share: over every compiled unit view whose mark type matches, collect
 * the value axes that are not linear-zero-anchored. `skip` lets R3 drop ranged (y2/x2) views.
 */
function evaluateScaleRule(
  compiled: unknown,
  markType: string,
  markLabel: string,
  skip: (view: CompiledUnitView) => boolean,
): AccuracyRuleOutcome {
  const views = compiledUnitViews(compiled);
  if (views.length === 0) {
    return { evaluated: false, note: UNREADABLE_COMPILED_NOTE };
  }
  const offenders: Offender[] = [];
  for (const view of views) {
    if (unitViewMarkType(view) !== markType || skip(view)) {
      continue;
    }
    offenders.push(...offendersIn(view));
  }
  if (offenders.length === 0) {
    return { evaluated: true };
  }
  return { evaluated: true, message: describeOffenders(markLabel, offenders) };
}

/**
 * R1 — non-zero bar baseline. A bar communicates value by LENGTH from a baseline, so a bar
 * whose value axis is not a linear zero-anchored scale draws lengths whose ratios are not
 * the data's ratios. Fires per-cause (a sqrt bar is zero-anchored and must never be reported
 * as a moved baseline).
 */
export function evaluateNonZeroBarBaseline(_spec: NormalizedVizSpec, compiled: unknown): AccuracyRuleOutcome {
  return evaluateScaleRule(compiled, 'bar', 'bar mark', () => false);
}

/**
 * R3 — area encodes linear. Identical predicate over MarkArea, EXCLUDING ranged (x2/y2)
 * areas: a band draws two EDGE POSITIONS, not an extent from a baseline, so a non-zero
 * baseline distorts nothing there. The three committed band fixtures (target-band-line ×2,
 * facet-target-band) are that exclusion's guards.
 */
export function evaluateAreaEncodesLinear(_spec: NormalizedVizSpec, compiled: unknown): AccuracyRuleOutcome {
  return evaluateScaleRule(compiled, 'area', 'area mark', isRangedView);
}
