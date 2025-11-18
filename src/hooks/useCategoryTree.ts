import * as React from 'react';
import type { CategoryNode } from '@/schemas/classification/category-node.js';

export type CategoryTreeFilterMode = 'highlight' | 'hide';
export type CategoryTreeDropPosition = 'inside' | 'before' | 'after';

export interface CategorySelectionChangePayload {
  readonly ids: string[];
  readonly node: CategoryNode;
  readonly isSelected: boolean;
}

export interface CategoryReorderEvent {
  readonly sourceId: string;
  readonly targetId: string;
  readonly dropPosition: CategoryTreeDropPosition;
}

export interface CategoryReorderContext {
  readonly source: CategoryNode;
  readonly target: CategoryNode;
  readonly newParentId: string | null;
}

export interface SelectionOptions {
  readonly mode?: 'toggle' | 'replace';
}

interface TreeNodeState {
  readonly id: string;
  parentId: string | null;
  readonly node: CategoryNode;
  children: string[];
  level: number;
  position: number;
  setSize: number;
}

interface TreeModel {
  nodesById: Map<string, TreeNodeState>;
  rootIds: string[];
}

interface ReorderPayloadRef {
  event: CategoryReorderEvent;
  context: CategoryReorderContext;
}

export interface UseCategoryTreeOptions {
  readonly multiSelect?: boolean;
  readonly defaultExpandedDepth?: number;
  readonly initialExpandedIds?: readonly string[];
  readonly selectedIds?: readonly string[];
  readonly defaultSelectedIds?: readonly string[];
  readonly onSelectionChange?: (payload: CategorySelectionChangePayload) => void;
  readonly onReorder?: (event: CategoryReorderEvent, context: CategoryReorderContext) => void;
  readonly searchQuery?: string;
  readonly defaultSearchQuery?: string;
  readonly onSearchQueryChange?: (value: string) => void;
  readonly filterMode?: CategoryTreeFilterMode;
}

export interface UseCategoryTreeResult {
  readonly tree: TreeModel;
  readonly expandedIds: ReadonlySet<string>;
  readonly selection: ReadonlySet<string>;
  readonly visibleNodeIds: readonly string[];
  readonly focusId: string | null;
  readonly matchedNodeIds: ReadonlySet<string>;
  readonly searchQuery: string;
  readonly multiSelect: boolean;
  readonly filterMode: CategoryTreeFilterMode;
  readonly toggleNode: (id: string) => void;
  readonly isExpanded: (id: string) => boolean;
  readonly selectNode: (id: string, options?: SelectionOptions) => void;
  readonly clearSelection: () => void;
  readonly setFocusId: (id: string | null) => void;
  readonly setSearchQuery: (value: string) => void;
  readonly handleKeyDown: (event: React.KeyboardEvent, currentId: string) => void;
  readonly requestReorder: (event: CategoryReorderEvent) => void;
  readonly getPathForNode: (nodeId: string) => CategoryNode[];
}

const DEFAULT_FILTER_MODE: CategoryTreeFilterMode = 'hide';

