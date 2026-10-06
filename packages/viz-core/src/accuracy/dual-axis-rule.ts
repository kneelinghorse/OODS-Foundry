// Sprint-170 m01 — R2 (dual axis).
//
// Two series drawn in the SAME plot frame against two independently-scaled positional axes
// can be made to cross, converge or diverge anywhere the author likes: the visual relation
// between them is an artifact of the two scales, not of the data.
//
// SCOPE IS THE WHOLE RULE. Independent positional resolution is only a dual axis at LAYER
// scope. Facet-scope and concat-scope independence are LEGITIMATE — separate panels with
// their own axes, which is what small multiples are for — and the compiled spelling CANNOT
// tell the three apart: `buildVegaLiteSpec` emits the byte-identical top-level
// `resolve:{scale:{y:'independent'}}` node for layer, facet and concat alike (grounding G2,
// reproduced here: sparkline-grid is LayoutFacet + independent y, focus-context-line is
// LayoutConcat + independent y). The compiled node's SIBLING key would discriminate the
// three — except that a single-mark LayoutLayer emits no `layer` key at all (committed:
// linked-brush-scatter, stacked-area-projection), so the sibling test alone would miss a
// real dual axis. The IR carries the scope unambiguously, and #110 clause 2 explicitly
// permits reading it, so the scope comes from `spec.layout.trait` and the compiled node is
// required as CORROBORATION — the claim stays a compiled-spec property (rule 16 / G9) and
// the facet/concat guards can never fire.

import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import type { AccuracyRuleOutcome } from './types.js';
import { UNREADABLE_COMPILED_NOTE } from './scale-rules.js';

/** The positional scale channels. `color`/`size`/`shape`/`detail` independence is NOT a dual axis. */
const POSITIONAL_SCALES = ['x', 'y'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The COMPILED half, alone: which positional scales the compiled spec resolves independently.
 * Exported from the module (off the public barrel) so the scope-blind discriminating check can
 * compose a scope-blind mutant out of the REAL predicate instead of transcribing it — the
 * facet/concat guard fixtures must make THIS return non-empty while the rule stays silent.
 */
export function compiledIndependentPositionalScales(compiled: unknown): ('x' | 'y')[] {
  if (!isRecord(compiled)) {
    return [];
  }
  const resolve = compiled.resolve;
  if (!isRecord(resolve) || !isRecord(resolve.scale)) {
    return [];
  }
  const scale = resolve.scale;
  return POSITIONAL_SCALES.filter((channel) => scale[channel] === 'independent');
}

/**
 * The IR half, alone: which positional scales the IR declares independent AT LAYER SCOPE.
 * Exported alongside its compiled twin for the same reason.
 */
export function layerScopeIndependentPositionalScales(spec: NormalizedVizSpec): ('x' | 'y')[] {
  const layout = spec.layout;
  if (layout?.trait !== 'LayoutLayer') {
    return [];
  }
  const shared = layout.sharedScales;
  if (!shared) {
    return [];
  }
  return POSITIONAL_SCALES.filter((channel) => shared[channel] === 'independent');
}

export function evaluateDualAxis(spec: NormalizedVizSpec, compiled: unknown): AccuracyRuleOutcome {
  if (!isRecord(compiled)) {
    return { evaluated: false, note: UNREADABLE_COMPILED_NOTE };
  }
  const compiledIndependent = compiledIndependentPositionalScales(compiled);
  const layerScoped = layerScopeIndependentPositionalScales(spec);
  const channels = layerScoped.filter((channel) => compiledIndependent.includes(channel));
  if (channels.length === 0) {
    return { evaluated: true };
  }
  const list = channels.join(' and ');
  return {
    evaluated: true,
    message:
      `layered marks resolve the ${list} scale independently (LayoutLayer sharedScales.${channels.join('/')}:'independent'), ` +
      'so the layers share one plot frame while their positions are set by different scales — where the series cross, ' +
      'converge or diverge is an artifact of the two scales, not of the data. Facet-scope and concat-scope ' +
      'independence are separate panels and are not reported.',
  };
}
