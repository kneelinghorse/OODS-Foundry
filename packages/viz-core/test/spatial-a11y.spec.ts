import { describe, expect, it } from 'vitest';
import {
  analyzeSpatial,
  generateNarrativeSummary,
  type SpatialFeatureRow,
} from '@oods/viz-core';

// Sprint-128 m02 / Forge-Demos FD#10: spatial families (choropleth / bubble_map /
// flow_map) join geoData + data at render time, so analyzeSpatial accepts the
// per-feature rows the React fallback already derives and emits the existing
// VizDataAnalysis shape — letting the spatial narrative route through the same
// generateNarrativeSummary path as every other chart type.

const FEATURES: SpatialFeatureRow[] = [
  { id: 's1', featureLabel: 'California', values: { region: 's1', value: 100 } },
  { id: 's2', featureLabel: 'Texas', values: { region: 's2', value: 60 } },
  { id: 's3', featureLabel: 'Nevada', values: { region: 's3', value: 20 } },
];

describe('analyzeSpatial', () => {
  it('builds per-feature rows and extrema, auto-detecting the numeric measure field', () => {
    const analysis = analyzeSpatial({ features: FEATURES });
    expect(analysis.measureField).toBe('value');
    expect(analysis.rowCount).toBe(3);
    expect(analysis.total).toBe(180);
    expect(analysis.max).toEqual({ label: 'California', value: 100 });
    expect(analysis.min).toEqual({ label: 'Nevada', value: 20 });
    // each row carries the feature label + its joined values (the table source).
    expect(analysis.rows[0]).toEqual({ feature: 'California', region: 's1', value: 100 });
    expect(analysis.dimensionValues).toEqual(['California', 'Texas', 'Nevada']);
  });

  it('honors an explicit valueField over auto-detection', () => {
    const features: SpatialFeatureRow[] = [
      { id: 'a', featureLabel: 'A', values: { pop: 5, area: 50 } },
      { id: 'b', featureLabel: 'B', values: { pop: 9, area: 10 } },
    ];
    expect(analyzeSpatial({ features, valueField: 'area' }).max).toEqual({ label: 'A', value: 50 });
    expect(analyzeSpatial({ features, valueField: 'pop' }).max).toEqual({ label: 'B', value: 9 });
  });

  it('yields no measure when no field is numeric across all features', () => {
    const features: SpatialFeatureRow[] = [{ id: 'a', featureLabel: 'A', values: { name: 'x' } }];
    const analysis = analyzeSpatial({ features });
    expect(analysis.measureField).toBeUndefined();
    expect(analysis.total).toBeUndefined();
    expect(analysis.rowCount).toBe(1);
  });
});

describe('spatial narrative via the shared generateNarrativeSummary path', () => {
  it('narrates the spatial analysis like any other type', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSpatial({ features: FEATURES }),
      chartLabel: 'US population map',
      measureLabel: 'Population',
    });
    expect(narrative.status).toBe('ready');
    expect(narrative.summary).toContain('US population map covers 3 data points');
    expect(narrative.keyFindings).toContain('High Population: Population 100 (California)');
    expect(narrative.keyFindings).toContain('Total Population: 180');
  });

  it('lets an author spatial narrative win through the shared precedence', () => {
    const narrative = generateNarrativeSummary({
      analysis: analyzeSpatial({ features: FEATURES }),
      narrative: { summary: 'Hand-authored map summary.', keyFindings: ['Only this'] },
    });
    expect(narrative.summary).toBe('Hand-authored map summary.');
    expect(narrative.keyFindings).toEqual(['Only this']);
  });
});
