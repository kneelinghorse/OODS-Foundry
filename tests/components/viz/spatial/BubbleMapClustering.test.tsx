/* @vitest-environment jsdom */

/**
 * Tests for clustering utilities.
 */

import { describe, it, expect } from 'vitest';
import { clusterPoints, type ClusterPoint } from '../../../../src/components/viz/spatial/utils/clustering-utils.js';

function identityProject(lon: number, lat: number): [number, number] {
  return [lon, lat];
}

describe('clusterPoints', () => {
  it('clusters points that fall within the same grid cell', () => {
    const points: ClusterPoint[] = [
      { longitude: 0, latitude: 0, datum: { id: 1 } },
      { longitude: 5, latitude: 5, datum: { id: 2 } },
      { longitude: 50, latitude: 50, datum: { id: 3 } },
    ];

    const result = clusterPoints(points, identityProject, 10, 2);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].count).toBe(2);
    expect(result.points).toHaveLength(1);
  });

  it('returns unclustered points when below threshold', () => {
    const points: ClusterPoint[] = [
      { longitude: 0, latitude: 0, datum: { id: 1 } },
      { longitude: 5, latitude: 5, datum: { id: 2 } },
    ];

    const result = clusterPoints(points, identityProject, 10, 3);
    expect(result.clusters).toHaveLength(0);
    expect(result.points).toHaveLength(2);
  });

  it('ignores points that fail projection', () => {
    const points: ClusterPoint[] = [
      { longitude: 0, latitude: 0, datum: { id: 1 } },
      { longitude: 5, latitude: 5, datum: { id: 2 } },
    ];

    const result = clusterPoints(points, () => null, 10, 2);
    expect(result.clusters).toHaveLength(0);
    expect(result.points).toHaveLength(0);
  });
});
