// Geo field DETECTION for the field profiler (sprint-110 m01).
//
// Ported from the unshimmed src/viz/patterns/spatial-detection.ts (detectSpatialType)
// — the field-SELECTION core only. Two deliberate trims for the beachhead:
//   1. No `@/types/viz/spatial` SpatialSpec import (it fed only a tree-shake
//      re-export in the source; viz-core depends on @oods/tokens + ajv alone).
//   2. The bubble/choropleth confidence scoring + recommendation strings are
//      omitted — they are RENDERING intent, which stays deferred. This module
//      does TYPING only: it names the lat/lon/region fields so the profiler can
//      stamp `geoKind` on a FieldProfile. NO geo marks are emitted anywhere.
//
// DEVIATION (recorded as a Rule-7 call in the s110-m01 audit): the source's bare
// single-letter lat/lon aliases ('y' for latitude, 'x' for longitude) are NOT
// carried here. In a generic field profiler a column literally named `x`/`y` is
// far more likely a plot axis than a coordinate; the explicit spatial-detection
// entry point keeps them, this typing-only port does not.

const LAT_TOKENS = ['lat', 'latitude'] as const;
const LON_TOKENS = ['lon', 'longitude', 'lng'] as const;
const REGION_TOKENS = [
  'country',
  'state',
  'province',
  'region',
  'city',
  'zip',
  'postal',
  'fips',
  'iso',
  'geo_id',
] as const;
const GEO_TOKENS = ['geometry', 'geojson', 'geom', 'shape', 'boundary'] as const;

export interface GeoFieldDetection {
  /** Original-cased field name detected as a latitude, if any. */
  readonly latField?: string;
  /** Original-cased field name detected as a longitude, if any. */
  readonly lonField?: string;
  /** Original-cased field name detected as a region / geometry identifier, if any. */
  readonly regionField?: string;
}

interface FieldStats {
  readonly occurrences: Map<string, number>;
  readonly originalNames: Map<string, string>;
}

/**
 * Detect the lat/lon/region fields present in a row set. Deterministic: ranking
 * is by occurrence count, then token priority, then field name — no randomness,
 * no host dependence. Returns ORIGINAL field names so callers can match the
 * profiler's field keys directly.
 */
export function detectGeoFields(rows: ReadonlyArray<Record<string, unknown>>): GeoFieldDetection {
  const records = rows.filter(isRecord);
  if (records.length === 0) {
    return {};
  }
  const stats = collectFieldStats(records);
  const latKey = selectField(stats, LAT_TOKENS);
  const lonKey = selectField(stats, LON_TOKENS);
  const regionKey = selectField(stats, REGION_TOKENS) ?? findAll(stats, GEO_TOKENS)[0];

  return {
    latField: latKey ? stats.originalNames.get(latKey) ?? latKey : undefined,
    lonField: lonKey ? stats.originalNames.get(lonKey) ?? lonKey : undefined,
    regionField: regionKey ? stats.originalNames.get(regionKey) ?? regionKey : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFieldName(field: string): string {
  return field.trim().toLowerCase();
}

function collectFieldStats(rows: ReadonlyArray<Record<string, unknown>>): FieldStats {
  const occurrences = new Map<string, number>();
  const originalNames = new Map<string, string>();

  rows.forEach((row) => {
    const keys = Object.keys(row);
    keys.forEach((original) => {
      const key = normalizeFieldName(original);
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
      if (!originalNames.has(key)) {
        originalNames.set(key, original);
      }
    });
  });

  return { occurrences, originalNames };
}

function selectField(stats: FieldStats, tokens: readonly string[]): string | undefined {
  const ranked = tokens
    .flatMap((token) =>
      findCandidates(stats, token).map((key) => ({
        key,
        score: stats.occurrences.get(key) ?? 0,
        priority: tokenIndex(tokens, token),
      })),
    )
    .sort((a, b) => b.score - a.score || a.priority - b.priority || compareKeys(a.key, b.key));
  return ranked[0]?.key;
}

function findAll(stats: FieldStats, tokens: readonly string[]): string[] {
  const keys = new Set<string>();
  tokens.forEach((token) => findCandidates(stats, token).forEach((key) => keys.add(key)));
  return Array.from(keys).sort();
}

function findCandidates(stats: FieldStats, token: string): string[] {
  const matches: string[] = [];
  stats.occurrences.forEach((_, key) => {
    if (fieldMatchesToken(key, token)) {
      matches.push(key);
    }
  });
  return matches;
}

function fieldMatchesToken(field: string, token: string): boolean {
  if (field === token) {
    return true;
  }
  const parts = field.split(/[^a-z0-9]+/).filter(Boolean);
  return parts.includes(token);
}

function tokenIndex(tokens: readonly string[], token: string): number {
  const index = tokens.indexOf(token);
  return index >= 0 ? index : tokens.length;
}

// Locale-INDEPENDENT tie-break: order by UTF-16 code unit, NEVER
// String.prototype.localeCompare. localeCompare is host-locale / ICU dependent
// and is spec-permitted to vary across engines — using it here was a determinism
// hole (same rows could select a different geo field on a different machine).
// `<`/`>` on strings compares code units, which is deterministic and host-independent.
function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