export function useCategoryTree(
  nodes: readonly CategoryNode[],
  options: UseCategoryTreeOptions = {}
): UseCategoryTreeResult {
  const filterMode = options.filterMode ?? DEFAULT_FILTER_MODE;
  const multiSelect = options.multiSelect ?? false;

  const [tree, setTree] = React.useState<TreeModel>(() => buildTreeModel(nodes));
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() =>
    deriveInitialExpanded(tree, options)
  );

  const isSelectionControlled = Array.isArray(options.selectedIds);
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<Set<string>>(
    () => new Set(options.defaultSelectedIds ?? [])
  );
  const selection = React.useMemo(
    () =>
      isSelectionControlled
        ? new Set(options.selectedIds ?? [])
        : uncontrolledSelection,
    [isSelectionControlled, options.selectedIds, uncontrolledSelection]
  );

  const [focusId, setFocusId] = React.useState<string | null>(null);

  const isSearchControlled = typeof options.searchQuery === 'string';
  const [internalSearchQuery, setInternalSearchQuery] = React.useState<string>(
    options.defaultSearchQuery ?? ''
  );
  const rawSearchQuery = isSearchControlled ? options.searchQuery ?? '' : internalSearchQuery;
  const normalizedSearch = rawSearchQuery.trim().toLowerCase();

  const matchedNodeIds = React.useMemo(
    () => computeSearchMatches(tree, normalizedSearch),
    [tree, normalizedSearch]
  );

  const effectiveExpanded = React.useMemo(
    () => deriveEffectiveExpanded(expandedIds, matchedNodeIds, tree),
    [expandedIds, matchedNodeIds, tree]
  );

  const expansionSet = normalizedSearch ? effectiveExpanded : expandedIds;

  const visibleNodeIds = React.useMemo(
    () =>
      computeVisibleNodes(tree, expansionSet, normalizedSearch ? matchedNodeIds : undefined, {
        mode: filterMode,
      }),
    [tree, expansionSet, normalizedSearch, matchedNodeIds, filterMode]
  );

  React.useEffect(() => {
    setTree(buildTreeModel(nodes));
  }, [nodes]);

  React.useEffect(() => {
    if (!focusId && visibleNodeIds.length > 0) {
      setFocusId(visibleNodeIds[0]);
      return;
    }
    if (focusId && !tree.nodesById.has(focusId)) {
      setFocusId(visibleNodeIds[0] ?? null);
    }
  }, [focusId, visibleNodeIds, tree.nodesById]);

  const updateSelection = React.useCallback(
    (updater: (prev: Set<string>) => Set<string>, nodeId: string) => {
      const node = tree.nodesById.get(nodeId)?.node;
      if (!node) {
        return;
      }
      const prevSelection = new Set(selection);
      const nextSelection = updater(prevSelection);
      if (!isSelectionControlled) {
        setUncontrolledSelection(nextSelection);
      }
      options.onSelectionChange?.({
        ids: Array.from(nextSelection),
        node,
        isSelected: nextSelection.has(node.id),
      });
    },
    [isSelectionControlled, options, selection, tree.nodesById]
  );

  const toggleNode = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isExpanded = React.useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds]
  );

  const selectNode = React.useCallback(
    (id: string, selectionOptions?: SelectionOptions) => {
      if (!tree.nodesById.has(id)) {
        return;
      }
      const mode = selectionOptions?.mode ?? (multiSelect ? 'toggle' : 'replace');
      updateSelection((prev) => {
        const next = new Set(prev);
        if (!multiSelect || mode === 'replace') {
          next.clear();
          next.add(id);
          return next;
        }
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }, id);
    },
    [multiSelect, tree.nodesById, updateSelection]
  );

  const clearSelection = React.useCallback(() => {
    if (selection.size === 0) {
      return;
    }
    const ids = Array.from(selection);
    if (!isSelectionControlled) {
      setUncontrolledSelection(new Set());
    }
    const node = ids.length > 0 ? tree.nodesById.get(ids[ids.length - 1]) : undefined;
    if (node) {
      options.onSelectionChange?.({
        ids: [],
        node: node.node,
        isSelected: false,
      });
    }
  }, [isSelectionControlled, options, selection, tree.nodesById]);

  const setSearchQuery = React.useCallback(
    (value: string) => {
      if (isSearchControlled) {
        options.onSearchQueryChange?.(value);
        return;
      }
      setInternalSearchQuery(value);
      options.onSearchQueryChange?.(value);
    },
    [isSearchControlled, options]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, currentId: string) => {
      if (visibleNodeIds.length === 0) {
        return;
      }
      const index = visibleNodeIds.indexOf(currentId);
      if (index === -1) {
        return;
      }

      const currentNode = tree.nodesById.get(currentId);
      if (!currentNode) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextId = visibleNodeIds[index + 1];
          if (nextId) {
            setFocusId(nextId);
          }
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const prevId = visibleNodeIds[index - 1];
          if (prevId) {
            setFocusId(prevId);
          }
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          if (currentNode.children.length > 0 && !expandedIds.has(currentId)) {
            toggleNode(currentId);
          } else if (currentNode.children.length > 0) {
            setFocusId(currentNode.children[0]);
          }
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (expandedIds.has(currentId)) {
            toggleNode(currentId);
            break;
          }
          if (currentNode.parentId) {
            setFocusId(currentNode.parentId);
          }
          break;
        }
        case 'Home': {
          event.preventDefault();
          setFocusId(visibleNodeIds[0]);
          break;
        }
        case 'End': {
          event.preventDefault();
          setFocusId(visibleNodeIds[visibleNodeIds.length - 1]);
          break;
        }
        case 'Enter': {
          event.preventDefault();
          selectNode(currentId, { mode: multiSelect ? 'toggle' : 'replace' });
          break;
        }
        case ' ': {
          event.preventDefault();
          if (currentNode.children.length > 0) {
            toggleNode(currentId);
          } else {
            selectNode(currentId, { mode: multiSelect ? 'toggle' : 'replace' });
          }
          break;
        }
        default:
          break;
      }
    },
    [expandedIds, multiSelect, selectNode, toggleNode, tree.nodesById, visibleNodeIds]
  );

  const reorderPayloadRef = React.useRef<ReorderPayloadRef | null>(null);

  const requestReorder = React.useCallback(
    (event: CategoryReorderEvent) => {
      setTree((current) => {
        const next = applyReorder(current, event);
        if (next === current) {
          return current;
        }
        const source = next.nodesById.get(event.sourceId)?.node;
        const target = next.nodesById.get(event.targetId)?.node;
        if (source && target) {
          reorderPayloadRef.current = {
            event,
            context: {
              source,
              target,
              newParentId: next.nodesById.get(event.sourceId)?.parentId ?? null,
            },
          };
        }
        if (event.dropPosition === 'inside') {
          setExpandedIds((prev) => {
            const updated = new Set(prev);
            updated.add(event.targetId);
            return updated;
          });
        }
        return next;
      });
    },
    []
  );

  React.useEffect(() => {
    const payload = reorderPayloadRef.current;
    if (payload) {
      reorderPayloadRef.current = null;
      options.onReorder?.(payload.event, payload.context);
    }
  }, [options.onReorder, tree]);

  const getPathForNode = React.useCallback(
    (nodeId: string): CategoryNode[] => {
      const path: CategoryNode[] = [];
      let currentId: string | null = nodeId;
      while (currentId) {
        const entry = tree.nodesById.get(currentId);
        if (!entry) {
          break;
        }
        path.push(entry.node);
        currentId = entry.parentId;
      }
      return path.reverse();
    },
    [tree.nodesById]
  );

  return {
    tree,
    expandedIds,
    selection,
    visibleNodeIds,
    focusId,
    matchedNodeIds,
    searchQuery: rawSearchQuery,
    multiSelect,
    filterMode,
    toggleNode,
    isExpanded,
    selectNode,
    clearSelection,
    setFocusId,
    setSearchQuery,
    handleKeyDown,
    requestReorder,
    getPathForNode,
  };
}

