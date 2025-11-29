/**
 * Spatial Context
 *
 * React context for spatial visualization components that provides
 * projection state, layer configuration, and interaction handlers.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Feature } from 'geojson';
import type {
  ProjectionConfig,
  SpatialA11yConfig,
  SpatialLayer,
} from '../../../types/viz/spatial.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import { orderLayers, type OrderedLayerConfig } from './utils/layer-utils.js';

/**
 * Geographic feature type alias.
 */
export type GeoFeature = Feature;

/**
 * Spatial context value providing projection, layers, and interaction state.
 */
export interface SpatialContextValue {
  projection: ProjectionConfig;
  dimensions: { width: number; height: number };
  layers: OrderedLayerConfig[];
  a11y: SpatialA11yConfig;
  features: Feature[];
  joinedData?: Map<string, DataRecord>;

  // Interaction handlers
  handleFeatureClick: (featureId: string) => void;
  handleFeatureHover: (featureId: string | null) => void;

  // State
  hoveredFeature: string | null;
  selectedFeature: string | null;
}

const SpatialContext = createContext<SpatialContextValue | null>(null);

/**
 * Hook to access spatial context.
 *
 * @returns Spatial context value
 * @throws Error if used outside SpatialContextProvider
 */
export function useSpatialContext(): SpatialContextValue {
  const context = useContext(SpatialContext);
  if (!context) {
    throw new Error('useSpatialContext must be used within SpatialContextProvider');
  }
  return context;
}

/**
 * Props for SpatialContextProvider.
 */
export interface SpatialContextProviderProps {
  value: Omit<SpatialContextValue, 'handleFeatureClick' | 'handleFeatureHover' | 'hoveredFeature' | 'selectedFeature'>;
  onFeatureClick?: (feature: GeoFeature, datum?: DataRecord) => void;
  onFeatureHover?: (feature: GeoFeature | null, datum?: DataRecord) => void;
  children: ReactNode;
}

/**
 * Provider component for spatial context.
 */
export function SpatialContextProvider({
  value,
  onFeatureClick,
  onFeatureHover,
  children,
}: SpatialContextProviderProps): JSX.Element {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  // Order layers with stable sort
  const orderedLayers = useMemo(() => {
    return orderLayers(value.layers.map((l) => l.layer));
  }, [value.layers]);

  // Create feature lookup map
  const featureMap = useMemo(() => {
    const map = new Map<string, Feature>();
    value.features.forEach((feature) => {
      const id = feature.id as string | undefined;
      if (id !== undefined) {
        map.set(String(id), feature);
      }
    });
    return map;
  }, [value.features]);

  const handleFeatureClick = (featureId: string): void => {
    const feature = featureMap.get(featureId);
    if (feature) {
      const datum = value.joinedData?.get(featureId);
      onFeatureClick?.(feature, datum);
      setSelectedFeature(featureId);
    }
  };

  const handleFeatureHover = (featureId: string | null): void => {
    if (featureId === null) {
      setHoveredFeature(null);
      onFeatureHover?.(null);
      return;
    }

    const feature = featureMap.get(featureId);
    if (feature) {
      const datum = value.joinedData?.get(featureId);
      setHoveredFeature(featureId);
      onFeatureHover?.(feature, datum);
    }
  };

  const contextValue: SpatialContextValue = useMemo(
    () => ({
      ...value,
      layers: orderedLayers,
      handleFeatureClick,
      handleFeatureHover,
      hoveredFeature,
      selectedFeature,
    }),
    [value, orderedLayers, handleFeatureClick, handleFeatureHover, hoveredFeature, selectedFeature]
  );

  return <SpatialContext.Provider value={contextValue}>{children}</SpatialContext.Provider>;
}

