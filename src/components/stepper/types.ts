/**
 * @file Stepper component types
 * @module components/stepper/types
 */

/**
 * Status of an individual step in the stepper
 */
export type StepStatus =
  | 'incomplete'
  | 'current'
  | 'completed'
  | 'error'
  | 'disabled'
  | 'optional';

/**
 * Orientation of the stepper
 */
export type StepperOrientation = 'horizontal' | 'vertical';

/**
 * Descriptor for a single step
 */
export interface StepDescriptor {
  /**
   * Unique identifier for the step
   */
  readonly id: string;

  /**
   * Display label for the step
   */
  readonly label: string;

  /**
   * Optional description or subtitle
   */
  readonly description?: string;

  /**
   * Current status of this step
   */
  readonly status: StepStatus;

  /**
   * Whether the step is disabled and non-interactive
   */
  readonly isDisabled?: boolean;

  /**
   * Whether the step is optional (can be skipped)
   */
  readonly isOptional?: boolean;
}

/**
 * Props for the Stepper component
 */
export interface StepperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /**
   * Array of step descriptors
   */
  readonly steps: readonly StepDescriptor[];

  /**
   * ID of the currently active step
   */
  readonly activeStepId: string;

  /**
   * Layout orientation
   * @default 'horizontal'
   */
  readonly orientation?: StepperOrientation;

  /**
   * Whether to enforce linear progression (users cannot skip ahead)
   * @default true
   */
  readonly isLinear?: boolean;

  /**
   * Callback when a step is clicked
   * Only fires if isLinear is false and step is not disabled
   */
  readonly onStepClick?: (stepId: string) => void;
}
