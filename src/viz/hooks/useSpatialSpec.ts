/**
 * useSpatialSpec Hook
 *
 * Processes a spatial visualization specification into render-ready data by
 * resolving geo sources, performing joins, and exposing projection/layer configs.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Feature } from 'geojson';
import { resolveGeoData, type GeoResolverInput } from '../adapters/spatial/geo-data-resolver.js';
import type { DataRecord, JoinConfig } from '../adapters/spatial/geo-data-joiner.js';
import type { ParsedGeoData } from '../adapters/spatial/geo-format-parser.js';
import { mergeLayerDefaults } from '../../components/viz/spatial/utils/layer-utils.js';
import type { ProjectionConfig, SpatialLayer, SpatialSpec, GeoJoinData } from '../../types/viz/spatial.js';

/**
 * Options for useSpatialSpec hook.
 */
export interface UseSpatialSpecOptions {
  spec: SpatialSpec;
  geoSource?: string | ParsedGeoData;
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

function isGeoJoinDataSource(data: SpatialSpec['data']): data is GeoJoinData {
  return typeof data === 'object' && data !== null && 'type' in data && (data as GeoJoinData).type === 'data.geo.join';
}

function resolveGeoSource(options: UseSpatialSpecOptions): string | ParsedGeoData | undefined {
  if (options.geoSource) {
    return options.geoSource;
  }
  if (isGeoJoinDataSource(options.spec.data)) {
    return options.spec.data.geoSource;
  }
  if (options.spec.geo?.source) {
    return options.spec.geo.source as ParsedGeoData | string;
  }
  return undefined;
}

function deriveProjectionConfig(spec: SpatialSpec, dimensions: { width: number; height: number }): ProjectionConfig {
  const projection = spec.projection ?? {};

  return {
    type: projection.type ?? 'mercator',
    center: projection.center,
    scale: projection.scale ?? Math.min(dimensions.width, dimensions.height) / 2,
    rotate: projection.rotate,
    parallels: projection.parallels,
    clipAngle: projection.clipAngle,
    clipExtent: projection.clipExtent,
    precision: projection.precision,
    fitToData: projection.fitToData ?? false,
  };
}

function deriveLayerConfigs(spec: SpatialSpec): SpatialLayer[] {
  return (spec.layers ?? []).map((layer) => mergeLayerDefaults(layer));
}

function deriveJoinConfig(spec: SpatialSpec): JoinConfig | undefined {
  if (isGeoJoinDataSource(spec.data)) {
    return {
      geoKey: spec.data.geoKey,
      dataKey: spec.data.joinKey,
    };
  }
  return undefined;
}

function deriveTabularData(options: UseSpatialSpecOptions): DataRecord[] | undefined {
  if (options.data) {
    return options.data;
  }
  if ('values' in options.spec.data) {
    return options.spec.data.values as DataRecord[] | undefined;
  }
  return undefined;
}

/**
 * Hook that processes spatial spec and provides render-ready data.
 *
 * @param options - Hook options including spec, geo source, data, and dimensions
 * @returns Processed spatial data with loading and error states
 */
export function useSpatialSpec(options: UseSpatialSpecOptions): UseSpatialSpecResult {
  const { spec, dimensions } = options;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [joinedData, setJoinedData] = useState<Map<string, DataRecord>>(new Map());

  const projectionConfig = useMemo(() => deriveProjectionConfig(spec, dimensions), [spec, dimensions]);
  const layerConfigs = useMemo(() => deriveLayerConfigs(spec), [spec]);
  const joinConfig = useMemo(() => deriveJoinConfig(spec), [spec]);
  const resolvedGeoSource = useMemo(() => resolveGeoSource(options), [options.geoSource, spec]);
  const dataFingerprint = useMemo(
    () => JSON.stringify(options.data ?? ('values' in spec.data ? spec.data.values ?? [] : [])),
    [options.data, spec]
  );
  const tabularData = useMemo(() => deriveTabularData(options), [dataFingerprint, spec]);

  useEffect(() => {
    let cancelled = false;

    async function loadData(): Promise<void> {
      setIsLoading(true);
      setError(null);

      if (!resolvedGeoSource) {
        setError(new Error('Geo source is required for spatial visualizations'));
        setFeatures([]);
        setJoinedData(new Map());
        setIsLoading(false);
        return;
      }

      try {
        const resolverInput: GeoResolverInput = {
          geoSource: resolvedGeoSource,
          data: tabularData,
          joinConfig,
        };

        const result = await resolveGeoData(resolverInput);

        if (cancelled) {
          return;
        }

        const convertedFeatures: Feature[] = result.features.map((feature) => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.properties,
          id: feature.id,
        }));

        const convertedJoinedData = new Map<string, DataRecord>();
        if (result.joinedData) {
          result.joinedData.forEach((value, key) => {
            if (Array.isArray(value)) {
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
        const normalizedError = err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        setFeatures([]);
        setJoinedData(new Map());
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [resolvedGeoSource, joinConfig, spec, dataFingerprint]);

  return {
    isLoading,
    error,
    features,
    joinedData,
    projectionConfig,
    layerConfigs,
  };
}
