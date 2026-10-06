// Auto-generated from traits/auditable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Auditable trait's audit trail.
 */
export interface AuditableTraitParameters {
  /**
   * Number of days to retain audit log entries. 0 means indefinite.
   */
  retentionDays?: number;
  /**
   * When true, every state transition must include a reason string.
   */
  requireTransitionReason?: boolean;
  /**
   * When true, actor_id is captured on each transition.
   */
  trackActorId?: boolean;
}
