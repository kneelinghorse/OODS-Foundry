// Sprint-170 m01 — R4 (aggregation hiding).
//
// A chart that silently aggregates shows a reader ONE mark where the data had MANY rows. The
// mark is not wrong; the reader's inference about what it represents is — "revenue in the
// North" reads as a value when it is a sum of eleven. The distortion is the UNDISCLOSED
// collapse, so the rule needs BOTH halves and fires only on both:
//
//   COLLAPSE   the declared aggregation actually merges rows — some group under the FULL
//              group key (positional dimensions ∪ facet fields ∪ the categorical series
//              channels) holds more than one row. All 13 committed aggregate bindings are
//              IDENTITY (one row per full key), which is why the corpus stays green under a
//              collapse predicate and would NOT under a title-keyword one (G8).
//   NON-DISCLOSURE  none of the three declared text surfaces names the operation.
//
// The group key comes from `drawnCellKeyFields` — the SAME derivation the narrative
// projection, the drawn-value guard and the ECharts cell builder key off (data-analysis.ts
// s160 m2) — with `stacking:false` so the categorical series channels stay IN the key. That
// is deliberately the FINEST key available: a finer key means fewer groups with n>1, so an
// error in this rule's direction is silence, never a false accusation. Facet fields are in
// that derivation, which is what keeps facet-layout.spec.json (8 groups of 1 under the full
// key; 2 groups of 4 under a facet-blind one) silent.

import {
  drawnCellKeyFields,
  getEncodingBinding,
  keyFor,
  resolvePrimaryChannels,
} from '../a11y/data-analysis.js';
import type { EncodingMap, NormalizedVizSpec, TraitBinding } from '../spec/normalized-viz-spec.js';
import { compiledUnitViews } from './compiled-spec.js';
import type { AccuracyRuleOutcome } from './types.js';

type AggregateOp = NonNullable<TraitBinding['aggregate']>;
type Channel = keyof EncodingMap;

const CHANNELS: readonly Channel[] = ['x', 'y', 'x2', 'y2', 'color', 'size', 'shape', 'detail'];

/**
 * The words that DISCLOSE each aggregate operation, as a TYPED EXHAUSTIVE RECORD over the
 * IR's own `TraitBinding['aggregate']` enum: widening that enum without extending this table
 * is a TYPECHECK failure, not a silently-unhandled op. The table is derived from the DECLARED
 * SURFACE (the enum), never from what the fixture corpus happens to contain (standing rule 7b).
 *
 * `average` carries `mean` (and `avg`) because Vega-Lite's own spelling of this op is `mean`
 * — the adapter maps average→mean — so a description written against the rendered spec
 * discloses the same operation under the other name. Matching is word-boundary and
 * case-insensitive, so "minimum" does not disclose `min` by accident and "administration"
 * does not disclose it at all.
 */
const DISCLOSURE_TERMS: Record<AggregateOp, readonly string[]> = {
  sum: ['sum', 'summed', 'total', 'totals', 'totalled', 'totaled'],
  count: ['count', 'counts', 'number of', 'how many', 'tally'],
  average: ['average', 'averaged', 'avg', 'mean'],
  median: ['median'],
  min: ['min', 'minimum', 'lowest', 'smallest'],
  max: ['max', 'maximum', 'highest', 'largest'],
  distinct: ['distinct', 'unique', 'number of distinct'],
};

/** Vega-Lite spells `average` as `mean`; a transform written in Vega's vocabulary is the same op. */
const TRANSFORM_OP_ALIASES: Readonly<Record<string, AggregateOp>> = { mean: 'average' };

