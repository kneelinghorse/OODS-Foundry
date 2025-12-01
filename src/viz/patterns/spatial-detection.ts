import type { SpatialSpec } from '@/types/viz/spatial.js';

export type SpatialVisualizationType = 'choropleth' | 'bubble' | 'unknown';

export interface SpatialDetectionResult {
  readonly type: SpatialVisualizationType;
  readonly confidence: number;
  readonly detectedFields: {
    readonly geoFields?: string[];
    readonly latField?: string;
    readonly lonField?: string;
    readonly regionField?: string;
    readonly valueField?: string;
  };
  readonly recommendations: string[];
}

const LAT_TOKENS = ['lat', 'latitude', 'y'] as const;
const LON_TOKENS = ['lon', 'longitude', 'lng', 'x'] as const;
const REGION_TOKENS = ['country', 'state', 'province', 'region', 'city', 'zip', 'postal', 'fips', 'iso', 'geo_id'] as const;
const GEO_TOKENS = ['geometry', 'geojson', 'geom', 'shape', 'boundary'] as const;

type FieldStats = {
  readonly occurrences: Map<string, number>;
  readonly presence: Map<string, number>;
  readonly originalNames: Map<string, string>;
};

export function detectSpatialType(data: unknown[]): SpatialDetectionResult {
  if (!Array.isArray(data) || data.length === 0) {
    return buildUnknownResult(['Provide a non-empty array of records for spatial detection.']);
  }

  const rows = data.filter(isRecord);
  if (rows.length === 0) {
    return buildUnknownResult(['Spatial detection expects plain object records.']);
  }

  const stats = collectFieldStats(rows);
  const latField = selectField(stats, LAT_TOKENS);
  const lonField = selectField(stats, LON_TOKENS);
  const regionField = selectField(stats, REGION_TOKENS);
  const geoFields = findAll(stats, GEO_TOKENS);
  const valueField = selectNumericField(rows, [latField, lonField, regionField, ...geoFields]);

  const rowCount = rows.length;
  const latPresence = presenceScore(stats, latField, rowCount);
  const lonPresence = presenceScore(stats, lonField, rowCount);
  const bubbleScore = latField && lonField ? Math.min(latPresence, lonPresence) + 0.4 : 0;

  const regionScore = regionField ? presenceScore(stats, regionField, rowCount) + 0.25 : 0;
  const geoScore = geoFields.length > 0 ? Math.min(1, 0.65 + 0.05 * geoFields.length) : 0;
  const choroplethScore = Math.max(regionScore, geoScore);

  let type: SpatialVisualizationType = 'unknown';
  let confidence = 0;
  if (bubbleScore >= choroplethScore && bubbleScore >= 0.35) {
    type = 'bubble';
    confidence = Math.min(1, bubbleScore);
  } else if (choroplethScore > 0) {
    type = 'choropleth';
    confidence = Math.min(1, choroplethScore);
  }

  const recommendations: string[] = [];
  if (latField && lonField) {
    recommendations.push(`Detected latitude/longitude fields: ${latField}/${lonField}.`);
  }
  if (regionField) {
    recommendations.push(`Detected region identifier: ${regionField}.`);
  }
  if (geoFields.length > 0) {
    recommendations.push(`Detected geometry fields: ${geoFields.join(', ')}.`);
  }
  if (!recommendations.length) {
    recommendations.push('No spatial fields detected. Add lat/lon or region keys to your data.');
  }

  return {
    type,
    confidence: Number(confidence.toFixed(2)),
    detectedFields: {
      geoFields: geoFields.length > 0 ? geoFields : undefined,
      latField: latField ? stats.originalNames.get(latField) ?? latField : undefined,
      lonField: lonField ? stats.originalNames.get(lonField) ?? lonField : undefined,
      regionField: regionField ? stats.originalNames.get(regionField) ?? regionField : undefined,
      valueField: valueField ?? undefined,
    },
    recommendations,
  } satisfies SpatialDetectionResult;
}

function buildUnknownResult(recommendations: string[]): SpatialDetectionResult {
  return {
    type: 'unknown',
    confidence: 0,
    detectedFields: {},
    recommendations,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFieldName(field: string): string {
  return field.trim().toLowerCase();
}

function collectFieldStats(rows: Array<Record<string, unknown>>): FieldStats {
  const occurrences = new Map<string, number>();
  const presence = new Map<string, number>();
  const originalNames = new Map<string, string>();

  rows.forEach((row) => {
    const rowKeys = Object.keys(row).map(normalizeFieldName);
    const uniqueKeys = new Set(rowKeys);
    rowKeys.forEach((key, index) => {
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
      if (!originalNames.has(key)) {
        originalNames.set(key, Object.keys(row)[index]);
      }
    });
    uniqueKeys.forEach((key) => presence.set(key, (presence.get(key) ?? 0) + 1));
  });

  return { occurrences, presence, originalNames };
}

function selectField(stats: FieldStats, tokens: readonly string[]): string | undefined {
  const ranked = tokens
    .map((token) => ({ token, candidates: findCandidates(stats, token) }))
    .flatMap(({ token, candidates }) =>
      candidates.map((key) => ({ key, score: stats.occurrences.get(key) ?? 0, priority: tokenIndex(tokens, token) }))
    )
    .sort((a, b) => b.score - a.score || a.priority - b.priority || a.key.localeCompare(b.key));
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
  const index = tokens.indexOf(token as (typeof tokens)[number]);
  return index >= 0 ? index : tokens.length;
}

function presenceScore(stats: FieldStats, field: string | undefined, totalRows: number): number {
  if (!field || totalRows === 0) {
    return 0;
  }
  const presence = stats.presence.get(field) ?? 0;
  return presence / totalRows;
}

function selectNumericField(
  rows: Array<Record<string, unknown>>,
  excluded: Array<string | undefined>,
): string | undefined {
  const blocked = new Set(excluded.filter(Boolean) as string[]);
  const fieldScores = new Map<string, number>();

  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      const normalized = normalizeFieldName(key);
      if (blocked.has(normalized)) {
        return;
      }
      if (typeof value === 'number') {
        fieldScores.set(normalized, (fieldScores.get(normalized) ?? 0) + 1);
      }
    });
  });

  const sorted = Array.from(fieldScores.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0]?.[0];
}

// SpatialSpec import retained for tree-shaking friendliness when bundling CLI helpers
export type SpatialSpecReference = SpatialSpec;
