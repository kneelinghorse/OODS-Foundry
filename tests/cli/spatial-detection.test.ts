import { describe, expect, it } from 'vitest';
import { detectSpatialType } from '@/viz/patterns/spatial-detection.js';

describe('spatial detection', () => {
  it('detects bubble maps via latitude/longitude fields', () => {
    const data = [
      { city: 'San Francisco', latitude: 37.7749, longitude: -122.4194, magnitude: 120 },
      { city: 'New York', latitude: 40.7128, longitude: -74.006, magnitude: 150 },
    ];

    const result = detectSpatialType(data);

    expect(result.type).toBe('bubble');
    expect(result.detectedFields.latField).toBe('latitude');
    expect(result.detectedFields.lonField).toBe('longitude');
    expect(result.detectedFields.valueField).toBe('magnitude');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects choropleth via region identifiers', () => {
    const data = [
      { state: 'CA', sales: 120 },
      { state: 'WA', sales: 80 },
    ];

    const result = detectSpatialType(data);

    expect(result.type).toBe('choropleth');
    expect(result.detectedFields.regionField).toBe('state');
    expect(result.detectedFields.valueField).toBe('sales');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects choropleth via geometry fields', () => {
    const data = [
      {
        geometry: { type: 'Polygon', coordinates: [] },
        metric: 42,
      },
    ];

    const result = detectSpatialType(data);

    expect(result.type).toBe('choropleth');
    expect(result.detectedFields.geoFields).toContain('geometry');
    expect(result.detectedFields.valueField).toBe('metric');
  });

  it('returns unknown for non-spatial datasets', () => {
    const data = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ];

    const result = detectSpatialType(data);

    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.recommendations[0]).toContain('No spatial fields');
  });
});
