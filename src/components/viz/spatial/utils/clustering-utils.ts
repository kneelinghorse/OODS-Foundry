/**
 * Clustering Utilities
 *
 * Grid-based clustering for projected points. Deterministic and fast enough for 1k+ points.
 */

import type { DataRecord } from '../../../../viz/adapters/spatial/geo-data-joiner.js';

export interface ClusterPoint {
  id?: string;
  longitude: number;
  latitude: number;
  datum: DataRecord;
  projected?: [number, number];
  style?: {
    id?: string;
    color?: string;
    radius?: number;
  };
}

export interface ClusteredPoint extends ClusterPoint {
  projected: [number, number];
}

export interface Cluster {
  id: string;
  count: number;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
  points: ClusteredPoint[];
}

export interface ClusterResult {
  clusters: Cluster[];
  points: ClusteredPoint[];
}

function toProjected(
  point: ClusterPoint,
  project: (lon: number, lat: number) => [number, number] | null
): [number, number] | null {
  if (point.projected) {
    return point.projected;
  }
  return project(point.longitude, point.latitude);
}

function buildKey(x: number, y: number, radius: number): string {
  const cellX = Math.floor(x / radius);
  const cellY = Math.floor(y / radius);
  return `${cellX}:${cellY}`;
}

/**
 * Cluster projected points using a grid-based approach.
 */
export function clusterPoints(
  points: ClusterPoint[],
  project: (lon: number, lat: number) => [number, number] | null,
  radius: number,
  minPoints = 2
): ClusterResult {
  if (!Array.isArray(points) || points.length === 0) {
    return { clusters: [], points: [] };
  }

  if (!Number.isFinite(radius) || radius <= 0 || minPoints <= 1) {
    const projected = points
      .map((point) => {
        const projectedCoords = toProjected(point, project);
        return projectedCoords ? { ...point, projected: projectedCoords } : null;
      })
      .filter((candidate): candidate is ClusteredPoint => Boolean(candidate));
    return { clusters: [], points: projected };
  }

  const buckets = new Map<string, ClusteredPoint[]>();

  points.forEach((point) => {
    const projectedCoords = toProjected(point, project);
    if (!projectedCoords) {
      return;
    }
    const projectedPoint: ClusteredPoint = { ...point, projected: projectedCoords };
    const key = buildKey(projectedCoords[0], projectedCoords[1], radius);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(projectedPoint);
    } else {
      buckets.set(key, [projectedPoint]);
    }
  });

  const clusters: Cluster[] = [];
  const unclustered: ClusteredPoint[] = [];

  const entries = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));

  entries.forEach(([key, group], index) => {
    if (group.length >= minPoints) {
      const xs = group.map((p) => p.projected[0]);
      const ys = group.map((p) => p.projected[1]);
      const centroidX = xs.reduce((sum, value) => sum + value, 0) / group.length;
      const centroidY = ys.reduce((sum, value) => sum + value, 0) / group.length;
      clusters.push({
        id: `${key}-${index}`,
        count: group.length,
        centroid: [centroidX, centroidY],
        bounds: [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        points: group,
      });
    } else {
      unclustered.push(...group);
    }
  });

  return { clusters, points: unclustered };
}
