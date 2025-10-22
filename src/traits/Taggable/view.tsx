import type { TraitAdapter } from '../../types/render-context.js';
import { registerTaggableContributions } from './contrib/taggable-contributions.js';
import type { TaggableTraitOptions, TaggableViewData } from './types.js';

export function createTaggableTraitAdapter<Data extends TaggableViewData>(
  options: TaggableTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Taggable';

  registerTaggableContributions<Data>({
    traitId,
    options,
  });

  return Object.freeze({
    id: traitId,
    view: () => [],
  });
}
