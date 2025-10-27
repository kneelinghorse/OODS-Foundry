/**
 * @file Progress component types
 * @module components/progress/types
 */

/**
 * Intent values for progress indicators, mapped to Statusables tokens
 */
export type ProgressIntent = 'info' | 'success' | 'warning' | 'error';

/**
 * Visual variant of progress indicator
 */
export type ProgressVariant = 'linear' | 'circular';

/**
 * Size variants for progress indicators
 */
export type ProgressSize = 'sm' | 'md' | 'lg';

/**
 * Base props for all progress components
 */
export interface ProgressBaseProps {
  /**
   * Current progress value (0-100). Omit for indeterminate state.
   */
  readonly value?: number;

  /**
   * Maximum value for progress calculation
   * @default 100
   */
  readonly max?: number;

  /**
   * Semantic intent/status of the progress
   * @default 'info'
   */
  readonly intent?: ProgressIntent;

  /**
   * Size of the progress indicator
   * @default 'md'
   */
  readonly size?: ProgressSize;

  /**
   * Accessible label for screen readers
   */
  readonly label?: string;

  /**
   * Force indeterminate state even if value is provided
   */
  readonly isIndeterminate?: boolean;
}

/**
 * Props for linear progress component
 */
export interface ProgressLinearProps
  extends ProgressBaseProps,
    Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {}

/**
 * Props for circular progress component
 */
export interface ProgressCircularProps
  extends ProgressBaseProps,
    Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Diameter of the circular progress in pixels
   * @default 40
   */
  readonly diameter?: number;

  /**
   * Stroke width of the circular progress in pixels
   * @default 4
   */
  readonly strokeWidth?: number;
}