const IR_AGGREGATE_OPS = new Set<string>(Object.keys(DISCLOSURE_TERMS));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeForRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary, case-insensitive containment. Deterministic and allocation-local. */
function mentions(haystack: string, term: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(term)}\\b`, 'i').test(haystack);
}

// ---------------------------------------------------------------------------
// The declared aggregations
// ---------------------------------------------------------------------------

export interface DeclaredAggregation {
  /** The IR-enum op, or undefined when a transform declared an op outside that vocabulary. */
  readonly op?: AggregateOp;
  /** The raw op text, for the unevaluable note. */
  readonly rawOp: string;
  /** The binding channel, when the aggregation was declared as a binding. */
  readonly channel?: Channel;
  readonly field?: string;
  /** An explicit group key (`params.groupby`), when the aggregation was declared as a transform. */
  readonly groupBy?: readonly string[];
}

function bindingAggregations(spec: NormalizedVizSpec): DeclaredAggregation[] {
  const found: DeclaredAggregation[] = [];
  const seen = new Set<string>();
  const scan = (map: EncodingMap | undefined): void => {
    if (!map) {
      return;
    }
    for (const channel of CHANNELS) {
      const binding = map[channel];
      if (!binding?.aggregate) {
        continue;
      }
      // The same binding is commonly present both top-level and on marks[].encodings; one
      // declared aggregation, not two.
      const identity = `${channel}\0${binding.aggregate}\0${binding.field}`;
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);
      found.push({ op: binding.aggregate, rawOp: binding.aggregate, channel, field: binding.field });
    }
  };
  scan(spec.encoding);
  for (const mark of spec.marks) {
    scan(mark.encodings);
  }
  return found;
}

/**
 * The transform spelling: `transforms:[{type:'aggregate', params:{aggregate:[{op,field}], groupby:[...]}}]`.
 * `params` is an OPEN object that passes through to Vega-Lite verbatim, so its `op` vocabulary
 * is Vega's, not the IR enum's — anything outside the enum (after the declared `mean` alias) is
 * carried through with `op:undefined` and makes the rule UNEVALUABLE rather than silent-by-luck.
 */
function transformAggregations(spec: NormalizedVizSpec): DeclaredAggregation[] {
  const found: DeclaredAggregation[] = [];
  for (const transform of spec.transforms ?? []) {
    if (transform.type !== 'aggregate' || !transform.params) {
      continue;
    }
    const params = transform.params as Record<string, unknown>;
    const groupBy = Array.isArray(params.groupby)
      ? params.groupby.filter((entry): entry is string => typeof entry === 'string')
      : undefined;
    const entries = Array.isArray(params.aggregate) ? params.aggregate : [params];
    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.op !== 'string') {
        continue;
      }
      const rawOp = entry.op;
      const aliased = TRANSFORM_OP_ALIASES[rawOp] ?? rawOp;
      found.push({
        op: IR_AGGREGATE_OPS.has(aliased) ? (aliased as AggregateOp) : undefined,
        rawOp,
        field: typeof entry.field === 'string' ? entry.field : undefined,
        groupBy,
      });
    }
  }
  return found;
}

export function declaredAggregations(spec: NormalizedVizSpec): DeclaredAggregation[] {
  return [...bindingAggregations(spec), ...transformAggregations(spec)];
}

// ---------------------------------------------------------------------------
// The COLLAPSE half
// ---------------------------------------------------------------------------

/**
 * The full group key an aggregation collapses over. Exported from the module (off the public
 * barrel) so the facet-blind discriminating check can build its mutant by DROPPING a field
 * from this real list rather than transcribing the derivation.
 */
export function collapseGroupKeyFields(spec: NormalizedVizSpec, aggregation: DeclaredAggregation): string[] {
  if (aggregation.groupBy) {
    return [...aggregation.groupBy];
  }
  const measureField = getEncodingBinding(spec, resolvePrimaryChannels(spec).measureChannel)?.field;
  // `stacking:false` keeps the categorical series channels in the key — the finest key the
  // shared spine offers, and the fail-safe direction (finer key ⇒ fewer collapses ⇒ silence).
  return drawnCellKeyFields(spec, measureField ?? aggregation.field ?? '', false);
}

/** Every row-set the IR carries, each evaluated INDEPENDENTLY (a layer's dataset is its own rows). */
export function carriedRowSets(spec: NormalizedVizSpec): Record<string, unknown>[][] {
  const sets: Record<string, unknown>[][] = [];
  const push = (values: unknown): void => {
    if (!Array.isArray(values)) {
      return;
    }
    const rows = values.filter(isRecord);
    if (rows.length > 0) {
      sets.push(rows);
    }
  };
  push(spec.data.values);
  for (const values of Object.values(spec.datasets ?? {})) {
    push(values);
  }
  return sets;
}

/**
 * True when some group under `fields` holds more than one row — the aggregation MERGES. An
 * empty field list means every row falls in one group, which is the no-dimension aggregation
 * (a single number over N rows) and collapses whenever N > 1.
 *
 * Keys are built by the SHARED `keyFor` (NUL join + `\0null` sentinel), never a re-typed join:
 * the s159 space-join collision — two distinct field tuples keying to one string — is exactly
 * the class of bug a transcription here would reintroduce, and it would under-count groups,
 * i.e. INVENT a collapse.
 */
export function anyGroupCollapses(rows: readonly Record<string, unknown>[], fields: readonly string[]): boolean {
  if (rows.length <= 1) {
    return false;
  }
  if (fields.length === 0) {
    return true;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const key = keyFor(row, fields);
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

// ---------------------------------------------------------------------------
// The DISCLOSURE half
// ---------------------------------------------------------------------------

/**
 * The three DECLARED text surfaces, and only those (memo §3 m01.5): the a11y description, the
 * chart title, and the compiled axis title of the aggregated channel. The check is LEXICAL over
 * these surfaces — §4's stated limit. When the aggregation was declared as a TRANSFORM there is
 * no channel to key on, so every compiled axis title is admitted: a superset of surfaces means
 * more disclosure found, i.e. fewer findings — the fail-safe direction.
 */
export function disclosureSurfaces(
  spec: NormalizedVizSpec,
  compiled: unknown,
  aggregation: DeclaredAggregation,
): string[] {
  const surfaces: string[] = [spec.a11y.description];
  if (spec.name) {
    surfaces.push(spec.name);
  }
  for (const view of compiledUnitViews(compiled)) {
    for (const [channel, definition] of Object.entries(view.encoding)) {
      if (aggregation.channel !== undefined && channel !== aggregation.channel) {
        continue;
      }
      if (isRecord(definition) && typeof definition.title === 'string') {
        surfaces.push(definition.title);
      }
    }
  }
  return surfaces;
}

export function disclosesOperation(surfaces: readonly string[], op: AggregateOp): boolean {
  const text = surfaces.join(' \0 ');
  return DISCLOSURE_TERMS[op].some((term) => mentions(text, term));
}

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

export const URL_DATA_NOTE =
  'an aggregation is declared but the IR carries no rows (data is referenced by url), so whether it collapses rows could not be evaluated';

export function outOfVocabularyNote(rawOp: string): string {
  return `a transform declares the aggregate op '${rawOp}', which is outside the IR's aggregate vocabulary, so its disclosure could not be evaluated`;
}

