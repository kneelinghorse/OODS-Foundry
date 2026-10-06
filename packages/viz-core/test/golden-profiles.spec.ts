import { describe, expect, it } from 'vitest';
import { inferFieldProfile, suggestPatterns, toSchemaIntent } from '@oods/viz-core';

// Committed golden harness (sprint-110 m05): representative real-shaped datasets
// each pinned to a snapshot of its full data-aware pipeline —
//   rows -> FieldProfile[] -> SchemaIntent -> recommendation ranking.
//
// The snapshot IS the golden. Any change to the profiler, intent derivation, or
// scorer that alters a profile/intent/ranking flips the snapshot — the tripwire.
// (Verified to bite: locally perturbing a stat or a weight fails these.)
const FIXTURES: Record<string, Array<Record<string, unknown>>> = {
  // Sales: a categorical region × a monthly axis × a revenue measure.
  sales: [
    { region: 'North', quarter: '2024-01', revenue: 120000 },
    { region: 'South', quarter: '2024-01', revenue: 135000 },
    { region: 'North', quarter: '2024-02', revenue: 128000 },
    { region: 'South', quarter: '2024-02', revenue: 142000 },
  ],
  // Timeseries: a regular monthly axis + a single measure.
  timeseries: [
    { month: '2024-01', visitors: 1000 },
    { month: '2024-02', visitors: 1120 },
    { month: '2024-03', visitors: 1080 },
    { month: '2024-04', visitors: 1240 },
    { month: '2024-05', visitors: 1310 },
    { month: '2024-06', visitors: 1290 },
  ],
  // Two correlated measures, no dimension — the relationship/scatter shape.
  'two-measure': [
    { spend: 100, revenue: 240 },
    { spend: 150, revenue: 355 },
    { spend: 200, revenue: 470 },
    { spend: 250, revenue: 585 },
    { spend: 300, revenue: 700 },
  ],
  // Geo: lat/lon coordinates + a value — geoKind typing (no geo rendering).
  geo: [
    { city: 'NYC', lat: 40.71, lon: -74.0, temp: 11 },
    { city: 'LA', lat: 34.05, lon: -118.24, temp: 19 },
    { city: 'CHI', lat: 41.88, lon: -87.63, temp: 7 },
    { city: 'HOU', lat: 29.76, lon: -95.37, temp: 23 },
  ],
  // Categorical codes: the #686 misclassification shapes (zip / year / currency).
  'categorical-codes': [
    { zip: '02134', year: '2019', currency: 'USD', sales: 4200 },
    { zip: '10001', year: '2020', currency: 'EUR', sales: 5100 },
    { zip: '94103', year: '2021', currency: 'GBP', sales: 6300 },
  ],
};

describe('golden profiles — committed profile -> intent -> ranking', () => {
  for (const [name, rows] of Object.entries(FIXTURES)) {
    it(`${name}: data-aware pipeline matches the committed golden`, () => {
      const profiles = inferFieldProfile(rows);
      const intent = toSchemaIntent(profiles, rows);
      const ranking = suggestPatterns(intent, { limit: 5 }).map((s) => ({
        id: s.pattern.id,
        chartType: s.pattern.chartType,
        score: s.score,
      }));
      expect({ profiles, intent, ranking }).toMatchSnapshot();
    });
  }
});
