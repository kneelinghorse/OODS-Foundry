import * as React from 'react';
import type { CategoryNode } from '@/schemas/classification/category-node.js';

export interface CategoryNodeRowProps {
  readonly data: CategoryNode;
  readonly level: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
  readonly isSelected: boolean;
  readonly isFocused: boolean;
  readonly isMatch: boolean;
  readonly isDropTarget?: boolean;
  readonly isDragSource?: boolean;
  readonly selectionStyle: 'highlight' | 'checkbox';
  readonly badge?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly multiSelect?: boolean;
  readonly setSize: number;
  readonly position: number;
  readonly onToggle?: () => void;
  readonly onSelect?: (event?: React.SyntheticEvent) => void;
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  readonly onFocus?: () => void;
  readonly draggable?: boolean;
  readonly onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  readonly onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  readonly onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  readonly onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
  readonly disableSelection?: boolean;
}

export function CategoryNodeRow({
  data,
  level,
  hasChildren,
  isExpanded,
  isSelected,
  isFocused,
  isMatch,
  isDropTarget = false,
  isDragSource = false,
  selectionStyle,
  badge,
  description,
  multiSelect = false,
  setSize,
  position,
  onToggle,
  onSelect,
  onKeyDown,
  onFocus,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  disableSelection = false,
}: CategoryNodeRowProps): React.ReactElement {
  const handleToggleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle?.();
    },
    [onToggle]
  );

  const handleSelect = React.useCallback(
    (event?: React.SyntheticEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (disableSelection || !data.isSelectable) {
        return;
      }
      onSelect?.(event);
    },
    [data.isSelectable, disableSelection, onSelect]
  );

  const handleFocus = React.useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  return (
    <div
      className="category-tree__node"
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={disableSelection ? undefined : isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-level={level}
      aria-setsize={setSize}
      aria-posinset={position}
      onKeyDown={onKeyDown}
      onFocus={handleFocus}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-focused={isFocused ? 'true' : undefined}
      data-selected={isSelected ? 'true' : undefined}
      data-match={isMatch ? 'true' : undefined}
      data-drop-target={isDropTarget ? 'true' : undefined}
      data-drag-source={isDragSource ? 'true' : undefined}
      style={{ '--category-tree-level': String(level) } as React.CSSProperties}
    >
      <div className="category-tree__node-content">
        {hasChildren ? (
          <button
            type="button"
            className="category-tree__toggle"
            tabIndex={-1}
            aria-hidden="true"
            onClick={handleToggleClick}
          >
            <span className="category-tree__toggle-icon" aria-hidden="true" />
          </button>
        ) : (
          <span className="category-tree__toggle-spacer" aria-hidden="true" />
        )}
        {selectionStyle === 'checkbox' ? (
          <label
            className="category-tree__checkbox"
            onMouseDown={(event) => event.preventDefault()}
          >
            <input
              type="checkbox"
              tabIndex={-1}
              checked={isSelected}
              onChange={handleSelect}
              aria-label={`Select ${data.name}`}
              disabled={disableSelection || !data.isSelectable}
            />
            <span className="category-tree__checkbox-decoration" aria-hidden="true" />
          </label>
        ) : (
          <span className="category-tree__bullet" aria-hidden="true" />
        )}
        <button
          type="button"
          className="category-tree__label"
          tabIndex={-1}
          onClick={() => handleSelect()}
          aria-label={`View ${data.name}`}
        >
          <span className="category-tree__label-text">{data.name}</span>
          {data.metadata?.source ? (
            <span className="category-tree__label-source">{data.metadata.source}</span>
          ) : null}
          {multiSelect ? (
            <span className="category-tree__assistive">
              {isSelected ? 'Selected' : 'Not selected'}
            </span>
          ) : null}
        </button>
        {badge ? <span className="category-tree__badge">{badge}</span> : null}
      </div>
      {description ? (
        <p className="category-tree__description">{description}</p>
      ) : null}
    </div>
  );
}
