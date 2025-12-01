/**
 * ChoroplethMapRegion Component
 *
 * Renders an individual choropleth region with interaction handling.
 */

import tokensBundle from '@oods/tokens';
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
  isFocused?: boolean;
  valueField?: string;

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
  isFocused = false,
  valueField,
  stroke = 'var(--viz-map-region-stroke)',
  strokeWidth = 1,
  opacity = 1,
  onClick,
  onHover,
  onHoverEnd,
  ariaLabel,
  tabIndex = 0,
}: ChoroplethMapRegionProps): JSX.Element | null {
  const cssMap: Record<string, string> = (tokensBundle?.cssVariables as Record<string, string>) ?? {};

  const normalizeTokenName = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

  const parseCssVariable = (color: string): string | undefined => {
    const match = color.match(/var\((--[^,)\s]+)/);
    return match ? normalizeTokenName(match[1]) : undefined;
  };

  const parseOklch = (value: string): { l: number; c: number; h: number } | undefined => {
    const match = value
      .replace(/deg/gi, '')
      .replace(/\s+/g, ' ')
      .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);
    if (!match) return undefined;
    const l = match[1].includes('%') ? Number.parseFloat(match[1]) / 100 : Number(match[1]);
    const c = Number(match[2]);
    const h = Number(match[3]);
    if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return undefined;
    return { l, c, h };
  };

  const convertOklchToRgb = (input: string): string | undefined => {
    const parsed = parseOklch(input);
    if (!parsed) return undefined;
    const { l, c, h } = parsed;
    const hr = (h * Math.PI) / 180;
    const a = Math.cos(hr) * c;
    const b = Math.sin(hr) * c;
    const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
    const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
    const s1 = l - 0.0894841775 * a - 1.291485548 * b;
    const l3 = l1 ** 3;
    const m3 = m1 ** 3;
    const s3 = s1 ** 3;
    const linearToSrgb = (value: number): number => {
      if (value <= 0.0) return 0;
      if (value >= 1.0) return 1;
      if (value <= 0.0031308) return 12.92 * value;
      return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    };
    const clampChannel = (channel: number): number =>
      Math.round(Math.min(255, Math.max(0, channel * 255)));

    const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

    return `rgb(${clampChannel(linearToSrgb(rLinear))}, ${clampChannel(
      linearToSrgb(gLinear)
    )}, ${clampChannel(linearToSrgb(bLinear))})`;
  };

  const resolveColorValue = (color: string): string => {
    const tokenName = parseCssVariable(color);
    if (!tokenName) {
      return color.toLowerCase().startsWith('oklch(') ? convertOklchToRgb(color) ?? color : color;
    }
    const direct = cssMap[tokenName];
    const fallback =
      tokenName.startsWith('--oods-') || tokenName.startsWith('--viz')
        ? undefined
        : cssMap[`--oods-${tokenName.slice(2)}`];
    const resolved = direct ?? fallback ?? color;
    if (resolved.toLowerCase().startsWith('oklch(')) {
      return convertOklchToRgb(resolved) ?? resolved;
    }
    return resolved;
  };

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
  const hoverStroke = resolveColorValue('var(--viz-map-region-hover-stroke)');
  const focusStroke = resolveColorValue('var(--sys-focus-ring)');
  const baseStroke = resolveColorValue(stroke);
  const effectiveStrokeWidth = isHovered || isFocused ? strokeWidth * 2 : strokeWidth;
  const effectiveOpacity = isHovered ? Math.min(opacity * 1.2, 1) : opacity;
  const effectiveStroke = isSelected || isFocused ? focusStroke : isHovered ? hoverStroke : baseStroke;

  // Generate ARIA label
  const featureId = feature.id ?? 'unknown';
  const properties = feature.properties || {};
  const name = properties.name || properties.NAME || String(featureId);
  const valueText =
    valueField && datum && valueField in datum && (datum as Record<string, unknown>)[valueField] !== undefined
      ? String((datum as Record<string, unknown>)[valueField])
      : undefined;
  const effectiveAriaLabel = ariaLabel || (valueText ? `${name}: ${valueText}` : name);

  return (
    <path
      d={pathData}
      fill={resolveColorValue(fillColor)}
      stroke={resolveColorValue(effectiveStroke)}
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
        outline: isFocused ? `2px solid ${focusStroke}` : 'none',
        outlineOffset: '2px',
        transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
      }}
    />
  );
}
