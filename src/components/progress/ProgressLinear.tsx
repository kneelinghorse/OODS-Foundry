/**
 * @file ProgressLinear - Linear progress bar component
 * @module components/progress/ProgressLinear
 */

import * as React from 'react';
import type { ProgressLinearProps } from './types.js';
import { resolveProgressTokens } from './tokens.js';
import './progress.css';

const SIZE_HEIGHT_MAP = {
  sm: '4px',
  md: '6px',
  lg: '8px',
} as const;

type ProgressLinearElement = React.ElementRef<'div'>;

/**
 * Linear progress bar for determinate and indeterminate loading states
 *
 * @example
 * ```tsx
 * // Determinate progress
 * <ProgressLinear value={65} intent="info" label="Upload progress" />
 *
 * // Indeterminate progress
 * <ProgressLinear isIndeterminate intent="info" label="Loading..." />
 * ```
 */
export const ProgressLinear = React.forwardRef<
  ProgressLinearElement,
  ProgressLinearProps
>(
  (
    {
      value,
      max = 100,
      intent = 'info',
      size = 'md',
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

    const height = SIZE_HEIGHT_MAP[size];

    const mergedClassName = [
      'progress-linear',
      isDeterminate ? 'progress-linear--determinate' : 'progress-linear--indeterminate',
      `progress-linear--${intent}`,
      `progress-linear--${size}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const cssVariables = {
      '--progress-linear-track': resolvedTokens.track,
      '--progress-linear-fill': resolvedTokens.indicator,
      '--progress-linear-height': height,
      '--progress-linear-percentage': `${percentage}%`,
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
        <div className="progress-linear__track">
          <div
            className="progress-linear__fill"
            style={
              isDeterminate
                ? { width: `${percentage}%` }
                : undefined
            }
          />
        </div>
      </div>
    );
  }
);

ProgressLinear.displayName = 'OODS.ProgressLinear';
