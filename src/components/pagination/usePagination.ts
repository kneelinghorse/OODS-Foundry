/**
 * @file usePagination - Headless hook for pagination logic
 * @module components/pagination/usePagination
 */

import { useMemo } from 'react';
import type { UsePaginationOptions, PaginationItem } from './types.js';

/**
 * Calculate pagination items with truncation logic
 *
 * Implements the canonical pagination truncation pattern while returning
 * structured items for previous/next controls and ellipsis markers:
 * - Show boundaryCount pages at start and end
 * - Show siblingCount pages around the current page
 * - Replace gaps with ellipsis (...) markers
 * - Always include previous/next navigation items with disabled states
 *
 * Examples:
 * - prev [1] [2] [3] [4] [5] next (no truncation)
 * - prev [1] [...] [5] [6] [7] [...] [10] next (double ellipsis)
 * - prev [1] [2] [3] [...] [10] next (single ellipsis at end)
 *
 * @param options - Configuration object
 * @returns Array of pagination items to render
 */
export function usePagination(options: UsePaginationOptions): {
  items: PaginationItem[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
} {
  const {
    page,
    count,
    siblingCount = 1,
    boundaryCount = 1,
    onChange,
  } = options;

  // Normalise numeric inputs
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rawPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = safeCount > 0 ? Math.max(1, Math.min(rawPage, safeCount)) : 1;

  const requestedSiblingCount = Number.isFinite(siblingCount)
    ? Math.floor(siblingCount)
    : Math.floor(1);
  const safeSiblingCount = Math.max(0, requestedSiblingCount);

  const requestedBoundaryCount = Number.isFinite(boundaryCount)
    ? Math.floor(boundaryCount)
    : Math.floor(1);
  const safeBoundaryCount = Math.max(1, requestedBoundaryCount);

  const items = useMemo(() => {
    const result: PaginationItem[] = [];
    const hasPages = safeCount > 0;

    const range = (start: number, end: number) => {
      if (start > end) {
        return [];
      }
      const length = end - start + 1;
      return Array.from({ length }, (_, index) => start + index);
    };

    const createPageItem = (pageNumber: number): PaginationItem => ({
      type: 'page',
      page: pageNumber,
      selected: pageNumber === safePage,
      disabled: false,
    });

    const createEllipsis = (ellipsisIndex: number): PaginationItem => ({
      type: 'ellipsis',
      selected: false,
      disabled: true,
      index: ellipsisIndex,
    });

    // Previous navigation item
    const previousDisabled = !hasPages || safePage <= 1;
    const previousTarget = previousDisabled ? safePage : safePage - 1;

    result.push({
      type: 'previous',
      page: previousTarget,
      selected: false,
      disabled: previousDisabled,
    });

    // Edge case: no pages to display
    if (!hasPages) {
      result.push({
        type: 'next',
        page: 1,
        selected: false,
        disabled: true,
      });
      return result;
    }

    const startPages = range(1, Math.min(safeBoundaryCount, safeCount));
    const endPages = range(
      Math.max(safeCount - safeBoundaryCount + 1, safeBoundaryCount + 1),
      safeCount
    );

    const siblingsStart = Math.max(
      Math.min(
        safePage - safeSiblingCount,
        safeCount - safeBoundaryCount - safeSiblingCount * 2 - 1
      ),
      safeBoundaryCount + 2
    );

    const siblingsEnd = Math.min(
      Math.max(
        safePage + safeSiblingCount,
        safeBoundaryCount + safeSiblingCount * 2 + 2
      ),
      safeCount - safeBoundaryCount - 1
    );

    const totalPageNumbers =
      safeBoundaryCount * 2 + safeSiblingCount * 2 + 5;

    const pageItems: PaginationItem[] = [];
    let ellipsisIndex = 0;

    if (safeCount <= totalPageNumbers) {
      range(1, safeCount).forEach(pageNumber => {
        pageItems.push(createPageItem(pageNumber));
      });
    } else {
      startPages.forEach(pageNumber => {
        pageItems.push(createPageItem(pageNumber));
      });

      const hasLeftGap =
        siblingsStart > safeBoundaryCount + 2;
      const hasRightGap =
        siblingsEnd < safeCount - safeBoundaryCount - 1;

      if (hasLeftGap) {
        pageItems.push(createEllipsis(ellipsisIndex++));
      } else {
        range(safeBoundaryCount + 1, siblingsStart - 1).forEach(
          pageNumber => {
            pageItems.push(createPageItem(pageNumber));
          }
        );
      }

      range(siblingsStart, siblingsEnd).forEach(pageNumber => {
        pageItems.push(createPageItem(pageNumber));
      });

      if (hasRightGap) {
        pageItems.push(createEllipsis(ellipsisIndex++));
      } else {
        range(siblingsEnd + 1, safeCount - safeBoundaryCount).forEach(
          pageNumber => {
            pageItems.push(createPageItem(pageNumber));
          }
        );
      }

      endPages.forEach(pageNumber => {
        pageItems.push(createPageItem(pageNumber));
      });
    }

    // Remove duplicate pages (can happen at boundaries) while preserving order
    const seen = new Set<number>();
    const dedupedPages = pageItems.filter(item => {
      if (item.type !== 'page' || item.page === undefined) {
        return true;
      }
      if (seen.has(item.page)) {
        return false;
      }
      seen.add(item.page);
      return true;
    });

    result.push(...dedupedPages);

    const nextDisabled = safePage >= safeCount;
    const nextTarget = nextDisabled ? safeCount : safePage + 1;

    result.push({
      type: 'next',
      page: nextTarget,
      selected: false,
      disabled: nextDisabled,
    });

    return result;
  }, [safePage, safeCount, safeSiblingCount, safeBoundaryCount]);

  // Navigation handlers
  const goToPage = (newPage: number) => {
    if (safeCount === 0) {
      return;
    }
    const clampedPage = Math.max(1, Math.min(newPage, safeCount));
    if (clampedPage !== safePage) {
      onChange?.(clampedPage);
    }
  };

  const nextPage = () => {
    if (safePage < safeCount) {
      goToPage(safePage + 1);
    }
  };

  const previousPage = () => {
    if (safePage > 1) {
      goToPage(safePage - 1);
    }
  };

  return {
    items,
    goToPage,
    nextPage,
    previousPage,
  };
}
