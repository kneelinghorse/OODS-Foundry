/**
 * @file useOverflowMenu hook for responsive tabs behavior
 * @module components/tabs/useOverflowMenu
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TabItem, UseOverflowMenuOptions, UseOverflowMenuResult } from './types.js';

const DEFAULT_OVERFLOW_WIDTH = 80;

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Computes which tab items are visible vs. overflowed based on container width.
 * The selected tab is always forced into the visible list, even if it exceeds the
 * available width budget. Width measurements are cached to avoid layout jank
 * when items toggle between tabs and overflow menu.
 */
export function useOverflowMenu({
  items,
  containerRef,
  selectedId,
}: UseOverflowMenuOptions): UseOverflowMenuResult {
  const measurementsRef = useRef(new Map<string, number>());
  const [visibleItems, setVisibleItems] = useState<TabItem[]>(items);
  const [overflowItems, setOverflowItems] = useState<TabItem[]>([]);

  const calculateOverflow = useCallback(() => {
    const container = containerRef.current;

    if (!container || items.length === 0) {
      setVisibleItems(items);
      setOverflowItems([]);
      return;
    }

    const containerWidth = container.offsetWidth;

    if (containerWidth === 0) {
      setVisibleItems(items);
      setOverflowItems([]);
      return;
    }

    const tabNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-tab-id]'));
    tabNodes.forEach(node => {
      const id = node.dataset.tabId;
      if (!id) return;
      measurementsRef.current.set(id, node.offsetWidth);
    });

    const orderMap = new Map(items.map((item, index) => [item.id, index] as const));

    const fallbackWidth = (() => {
      if (tabNodes.length > 0) {
        const total = tabNodes.reduce((sum, node) => sum + node.offsetWidth, 0);
        return total / tabNodes.length;
      }
      return containerWidth / Math.max(items.length, 1);
    })();

    const getWidth = (id: string) => measurementsRef.current.get(id) ?? fallbackWidth;

    const overflowTrigger = container.querySelector<HTMLElement>('[data-tabs-overflow-trigger]');
    const overflowWidth = overflowTrigger?.offsetWidth ?? DEFAULT_OVERFLOW_WIDTH;
    const availableWidth = Math.max(containerWidth - overflowWidth, 0);

    const selectedItem = selectedId ? items.find(item => item.id === selectedId) ?? null : null;
    const selectedWidth = selectedItem ? getWidth(selectedItem.id) : 0;

    const visible: TabItem[] = [];
    const overflow: TabItem[] = [];
    let usedWidth = 0;

    if (selectedItem) {
      visible.push(selectedItem);
      usedWidth += selectedWidth;
    }

    for (const item of items) {
      if (selectedItem && item.id === selectedItem.id) continue;

      const width = getWidth(item.id);

      if (usedWidth + width <= availableWidth || !selectedItem) {
        visible.push(item);
        usedWidth += width;
      } else {
        overflow.push(item);
      }
    }

    if (visible.length === 0 && items.length > 0) {
      // Ensure at least one tab remains visible to preserve keyboard access.
      const firstItem = items[0];
      visible.push(firstItem);
      const overflowIndex = overflow.findIndex(item => item.id === firstItem.id);
      if (overflowIndex >= 0) {
        overflow.splice(overflowIndex, 1);
      }
    }

    // Restore original item order for the visible list
    visible.sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? 0;
      const bIndex = orderMap.get(b.id) ?? 0;
      return aIndex - bIndex;
    });

    if (overflow.length === 0) {
      setVisibleItems(items);
      setOverflowItems([]);
      return;
    }

    setVisibleItems(visible);
    setOverflowItems(overflow);
  }, [containerRef, items, selectedId]);

  useIsomorphicLayoutEffect(() => {
    calculateOverflow();

    const container = containerRef.current;
    if (!container) return;

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => calculateOverflow());
      observer.observe(container);
      return () => {
        observer.disconnect();
      };
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => calculateOverflow();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateOverflow, containerRef]);

  useEffect(() => {
    setVisibleItems(items);
    setOverflowItems([]);
    calculateOverflow();
  }, [items, selectedId, calculateOverflow]);

  return {
    visibleItems,
    overflowItems,
    hasOverflow: overflowItems.length > 0,
  };
}
