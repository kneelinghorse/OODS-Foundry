// Sprint-170 m01 — the COMPILED-SPEC operand shared by R1 (bars) and R3 (areas).
//
// certify hands the rules the object `toVegaLiteSpec` produced. Its shape depends on the
// IR's layout (vega-lite-layout-mapper.ts):
//   no layout / LayoutLayer → `{mark, encoding}` or `{layer:[{mark, encoding}, ...]}`
//   LayoutFacet             → `{facet, spec: <primitive>, resolve}`
//   LayoutConcat            → `{hconcat|vconcat|concat: [<primitive>, ...], resolve}`
// so a rule that wants "every drawn mark and the encoding it renders" must WALK, not index.
// Every rule reads this walk, so the facet/layer/concat axis is covered by construction
// rather than by four separate traversals that could each miss a container (memo §3 m01.8).

/** One compiled Vega-Lite UNIT view: a mark definition plus the encoding it renders. */
export interface CompiledUnitView {
  readonly mark: Record<string, unknown>;
  readonly encoding: Record<string, unknown>;
}

/** The container keys `buildVegaLiteSpec` can nest a primitive under. */
const CONTAINER_KEYS = ['spec', 'layer', 'hconcat', 'vconcat', 'concat'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every unit view in the compiled spec, in document order. Returns [] for anything that is
 * not a readable object — the unresolvable-operand branch every caller treats as silence.
 */
export function compiledUnitViews(compiled: unknown): CompiledUnitView[] {
  const views: CompiledUnitView[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        visit(entry);
      }
      return;
    }
    if (!isRecord(node)) {
      return;
    }
    if (isRecord(node.mark) && isRecord(node.encoding)) {
      views.push({ mark: node.mark, encoding: node.encoding });
    }
    for (const key of CONTAINER_KEYS) {
      if (node[key] !== undefined) {
        visit(node[key]);
      }
    }
  };
  visit(compiled);
  return views;
}

/** The compiled Vega-Lite mark type (`bar`/`line`/`point`/`area`/`rect`), when readable. */
export function unitViewMarkType(view: CompiledUnitView): string | undefined {
  return typeof view.mark.type === 'string' ? view.mark.type : undefined;
}

/**
 * The positional channels a bar/area draws its VALUE on — the axes whose extent-from-the-
 * baseline IS the quantity a reader compares.
 *
 * DERIVATION, stated because it is the judgement R1/R3 rest on: on a bar or an area the
 * quantitative positional channel is the length axis and the band/nominal/temporal channel
 * is the category axis, so "quantitative positional channel" identifies the value axis
 * without reaching outside the compiled spec (#110 clause 2 keeps the rules to the IR + the
 * compiled spec; the adapter's own private baseline-target derivation is not importable and
 * m01.9 pins the adapter byte-untouched). This is a SUPERSET of that private derivation
 * (which takes y-if-quantitative else x), so a `mark.options.baseline:'min'` defect — which
 * the adapter writes onto exactly one of these channels — can never be missed by looking at
 * the wrong axis.
 *
 * EXCLUDED, deliberately: `bin:true` channels (a binned axis is a derived DIMENSION, not the
 * drawn quantity — a histogram's binned x) and the `x2`/`y2` range endpoints (they are
 * separate keys, and a ranged mark is handled by R3's band exclusion).
 */
export function valueAxisChannels(view: CompiledUnitView): ('x' | 'y')[] {
  const channels: ('x' | 'y')[] = [];
  for (const channel of ['x', 'y'] as const) {
    const definition = view.encoding[channel];
    if (!isRecord(definition)) {
      continue;
    }
    if (definition.type !== 'quantitative') {
      continue;
    }
    if (definition.bin === true) {
      continue;
    }
    channels.push(channel);
  }
  return channels;
}

/** True when the view encodes a RANGE (x2/y2) — a band, whose marks encode edge positions. */
export function isRangedView(view: CompiledUnitView): boolean {
  return view.encoding.x2 !== undefined || view.encoding.y2 !== undefined;
}

/** Why a value axis is not a linear scale anchored at zero. */
export type NonLinearZeroCause = 'baseline-moved' | 'log' | 'sqrt';

/**
 * The causes on which a compiled value axis fails to be a LINEAR ZERO-ANCHORED scale, in a
 * fixed order so the message is deterministic.
 *
 *  - `zero:false`  the baseline was moved off zero, so mark extent no longer starts at zero
 *                  (`mark.options.baseline:'min'` compiles to exactly this).
 *  - `type:'log'`  a log scale HAS no zero, so there is no baseline the extent can measure
 *                  from at all.
 *  - `type:'sqrt'` a sqrt scale IS zero-anchored (Vega-Lite defaults `zero` TRUE for it), so
 *                  this is NOT a moved baseline — the defect is that extent grows as √value,
 *                  so a mark twice as long does not represent twice the value.
 *
 * `mark.options.baseline:0`/`'zero'` compiles to `zero:true` and is silent here — that is why
 * the committed diverging-bar fixtures stay green, not because zero sits inside their domain.
 */
export function nonLinearZeroCauses(definition: unknown): NonLinearZeroCause[] {
  if (!isRecord(definition)) {
    return [];
  }
  const scale = definition.scale;
  if (!isRecord(scale)) {
    return [];
  }
  const causes: NonLinearZeroCause[] = [];
  if (scale.zero === false) {
    causes.push('baseline-moved');
  }
  if (scale.type === 'log') {
    causes.push('log');
  }
  if (scale.type === 'sqrt') {
    causes.push('sqrt');
  }
  return causes;
}

/** Per-cause wording. A sqrt scale must never be described as a moved baseline. */
const CAUSE_TEXT: Record<NonLinearZeroCause, string> = {
  'baseline-moved': 'its baseline is moved off zero (scale.zero:false), so mark extent no longer measures value from zero',
  log: 'it is a log scale, on which no zero exists for mark extent to measure from',
  sqrt: 'it is a sqrt scale — zero-anchored, but mark extent grows as the square root of value, so extent is not proportional to value',
};

export function describeCauses(causes: readonly NonLinearZeroCause[]): string {
  return causes.map((cause) => CAUSE_TEXT[cause]).join('; ');
}
