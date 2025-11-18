import * as React from 'react';
import type { CategoryNode } from '@/schemas/classification/category-node.js';
import {
  useCategoryTree,
  type UseCategoryTreeResult,
  type UseCategoryTreeOptions,
} from '@/hooks/useCategoryTree.js';
import { CategoryNodeRow } from './CategoryNode.js';
import { CategoryBreadcrumb } from './CategoryBreadcrumb.js';
import './category-tree.css';

export interface CategoryTreeViewProps {
  readonly state: UseCategoryTreeResult;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly renderNodeBadge?: (node: CategoryNode) => React.ReactNode;
  readonly getNodeDescription?: (node: CategoryNode) => React.ReactNode | undefined;
  readonly emptyState?: React.ReactNode;
  readonly selectionStyle?: 'highlight' | 'checkbox';
  readonly allowSelection?: boolean;
  readonly enableDragAndDrop?: boolean;
  readonly showBreadcrumbs?: boolean;
  readonly breadcrumbsLabel?: string;
  readonly onNodeSelect?: (node: CategoryNode) => void;
  readonly resolveDropIntent?: (
    payload: { event: React.DragEvent; sourceId: string; targetId: string }
  ) => 'before' | 'after' | 'inside';
}

export interface CategoryTreeProps
  extends Omit<CategoryTreeViewProps, 'state'>,
    UseCategoryTreeOptions {
  readonly nodes: readonly CategoryNode[];
}

export function CategoryTree({
  nodes,
  className,
  'aria-label': ariaLabel,
  renderNodeBadge,
  getNodeDescription,
  emptyState,
  selectionStyle,
  allowSelection,
  enableDragAndDrop,
  showBreadcrumbs,
  breadcrumbsLabel,
  onNodeSelect,
  resolveDropIntent,
  ...hookOptions
}: CategoryTreeProps): React.ReactElement {
  const state = useCategoryTree(nodes, hookOptions);
  return (
    <CategoryTreeView
      state={state}
      className={className}
      aria-label={ariaLabel}
      renderNodeBadge={renderNodeBadge}
      getNodeDescription={getNodeDescription}
      emptyState={emptyState}
      selectionStyle={selectionStyle}
      allowSelection={allowSelection}
      enableDragAndDrop={enableDragAndDrop}
      showBreadcrumbs={showBreadcrumbs}
      breadcrumbsLabel={breadcrumbsLabel}
      onNodeSelect={onNodeSelect}
      resolveDropIntent={resolveDropIntent}
    />
  );
}

