/**
 * BubbleMapPoint Component
 *
 * Renders an individual point/symbol with keyboard and pointer interactions.
 */

import { useCallback, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner';

export interface BubbleMapPointProps {
  id: string;
  x: number;
  y: number;
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  datum: DataRecord;
  ariaLabel?: string;
  tabIndex?: number;
  isHovered?: boolean;
  isFocused?: boolean;
  onClick?: (datum: DataRecord) => void;
  onHover?: (datum: DataRecord) => void;
  onHoverEnd?: () => void;
}

export function BubbleMapPoint({
  id,
  x,
  y,
  radius,
  fill,
  stroke = 'var(--oods-viz-map-point-stroke, var(--sys-border-strong))',
  strokeWidth = 1,
  opacity = 0.9,
  datum,
  ariaLabel,
  tabIndex = 0,
  isHovered = false,
  isFocused = false,
  onClick,
  onHover,
  onHoverEnd,
}: BubbleMapPointProps): JSX.Element {
  const handleClick = useCallback(
    (event: MouseEvent<SVGCircleElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClick?.(datum);
    },
    [datum, onClick]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGCircleElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onClick?.(datum);
      }
    },
    [datum, onClick]
  );

  const handleHover = useCallback(() => {
    onHover?.(datum);
  }, [datum, onHover]);

  const handleHoverEnd = useCallback(() => {
    onHoverEnd?.();
  }, [onHoverEnd]);

  const effectiveStroke = isFocused ? 'var(--sys-focus-ring)' : stroke;
  const effectiveStrokeWidth = isFocused || isHovered ? strokeWidth * 1.5 : strokeWidth;
  const effectiveOpacity = isHovered ? Math.min(opacity * 1.1, 1) : opacity;

  return (
    <circle
      id={id}
      data-testid="bubble-point"
      cx={x}
      cy={y}
      r={radius}
      fill={fill}
      stroke={effectiveStroke}
      strokeWidth={effectiveStrokeWidth}
      opacity={effectiveOpacity}
      role="button"
      aria-label={ariaLabel ?? 'Map point'}
      aria-pressed={isFocused ? 'true' : undefined}
      tabIndex={tabIndex}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHover}
      onBlur={handleHoverEnd}
      onKeyDown={handleKeyDown}
      style={{
        cursor: 'pointer',
        transition: 'transform 120ms ease, opacity 120ms ease, stroke-width 120ms ease',
        outline: 'none',
      }}
    />
  );
}
