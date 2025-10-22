import { Badge } from '../../../components/base/Badge.js';
import { Text } from '../../../components/base/Text.js';
import { registerContribution } from '../../../engine/contributions/index.js';
import type { ContextKind } from '../../../contexts/index.js';
import type { ContributionRenderContext } from '../../../engine/contributions/index.js';
import type { TaggableViewData, TaggableTraitOptions } from '../types.js';

interface NormalizeTagResult {
  readonly tags: readonly string[];
  readonly overflow: number;
}

function normalizeTags(
  data: TaggableViewData,
  maxVisible: number
): NormalizeTagResult | null {
  const source = Array.isArray(data.tags) ? data.tags : [];
  const cleaned = source
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);

  if (cleaned.length === 0) {
    return null;
  }

  const visible = cleaned.slice(0, maxVisible);
  const total =
    typeof data.tag_count === 'number' && Number.isFinite(data.tag_count)
      ? Math.max(data.tag_count, cleaned.length)
      : cleaned.length;

  return {
    tags: visible,
    overflow: Math.max(total - visible.length, 0),
  };
}

function renderTagList<Data extends TaggableViewData>(
  ctx: ContributionRenderContext<Data>,
  maxVisible: number
) {
  const data = ctx.renderContext.data as TaggableViewData;
  const normalized = normalizeTags(data, maxVisible);

  if (!normalized) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/60 bg-white/60 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
        Tags
      </Text>
      {normalized.tags.map((tag) => (
        <Badge key={`tag-${tag}`} tone="neutral">
          #{tag}
        </Badge>
      ))}
      {normalized.overflow > 0 ? (
        <Badge key="tag-overflow" tone="neutral">
          +{normalized.overflow}
        </Badge>
      ) : null}
    </div>
  );
}

const DEFAULT_CONTEXTS: readonly ContextKind[] = Object.freeze(['detail', 'list', 'form']);

export interface RegisterTaggableContributionsInput {
  readonly traitId: string;
  readonly options?: TaggableTraitOptions;
  readonly contexts?: readonly ContextKind[];
}

export function registerTaggableContributions<Data extends TaggableViewData>(
  input: RegisterTaggableContributionsInput
): void {
  const { traitId, options, contexts = DEFAULT_CONTEXTS } = input;
  const maxVisible = Math.max(1, options?.maxVisibleTags ?? 4);

  registerContribution<Data>({
    id: `${traitId}:page-header:tag-list`,
    traitId,
    context: contexts,
    region: 'pageHeader',
    priority: 55,
    render: (ctx) => renderTagList(ctx, maxVisible),
  });
}
