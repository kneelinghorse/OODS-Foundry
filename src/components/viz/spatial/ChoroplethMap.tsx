/**
 * ChoroplethMap Component
 *
 * Primary spatial visualization component for regional comparisons with color encoding.
 */

import { useMemo, useState, useCallback, type JSX } from 'react';
import type { Feature } from 'geojson';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import type { ProjectionType, ColorScaleType } from '../../../types/viz/spatial.js';
import { useSpatialContext } from './SpatialContext.js';
import { ChoroplethMapRegion } from './ChoroplethMapRegion.js';
import { createProjection } from './utils/projection-utils.js';
import {
  createQuantizeScale,
  createQuantileScale,
  createThresholdScale,
  type ColorScale,
} from './utils/color-scale-utils.js';
import {
  calculateDomain,
  assignColors,
  extractValues,
  type ColorAssignment,
} from './utils/choropleth-utils.js';

/**
 * Table fallback configuration for accessibility.
 */
export interface TableFallbackConfig {
  enabled: boolean;
  caption: string;
}

/**
 * Narrative configuration for accessibility.
 */
export interface NarrativeConfig {
  summary: string;
  keyFindings: string[];
}

/**
 * Accessibility configuration for choropleth map.
 */
export interface ChoroplethA11yConfig {
  description: string;
  tableFallback?: TableFallbackConfig;
  narrative?: NarrativeConfig;
}

/**
 * Props for ChoroplethMap component.
 */
export interface ChoroplethMapProps {
  data: DataRecord[];

  // Encoding
  valueField: string;
  geoJoinKey: string;
  dataJoinKey?: string; // defaults to geoJoinKey

  // Color scale
  colorScale?: ColorScaleType;
  colorRange?: string[];
  thresholds?: number[];

  // Projection (can override container)
  projection?: ProjectionType;
  fitToData?: boolean;

  // Interactions
  onRegionClick?: (feature: Feature, datum: DataRecord | null) => void;
  onRegionHover?: (feature: Feature, datum: DataRecord | null) => void;

  // Accessibility
  a11y: ChoroplethA11yConfig;

  // Renderer preference (for future multi-renderer support)
  preferredRenderer?: 'echarts' | 'vega-lite' | 'svg';
}

/**
 * Default color range using sequential blue scale.
 */
const DEFAULT_COLOR_RANGE = [
  'var(--viz-scale-sequential-blue-1)',
  'var(--viz-scale-sequential-blue-3)',
  'var(--viz-scale-sequential-blue-5)',
  'var(--viz-scale-sequential-blue-7)',
];

/**
 * Choropleth visualization component.
 *
 * Renders filled regions with color encoding based on data values.
 * Integrates with SpatialContainer for projection and geo data.
 */
export function ChoroplethMap({
  data,
  valueField,
  geoJoinKey,
  dataJoinKey: _dataJoinKey,
  colorScale: colorScaleType = 'quantize',
  colorRange = DEFAULT_COLOR_RANGE,
  thresholds,
  onRegionClick,
  onRegionHover,
  a11y,
  preferredRenderer = 'svg',
}: ChoroplethMapProps): JSX.Element {
  // Get spatial context
  const context = useSpatialContext();
  const { projection, features, joinedData, dimensions } = context;

  // Local state for interactions
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [_focusedFeatureId, _setFocusedFeatureId] = useState<string | null>(null);

  // Calculate data domain
  const domain = useMemo(() => calculateDomain(data, valueField), [data, valueField]);

  // Create color scale
  const colorScale = useMemo((): ColorScale => {
    if (colorScaleType === 'quantile') {
      const values = extractValues(data, valueField);
      return createQuantileScale(values, colorRange);
    }

    if (colorScaleType === 'threshold') {
      if (!thresholds || thresholds.length === 0) {
        throw new Error('Threshold scale requires thresholds array');
      }
      return createThresholdScale(thresholds, colorRange);
    }

    // Default: quantize
    return createQuantizeScale(domain, colorRange);
  }, [colorScaleType, domain, colorRange, thresholds, data, valueField]);

  // Assign colors to features
  const colorAssignments = useMemo(
    (): ColorAssignment[] =>
      assignColors(features, joinedData, colorScale, valueField, geoJoinKey),
    [features, joinedData, colorScale, valueField, geoJoinKey]
  );

  // Create lookup map for quick access
  const colorMap = useMemo(() => {
    const map = new Map<string | number | undefined, ColorAssignment>();
    colorAssignments.forEach((assignment) => {
      map.set(assignment.featureId, assignment);
    });
    return map;
  }, [colorAssignments]);

  // Handle region click
  const handleRegionClick = useCallback(
    (feature: Feature, datum: DataRecord | null) => {
      setSelectedFeatureId(String(feature.id));
      if (onRegionClick) {
        onRegionClick(feature, datum);
      }
    },
    [onRegionClick]
  );

  // Handle region hover
  const handleRegionHover = useCallback(
    (feature: Feature, datum: DataRecord | null) => {
      setHoveredFeatureId(String(feature.id));
      if (onRegionHover) {
        onRegionHover(feature, datum);
      }
    },
    [onRegionHover]
  );

  const handleRegionHoverEnd = useCallback(() => {
    setHoveredFeatureId(null);
  }, []);

  // Create projection object from context config
  const projectionObject = useMemo(() => {
    const projType = projection.type || 'mercator';
    return createProjection(projType, projection, dimensions);
  }, [projection, dimensions]);

  // Render SVG choropleth
  if (preferredRenderer === 'svg') {
    return (
      <svg
        width={dimensions.width}
        height={dimensions.height}
        aria-label={a11y.description}
        style={{ display: 'block' }}
      >
        <title>{a11y.description}</title>
        {a11y.narrative && (
          <desc>
            {a11y.narrative.summary}
            {a11y.narrative.keyFindings && a11y.narrative.keyFindings.length > 0
              ? ` Key findings: ${a11y.narrative.keyFindings.join('; ')}`
              : ''}
          </desc>
        )}
        <g role="group" aria-label="Choropleth regions">
          {features.map((feature) => {
            const featureId = feature.id;
            const assignment = colorMap.get(featureId);
            const fillColor = assignment?.color || colorRange[0];

            // Get datum from joined data
            const properties = feature.properties || {};
            const joinKeyValue = properties[geoJoinKey];
            let datum: DataRecord | null = null;
            if (joinKeyValue !== undefined && joinKeyValue !== null) {
              const normalizedKey = String(joinKeyValue).trim().toLowerCase();
              datum = joinedData.get(normalizedKey) || null;
            }

            return (
              <ChoroplethMapRegion
                key={String(featureId) || `feature-${features.indexOf(feature)}`}
                feature={feature}
                projection={projectionObject}
                fillColor={fillColor}
                datum={datum}
                isHovered={String(featureId) === hoveredFeatureId}
                isSelected={String(featureId) === selectedFeatureId}
                isFocused={String(featureId) === _focusedFeatureId}
                onClick={handleRegionClick}
                onHover={handleRegionHover}
                onHoverEnd={handleRegionHoverEnd}
              />
            );
          })}
        </g>
      </svg>
    );
  }

  // Future: ECharts and Vega-Lite renderers
  return (
    <div role="img" aria-label={a11y.description}>
      <p>Renderer &quot;{preferredRenderer}&quot; not yet implemented. Use &quot;svg&quot;.</p>
    </div>
  );
}