function buildTreeModel(nodes: readonly CategoryNode[]): TreeModel {
  const nodesById = new Map<string, TreeNodeState>();
  const childrenByParent = new Map<string | null, string[]>();

  for (const node of nodes) {
    const parentId = resolveParentId(node);
    const entry: TreeNodeState = {
      id: node.id,
      node,
      parentId,
      children: [],
      level: Math.max(1, (node.depth ?? 0) + 1),
      position: 1,
      setSize: 1,
    };
    nodesById.set(node.id, entry);
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(parentId, siblings);
  }

  for (const [, childIds] of childrenByParent) {
    childIds.sort((a, b) => compareNodes(nodesById.get(a)?.node, nodesById.get(b)?.node));
  }

  for (const entry of nodesById.values()) {
    const childIds = childrenByParent.get(entry.id) ?? [];
    entry.children = [...childIds];
  }

  const rootIds = [...(childrenByParent.get(null) ?? [])];
  assignHierarchyMetadata(rootIds, nodesById, 1);

  return { nodesById, rootIds };
}

function compareNodes(a?: CategoryNode, b?: CategoryNode): number {
  if (!a || !b) {
    return 0;
  }
  const sortA = typeof a.metadata?.sortKey === 'number' ? a.metadata.sortKey : null;
  const sortB = typeof b.metadata?.sortKey === 'number' ? b.metadata.sortKey : null;
  if (sortA !== null && sortB !== null && sortA !== sortB) {
    return sortA - sortB;
  }
  if (sortA !== null && sortB === null) {
    return -1;
  }
  if (sortA === null && sortB !== null) {
    return 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function assignHierarchyMetadata(
  ids: readonly string[],
  nodesById: Map<string, TreeNodeState>,
  level: number
): void {
  ids.forEach((id, index) => {
    const entry = nodesById.get(id);
    if (!entry) {
      return;
    }
    entry.level = level;
    entry.position = index + 1;
    entry.setSize = ids.length;
    if (entry.children.length > 0) {
      assignHierarchyMetadata(entry.children, nodesById, level + 1);
    }
  });
}

function resolveParentId(node: CategoryNode): string | null {
  if (typeof node.parentId === 'string' && node.parentId.trim().length > 0) {
    return node.parentId;
  }
  const ancestors = Array.isArray(node.ancestors) ? node.ancestors : [];
  if (ancestors.length > 0) {
    return ancestors[ancestors.length - 1];
  }
  const segments = node.ltreePath?.split('.') ?? [];
  if (segments.length > 1) {
    return segments[segments.length - 2];
  }
  return null;
}

function deriveInitialExpanded(tree: TreeModel, options: UseCategoryTreeOptions): Set<string> {
  const preset = new Set(options.initialExpandedIds ?? []);
  const defaultDepth = options.defaultExpandedDepth ?? 1;
  if (defaultDepth <= 0) {
    return preset;
  }

  for (const entry of tree.nodesById.values()) {
    if (entry.level <= defaultDepth && entry.children.length > 0) {
      preset.add(entry.id);
    }
  }

  return preset;
}

function computeSearchMatches(tree: TreeModel, query: string): Set<string> {
  if (!query) {
    return new Set();
  }
  const lowercaseQuery = query.toLowerCase();
  const matches = new Set<string>();
  for (const entry of tree.nodesById.values()) {
    const slugMatch = entry.node.slug?.toLowerCase().includes(lowercaseQuery);
    if (
      entry.node.name.toLowerCase().includes(lowercaseQuery) ||
      (slugMatch ?? false)
    ) {
      matches.add(entry.id);
      continue;
    }
    if (
      entry.node.metadata?.source &&
      entry.node.metadata.source.toLowerCase().includes(lowercaseQuery)
    ) {
      matches.add(entry.id);
    }
  }
  return matches;
}

function deriveEffectiveExpanded(
  expanded: ReadonlySet<string>,
  matches: ReadonlySet<string>,
  tree: TreeModel
): Set<string> {
  if (matches.size === 0) {
    return new Set(expanded);
  }
  const result = new Set(expanded);
  for (const matchId of matches) {
    let parentId = tree.nodesById.get(matchId)?.parentId ?? null;
    while (parentId) {
      result.add(parentId);
      parentId = tree.nodesById.get(parentId)?.parentId ?? null;
    }
  }
  return result;
}

function computeVisibleNodes(
  tree: TreeModel,
  expanded: ReadonlySet<string>,
  matches: ReadonlySet<string> | undefined,
  options: { readonly mode: CategoryTreeFilterMode }
): string[] {
  const visible: string[] = [];
  const matchCache = new Map<string, boolean>();

  const hasMatch = (id: string): boolean => {
    if (!matches || matches.size === 0) {
      return true;
    }
    if (matches.has(id)) {
      matchCache.set(id, true);
      return true;
    }
    if (matchCache.has(id)) {
      return matchCache.get(id) ?? false;
    }
    const entry = tree.nodesById.get(id);
    if (!entry) {
      matchCache.set(id, false);
      return false;
    }
    const descendantMatch = entry.children.some((childId) => hasMatch(childId));
    matchCache.set(id, descendantMatch);
    return descendantMatch;
  };

  const traverse = (ids: readonly string[]) => {
    ids.forEach((id) => {
      const entry = tree.nodesById.get(id);
      if (!entry) {
        return;
      }
      const shouldDisplay =
        !matches ||
        matches.size === 0 ||
        options.mode === 'highlight' ||
        hasMatch(id);

      if (shouldDisplay) {
        visible.push(id);
      }

      if (entry.children.length > 0 && expanded.has(id)) {
        traverse(entry.children);
      } else if (
        entry.children.length > 0 &&
        matches &&
        matches.size > 0 &&
        (matches.has(id) || hasMatch(id))
      ) {
        traverse(entry.children);
      }
    });
  };

  traverse(tree.rootIds);
  return visible;
}

function cloneTreeModel(model: TreeModel): TreeModel {
  const nodesById = new Map<string, TreeNodeState>();
  for (const [id, entry] of model.nodesById) {
    nodesById.set(id, {
      id,
      node: entry.node,
      parentId: entry.parentId,
      children: [...entry.children],
      level: entry.level,
      position: entry.position,
      setSize: entry.setSize,
    });
  }

  return {
    nodesById,
    rootIds: [...model.rootIds],
  };
}

function applyReorder(model: TreeModel, event: CategoryReorderEvent): TreeModel {
  if (event.sourceId === event.targetId) {
    return model;
  }
  const currentSource = model.nodesById.get(event.sourceId);
  const currentTarget = model.nodesById.get(event.targetId);
  if (!currentSource || !currentTarget) {
    return model;
  }
  if (isDescendant(model.nodesById, event.targetId, event.sourceId)) {
    return model;
  }

  const next = cloneTreeModel(model);
  const source = next.nodesById.get(event.sourceId);
  const target = next.nodesById.get(event.targetId);
  if (!source || !target) {
    return model;
  }

  removeFromParent(next, source.id, source.parentId);

  if (event.dropPosition === 'inside') {
    source.parentId = target.id;
    target.children.push(source.id);
  } else {
    const parentId = target.parentId;
    const siblings = parentId ? next.nodesById.get(parentId)?.children : next.rootIds;
    if (!siblings) {
      return model;
    }
    const targetIndex = siblings.indexOf(target.id);
    const insertIndex = event.dropPosition === 'before' ? targetIndex : targetIndex + 1;
    siblings.splice(insertIndex, 0, source.id);
    source.parentId = parentId ?? null;
  }

  assignHierarchyMetadata(next.rootIds, next.nodesById, 1);

  return next;
}

function removeFromParent(model: TreeModel, nodeId: string, parentId: string | null): void {
  if (parentId) {
    const parent = model.nodesById.get(parentId);
    if (!parent) {
      return;
    }
    parent.children = parent.children.filter((childId) => childId !== nodeId);
  } else {
    model.rootIds = model.rootIds.filter((id) => id !== nodeId);
  }
}

function isDescendant(
  nodesById: Map<string, TreeNodeState>,
  candidateId: string,
  ancestorId: string
): boolean {
  let currentParent = nodesById.get(candidateId)?.parentId ?? null;
  while (currentParent) {
    if (currentParent === ancestorId) {
      return true;
    }
    currentParent = nodesById.get(currentParent)?.parentId ?? null;
  }
  return false;
}
