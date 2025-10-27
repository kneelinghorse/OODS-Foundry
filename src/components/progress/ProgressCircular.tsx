/**
 * @file ProgressCircular - Circular progress indicator component
 * @module components/progress/ProgressCircular
 */

import * as React from 'react';
import type { ProgressCircularProps } from './types.js';
import { resolveProgressTokens } from './tokens.js';
import './progress.css';

type ProgressCircularElement = React.ElementRef<'div'>;

/**
 * Circular progress indicator for determinate and indeterminate loading states
 *
 * @example
 * ```tsx
 * // Determinate progress
 * <ProgressCircular value={75} intent="success" label="Processing" />
 *
 * // Indeterminate progress (spinner)
 * <ProgressCircular isIndeterminate intent="info" label="Loading..." />
 * ```
 */
export const ProgressCircular = React.forwardRef<
  ProgressCircularElement,
  ProgressCircularProps
>(
  (
    {
      value,
      max = 100,
      intent = 'info',
      size = 'md',
      diameter = 40,
      strokeWidth = 4,
      label,
      isIndeterminate = false,
      className,
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const resolvedTokens = resolveProgressTokens(intent);
    const resolvedMax = Math.max(max, 0);
    const isDeterminate = !isIndeterminate && value !== undefined;
    const clampedValue = isDeterminate
      ? Math.min(Math.max(value as number, 0), resolvedMax)
      : undefined;
    const percentage =
      isDeterminate && resolvedMax > 0
        ? (clampedValue! / resolvedMax) * 100
        : 0;

    const radius = Math.max((diameter - strokeWidth) / 2, 0);
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = isDeterminate
      ? circumference - (percentage / 100) * circumference
      : circumference * 0.75; // For indeterminate, show 25% of circle

    const mergedClassName = [
      'progress-circular',
      isDeterminate ? 'progress-circular--determinate' : 'progress-circular--indeterminate',
      `progress-circular--${intent}`,
      `progress-circular--${size}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const cssVariables = {
      '--progress-circular-track': resolvedTokens.track,
      '--progress-circular-fill': resolvedTokens.indicator,
      '--progress-circular-diameter': `${diameter}px`,
      '--progress-circular-stroke-width': `${strokeWidth}px`,
    } as React.CSSProperties;

    const mergedStyle = style
      ? ({ ...cssVariables, ...style } as React.CSSProperties)
      : cssVariables;

    // ARIA attributes per WCAG requirements
    const ariaProps = isDeterminate
      ? {
          'aria-valuenow': clampedValue,
          'aria-valuemin': 0,
          'aria-valuemax': resolvedMax,
        }
      : {};
    const ariaLabelProps = label ? { 'aria-label': label } : {};

    return (
      <div
        ref={forwardedRef}
        className={mergedClassName}
        style={mergedStyle}
        role="progressbar"
        data-intent={intent}
        data-size={size}
        {...ariaLabelProps}
        {...ariaProps}
        {...rest}
      >
        <svg
          className="progress-circular__svg"
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
        >
          {/* Track circle */}
          <circle
            className="progress-circular__track"
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={resolvedTokens.track}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            className="progress-circular__fill"
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={resolvedTokens.indicator}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
          />
        </svg>
      </div>
    );
  }
);

ProgressCircular.displayName = 'OODS.ProgressCircular';
