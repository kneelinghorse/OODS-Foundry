// Shared field-name heuristics (sprint-155 m04). These name-token helpers were module-local to
// spec-builder.ts (the field profiler's inferFieldType), where they decide a numeric column's TYPE
// (measure vs identifier/zip dimension). s155 m04 extracts them to ONE module so the a11y CLAIM
// layer (data-analysis → the "Total X" gate) derives additivity from the SAME token model the
// profiler uses — the s150 "share the derivation, don't re-derive" recipe — instead of a parallel
// copy that could drift. NOTHING here is re-exported from the package barrel: the a11y barrel is
// `export *` from data-analysis (which imports isProvablyAdditive but does not re-export it), and
// spec-builder imports these without re-exporting, so the public surface is unchanged.

/** Split a field name into lowercased alphanumeric tokens: `total_revenue` → ['total','revenue']. */
export function fieldNameTokens(name: string): string[] {
  return name.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// The HEAD noun of a field name = its last token after stripping a trailing all-digit suffix
// (sprint-154 F2). The digit strip keeps a temporal/version suffix from masking the real head, so
// store_id_2024 / user_id_2 keep head 'id'. Undefined only for an all-digit name (no head noun).
// Consumed by the rule-(3z) head-noun escape to split id_count (aggregate head → measure) from
// sales_id (id head → dimension) — the collision no token-ordering model can express — AND
// (sprint-155 m04) by isProvablyAdditive (the additive-Total gate).
export function headToken(name: string): string | undefined {
  const tokens = fieldNameTokens(name);
  let end = tokens.length;
  while (end > 0 && /^\d+$/.test(tokens[end - 1])) {
    end -= 1;
  }
  return end > 0 ? tokens[end - 1] : undefined;
}

// A conservative measure-name token set (sprint-118 m04). DELIBERATELY excludes 'count' and
// 'score' — those are commonly genuine ordinal scales, so keeping them out preserves the
// rule-(4) ordinal typing for e.g. a 'rating'/'count' column. Extracted to a module constant
// (sprint-154 F2) so the rule-(3z) head-noun escape can test membership against the SAME set
// nameHintsMeasure uses — one source of truth, no drift.
export const MEASURE_NAME_TOKENS: readonly string[] = [
  'value', 'val', 'quantity', 'qty', 'amount', 'amt', 'price', 'cost', 'total', 'revenue', 'sales',
];

// Aggregate-shaped HEAD nouns (sprint-154 F2). When one of these is the head noun of a zip/id
// column (id_count, guid_score, ids_sum), the column is a genuine numeric aggregate and escapes
// the rule-(3z) dimension classification. Includes 'count'/'score' (which nameHintsMeasure omits
// as standalone ordinals) BECAUSE here they qualify an identifier — counting IDs is a measure.
// 'total' is intentionally absent: it is already a MEASURE_NAME_TOKENS member (no duplication).
export const AGGREGATE_HEADS: ReadonlySet<string> = new Set([
  'count', 'counts', 'sum', 'avg', 'average', 'mean', 'median', 'min', 'max', 'score',
]);

export function nameHintsMeasure(name: string): boolean {
  const tokens = fieldNameTokens(name);
  return MEASURE_NAME_TOKENS.some((t) => tokens.includes(t));
}

export function nameHintsZip(name: string): boolean {
  const tokens = fieldNameTokens(name);
  return ['zip', 'zipcode', 'postal', 'postalcode', 'postcode', 'fips'].some((t) => tokens.includes(t));
}

// An IDENTIFIER token set (sprint-152 F2, #895; narrowed sprint-153 F2). A numeric-string
// identifier column (store_id, uuid, guid) is a categorical dimension, never a measure —
// summing or gradient-shading IDs is meaningless. Token-based (via fieldNameTokens) so
// 'store_id'→['store','id'] matches ANYWHERE (.some); overlaps with nameHintsZip ('zip_code') /
// nameHintsCurrencyCode ('currency_code') are harmless (all return 'nominal'). Consumed by the
// rule-(3z) head-noun escape (sprint-154 F2): an id-hinted column stays nominal UNLESS its head
// noun is aggregate/measure-shaped, so id_count/postal_revenue escape while sales_id/id_number do
// not. 'code'/'sku' were DROPPED (sprint-153 F2): as bare tokens they demoted genuine numeric
// measures (lines_of_code, code_coverage, sku_price, sku_revenue) to nominal.
export function nameHintsIdentifier(name: string): boolean {
  const tokens = fieldNameTokens(name);
  return ['id', 'ids', 'uuid', 'guid'].some((t) => tokens.includes(t));
}

// PROVABLY-ADDITIVE HEAD nouns (sprint-155 m04). A "Total <measure>" claim is only honest when
// summing the measure across rows is a MEANINGFUL aggregate. This is a NARROWER positive allowlist
// than MEASURE_NAME_TOKENS (which types a column as a measure): 'price' is a measure but summing
// unit prices is meaningless; 'value'/'val' are measures but too generic to prove additivity. The
// set is the ratified conservative floor (s155 memo §5, m02-verified against the name bank):
// revenue/sales/cost/amount/quantity are additive levels; count/sum/total/subtotal/spend/volume/
// units are aggregate-shaped. Deliberately EXCLUDES price/val/value (documented less-rich: a
// per-unit price or a generic 'value' column loses its Total → silence, never a false sum).
const ADDITIVE_MEASURE_HEADS: ReadonlySet<string> = new Set([
  'revenue', 'sales', 'cost', 'amount', 'quantity', 'count', 'sum', 'total', 'spend', 'volume', 'units', 'subtotal',
]);

// NON-ADDITIVE QUALIFIER tokens (sprint-155 m05 corrective, adversarial-verify closure). An additive
// HEAD noun does NOT prove additivity when a QUALIFIER token makes the column an average / rate /
// share / cumulative running / extremum: `avg_revenue`, `unit_cost`, `running_total`,
// `percent_of_total`, `median_sales` all have an allowlisted head (revenue/cost/total/sales) yet
// summing them is meaningless. If ANY token is one of these qualifiers, the column is NOT provably
// additive regardless of head. Errs toward silence (a missed qualifier is a documented residual, not
// a crash). None overlap ADDITIVE_MEASURE_HEADS, and neutral domain qualifiers (net/gross/daily/
// monthly/store) are deliberately ABSENT — net_revenue / daily_sales stay additive.
// s157 m06 (V2, from the s155 NOT_GENUINE review): distinct/unique CARDINALITY qualifiers. A
// `distinct_count`/`unique_count` has an additive head ('count') but summing distinct counts across
// rows is meaningless (a stack of distinct counts ≠ the distinct-over-the-whole — the "Total Distinct
// count: 6,006" dishonesty). 'distinct'/'unique' were in NON_ADDITIVE_AGGREGATES (blocking a DECLARED
// aggregate:'distinct') but missing here, so the NAME token slipped. Added so a distinct/unique name
// suppresses the Total, mirroring the aggregate membership.
const NON_ADDITIVE_QUALIFIERS: ReadonlySet<string> = new Set([
  'avg', 'average', 'mean', 'median', 'mode',
  'pct', 'percent', 'percentage', 'ratio', 'rate', 'per', 'share',
  'unit', 'running', 'cumulative', 'cumul', 'ytd', 'mtd', 'qtd', 'rolling', 'moving',
  'index', 'weighted', 'normalized', 'stddev', 'stdev', 'variance', 'min', 'max',
  'distinct', 'unique', 'uniq', 'nunique', 'cardinality', 'distinctcount',
]);

// TraitBinding.aggregate values whose result is NOT summable — a caller-declared mean/median/min/
// max/distinct is AUTHORITATIVE that the measure is non-additive, overriding any additive name.
const NON_ADDITIVE_AGGREGATES: ReadonlySet<string> = new Set(['average', 'median', 'min', 'max', 'distinct']);

/**
 * sprint-155 m04 (CLAIM-ON-POSITIVE-EVIDENCE): is summing this measure across rows a PROVABLY
 * meaningful aggregate? Precedence:
 *  1. A caller-declared `aggregate` is AUTHORITATIVE. `sum`/`count` ⇒ additive (the caller asserted
 *     the sum) — EXCEPT never sum a hard identifier/zip even when declared (summing IDs is never
 *     meaningful; the #895 class). `average`/`median`/`min`/`max`/`distinct` ⇒ NOT additive,
 *     overriding any additive name (m05: a mean-aggregated `sales` column must not "Total").
 *  2. Otherwise NAME-based: no token may be a non-additive qualifier (avg/unit/running/percent/…),
 *     AND the HEAD noun must be on the positive additive allowlist. HEAD-noun (not any-token) is
 *     load-bearing: sales_id's 'sales' token must NOT rescue an identifier (#895), while
 *     postal_revenue's 'revenue' head legitimately escapes, and id_max's 'max' head correctly does
 *     not. Not provably additive ⇒ the "Total X" claim is omitted (High/Low/mean still emit).
 */
export function isProvablyAdditive(fieldName: string | undefined, callerAggregate?: string): boolean {
  if (callerAggregate === 'sum' || callerAggregate === 'count') {
    // Declared sum/count is authoritative — but never sum a hard identifier/zip even on request.
    return fieldName === undefined || (!nameHintsIdentifier(fieldName) && !nameHintsZip(fieldName));
  }
  if (callerAggregate !== undefined && NON_ADDITIVE_AGGREGATES.has(callerAggregate)) {
    return false;
  }
  if (fieldName === undefined) {
    return false;
  }
  const tokens = fieldNameTokens(fieldName);
  if (tokens.some((token) => NON_ADDITIVE_QUALIFIERS.has(token))) {
    return false;
  }
  const head = headToken(fieldName);
  return head !== undefined && ADDITIVE_MEASURE_HEADS.has(head);
}
