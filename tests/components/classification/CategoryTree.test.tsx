/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryTree, CategoryTreeView } from '../../../src/components/classification/CategoryTree.js';
import { useCategoryTree } from '../../../src/hooks/useCategoryTree.js';
import type { CategoryNode } from '../../../src/schemas/classification/category-node.ts';

const TREE_FIXTURES: CategoryNode[] = [
  {
    id: 'electronics',
    slug: 'electronics',
    name: 'Electronics',
    parentId: null,
    ltreePath: 'electronics',
    depth: 0,
    ancestors: [],
    childCount: 3,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'mobile',
    slug: 'mobile',
    name: 'Mobile',
    parentId: 'electronics',
    ltreePath: 'electronics.mobile',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 2,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'android',
    slug: 'android',
    name: 'Android Phones',
    parentId: 'mobile',
    ltreePath: 'electronics.mobile.android',
    depth: 2,
    ancestors: ['electronics', 'mobile'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'ios',
    slug: 'ios',
    name: 'iOS Phones',
    parentId: 'mobile',
    ltreePath: 'electronics.mobile.ios',
    depth: 2,
    ancestors: ['electronics', 'mobile'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'audio',
    slug: 'audio',
    name: 'Audio',
    parentId: 'electronics',
    ltreePath: 'electronics.audio',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 1,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'wireless-audio',
    slug: 'wireless-audio',
    name: 'Wireless Audio',
    parentId: 'audio',
    ltreePath: 'electronics.audio.wireless',
    depth: 2,
    ancestors: ['electronics', 'audio'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
];

class DataTransferMock {
  dropEffect: 'none' | 'copy' | 'link' | 'move' = 'move';
  effectAllowed: 'none' | 'copy' | 'copyLink' | 'copyMove' | 'link' | 'linkMove' | 'move' | 'all' | 'uninitialized' =
    'all';
  types: readonly string[] = [];
  private data: Record<string, string> = {};

  clearData(): void {
    this.data = {};
  }

  getData(format: string): string {
    return this.data[format] ?? '';
  }

  setData(format: string, data: string): void {
    this.data[format] = data;
    this.types = Object.keys(this.data);
  }

  setDragImage(): void {
    // noop
  }
}

describe('CategoryTree component', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('renders treeitems with badges', () => {
    render(<CategoryTree nodes={TREE_FIXTURES} showBreadcrumbs />);
    const tree = screen.getByRole('tree', { name: /Category tree/i });
    expect(tree).toBeInTheDocument();

    expect(screen.getByRole('treeitem', { name: /Electronics/i })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /Mobile/i })).toHaveAttribute('aria-level', '2');
  });

  it('supports keyboard navigation and selection', async () => {
    const user = userEvent.setup();
    render(<CategoryTree nodes={TREE_FIXTURES} multiSelect />);

    const root = screen.getByRole('treeitem', { name: /Electronics/ });
    act(() => {
      fireEvent.keyDown(root, { key: 'ArrowRight' });
    });
    const mobile = screen.getByRole('treeitem', { name: /Mobile/ });
    act(() => {
      fireEvent.keyDown(mobile, { key: 'Enter' });
    });
    expect(mobile).toHaveAttribute('aria-selected', 'true');
    act(() => {
      fireEvent.keyDown(mobile, { key: 'ArrowRight' });
    });
    expect(screen.getByRole('treeitem', { name: /Android Phones/ })).toBeInTheDocument();
  });

  it('filters nodes when search query is applied via hook', async () => {
    const ControlledTree = ({ query }: { query: string }) => {
      const state = useCategoryTree(TREE_FIXTURES, { multiSelect: true, defaultExpandedDepth: 1 });
      React.useEffect(() => {
        state.setSearchQuery(query);
      }, [query, state]);
      return <CategoryTreeView state={state} allowSelection={false} />;
    };

    const { rerender } = render(<ControlledTree query="" />);
    expect(screen.queryByRole('treeitem', { name: /Android Phones/ })).not.toBeInTheDocument();

    rerender(<ControlledTree query="android" />);
    await waitFor(() => {
      expect(screen.getByRole('treeitem', { name: /Android Phones/ })).toBeInTheDocument();
    });
  });

  it('emits reorder events via drag and drop', () => {
    const onReorder = vi.fn();
    render(
      <CategoryTree
        nodes={TREE_FIXTURES}
        onReorder={onReorder}
        enableDragAndDrop
        defaultExpandedDepth={3}
      />
    );
    const source = screen.getByRole('treeitem', { name: /Android Phones/ });
    const [target] = screen.getAllByRole('treeitem', { name: /Audio/ });
    const dataTransfer = new DataTransferMock() as unknown as DataTransfer;

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(onReorder).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'android',
        targetId: 'audio',
      }),
      expect.any(Object)
    );
  });
});
