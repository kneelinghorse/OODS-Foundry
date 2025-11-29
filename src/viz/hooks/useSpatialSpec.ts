/**
 * useSpatialSpec Hook
 *
 * React hook that processes spatial visualization specifications and provides
 * render-ready data including GeoJSON features, joined data, and projection config.
 */

import { useEffect, useState } from 'react';
import type { Feature } from 'geojson';
import type { NormalizedVizSpec } from '../spec/normalized-viz-spec.js';
import { resolveGeoData, type GeoResolverInput } from '../adapters/spatial/geo-data-resolver.js';
import type { DataRecord } from '../adapters/spatial/geo-data-joiner.js';
import type { ProjectionConfig, ProjectionType, SpatialLayer } from '../../types/viz/spatial.js';

/**
 * Options for useSpatialSpec hook.
 */
export interface UseSpatialSpecOptions {
  spec: NormalizedVizSpec;
  geoSource: string | GeoJSON.FeatureCollection | TopoJSON.Topology;
  data?: DataRecord[];
  dimensions: { width: number; height: number };
}

/**
 * Result of useSpatialSpec hook.
 */
export interface UseSpatialSpecResult {
  isLoading: boolean;
  error: Error | null;
  features: Feature[];
  joinedData: Map<string, DataRecord>;
  projectionConfig: ProjectionConfig;
  layerConfigs: SpatialLayer[];
}

/**
 * Extracts projection configuration from normalized viz spec.
 */
function extractProjectionConfig(spec: NormalizedVizSpec): ProjectionConfig {
  const layout = spec.layout;
  const projection: ProjectionConfig = {
    type: 'mercator', // Default
  };

  // Check layout.projection (from LayoutLayer or LayoutFacet)
  if (layout && 'projection' in layout && layout.projection) {
    const layoutProj = layout.projection;
    if (layoutProj.type) {
      projection.type = layoutProj.type as ProjectionType;
    }
    if (layoutProj.center) {
      projection.center = layoutProj.center as [number, number];
    }
    if (layoutProj.scale !== undefined) {
      projection.scale = layoutProj.scale;
    }
    if (layoutProj.rotate !== undefined) {
      projection.rotate = [layoutProj.rotate, 0, 0];
    }
  }

  // Check config for overrides
  if (spec.config?.layout) {
    // Config can override layout dimensions but not projection type
    // (projection type is a trait-level decision)
  }

  return projection;
}

/**
 * Extracts layer configurations from normalized viz spec marks.
 * Converts marks to SpatialLayer format.
 */
function extractLayerConfigs(spec: NormalizedVizSpec): SpatialLayer[] {
  const layers: SpatialLayer[] = [];

  spec.marks.forEach((mark, index) => {
    // For now, we'll create a basic layer structure
    // In a full implementation, this would parse mark.trait to determine layer type
    // and extract encoding information

    // Default to regionFill for spatial visualizations
    // This is a simplified implementation - full version would inspect mark.trait
    const layer: SpatialLayer = {
      type: 'regionFill',
      encoding: {
        color: {
          field: 'value', // Placeholder - would come from mark encoding
        },
      },
      zIndex: index,
    };

    layers.push(layer);
  });

  return layers;
}

/**
 * Extracts join configuration from spec data structure.
 */
function extractJoinConfig(spec: NormalizedVizSpec): { geoKey: string; dataKey: string } | undefined {
  // If spec.data has join information, extract it
  // This is a simplified version - full implementation would parse spec.data structure
  // For now, return undefined (no join) or use defaults
  return undefined;
}

/**
 * Hook that processes spatial spec and provides render-ready data.
 *
 * @param options - Hook options including spec, geo source, data, and dimensions
 * @returns Processed spatial data with loading and error states
 */
export function useSpatialSpec(options: UseSpatialSpecOptions): UseSpatialSpecResult {
  const { spec, geoSource, data, dimensions } = options;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [joinedData, setJoinedData] = useState<Map<string, DataRecord>>(new Map());

  // Extract configuration (these don't depend on async operations)
  const projectionConfig = extractProjectionConfig(spec);
  const layerConfigs = extractLayerConfigs(spec);
  const joinConfig = extractJoinConfig(spec);

  useEffect(() => {
    let cancelled = false;

    async function loadData(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        // Prepare resolver input
        const resolverInput: GeoResolverInput = {
          geoSource: typeof geoSource === 'string' ? geoSource : geoSource,
          data,
          joinConfig: joinConfig
            ? {
                geoKey: joinConfig.geoKey,
                dataKey: joinConfig.dataKey,
              }
            : undefined,
        };

        // Resolve geo data
        const result = await resolveGeoData(resolverInput);

        if (cancelled) {
          return;
        }

        // Convert GeoJSONFeature[] to Feature[]
        const convertedFeatures: Feature[] = result.features.map((f) => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: f.properties,
          id: f.id,
        }));

        // Convert joined data
        const convertedJoinedData = new Map<string, DataRecord>();
        if (result.joinedData) {
          result.joinedData.forEach((value, key) => {
            // Handle one-to-many joins (value can be array)
            if (Array.isArray(value)) {
              // For now, take first record
              if (value.length > 0) {
                convertedJoinedData.set(key, value[0]);
              }
            } else {
              convertedJoinedData.set(key, value);
            }
          });
        }

        setFeatures(convertedFeatures);
        setJoinedData(convertedJoinedData);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [geoSource, data, joinConfig]);

  return {
    isLoading,
    error,
    features,
    joinedData,
    projectionConfig,
    layerConfigs,
  };
}

