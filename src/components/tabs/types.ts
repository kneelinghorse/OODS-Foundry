/**
 * @file Tabs component types
 * @module components/tabs/types
 */

import type { KeyboardEvent, ReactNode } from 'react';

/** Size variants for tabs component */
export type TabsSize = 'sm' | 'md' | 'lg';

/** Individual tab item */
export type TabItem = {
  /** Unique identifier for the tab */
  id: string;
  /** Tab label content */
  label: ReactNode;
  /** Panel content */
  panel: ReactNode;
  /** Whether tab is disabled */
  isDisabled?: boolean;
};

/** Base Tabs component props */
export interface TabsProps {
  /** Array of tab items */
  items: TabItem[];
  /** Controlled selected tab ID */
  selectedId?: string;
  /** Default selected tab ID (uncontrolled) */
  defaultSelectedId?: string;
  /** Size variant */
  size?: TabsSize;
  /** Label for overflow menu button */
  overflowLabel?: string;
  /** Callback fired when selection changes */
  onChange?: (id: string) => void;
  /** Accessible label for the tablist */
  'aria-label'?: string;
  /** Additional CSS class */
  className?: string;
}

/** Options for the useTabs hook */
export interface UseTabsOptions {
  /** All tab items */
  items: TabItem[];
  /** Controlled selected tab ID */
  selectedId?: string;
  /** Default selected tab ID (uncontrolled) */
  defaultSelectedId?: string;
  /** Callback fired when selection changes */
  onChange?: (id: string) => void;
}

/** Result from useTabs hook */
export interface UseTabsResult {
  /** Currently selected tab ID */
  activeId: string;
  /** Currently focused tab ID */
  focusedId: string;
  /** Get unique DOM id for a tab */
  tabId: (id: string) => string;
  /** Get unique DOM id for a panel */
  panelId: (id: string) => string;
  /** Derive tablist keyboard handlers for a given visible set */
  getListProps: (visibleItems: TabItem[]) => {
    onKeyDown: (event: KeyboardEvent) => void;
  };
  /** Derive tab button props */
  getTabProps: (item: TabItem, visibleItems: TabItem[]) => {
    ref: (node: HTMLButtonElement | null) => void;
    id: string;
    role: 'tab';
    type: 'button';
    'aria-selected': boolean;
    'aria-controls': string;
    tabIndex: 0 | -1;
    disabled: boolean;
    onClick: () => void;
    onFocus: () => void;
  };
  /** Derive tab panel props */
  getPanelProps: (item: TabItem) => {
    id: string;
    role: 'tabpanel';
    'aria-labelledby': string;
    hidden: boolean;
    tabIndex: number;
  };
  /** Imperative selection helper */
  selectTab: (id: string) => void;
};

/** Hook to manage tabs overflow behavior */
export interface UseOverflowMenuOptions {
  /** All tab items */
  items: TabItem[];
  /** Container element reference */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Currently selected tab ID */
  selectedId: string;
}

/** Result from useOverflowMenu hook */
export interface UseOverflowMenuResult {
  /** Visible tab items */
  visibleItems: TabItem[];
  /** Overflow (hidden) tab items */
  overflowItems: TabItem[];
  /** Whether overflow menu should be shown */
  hasOverflow: boolean;
}
