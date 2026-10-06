// Auto-generated from traits/assessable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for the Assessable trait: which result states the source of truth writes as items rather than only as counts.
 */
export interface AssessableTraitParameters {
  /**
   * The result states the source writes as items. Stage1's a11y evidence writes violations as items and needs-review, passed and not-applicable only as page-level counts.
   *
   * @minItems 1
   */
  recordedStates: [
    'violation' | 'passed' | 'needs_review' | 'not_applicable' | 'not_measured',
    ...('violation' | 'passed' | 'needs_review' | 'not_applicable' | 'not_measured')[]
  ];
}
