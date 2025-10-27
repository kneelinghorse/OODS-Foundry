/**
 * @file Tabs component
 * @module components/tabs/Tabs
 */

import * as React from 'react';
import { useRef } from 'react';
import type { TabsProps, TabItem } from './types.js';
import { resolveTabsTokens } from './tokens.js';
import { useOverflowMenu } from './useOverflowMenu.js';
import { useTabs } from './useTabs.js';
import { Popover } from '../Popover/Popover.js';
import './tabs.css';

type TabsElement = React.ElementRef<'div'>;

/**
 * Tabs component for organizing related content into separate, switchable views
 *
 * Features:
 * - Responsive overflow menu for excess tabs
 * - Size variants (sm, md, lg)
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Truncation with tooltips for long labels
 * - High-contrast mode support
 *
 * @example
 * ```tsx
 * const items = [
 *   { id: '1', label: 'Overview', panel: <div>Overview content</div> },
 *   { id: '2', label: 'Details', panel: <div>Details content</div> },
 * ];
 * <Tabs items={items} defaultSelectedId="1" size="md" />
 * ```
 */
export const Tabs = React.forwardRef<TabsElement, TabsProps>(
  (
    {
      items,
      selectedId,
      defaultSelectedId,
      size = 'md',
      overflowLabel = 'More',
      onChange,
      'aria-label': ariaLabel,
      className,
    },
    forwardedRef
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const { activeId, getListProps, getTabProps, getPanelProps, selectTab } = useTabs({
      items,
      selectedId,
      defaultSelectedId,
      onChange,
    });

    const { visibleItems, overflowItems, hasOverflow } = useOverflowMenu({
      items,
      containerRef,
      selectedId: activeId,
    });

    const listProps = getListProps(visibleItems);

    const renderTab = (item: TabItem) => {
      const tabProps = getTabProps(item, visibleItems);
      const isSelected = item.id === activeId;
      const isDisabled = Boolean(item.isDisabled);

      return (
        <button
          key={item.id}
          {...tabProps}
          className={`tabs__tab ${isSelected ? 'tabs__tab--selected' : ''} ${
            isDisabled ? 'tabs__tab--disabled' : ''
          }`}
          data-size={size}
          data-tab-id={item.id}
          title={typeof item.label === 'string' ? item.label : undefined}
        >
          <span className="tabs__tab-label">{item.label}</span>
        </button>
      );
    };

    const tokens = resolveTabsTokens(size);

    return (
      <div
        ref={forwardedRef}
        data-size={size}
        className={className ? `tabs ${className}` : 'tabs'}
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--tabs-font-size' as any]: tokens.fontSize,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--tabs-font-weight' as any]: tokens.fontWeight,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--tabs-padding-block' as any]: tokens.paddingBlock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--tabs-padding-inline' as any]: tokens.paddingInline,
        }}
      >
        <div
          ref={containerRef}
          role="tablist"
          aria-label={ariaLabel}
          className="tabs__list"
          onKeyDown={listProps.onKeyDown}
        >
          {visibleItems.map(item => renderTab(item))}

          {hasOverflow && (
            <Popover
              trigger={
                <button
                  type="button"
                  className="tabs__overflow-trigger"
                  aria-label={`${overflowLabel} tabs`}
                  aria-haspopup="menu"
                  data-size={size}
                  data-tabs-overflow-trigger="true"
                >
                  {overflowLabel}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4H4z" />
                  </svg>
                </button>
              }
              title={`${overflowLabel} tabs`}
            >
              <div className="tabs__overflow-menu" role="menu">
                {overflowItems.map(item => {
                  const isSelected = item.id === activeId;
                  const isDisabled = !!item.isDisabled;
                  return (
                    <button
                      key={item.id}
                      role="menuitem"
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) selectTab(item.id);
                      }}
                      className={`tabs__overflow-item ${
                        isSelected ? 'tabs__overflow-item--selected' : ''
                      }`}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </Popover>
          )}
        </div>

        {items.map(item => {
          const panelProps = getPanelProps(item);
          const isSelected = item.id === activeId;
          return (
            <div key={item.id} {...panelProps} className="tabs__panel">
              {isSelected ? item.panel : null}
            </div>
          );
        })}
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';
