// Field-presence helpers for the opt-in strictFields check (sprint-118 m05).
//
// The silent-wrong class: a referenced field that is ABSENT from every row is treated as
// "no numeric data" (KPI value:0) or a confident-wrong spec (chart), not "field does not
// exist". Under strictFields these helpers surface the absent field as OODS-V131 at the
// mcp-server ingestion boundary — BEFORE compute/build, never inside computeKpi.

// The tabular encoding channels a chart can reference (mirrors viz.render.input.json
// encodings: x/y/color/size/shape/detail).
const ENCODING_CHANNELS = ['x', 'y', 'color', 'size', 'shape', 'detail'] as const;

/**
 * Collect the field names referenced by a tabular `encodings` object — each channel binding
 * is a bare field-name string or a `{ field }` object. Accepts `unknown` so both the viz.render
 * input and a dashboard ChartPanel can pass their encodings without a cast.
 */
export function referencedEncodingFields(encodings: unknown): string[] {
  if (!encodings || typeof encodings !== 'object') {
    return [];
  }
  const enc = encodings as Record<string, unknown>;
  const fields: string[] = [];
  for (const channel of ENCODING_CHANNELS) {
    const binding = enc[channel];
    if (typeof binding === 'string') {
      fields.push(binding);
    } else if (binding && typeof binding === 'object' && typeof (binding as { field?: unknown }).field === 'string') {
      fields.push((binding as { field: string }).field);
    }
  }
  return fields;
}

/**
 * The referenced fields NOT present as a key in any row. EMPTY rows return [] — an empty
 * dataset (e.g. the frozen-D6 missing-datasetId path) is NOT a field-presence failure and
 * stays on its legacy silent-empty path; only a NON-empty dataset missing a referenced key
 * is a typo/absent-field (OODS-V131).
 */
export function absentFields(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: readonly string[],
): string[] {
  if (rows.length === 0 || fields.length === 0) {
    return [];
  }
  const present = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      present.add(key);
    }
  }
  return fields.filter((field) => !present.has(field));
}
