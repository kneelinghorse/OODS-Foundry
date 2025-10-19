// Auto-generated from traits/taggable.parameters.schema.json. Do not edit manually.

/**
 * Controls how tags can be attached to composed objects.
 */
export type TaggableTraitParameters = TaggableTraitParameters1 & TaggableTraitParameters2;
export type TaggableTraitParameters1 = {
  [k: string]: unknown;
};

export interface TaggableTraitParameters2 {
  /**
   * Maximum number of tags that can be stored.
   */
  maxTags?: number;
  /**
   * Whether users may add new tags outside the allow list.
   */
  allowCustomTags?: boolean;
  /**
   * Optional allow list of approved tags.
   *
   * @minItems 1
   */
  allowedTags?: [string, ...string[]];
  /**
   * Whether tag comparisons should be case sensitive.
   */
  caseSensitive?: boolean;
}
