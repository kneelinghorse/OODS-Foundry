/**
 * Spatial Context
 *
 * React context for spatial visualization components that provides
 * projection state, layer configuration, and interaction handlers.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Feature } from 'geojson';
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
