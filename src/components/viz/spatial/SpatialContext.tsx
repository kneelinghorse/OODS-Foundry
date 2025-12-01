/**
 * Spatial Context
 *
 * React context for spatial visualization components that provides
 * projection state, layer configuration, and interaction handlers.
 */

import { createContext, useContext, type ReactNode, type JSX } from 'react';
import type { Feature } from 'geojson';
import type { GeoProjection } from 'd3-geo';
import type { ProjectionConfig, SpatialA11yConfig } from '../../../types/viz/spatial.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import type { OrderedLayerConfig } from './utils/layer-utils.js';

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
  joinedData: Map<string, DataRecord>;
  project?: (lon: number, lat: number) => [number, number] | null;
  projectionInstance?: GeoProjection;
  bounds?: [[number, number], [number, number]];

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
 * Optional hook that returns null when no SpatialContext provider is present.
 *
 * Useful for components that can accept explicit props but prefer context defaults.
 */
export function useOptionalSpatialContext(): SpatialContextValue | null {
  return useContext(SpatialContext);
}

/**
 * Props for SpatialContextProvider.
 */
export interface SpatialContextProviderProps {
  value: SpatialContextValue;
  children: ReactNode;
}

/**
 * Provider component for spatial context.
 */
export function SpatialContextProvider({ value, children }: SpatialContextProviderProps): JSX.Element {
  return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
}
