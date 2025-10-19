import type { TraitAdapter } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import { Badge } from '../../components/base/Badge.js';
import { Text } from '../../components/base/Text.js';

export interface TaggableViewData {
  readonly tags?: readonly string[] | null;
  readonly tag_count?: number | null;
}

export interface TaggableTraitOptions {
  readonly traitId?: string;
  readonly maxVisibleTags?: number;
}

const DEFAULT_MAX_VISIBLE_TAGS = 4;

function normalizeTags(tags: TaggableViewData['tags']): readonly string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);
}

export function createTaggableTraitAdapter<Data extends TaggableViewData>(
  options: TaggableTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Taggable';
  const maxVisible = Math.max(1, options.maxVisibleTags ?? DEFAULT_MAX_VISIBLE_TAGS);

  const extensions: ViewExtension<Data>[] = [
    {
      id: 'taggable:badges',
      region: 'pageHeader',
      type: 'section',
      priority: 45,
      render: ({ data }) => {
        const tags = normalizeTags(data.tags);
        if (tags.length === 0) {
          return null;
        }

        const visible = tags.slice(0, maxVisible);
        const total =
          typeof data.tag_count === 'number' && Number.isFinite(data.tag_count)
            ? Math.max(tags.length, data.tag_count)
            : tags.length;
        const overflow = Math.max(total - visible.length, 0);

        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
              Tags
            </Text>
            {visible.map((tag) => (
              <Badge key={`tag-${tag}`} tone="neutral">
                #{tag}
              </Badge>
            ))}
            {overflow > 0 ? (
              <Badge key="tag-overflow" tone="neutral">
                +{overflow}
              </Badge>
            ) : null}
          </div>
        );
      },
    },
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
