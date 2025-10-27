/**
 * @file Breadcrumbs types
 * @module components/breadcrumbs/types
 */

/**
 * Single breadcrumb item
 */
export interface BreadcrumbItem {
  /** Unique identifier for the breadcrumb */
  id: string;
  /** Display label */
  label: string;
  /** Optional href for navigation */
  href?: string;
  /** Whether this item is disabled */
  disabled?: boolean;
}

/**
 * Props for Breadcrumbs component
 */
export interface BreadcrumbsProps {
  /** Array of breadcrumb items (first to last) */
  items: BreadcrumbItem[];
  /** Label for the overflow menu */
  overflowLabel?: string;
  /** Aria label for the navigation landmark */
  'aria-label'?: string;
  /** Additional className */
  className?: string;
  /** Max visible items before overflow (first + last + maxVisible middle items) */
  maxVisibleItems?: number;
  /** Callback when item is clicked */
  onItemClick?: (item: BreadcrumbItem) => void;
}
