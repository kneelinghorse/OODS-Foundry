/**
 * @file Pagination types
 * @module components/pagination/types
 */

/**
 * Item type returned by usePagination hook
 */
export type PaginationItemType = 'page' | 'ellipsis' | 'previous' | 'next';

/**
 * Pagination item structure
 */
export interface PaginationItem {
  /** Type of pagination item */
  type: PaginationItemType;
  /** Page number (for type='page') */
  page?: number;
  /** Whether this item is selected (current page) */
  selected: boolean;
  /** Whether this item is disabled */
  disabled: boolean;
  /** Optional index for keying */
  index?: number;
}

/**
 * Configuration for usePagination hook
 */
export interface UsePaginationOptions {
  /** Current page number (1-based) */
  page: number;
  /** Total number of pages */
  count: number;
  /** Number of page links to show on each side of current page */
  siblingCount?: number;
  /** Number of page links to show at start and end */
  boundaryCount?: number;
  /** Callback when page changes */
  onChange?: (page: number) => void;
}

/**
 * Props for Pagination component
 */
export interface PaginationProps {
  /** Current page number (1-based) */
  page: number;
  /** Total number of pages */
  count: number;
  /** Callback when page changes */
  onChange: (page: number) => void;
  /** Number of page links to show on each side of current page */
  siblingCount?: number;
  /** Number of page links to show at start and end */
  boundaryCount?: number;
  /** Aria label for navigation */
  'aria-label'?: string;
  /** Additional className */
  className?: string;
  /** Show first/last buttons */
  showFirstLast?: boolean;
}
