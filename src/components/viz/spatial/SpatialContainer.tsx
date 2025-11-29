/**
 * SpatialContainer
 *
 * Root container component for spatial visualizations that manages projection state,
 * layer ordering, and accessibility context. Provides SpatialContext to child components.
 */

import { useEffect, useId, useMemo, useRef, type JSX, type ReactNode } from 'react';
import type { FeatureCollection } from 'geojson';
import type { NormalizedVizSpec } from '../../../viz/spec/normalized-viz-spec.js';
import type { ProjectionConfig, ProjectionType, SpatialA11yConfig, SpatialLayer } from '../../../types/viz/spatial.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import { useSpatialSpec } from '../../../viz/hooks/useSpatialSpec.js';
import { useSpatialProjection } from '../../../viz/hooks/useSpatialProjection.js';
import { SpatialContextProvider, type GeoFeature } from './SpatialContext.js';
import { orderLayers } from './utils/layer-utils.js';

/**
 * Props for SpatialContainer component.
 */
export interface SpatialContainerProps {
  /** Normalized visualization specification */
  spec: NormalizedVizSpec;

  /** GeoJSON feature collection */
  geoData: FeatureCollection;

  /** Optional tabular data to join with geo features */
  data?: DataRecord[];

  /** Container width in pixels */
  width: number;

  /** Container height in pixels */
  height: number;

  /** Projection type override */
  projection?: ProjectionType;

  /** Projection configuration override */
  projectionConfig?: ProjectionConfig;

  /** Layer configurations override */
  layers?: SpatialLayer[];

  /** Accessibility configuration */
  a11y: {
    description: string;
    tableFallback?: { enabled: boolean; caption: string };
    narrative?: { summary: string; keyFindings: string[] };
  };

  /** Feature click handler */
  onFeatureClick?: (feature: GeoFeature, datum?: DataRecord) => void;

  /** Feature hover handler */
  onFeatureHover?: (feature: GeoFeature, datum?: DataRecord) => void;

  /** Child components to render */
  children?: ReactNode;
}

/**
 * SpatialContainer component for managing spatial visualization state and context.
 */
export function SpatialContainer({
  spec,
  geoData,
  data,
  width,
  height,
  projection: projectionOverride,
  projectionConfig: projectionConfigOverride,
  layers: layersOverride,
  a11y,
  onFeatureClick,
  onFeatureHover,
  children,
}: SpatialContainerProps): JSX.Element {
  const containerId = useId();
  const mapId = `${containerId}-map`;
  const descriptionId = `${containerId}-description`;
  const tableId = `${containerId}-table`;
  const containerRef = useRef<HTMLDivElement>(null);

  // Use useSpatialSpec to process spec and get features
  const spatialSpecResult = useSpatialSpec({
    spec,
    geoSource: geoData,
    data,
    dimensions: { width, height },
  });

  const { isLoading, error, features, joinedData, projectionConfig: specProjectionConfig, layerConfigs: specLayerConfigs } = spatialSpecResult;

  // Determine projection type and config
  const projectionType: ProjectionType = projectionOverride ?? specProjectionConfig.type ?? 'mercator';
  const projectionConfig: ProjectionConfig = projectionConfigOverride ?? specProjectionConfig;

  // Determine layers
  const layers: SpatialLayer[] = layersOverride ?? specLayerConfigs;

  // Use projection hook
  const featureCollection: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features,
    }),
    [features]
  );

  const { project, bounds } = useSpatialProjection(projectionType, projectionConfig, { width, height }, featureCollection);

  // Convert a11y props to SpatialA11yConfig
  const spatialA11yConfig: SpatialA11yConfig = useMemo(
    () => ({
      description: a11y.description,
      ariaLabel: spec.a11y.ariaLabel ?? spec.name ?? 'Spatial visualization',
      narrative: a11y.narrative,
      tableFallback: a11y.tableFallback,
    }),
    [a11y, spec]
  );

  // Set up keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Make container focusable for keyboard navigation
    container.setAttribute('tabindex', '0');
    container.setAttribute('role', 'application');
    container.setAttribute('aria-label', spatialA11yConfig.ariaLabel ?? spatialA11yConfig.description);

    // Keyboard navigation handler
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Arrow keys for navigating features
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        // TODO: Implement feature navigation logic
        // This would require maintaining a focus index and moving between features
      }

      // Enter/Space to activate focused feature
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        // TODO: Trigger click on focused feature
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [spatialA11yConfig]);

  // Context value - orderLayers returns OrderedLayerConfig[], but context expects layers with layer property
  const orderedLayers = useMemo(() => orderLayers(layers), [layers]);
  
  const contextValue = useMemo(
    () => ({
      projection: projectionConfig,
      dimensions: { width, height },
      layers: orderedLayers,
      a11y: spatialA11yConfig,
      features,
      joinedData: joinedData ?? new Map(),
    }),
    [projectionConfig, width, height, orderedLayers, spatialA11yConfig, features, joinedData]
  );

  // Render loading state
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        id={containerId}
        role="status"
        aria-live="polite"
        aria-label="Loading spatial visualization"
        className="flex items-center justify-center"
        style={{ width, height }}
      >
        <p className="text-text-muted">Loading map data...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        ref={containerRef}
        id={containerId}
        role="alert"
        aria-live="assertive"
        aria-label="Error loading spatial visualization"
        className="flex items-center justify-center"
        style={{ width, height }}
      >
        <p className="text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <SpatialContextProvider value={contextValue} onFeatureClick={onFeatureClick} onFeatureHover={onFeatureHover}>
      <div
        ref={containerRef}
        id={containerId}
        className="relative"
        style={{ width, height }}
        role="application"
        aria-label={spatialA11yConfig.ariaLabel}
        aria-describedby={descriptionId}
      >
        {/* Map container */}
        <div id={mapId} className="absolute inset-0" aria-hidden={a11y.tableFallback?.enabled ? 'true' : undefined}>
          {children}
        </div>

        {/* Description for screen readers */}
        <div id={descriptionId} className="sr-only">
          {spatialA11yConfig.description}
          {spatialA11yConfig.narrative?.summary && <p>{spatialA11yConfig.narrative.summary}</p>}
          {spatialA11yConfig.narrative?.keyFindings && spatialA11yConfig.narrative.keyFindings.length > 0 && (
            <ul>
              {spatialA11yConfig.narrative.keyFindings.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Table fallback for accessibility */}
        {a11y.tableFallback?.enabled && (
          <div id={tableId} className="mt-4">
            <table className="w-full border-collapse">
              {a11y.tableFallback.caption && <caption>{a11y.tableFallback.caption}</caption>}
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {data && data.length > 0 && Object.keys(data[0]).map((key) => <th key={key} scope="col">{key}</th>)}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => {
                  const featureId = (feature.id as string | undefined) ?? `feature-${index}`;
                  const datum = joinedData?.get(String(featureId));
                  return (
                    <tr key={featureId}>
                      <td>{feature.properties?.name ?? featureId}</td>
                      {data &&
                        data.length > 0 &&
                        Object.keys(data[0]).map((key) => (
                          <td key={key}>{datum ? String(datum[key] ?? '') : ''}</td>
                        ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SpatialContextProvider>
  );
}

