/**
 * @file useTabs hook encapsulating selection and focus logic for Tabs component
 * @module components/tabs/useTabs
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TabItem, UseTabsOptions, UseTabsResult } from './types.js';
import {
  getFirstEnabledIndex,
  getRovingTabIndex,
  handleHorizontalArrowKeys,
} from '../navigation/a11y.js';

/**
 * Shared logic for Tabs, exposing helpers to wire up ARIA relationships,
 * roving tabindex, and manual activation keyboard handling.
 */
export function useTabs({
  items,
  selectedId,
  defaultSelectedId,
  onChange,
}: UseTabsOptions): UseTabsResult {
  const isControlled = selectedId !== undefined;
  const initialSelection = useMemo(() => {
    if (selectedId) return selectedId;
    if (defaultSelectedId) return defaultSelectedId;
    const firstEnabled = items.find(item => !item.isDisabled);
    return firstEnabled?.id ?? '';
  }, [defaultSelectedId, items, selectedId]);

  const [internalSelected, setInternalSelected] = useState<string>(initialSelection);
  const activeId = isControlled ? selectedId ?? '' : internalSelected;
  const [focusedId, setFocusedId] = useState<string>(activeId);

  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const baseId = useId();

  useEffect(() => {
    if (!isControlled) return;
    if (selectedId && selectedId !== internalSelected) {
      setInternalSelected(selectedId);
    }
  }, [internalSelected, isControlled, selectedId]);

  useEffect(() => {
    if (!activeId) return;
    setFocusedId(prev => (prev ? prev : activeId));
  }, [activeId]);

  useEffect(() => {
    const hasFocused = focusedId && items.some(item => item.id === focusedId);
    if (hasFocused) return;

    const fallback = (() => {
      if (activeId && items.some(item => item.id === activeId)) {
        return activeId;
      }
      const firstEnabled = items.find(item => !item.isDisabled);
      return firstEnabled?.id ?? items[0]?.id ?? '';
    })();

    setFocusedId(fallback);
  }, [activeId, focusedId, items]);

  useEffect(() => {
    if (isControlled) return;
    if (!activeId || items.some(item => item.id === activeId)) return;

    const fallback = items.find(item => !item.isDisabled)?.id ?? items[0]?.id ?? '';
    setInternalSelected(fallback);
    setFocusedId(fallback);
  }, [activeId, isControlled, items]);

  useEffect(() => {
    if (!focusedId) return;
    const node = tabRefs.current.get(focusedId);
    if (node && document.activeElement !== node) {
      node.focus();
    }
  }, [focusedId]);

  const selectTab = useCallback(
    (id: string) => {
      if (!id) return;
      if (!isControlled) {
        setInternalSelected(id);
      }
      onChange?.(id);
      setFocusedId(id);
    },
    [isControlled, onChange]
  );

  const tabId = useCallback((id: string) => `tabs-tab-${baseId}-${id}`, [baseId]);
  const panelId = useCallback((id: string) => `tabs-panel-${baseId}-${id}`, [baseId]);

  const getListProps: UseTabsResult['getListProps'] = useCallback(
    (visibleItems: TabItem[]) => ({
      onKeyDown: (event) => {
        if (visibleItems.length === 0) return;

        const visibleIds = visibleItems.map(item => item.id);
        const currentFocusId = focusedId || activeId;
        const fallbackIndex = (() => {
          const activeIndex = visibleIds.indexOf(activeId);
          if (activeIndex >= 0) return activeIndex;
          const firstEnabled = getFirstEnabledIndex(
            visibleItems.length,
            visibleItems
              .map((item, index) => (item.isDisabled ? index : -1))
              .filter(index => index >= 0)
          );
          return firstEnabled;
        })();

        const currentIndex = (() => {
          const idx = visibleIds.indexOf(currentFocusId);
          return idx >= 0 ? idx : fallbackIndex;
        })();

        const disabledIndexes = visibleItems
          .map((item, index) => (item.isDisabled ? index : -1))
          .filter(index => index !== -1);

        const handled = handleHorizontalArrowKeys(event, {
          currentIndex,
          disabledIndexes,
          totalItems: visibleItems.length,
          onFocusChange: (nextIndex) => {
            const nextId = visibleIds[nextIndex];
            if (!nextId) return;
            setFocusedId(nextId);
          },
        });

        if (!handled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          const targetId = visibleIds[currentIndex];
          const target = visibleItems[currentIndex];
          if (targetId && !target?.isDisabled) {
            selectTab(targetId);
          }
        }
      },
    }),
    [activeId, focusedId, selectTab]
  );

  const getTabProps: UseTabsResult['getTabProps'] = useCallback(
    (item, visibleItems) => {
      const isSelected = item.id === activeId;
      const isDisabled = Boolean(item.isDisabled);
      const visibleIds = visibleItems.map(tab => tab.id);
      const focusTargetId = focusedId || activeId;
      const focusIndex = visibleIds.indexOf(focusTargetId);
      const itemIndex = visibleIds.indexOf(item.id);
      const activeIndex = focusIndex >= 0 ? focusIndex : visibleIds.indexOf(activeId);

      return {
        ref: (node: HTMLButtonElement | null) => {
          if (node) {
            tabRefs.current.set(item.id, node);
            if (typeof document !== 'undefined' && item.id === focusedId && document.activeElement !== node) {
              node.focus();
            }
          } else {
            tabRefs.current.delete(item.id);
          }
        },
        id: tabId(item.id),
        role: 'tab' as const,
        type: 'button' as const,
        'aria-selected': isSelected,
        'aria-controls': panelId(item.id),
        tabIndex: getRovingTabIndex(itemIndex, activeIndex >= 0 ? activeIndex : 0),
        disabled: isDisabled,
        onClick: () => {
          if (!isDisabled) {
            selectTab(item.id);
          }
        },
        onFocus: () => {
          if (item.isDisabled) return;
          setFocusedId(item.id);
        },
      };
    },
    [activeId, focusedId, panelId, selectTab, tabId]
  );

  const getPanelProps: UseTabsResult['getPanelProps'] = useCallback(
    (item) => ({
      id: panelId(item.id),
      role: 'tabpanel' as const,
      'aria-labelledby': tabId(item.id),
      hidden: item.id !== activeId,
      tabIndex: 0,
    }),
    [activeId, panelId, tabId]
  );

  return {
    activeId,
    focusedId,
    tabId,
    panelId,
    getListProps,
    getTabProps,
    getPanelProps,
    selectTab,
  };
}
