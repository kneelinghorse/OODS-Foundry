// Auto-generated from traits/archivable.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for archival behavior.
 */
export type ArchivableTraitParameters = ArchivableTraitParameters1 & ArchivableTraitParameters2;
export type ArchivableTraitParameters1 = {
  [k: string]: unknown;
};

export interface ArchivableTraitParameters2 {
  /**
   * Number of days after archival before permanent deletion.
   */
  gracePeriodDays?: number;
  /**
   * Whether archival retains a readable change history.
   */
  retainHistory?: boolean;
  /**
   * Maximum number of days archived entities can be restored.
   */
  restoreWindowDays?: number;
  /**
   * Days the entity remains in soft-deleted state before automatic hard deletion.
   */
  softDeleteDuration?: number;
  /**
   * Whether archived entities can be partially restored.
   */
  allowPartialRestore?: boolean;
}
