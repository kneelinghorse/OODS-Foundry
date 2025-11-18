import * as React from 'react';

import type { Tag } from '@/schemas/classification/tag.js';

import './tag-field.css';

export type TagLike = Pick<Tag, 'id' | 'name' | 'slug' | 'usageCount' | 'isCanonical'> & {
  readonly description?: string;
};

export interface TagPillProps {
  readonly tag: TagLike;
  readonly className?: string;
  readonly interactive?: boolean;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly removable?: boolean;
  readonly showUsage?: boolean;
  readonly onClick?: (tag: TagLike, event: React.MouseEvent<HTMLButtonElement | HTMLSpanElement>) => void;
  readonly onRemove?: (tag: TagLike) => void;
}

export function TagPill({
  tag,
  className,
  interactive = false,
  selected = false,
  disabled = false,
  removable = false,
  showUsage = false,
  onClick,
  onRemove,
}: TagPillProps): React.ReactElement {
  const commonProps = {
    className: ['tag-pill', className].filter(Boolean).join(' '),
    'data-interactive': interactive ? 'true' : undefined,
    'data-state': selected ? 'selected' : undefined,
    'data-disabled': disabled ? 'true' : undefined,
  } as const;

  const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      onRemove?.(tag);
    }
  };

  const usage =
    showUsage && typeof tag.usageCount === 'number' ? (
      <span className="tag-pill__meta" aria-hidden="true">
        {tag.usageCount.toLocaleString()}
      </span>
    ) : null;

  const content = (
    <>
      <span className="tag-pill__label">
        <span>{tag.name}</span>
        {tag.slug ? <span className="tag-pill__slug">#{tag.slug}</span> : null}
      </span>
      {usage}
      {removable ? (
        <button
          type="button"
          className="tag-pill__button"
          aria-label={`Remove ${tag.name}`}
          onClick={handleRemove}
          disabled={disabled}
        >
          {'\u00d7'}
        </button>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        {...commonProps}
        aria-pressed={selected || undefined}
        disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(tag, event);
        }}
      >
        {content}
      </button>
    );
  }

  return <span {...commonProps}>{content}</span>;
}
