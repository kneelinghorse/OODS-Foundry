import * as React from 'react';

import type { Tag } from '@/schemas/classification/tag.js';

import { TagPill, type TagLike } from './TagPill.js';
import './tag-field.css';

export interface TagListProps {
  readonly tags: readonly TagLike[] | readonly Tag[];
  readonly maxVisible?: number;
  readonly density?: 'comfortable' | 'compact';
  readonly interactive?: boolean;
  readonly showUsage?: boolean;
  readonly className?: string;
  readonly emptyState?: React.ReactNode;
  readonly ariaLabel?: string;
  readonly overflowLabel?: (hiddenCount: number, expanded: boolean) => string;
  readonly onTagClick?: (tag: TagLike) => void;
  readonly onRemoveTag?: (tag: TagLike) => void;
}

export function TagList({
  tags,
  maxVisible = 12,
  density = 'comfortable',
  interactive = false,
  showUsage = false,
  className,
  emptyState,
  ariaLabel,
  overflowLabel = (count, expanded) => (expanded ? 'Show fewer' : `+${count} more`),
  onTagClick,
  onRemoveTag,
}: TagListProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);

  const effectiveTags = Array.isArray(tags) ? tags : [];
  const visibleLimit = expanded || !maxVisible ? effectiveTags.length : maxVisible;
  const visibleTags = effectiveTags.slice(0, visibleLimit);
  const overflowCount = Math.max(effectiveTags.length - visibleTags.length, 0);

  if (effectiveTags.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className} data-density={density}>
      <ul className="tag-list" aria-label={ariaLabel} role="list">
        {visibleTags.map((tag) => (
          <li key={tag.id} role="listitem">
            <TagPill
              tag={tag as TagLike}
              interactive={interactive}
              showUsage={showUsage}
              onClick={
                interactive
                  ? (current, event) => {
                      event.preventDefault();
                      onTagClick?.(current);
                    }
                  : undefined
              }
              removable={Boolean(onRemoveTag)}
              onRemove={onRemoveTag}
            />
          </li>
        ))}
      </ul>
      {overflowCount > 0 ? (
        <button
          type="button"
          className="tag-list__overflow-button"
          onClick={() => setExpanded((value) => !value)}
        >
          {overflowLabel(overflowCount, expanded)}
        </button>
      ) : null}
    </div>
  );
}
