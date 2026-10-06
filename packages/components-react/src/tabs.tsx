import * as React from 'react';
import type { TabItem, TabsProps } from './types.js';

const classes = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

const enabledTabIndexes = (items: readonly TabItem[]): number[] =>
  items.flatMap((item, index) => (item.disabled || item.isDisabled ? [] : [index]));

/** Private overflow policy; it is deliberately not exported from the package. */
const partitionForOverflow = (
  items: readonly TabItem[],
  visibleCount: number,
  selectedId: string
): { visibleItems: readonly TabItem[]; overflowItems: readonly TabItem[] } => {
  if (visibleCount >= items.length) return { visibleItems: items, overflowItems: [] };
  const visibleItems = [...items.slice(0, Math.max(1, visibleCount))];
  const selected = items.find(item => item.id === selectedId);
  if (selected && !visibleItems.some(item => item.id === selectedId)) {
    visibleItems[visibleItems.length - 1] = selected;
  }
  const visibleIds = new Set(visibleItems.map(item => item.id));
  return {
    visibleItems,
    overflowItems: items.filter(item => !visibleIds.has(item.id)),
  };
};

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      items,
      selectedId,
      defaultSelectedId,
      size = 'md',
      overflowLabel = 'More',
      ariaLabel,
      onChange,
      onUpdate,
      className,
      'aria-label': ariaLabelAttribute,
      ...rest
    },
    ref
  ) => {
    const instanceId = React.useId().replaceAll(':', '');
    const controlled = selectedId !== undefined;
    const firstEnabled = items.find(item => !item.disabled && !item.isDisabled)?.id ?? '';
    const [internalSelectedId, setInternalSelectedId] = React.useState(
      defaultSelectedId ?? firstEnabled
    );
    const activeId = controlled ? selectedId : internalSelectedId;
    const [focusedId, setFocusedId] = React.useState(activeId);
    const [visibleCount, setVisibleCount] = React.useState(items.length);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const listRef = React.useRef<HTMLDivElement>(null);
    const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
    const itemWidths = React.useRef(new Map<string, number>());
    const focusRequestedByUser = React.useRef(false);

    React.useEffect(() => setFocusedId(activeId), [activeId]);

    const select = React.useCallback(
      (id: string) => {
        const item = items.find(candidate => candidate.id === id);
        if (!item || item.disabled || item.isDisabled) return;
        if (!controlled) setInternalSelectedId(id);
        focusRequestedByUser.current = true;
        setFocusedId(id);
        onChange?.(id);
        onUpdate?.(id);
      },
      [controlled, items, onChange, onUpdate]
    );

    const measure = React.useCallback(() => {
      const list = listRef.current;
      if (!list || items.length < 2) return;
      const available = list.offsetWidth;
      for (const tab of Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))) {
        const itemId = tab.dataset.tabId;
        if (itemId && tab.offsetWidth > 0) itemWidths.current.set(itemId, tab.offsetWidth);
      }
      const widths = items.map(item => itemWidths.current.get(item.id) ?? 0);
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (!available || !total || total <= available) {
        setVisibleCount(items.length);
        return;
      }
      const overflowReserve = 80;
      let used = 0;
      let count = 0;
      for (const width of widths) {
        if (used + width > available - overflowReserve) break;
        used += width;
        count += 1;
      }
      setVisibleCount(Math.max(1, count));
    }, [items.length]);

    React.useLayoutEffect(() => {
      measure();
      const list = listRef.current;
      if (!list || typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(measure);
      observer.observe(list);
      return () => observer.disconnect();
    }, [measure]);

    const { visibleItems, overflowItems } = partitionForOverflow(
      items,
      visibleCount,
      activeId
    );

    const move = (currentId: string, key: string) => {
      const enabled = enabledTabIndexes(items);
      if (enabled.length === 0) return;
      const currentIndex = items.findIndex(item => item.id === currentId);
      const position = enabled.indexOf(currentIndex);
      let nextIndex: number | undefined;
      if (key === 'Home') nextIndex = enabled[0];
      if (key === 'End') nextIndex = enabled[enabled.length - 1];
      if (key === 'ArrowRight') nextIndex = enabled[(Math.max(0, position) + 1) % enabled.length];
      if (key === 'ArrowLeft') nextIndex = enabled[(position - 1 + enabled.length) % enabled.length];
      if (nextIndex === undefined) return;
      const nextId = items[nextIndex]?.id;
      if (!nextId) return;
      select(nextId);
    };

    React.useEffect(() => {
      if (focusRequestedByUser.current && visibleItems.some(item => item.id === focusedId)) {
        focusRequestedByUser.current = false;
        tabRefs.current.get(focusedId)?.focus();
      }
    }, [focusedId, visibleItems]);

    const renderTab = (item: TabItem) => {
      const disabled = Boolean(item.disabled || item.isDisabled);
      const selected = item.id === activeId;
      return (
        <button
          key={item.id}
          ref={node => {
            if (node) tabRefs.current.set(item.id, node);
            else tabRefs.current.delete(item.id);
          }}
          id={`${instanceId}-tab-${item.id}`}
          type="button"
          role="tab"
          className={classes(
            'oods-tab',
            'tabs__tab',
            selected && 'tabs__tab--selected',
            disabled && 'tabs__tab--disabled'
          )}
          data-size={size}
          data-tab-id={item.id}
          aria-selected={selected}
          aria-controls={`${instanceId}-panel-${item.id}`}
          tabIndex={item.id === focusedId ? 0 : -1}
          disabled={disabled}
          title={typeof item.label === 'string' ? item.label : undefined}
          onFocus={() => setFocusedId(item.id)}
          onClick={() => select(item.id)}
          onKeyDown={event => {
            if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              move(item.id, event.key);
            }
          }}
        >
          <span className="tabs__tab-label">{item.label}</span>
        </button>
      );
    };

    return (
      <div
        ref={ref}
        className={classes('oods-tabs', 'tabs', className)}
        data-oods-component="Tabs"
        data-size={size}
        {...rest}
      >
        <div
          ref={listRef}
          className="oods-tab-list tabs__list"
          role="tablist"
          aria-label={ariaLabel ?? ariaLabelAttribute}
        >
          {visibleItems.map(renderTab)}
          {overflowItems.length ? (
            // s224-m01 (#2542 ruling 2): the overflow markup is Vue's too: both class families, the trigger's data
            // attribute and aria-current="true" on an item.
            <div className="oods-tabs__overflow oods-tabs-overflow">
              <button
                type="button"
                className="tabs__overflow-trigger oods-tabs-overflow-trigger"
                aria-label={`${overflowLabel} tabs`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                data-tabs-overflow-trigger="true"
                onClick={() => setMenuOpen(open => !open)}
              >
                {overflowLabel}
              </button>
              {menuOpen ? (
                <div className="tabs__overflow-menu oods-tabs-overflow-menu" role="menu">
                  {overflowItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled || item.isDisabled}
                      aria-current={item.id === activeId ? 'true' : undefined}
                      className={classes(
                        'tabs__overflow-item',
                        item.id === activeId && 'tabs__overflow-item--selected'
                      )}
                      onClick={() => {
                        select(item.id);
                        setMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {items.map(item => {
          const selected = item.id === activeId;
          return (
            <div
              key={item.id}
              id={`${instanceId}-panel-${item.id}`}
              role="tabpanel"
              className="oods-tab-panel tabs__panel"
              aria-labelledby={`${instanceId}-tab-${item.id}`}
              hidden={!selected}
              tabIndex={0}
            >
              {selected ? item.panel : null}
            </div>
          );
        })}
      </div>
    );
  }
);
Tabs.displayName = 'OODS.Tabs';