export function CategoryTreeView({
  state,
  className,
  'aria-label': ariaLabel = 'Category tree',
  renderNodeBadge,
  getNodeDescription,
  emptyState,
  selectionStyle = 'highlight',
  allowSelection = true,
  enableDragAndDrop = true,
  showBreadcrumbs = false,
  breadcrumbsLabel = 'Selected category path',
  onNodeSelect,
  resolveDropIntent,
}: CategoryTreeViewProps): React.ReactElement {
  const [dragState, setDragState] = React.useState<{ sourceId: string | null; overId: string | null }>({
    sourceId: null,
    overId: null,
  });

  const handleNodeSelect = React.useCallback(
    (nodeId: string) => {
      if (!allowSelection) {
        return;
      }
      state.setFocusId(nodeId);
      state.selectNode(nodeId, { mode: state.multiSelect ? 'toggle' : 'replace' });
      const entry = state.tree.nodesById.get(nodeId);
      if (entry) {
        onNodeSelect?.(entry.node);
      }
    },
    [allowSelection, onNodeSelect, state]
  );

  const defaultBadgeRenderer = React.useCallback(
    (node: CategoryNode) => {
      if (typeof node.childCount === 'number' && node.childCount > 0) {
        return node.childCount.toLocaleString();
      }
      if (node.metadata?.sortKey !== undefined) {
        return `#${node.metadata.sortKey}`;
      }
      return undefined;
    },
    []
  );

  const determineDropIntent = React.useCallback(
    (payload: { event: React.DragEvent; sourceId: string; targetId: string }) => {
      if (resolveDropIntent) {
        return resolveDropIntent(payload);
      }
      if (payload.event.shiftKey) {
        return 'before';
      }
      if (payload.event.altKey || payload.event.metaKey) {
        return 'after';
      }
      return 'inside';
    },
    [resolveDropIntent]
  );

  const handleDragStart = React.useCallback(
    (nodeId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!enableDragAndDrop) {
        return;
      }
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', nodeId);
      setDragState({ sourceId: nodeId, overId: null });
    },
    [enableDragAndDrop]
  );

  const handleDragOver = React.useCallback(
    (nodeId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!enableDragAndDrop || dragState.sourceId === null || dragState.sourceId === nodeId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragState.overId !== nodeId) {
        setDragState((prev) => ({ ...prev, overId: nodeId }));
      }
    },
    [dragState.overId, dragState.sourceId, enableDragAndDrop]
  );

  const handleDrop = React.useCallback(
    (nodeId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!enableDragAndDrop || dragState.sourceId === null || dragState.sourceId === nodeId) {
        return;
      }
      event.preventDefault();
      const dropIntent = determineDropIntent({
        event,
        sourceId: dragState.sourceId,
        targetId: nodeId,
      });
      state.requestReorder({
        sourceId: dragState.sourceId,
        targetId: nodeId,
        dropPosition: dropIntent,
      });
      setDragState({ sourceId: null, overId: null });
    },
    [determineDropIntent, dragState.sourceId, enableDragAndDrop, state]
  );

  const handleDragEnd = React.useCallback(() => {
    setDragState({ sourceId: null, overId: null });
  }, []);

  return (
    <div className={['category-tree', className].filter(Boolean).join(' ')}>
      {showBreadcrumbs && state.focusId ? (
        <CategoryBreadcrumb
          nodes={state.getPathForNode(state.focusId)}
          className="category-tree__breadcrumb"
          aria-label={breadcrumbsLabel}
          onNavigate={(node) => state.setFocusId(node.id)}
        />
      ) : null}
      <div
        className="category-tree__viewport"
        role="tree"
        aria-label={ariaLabel}
        aria-multiselectable={allowSelection && state.multiSelect ? true : undefined}
      >
        {state.visibleNodeIds.map((id) => {
          const entry = state.tree.nodesById.get(id);
          if (!entry) {
            return null;
          }
          const hasChildren = entry.children.length > 0;
          const badge = (renderNodeBadge ?? defaultBadgeRenderer)(entry.node);
          const description = getNodeDescription?.(entry.node) ?? entry.node.description;
          const isMatch =
            state.matchedNodeIds.size === 0 || state.matchedNodeIds.has(entry.id);

          return (
            <CategoryNodeRow
              key={entry.id}
              data={entry.node}
              level={entry.level}
              hasChildren={hasChildren}
              isExpanded={hasChildren ? state.isExpanded(entry.id) : false}
              isSelected={state.selection.has(entry.id)}
              isFocused={state.focusId === entry.id}
              isMatch={isMatch}
              selectionStyle={selectionStyle}
              badge={badge}
              description={description}
              multiSelect={state.multiSelect}
              setSize={entry.setSize}
              position={entry.position}
              onToggle={() => state.toggleNode(entry.id)}
              onSelect={() => handleNodeSelect(entry.id)}
              onKeyDown={(event) => state.handleKeyDown(event, entry.id)}
              onFocus={() => state.setFocusId(entry.id)}
              draggable={enableDragAndDrop}
              onDragStart={handleDragStart(entry.id)}
              onDragOver={handleDragOver(entry.id)}
              onDrop={handleDrop(entry.id)}
              onDragEnd={handleDragEnd}
              disableSelection={!allowSelection}
              isDropTarget={dragState.overId === entry.id}
              isDragSource={dragState.sourceId === entry.id}
            />
          );
        })}
        {state.visibleNodeIds.length === 0 ? (
          <div className="category-tree__empty">{emptyState ?? 'No categories available.'}</div>
        ) : null}
      </div>
    </div>
  );
}
