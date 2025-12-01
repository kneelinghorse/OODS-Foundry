/**
 * ChoroplethMapRegion Component
 *
 * Renders an individual choropleth region with interaction handling.
 */

import { useCallback, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import type { Feature } from 'geojson';
import type { GeoProjection } from 'd3-geo';
import { geoPath } from 'd3-geo';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';

/**
 * Props for ChoroplethMapRegion component.
 */
export interface ChoroplethMapRegionProps {
  feature: Feature;
  projection: GeoProjection;
  fillColor: string;
  datum: DataRecord | null;
  isHovered: boolean;
  isSelected: boolean;
  isFocused: boolean;

  // Stroke styling
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;

  // Interaction handlers
  onClick?: (feature: Feature, datum: DataRecord | null) => void;
  onHover?: (feature: Feature, datum: DataRecord | null) => void;
  onHoverEnd?: () => void;

  // Accessibility
  ariaLabel?: string;
  tabIndex?: number;
}

/**
 * Individual region component for choropleth maps.
 *
 * Handles rendering, interaction, and accessibility for a single geographic region.
 */
export function ChoroplethMapRegion({
  feature,
  projection,
  fillColor,
  datum,
  isHovered,
  isSelected,
  isFocused,
  stroke = '#fff',
  strokeWidth = 1,
  opacity = 1,
  onClick,
  onHover,
  onHoverEnd,
  ariaLabel,
  tabIndex = 0,
}: ChoroplethMapRegionProps): JSX.Element | null {
  // Generate path from feature geometry
  const pathGenerator = geoPath(projection);
  const pathData = pathGenerator(feature);

  // Handle click events
  const handleClick = useCallback(
    (e: MouseEvent<SVGPathElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClick) {
        onClick(feature, datum);
      }
    },
    [feature, datum, onClick]
  );

  // Handle hover events
  const handleMouseEnter = useCallback(() => {
    if (onHover) {
      onHover(feature, datum);
    }
  }, [feature, datum, onHover]);

  const handleMouseLeave = useCallback(() => {
    if (onHoverEnd) {
      onHoverEnd();
    }
  }, [onHoverEnd]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGPathElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) {
          onClick(feature, datum);
        }
      }
    },
    [feature, datum, onClick]
  );

  // Don't render if path generation failed
  if (!pathData) {
    return null;
  }

  // Calculate state-based styling
  const effectiveStrokeWidth = isHovered || isFocused ? strokeWidth * 2 : strokeWidth;
  const effectiveOpacity = isHovered ? Math.min(opacity * 1.2, 1) : opacity;
  const effectiveStroke = isSelected || isFocused ? '#000' : stroke;

  // Generate ARIA label
  const featureId = feature.id ?? 'unknown';
  const properties = feature.properties || {};
  const name = properties.name || properties.NAME || String(featureId);
  const effectiveAriaLabel =
    ariaLabel || `${name}${datum ? `: ${JSON.stringify(datum)}` : ' (no data)'}`;

  return (
    <path
      d={pathData}
      fill={fillColor}
      stroke={effectiveStroke}
      strokeWidth={effectiveStrokeWidth}
      opacity={effectiveOpacity}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
      role="button"
      aria-label={effectiveAriaLabel}
      aria-pressed={isSelected}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        outline: isFocused ? '2px solid #000' : 'none',
        outlineOffset: '2px',
        transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
      }}
    />
  );
}
