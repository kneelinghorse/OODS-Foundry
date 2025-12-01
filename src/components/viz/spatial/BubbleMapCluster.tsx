/**
 * BubbleMapCluster Component
 *
 * Renders a cluster indicator for grouped points with accessible interactions.
 */

import { useCallback, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import type { ClusteredPoint } from './utils/clustering-utils.js';

export interface BubbleMapClusterProps {
  id: string;
  x: number;
  y: number;
  radius: number;
  count: number;
  points: ClusteredPoint[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  tabIndex?: number;
  ariaLabel?: string;
  onClick?: (points: ClusteredPoint[]) => void;
  onHover?: (points: ClusteredPoint[]) => void;
  onHoverEnd?: () => void;
}

export function BubbleMapCluster({
  id,
  x,
  y,
  radius,
  count,
  points,
  fill = 'var(--oods-viz-map-cluster-fill, #6366f1)',
  stroke = 'var(--oods-viz-map-cluster-stroke, #4338ca)',
  strokeWidth = 1.5,
  tabIndex = 0,
  ariaLabel,
  onClick,
  onHover,
  onHoverEnd,
}: BubbleMapClusterProps): JSX.Element {
  const handleClick = useCallback(
    (event: MouseEvent<SVGGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onClick?.(points);
    },
    [onClick, points]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onClick?.(points);
      }
    },
    [onClick, points]
  );

  const handleHover = useCallback(() => {
    onHover?.(points);
  }, [onHover, points]);

  const handleHoverEnd = useCallback(() => {
    onHoverEnd?.();
  }, [onHoverEnd]);

  const label = ariaLabel ?? `Cluster of ${count} points`;

  return (
    <g
      id={id}
      data-testid="bubble-cluster"
      transform={`translate(${x}, ${y})`}
      role="button"
      aria-label={label}
      tabIndex={tabIndex}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHover}
      onBlur={handleHoverEnd}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
    >
      <circle
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={0.9}
      />
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fontSize={Math.max(12, Math.min(radius / 1.5, 18))}
        fill="var(--oods-sys-text-on-accent, #ffffff)"
        fontWeight={600}
        aria-hidden="true"
      >
        {count}
      </text>
    </g>
  );
}