// s176 m03b — the NO-SUBJECT pass, said out loud. A spec that declares no aggregation
// passes this rule vacuously: there was no disclosure to examine, which is a different
// fact from "the disclosure was examined and found honest". The verdict does not move
// (evaluated stays true — the rule genuinely ran and found nothing aggregated; the
// strict s176 invariant: accuracy stays 'pass', conformant and every pillar unmoved),
// but the pass now names its subjectlessness in notes[] so a reader of
// accuracy:'pass' + rulesEvaluated:4 can tell the vacuous pass from an examined one.
export const NO_DECLARED_AGGREGATION_NOTE =
  'no aggregation is declared anywhere in the IR, so there was no disclosure to evaluate — the aggregation-hiding pass has no subject';

export function evaluateAggregationHiding(spec: NormalizedVizSpec, compiled: unknown): AccuracyRuleOutcome {
  const aggregations = declaredAggregations(spec);
  if (aggregations.length === 0) {
    // Nothing is aggregated: the rule ran and there is no distortion to find — and the
    // note says so (s176 m03b honest no-subject reporting; see the constant above).
    return { evaluated: true, note: NO_DECLARED_AGGREGATION_NOTE };
  }

  const outOfVocabulary = aggregations.find((aggregation) => aggregation.op === undefined);
  if (outOfVocabulary) {
    return { evaluated: false, note: outOfVocabularyNote(outOfVocabulary.rawOp) };
  }

  const rowSets = carriedRowSets(spec);
  if (rowSets.length === 0) {
    return { evaluated: false, note: URL_DATA_NOTE };
  }

  for (const aggregation of aggregations) {
    const op = aggregation.op;
    if (!op) {
      continue;
    }
    const fields = collapseGroupKeyFields(spec, aggregation);
    const collapses = rowSets.some((rows) => anyGroupCollapses(rows, fields));
    if (!collapses) {
      continue;
    }
    if (disclosesOperation(disclosureSurfaces(spec, compiled, aggregation), op)) {
      continue;
    }
    const target = aggregation.field ? ` of '${aggregation.field}'` : '';
    const grouped = fields.length > 0 ? `grouped by ${fields.map((field) => `'${field}'`).join(', ')}` : 'over every row';
    return {
      evaluated: true,
      message:
        `a declared '${op}' aggregation${target} ${grouped} merges multiple rows into single marks, and neither the ` +
        'accessible description, the chart title, nor the aggregated axis title says so — a reader sees one mark per ' +
        'group with no indication that it stands for several rows.',
    };
  }

  return { evaluated: true };
}
