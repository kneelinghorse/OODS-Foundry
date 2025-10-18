// Auto-generated from traits/cancellable.parameters.schema.json. Do not edit manually.

/**
 * Parameter contract for traits that add cancellation workflows.
 */
export type CancellableTraitParameters = CancellableTraitParameters1 & CancellableTraitParameters2;
export type CancellableTraitParameters1 = {
  [k: string]: unknown;
};

export interface CancellableTraitParameters2 {
  /**
   * If false, cancellation must happen before the object becomes active.
   */
  allowCancellationAfterStart?: boolean;
  /**
   * Number of hours after activation where cancellation is permitted.
   */
  cancellationWindowHours?: number;
  /**
   * Whether a cancellation reason must be supplied.
   */
  requireReason?: boolean;
  /**
   * Allow list of valid cancellation reason codes.
   *
   * @minItems 1
   */
  allowedReasons?: [string, ...string[]];
}
