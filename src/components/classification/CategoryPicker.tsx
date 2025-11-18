import * as React from 'react';
import type { CategoryNode } from '@/schemas/classification/category-node.js';
import {
  useCategoryTree,
  type CategorySelectionChangePayload,
  type UseCategoryTreeOptions,
} from '@/hooks/useCategoryTree.js';
import {
  resolveFieldMetadata,
  type FieldDensity,
  type FieldValidation,
} from '../base/fieldUtils.js';
import { CategoryTreeView } from './CategoryTree.js';

export interface CategoryPickerProps extends UseCategoryTreeOptions {
  readonly id: string;
  readonly name?: string;
  readonly nodes: readonly CategoryNode[];
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly required?: boolean;
  readonly requiredIndicator?: React.ReactNode;
  readonly searchPlaceholder?: string;
  readonly recentlyUsedIds?: readonly string[];
  readonly onRecentlyUsedSelect?: (node: CategoryNode) => void;
  readonly maxHeight?: number | string;
  readonly disabled?: boolean;
  readonly summaryLabel?: string;
  readonly enableReorder?: boolean;
  readonly onSelectionChange?: (payload: CategorySelectionChangePayload) => void;
}

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

export function CategoryPicker({
  id,
  name,
  nodes,
  label,
  description,
  validation,
  density = 'comfortable',
  className,
  style,
  required,
  requiredIndicator = DEFAULT_REQUIRED_INDICATOR,
  searchPlaceholder = 'Search categories',
  recentlyUsedIds,
  onRecentlyUsedSelect,
  maxHeight = 360,
  disabled = false,
  summaryLabel = 'Selected categories',
  enableReorder = false,
  onSelectionChange,
  ...hookOptions
}: CategoryPickerProps): React.ReactElement {
  const state = useCategoryTree(nodes, {
    multiSelect: true,
    defaultExpandedDepth: 1,
    ...hookOptions,
    onSelectionChange,
  });

  const metadata = resolveFieldMetadata(id, {
    hasDescription: Boolean(description),
    validation,
  });

  const nodeLookup = React.useMemo(() => {
    const map = new Map<string, CategoryNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const selectedNodes = React.useMemo(
    () => Array.from(state.selection).map((nodeId) => nodeLookup.get(nodeId)).filter(Boolean),
    [nodeLookup, state.selection]
  ) as CategoryNode[];

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    state.setSearchQuery(event.currentTarget.value);
  };

  const searchInputId = `${id}-search`;
  const fieldClassName = ['form-field', 'category-picker', className].filter(Boolean).join(' ');
  const fieldStyle = metadata.variables
    ? ({ ...metadata.variables, ...style } as React.CSSProperties)
    : style;
  const treeAriaLabel = typeof label === 'string' ? label : 'Category tree';

  return (
    <div
      className={fieldClassName}
      style={fieldStyle}
      data-density={density}
      data-validation-state={metadata.dataValidationState}
    >
      <div className="form-field__label" id={`${id}-label`}>
        <label htmlFor={searchInputId}>
          <span>{label}</span>
          {required && requiredIndicator}
        </label>
      </div>
      <div
        className="category-picker__control"
        aria-labelledby={`${id}-label`}
        aria-describedby={metadata.describedBy}
      >
        <div className="category-picker__search">
          <input
            id={searchInputId}
            type="search"
            placeholder={searchPlaceholder}
            value={state.searchQuery}
            onChange={handleSearchChange}
            aria-describedby={metadata.describedBy}
            aria-invalid={metadata.ariaInvalid}
            disabled={disabled}
          />
          {state.searchQuery ? (
            <button
              type="button"
              className="category-picker__clear"
              onClick={() => state.setSearchQuery('')}
              disabled={disabled}
            >
              Clear
            </button>
          ) : null}
        </div>
        {recentlyUsedIds && recentlyUsedIds.length > 0 ? (
          <div className="category-picker__recent">
            <span className="category-picker__recent-label">Recently used</span>
            <div className="category-picker__recent-list">
              {recentlyUsedIds.map((recentId) => {
                const node = nodeLookup.get(recentId);
                if (!node) {
                  return null;
                }
                const isSelected = state.selection.has(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                className={['category-picker__recent-chip', isSelected ? 'is-selected' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  state.selectNode(node.id, { mode: 'toggle' });
                  onRecentlyUsedSelect?.(node);
                }}
                disabled={disabled}
              >
                    {node.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="category-picker__summary">
          <div className="category-picker__summary-header">
            <span>{summaryLabel}</span>
            {selectedNodes.length > 0 ? (
              <button
                type="button"
                className="category-picker__summary-clear"
                onClick={() => state.clearSelection()}
                disabled={disabled}
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="category-picker__chips">
            {selectedNodes.length === 0 ? (
              <span className="category-picker__chips-empty">No categories selected.</span>
            ) : null}
            {selectedNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className="category-picker__chip"
                onClick={() => state.selectNode(node.id, { mode: 'toggle' })}
                disabled={disabled}
              >
                <span>{node.name}</span>
                <span aria-hidden="true" className="category-picker__chip-remove">
                  &times;
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="category-picker__tree" style={{ maxHeight }}>
          <CategoryTreeView
            state={state}
            aria-label={`${treeAriaLabel} hierarchy`}
            selectionStyle="checkbox"
            allowSelection={!disabled}
            enableDragAndDrop={enableReorder}
          />
        </div>
        {name
          ? Array.from(state.selection).map((selectedId) => (
              <input key={selectedId} type="hidden" name={name} value={selectedId} />
            ))
          : null}
      </div>
      {description ? (
        <p id={metadata.descriptionId} className="form-field__description">
          {description}
        </p>
      ) : null}
      {validation?.message ? (
        <p
          id={metadata.validationId}
          className="form-field__validation"
          role={validation.state === 'error' ? 'alert' : 'status'}
          data-state={validation.state}
        >
          {validation.message}
        </p>
      ) : null}
    </div>
  );
}
