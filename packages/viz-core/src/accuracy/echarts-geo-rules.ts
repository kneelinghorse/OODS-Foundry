// Sprint-172 m03 — the choropleth accuracy rule: OODS-V159.

import type { FeatureCollection } from 'geojson';
import { joinGeoWithData, type DataRecord } from '../adapters/spatial/geo-data-joiner.js';
import { registerGeoJson } from '../adapters/spatial/echarts-geo-registration.js';
import type { AccuracyRuleOutcome } from './types.js';
import { differsBeyondTolerance, type EChartsAccuracyOperand } from './echarts-types.js';

/** The tool-input geo branch, read structurally (the rule never assumes more than it checks). */
interface GeoBranchLike {
  readonly geojson?: unknown;
  readonly topojson?: unknown;
  readonly topoObjectName?: string;
  readonly rows?: unknown;
  readonly join?: { readonly dataKey?: string; readonly featureProperty?: string };
  readonly valueField?: string;
}

/**
 * OODS-V159 — a choropleth region whose colour is decided by an arbitrary pick.
 *
 * The joiner supports one-to-many by design: when several records match one feature it
 * merges them with a reduce and keeps the full list on `properties.__joinedRecords`.
 * Merging is last-record-wins, so when those records AGREE on the joined value field the
 * outcome is exactly right and nothing is wrong — benign multiplicity MUST NOT fire, and
 * the joiner's own comment documents one-to-many as supported.
 *
 * The rule fires only on CONFLICT: two or more matched records carrying DIFFERENT values
 * for the field that colours the region. Then the shade the reader sees is whichever record
 * happened to be last in the input array — a data-order artifact presented as a measurement.
 *
 * The join is run through joinGeoWithData with the SAME arguments the choropleth adapter
 * passes (geoKey = the feature property, dataKey = the row key, default case-insensitive
 * matching), so "multi-matched" here means multi-matched by the real join, not by a
 * re-implementation of it.
 */
export function evaluateChoroplethJoinConflict(operand: EChartsAccuracyOperand): AccuracyRuleOutcome {
  const geo = (operand.branchData ?? {}) as GeoBranchLike;
  const join = geo.join;
  const valueField = geo.valueField;

  if (!join?.dataKey || !join?.featureProperty) {
    // No join means one value per feature, straight off its own properties: multi-match
    // cannot occur. That is a positive fact about the operand, not an unresolved operand.
    return { evaluated: true };
  }
  if (!valueField) {
    return {
      evaluated: false,
      note: 'The choropleth branch declares a join but no valueField, so there is no joined value whose conflicts could be checked.',
    };
  }

  let features: FeatureCollection;
  try {
    const source = geo.geojson ?? geo.topojson;
    if (!source) {
      return {
        evaluated: false,
        note: 'The choropleth branch carries no inline geometry, so the join could not be resolved to check for conflicting matches.',
      };
    }
    features = registerGeoJson('geo', source as Parameters<typeof registerGeoJson>[1], {
      topoObjectName: geo.topoObjectName,
    }).geoJson;
  } catch {
    return {
      evaluated: false,
      note: 'The choropleth branch geometry could not be parsed, so the join could not be resolved to check for conflicting matches.',
    };
  }

  const rows = (Array.isArray(geo.rows) ? geo.rows : []) as DataRecord[];
  if (rows.length === 0) {
    return { evaluated: false, note: 'The choropleth branch carries no rows, so there is nothing to join and no conflict to check.' };
  }

  const joined = joinGeoWithData(features.features as never, rows, {
    geoKey: join.featureProperty,
    dataKey: join.dataKey,
  });

  const conflicts: string[] = [];
  for (const feature of joined.features) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const matched = properties.__joinedRecords;
    if (!Array.isArray(matched) || matched.length < 2) {
      continue;
    }
    // Only records that actually CARRY the value field can decide the shade. The joiner
    // merges matches by SPREADING each record over the accumulator
    // (geo-data-joiner.ts: `(acc, record) => ({ ...acc, ...record })`), so a record that
    // OMITS the key contributes nothing to the merged value — reading it as `undefined`
    // and comparing it against a real value manufactured a conflict that the drawn map
    // cannot have (s173 m01, defect 3: sparse rows, the shape a partial-coverage dataset
    // has by construction).
    //
    // `in`, deliberately, NOT `!= null`: an explicit `valueField: null` IS spread, DOES
    // overwrite the accumulator when it is last, and therefore still makes the shade
    // order-dependent — it stays a conflict.
    const values = (matched as DataRecord[])
      .filter((record) => valueField in record)
      .map((record) => record[valueField]);
    if (values.length < 2 || !valuesConflict(values)) {
      continue;
    }
    const label = String(properties[join.featureProperty] ?? feature.id ?? 'unknown');
    conflicts.push(`${label} (${values.map((value) => String(value)).join(' vs ')})`);
  }

  if (conflicts.length === 0) {
    return { evaluated: true };
  }
  return {
    evaluated: true,
    message: `${conflicts.length} region(s) matched several rows carrying DIFFERENT "${valueField}" values: ${conflicts.slice(0, 3).join('; ')}${conflicts.length > 3 ? `; +${conflicts.length - 3} more` : ''}. The join merges matches last-record-wins, so the shade drawn for each of those regions is decided by row order in the input rather than by the data. Aggregate the rows to one value per region, or join on a key that identifies them uniquely.`,
  };
}

/**
 * Do the matched values disagree? Numbers compare under the chartered relative epsilon (two
 * rows reporting 0.1+0.2 and 0.3 for the same region are the same measurement); anything
 * else compares by strict identity after a same-type check.
 */
function valuesConflict(values: readonly unknown[]): boolean {
  const first = values[0];
  return values.slice(1).some((value) => {
    if (typeof first === 'number' && typeof value === 'number') {
      if (!Number.isFinite(first) || !Number.isFinite(value)) {
        return !Object.is(first, value);
      }
      return differsBeyondTolerance(first, value);
    }
    return !Object.is(first, value);
  });
}
