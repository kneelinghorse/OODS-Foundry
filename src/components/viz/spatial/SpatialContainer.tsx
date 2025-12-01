/**
 * SpatialContainer
 *
 * Root container component for spatial visualizations that manages projection state,
 * layer ordering, and accessibility context. Provides SpatialContext to child components.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import { useSpatialSpec } from '../../../viz/hooks/useSpatialSpec.js';
import { useSpatialProjection } from '../../../viz/hooks/useSpatialProjection.js';
import { SpatialContextProvider, type GeoFeature } from './SpatialContext.js';
import { mergeLayerDefaults, orderLayers } from './utils/layer-utils.js';
import { setupKeyboardNav, announceFeatureFocus } from './utils/keyboard-nav-utils.js';
import { announce as announceToScreenReader } from './utils/screen-reader-utils.js';
import type {
  ProjectionConfig,
  ProjectionType,
  SpatialA11yConfig,
  SpatialLayer,
  SpatialSpec,
} from '../../../types/viz/spatial.js';

export interface SpatialContainerProps {
  spec: SpatialSpec;
  geoData: FeatureCollection;
  data?: DataRecord[];
  width: number;
  height: number;
  projection?: ProjectionType;
  projectionConfig?: ProjectionConfig;
  layers?: SpatialLayer[];
  a11y: SpatialA11yConfig;
  onFeatureClick?: (feature: GeoFeature, datum?: DataRecord) => void;
  onFeatureHover?: (feature: GeoFeature | null, datum?: DataRecord) => void;
  children?: ReactNode;
}

function getFeatureId(feature: Feature, index: number): string {
  const id = feature.id;
  if (id === null || id === undefined) {
    return `feature-${index}`;
  }
  return String(id);
}

function featureLabel(featureId: string, feature: Feature | undefined): string {
  const name = feature?.properties?.name;
  return typeof name === 'string' && name.trim().length > 0 ? name : featureId;
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
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [liveMessage, setLiveMessage] = useState<string>('');

  const spatialSpecResult = useSpatialSpec({
    spec,
    geoSource: geoData,
    data,
    dimensions: { width, height },
  });

  const {
    isLoading,
    error,
    features,
    joinedData,
    projectionConfig: specProjectionConfig,
    layerConfigs: specLayerConfigs,
  } = spatialSpecResult;

  const projectionType: ProjectionType =
    projectionOverride ?? projectionConfigOverride?.type ?? specProjectionConfig.type ?? spec.projection.type ?? 'mercator';

  const projectionConfig: ProjectionConfig = useMemo(
    () => ({
      ...specProjectionConfig,
      ...projectionConfigOverride,
      type: projectionType,
    }),
    [projectionConfigOverride, projectionType, specProjectionConfig]
  );

  const layers = useMemo(
    () => (layersOverride ?? spec.layers ?? specLayerConfigs ?? []).map((layer) => mergeLayerDefaults(layer)),
    [layersOverride, spec.layers, specLayerConfigs]
  );
  const orderedLayers = useMemo(() => orderLayers(layers), [layers]);

  const featureCollection: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features,
    }),
    [features]
  );

  const { project, bounds, projection: projectionInstance } = useSpatialProjection(
    projectionType,
    projectionConfig,
    { width, height },
    featureCollection
  );

  const spatialA11yConfig: SpatialA11yConfig = useMemo(
    () => ({
      description: a11y.description ?? spec.a11y.description,
      ariaLabel: a11y.ariaLabel ?? spec.a11y?.ariaLabel ?? spec.name ?? 'Spatial visualization',
      narrative: a11y.narrative ?? spec.a11y?.narrative,
      tableFallback: a11y.tableFallback ?? spec.a11y?.tableFallback,
    }),
    [a11y, spec]
  );

  const featureIds = useMemo(() => features.map((feature, index) => getFeatureId(feature, index)), [features]);

  const featureMap = useMemo(() => {
    const map = new Map<string, Feature>();
    features.forEach((feature, index) => {
      map.set(featureIds[index], feature);
    });
    return map;
  }, [features, featureIds]);

  const joinedDataMap = useMemo(() => joinedData ?? new Map<string, DataRecord>(), [joinedData]);

  useEffect(() => {
    if (hoveredFeature && !featureMap.has(hoveredFeature)) {
      setHoveredFeature(null);
    }
    if (selectedFeature && !featureMap.has(selectedFeature)) {
      setSelectedFeature(null);
    }
    if (focusedIndex >= featureIds.length) {
      setFocusedIndex(-1);
    }
  }, [featureIds, featureMap, focusedIndex, hoveredFeature, selectedFeature]);

  const tableColumns = useMemo(() => {
    if (a11y.tableFallback?.columns?.length) {
      return a11y.tableFallback.columns;
    }
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    const sampleFeature = features[0];
    if (sampleFeature?.properties) {
      return Object.keys(sampleFeature.properties);
    }
    return [] as string[];
  }, [a11y.tableFallback, data, features]);

  const setLiveAnnouncement = useCallback(
    (message: string, announceSr: boolean = true) => {
      setLiveMessage(message);
      if (announceSr) {
        announceToScreenReader(message);
      }
    },
    []
  );

  const handleFeatureHover = useCallback(
    (featureId: string | null) => {
      if (featureId === null) {
        setHoveredFeature(null);
        setFocusedIndex(-1);
        setLiveAnnouncement('Focus cleared');
        onFeatureHover?.(null);
        return;
      }

      const feature = featureMap.get(featureId);
      if (!feature) {
        return;
      }

      const datum = joinedDataMap.get(featureId);
      setHoveredFeature(featureId);
      setFocusedIndex(featureIds.indexOf(featureId));
      onFeatureHover?.(feature as GeoFeature, datum);
      const message = announceFeatureFocus(feature as GeoFeature, datum as DataRecord | undefined, featureIds.length);
      setLiveAnnouncement(message, false);
    },
    [featureIds, featureMap, joinedDataMap, onFeatureHover, setLiveAnnouncement]
  );

  const handleFeatureClick = useCallback(
    (featureId: string) => {
      const feature = featureMap.get(featureId);
      if (!feature) {
        return;
      }
      const datum = joinedDataMap.get(featureId);
      setSelectedFeature(featureId);
      onFeatureClick?.(feature as GeoFeature, datum);
      setLiveAnnouncement(`Selected ${featureLabel(featureId, feature)}`);
    },
    [featureMap, joinedDataMap, onFeatureClick, setLiveAnnouncement]
  );

  useEffect(() => {
    if (!containerRef.current || featureIds.length === 0) {
      return;
    }

    const cleanup = setupKeyboardNav(containerRef, featureIds, {
      getCurrentFeatureId: () => (focusedIndex >= 0 ? featureIds[focusedIndex] : null),
      onFocus: (featureId) => {
        if (featureId === null) {
          setSelectedFeature(null);
          setHoveredFeature(null);
          setFocusedIndex(-1);
          setLiveAnnouncement('Focus cleared');
          return;
        }
        handleFeatureHover(featureId);
      },
      onSelect: (featureId) => {
        if (featureId) {
          handleFeatureClick(featureId);
        }
      },
      onClear: () => {
        setSelectedFeature(null);
        setHoveredFeature(null);
        setFocusedIndex(-1);
        setLiveAnnouncement('Selection cleared');
      },
      onZoomIn: () => setLiveAnnouncement('Zoom in'),
      onZoomOut: () => setLiveAnnouncement('Zoom out'),
      onPan: (direction) => setLiveAnnouncement(`Pan ${direction}`),
    });

    return cleanup;
  }, [featureIds, focusedIndex, handleFeatureClick, handleFeatureHover, setLiveAnnouncement]);

  const contextValue = useMemo(
    () => ({
      projection: projectionConfig,
      dimensions: { width, height },
      layers: orderedLayers,
      a11y: spatialA11yConfig,
      features,
      joinedData: joinedDataMap,
      handleFeatureClick,
      handleFeatureHover,
      hoveredFeature,
      selectedFeature,
      project,
      projectionInstance,
      bounds,
    }),
    [
      projectionConfig,
      width,
      height,
      orderedLayers,
      spatialA11yConfig,
      features,
      joinedDataMap,
      handleFeatureClick,
      handleFeatureHover,
      hoveredFeature,
      selectedFeature,
      project,
      projectionInstance,
      bounds,
    ]
  );

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
    <SpatialContextProvider value={contextValue}>
      <div
        ref={containerRef}
        id={containerId}
        className="relative"
        style={{ width, height }}
        role="application"
        tabIndex={0}
        aria-label={spatialA11yConfig.ariaLabel}
        aria-describedby={descriptionId}
        data-active-feature={hoveredFeature ?? undefined}
        data-selected-feature={selectedFeature ?? undefined}
      >
        <div id={mapId} className="absolute inset-0" aria-hidden={a11y.tableFallback?.enabled ? 'true' : undefined}>
          {children}
        </div>

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

        {a11y.tableFallback?.enabled && (
          <div id={tableId} className="mt-4">
            <table className="w-full border-collapse">
              {a11y.tableFallback.caption && <caption>{a11y.tableFallback.caption}</caption>}
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {tableColumns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureIds.map((featureId) => {
                  const feature = featureMap.get(featureId);
                  const datum = joinedDataMap.get(featureId);
                  return (
                    <tr key={featureId}>
                      <td>{featureLabel(featureId, feature)}</td>
                      {tableColumns.map((column) => (
                        <td key={column}>{datum ? String((datum as Record<string, unknown>)[column] ?? '') : ''}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="sr-only" aria-live="polite">
          {liveMessage}
        </div>
      </div>
    </SpatialContextProvider>
  );
}
