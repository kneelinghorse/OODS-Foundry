export interface TaggableViewData {
  readonly tags?: readonly string[] | null;
  readonly tag_count?: number | null;
}

export interface TaggableTraitOptions {
  readonly traitId?: string;
  readonly maxVisibleTags?: number;
}
