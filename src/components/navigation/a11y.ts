/**
 * @file Shared navigation component accessibility utilities
 * @module components/navigation/a11y
 *
 * Reusable focus management and keyboard interaction helpers for navigation components
 * (Tabs, Pagination, Breadcrumbs).
 */

/**
 * Manages roving tabindex for a list of focusable elements
 * Based on WAI-ARIA Authoring Practices for tab panels
 */
export interface RovingTabindexOptions {
  /** Current focused index */
  currentIndex: number;
  /** List of disabled indexes */
  disabledIndexes: number[];
  /** Total number of items */
  totalItems: number;
  /** Callback to update focused item */
  onFocusChange: (index: number) => void;
}

/**
 * Calculate next/previous enabled index with wrapping
 */
export function getNextEnabledIndex(
  currentIndex: number,
  direction: 1 | -1,
  totalItems: number,
  disabledIndexes: number[]
): number {
  let nextIndex = currentIndex;
  let attempts = 0;
  const maxAttempts = totalItems;

  do {
    nextIndex = (nextIndex + direction + totalItems) % totalItems;
    attempts++;
    if (attempts >= maxAttempts) {
      // Prevent infinite loop if all items are disabled
      return currentIndex;
    }
  } while (disabledIndexes.includes(nextIndex));

  return nextIndex;
}

/**
 * Get the first enabled index in a list
 */
export function getFirstEnabledIndex(totalItems: number, disabledIndexes: number[]): number {
  for (let i = 0; i < totalItems; i++) {
    if (!disabledIndexes.includes(i)) {
      return i;
    }
  }
  return 0;
}

/**
 * Get the last enabled index in a list
 */
export function getLastEnabledIndex(totalItems: number, disabledIndexes: number[]): number {
  for (let i = totalItems - 1; i >= 0; i--) {
    if (!disabledIndexes.includes(i)) {
      return i;
    }
  }
  return totalItems - 1;
}

/**
 * Handle arrow key navigation for horizontal navigation components
 * Returns true if the event was handled
 */
export function handleHorizontalArrowKeys(
  event: React.KeyboardEvent,
  options: RovingTabindexOptions
): boolean {
  const { key } = event;
  const { currentIndex, disabledIndexes, totalItems, onFocusChange } = options;

  if (key === 'ArrowRight') {
    event.preventDefault();
    const nextIndex = getNextEnabledIndex(currentIndex, 1, totalItems, disabledIndexes);
    onFocusChange(nextIndex);
    return true;
  }

  if (key === 'ArrowLeft') {
    event.preventDefault();
    const prevIndex = getNextEnabledIndex(currentIndex, -1, totalItems, disabledIndexes);
    onFocusChange(prevIndex);
    return true;
  }

  if (key === 'Home') {
    event.preventDefault();
    const firstIndex = getFirstEnabledIndex(totalItems, disabledIndexes);
    onFocusChange(firstIndex);
    return true;
  }

  if (key === 'End') {
    event.preventDefault();
    const lastIndex = getLastEnabledIndex(totalItems, disabledIndexes);
    onFocusChange(lastIndex);
    return true;
  }

  return false;
}

/**
 * Create tabindex value for roving tabindex pattern
 * Returns 0 for active item, -1 for inactive items
 */
export function getRovingTabIndex(index: number, activeIndex: number): 0 | -1 {
  return index === activeIndex ? 0 : -1;
}
