/**
 * @file Pagination component
 * @module components/pagination/Pagination
 */

import * as React from 'react';
import type { PaginationProps, PaginationItem } from './types.js';
import { usePagination } from './usePagination.js';
import { resolvePaginationTokens } from './tokens.js';
import './pagination.css';

type PaginationElement = React.ElementRef<'nav'>;

/**
 * Pagination component for navigating through paginated content
 *
 * Features:
 * - Headless usePagination hook for reusable logic
 * - Truncation with ellipsis for large page counts
 * - Previous/Next navigation with boundary disabling
 * - aria-current for selected page
 * - Responsive mobile collapse pattern
 * - High-contrast mode support
 *
 * @example
 * ```tsx
 * const [page, setPage] = useState(1);
 * <Pagination
 *   page={page}
 *   count={50}
 *   onChange={setPage}
 *   siblingCount={1}
 *   boundaryCount={1}
 * />
 * ```
 */
export const Pagination = React.forwardRef<PaginationElement, PaginationProps>(
  (
    {
      page,
      count,
      onChange,
      siblingCount = 1,
      boundaryCount = 1,
      'aria-label': ariaLabel = 'Pagination',
      className,
      showFirstLast = false,
    },
    forwardedRef
  ) => {
    const { items, goToPage } = usePagination({
      page,
      count,
      siblingCount,
      boundaryCount,
      onChange,
    });

    const tokens = resolvePaginationTokens();

    const handleItemClick = (item: PaginationItem) => {
      if (item.disabled || typeof item.page !== 'number') {
        return;
      }
      goToPage(item.page);
    };

    const previousIcon = (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 12l-4-4 4-4v8z" />
      </svg>
    );

    const nextIcon = (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 12l4-4-4-4v8z" />
      </svg>
    );

    const renderItem = (item: PaginationItem, index: number) => {
      const key =
        item.type === 'page' && item.page !== undefined
          ? `page-${item.page}`
          : item.type === 'ellipsis'
          ? `ellipsis-${item.index ?? index}`
          : item.type;

      if (item.type === 'ellipsis') {
        return (
          <li
            key={key}
            className="pagination__item pagination__item--ellipsis"
            aria-hidden="true"
          >
            <span className="pagination__ellipsis">&hellip;</span>
          </li>
        );
      }

      if (item.type === 'page' && item.page !== undefined) {
        const isSelected = item.selected;
        return (
          <li key={key} className="pagination__item pagination__item--page">
            <button
              type="button"
              className={`pagination__button pagination__button--page${
                isSelected ? ' pagination__button--selected' : ''
              }`}
              onClick={() => handleItemClick(item)}
              aria-label={`Page ${item.page}`}
              aria-current={isSelected ? 'page' : undefined}
              disabled={item.disabled}
            >
              {item.page}
            </button>
          </li>
        );
      }

      if ((item.type === 'previous' || item.type === 'next') && typeof item.page === 'number') {
        const label =
          item.type === 'previous' ? 'Go to previous page' : 'Go to next page';
        const icon = item.type === 'previous' ? previousIcon : nextIcon;

        return (
          <li key={key} className="pagination__item pagination__item--nav">
            <button
              type="button"
              className="pagination__button pagination__button--nav"
              onClick={() => handleItemClick(item)}
              aria-label={label}
              disabled={item.disabled}
            >
              {icon}
            </button>
          </li>
        );
      }

      return null;
    };

    const isFirstDisabled = count <= 0 || page <= 1;
    const isLastDisabled = count <= 0 || page >= count;

    return (
      <nav
        ref={forwardedRef}
        aria-label={ariaLabel}
        className={className ? `pagination ${className}` : 'pagination'}
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-font-size' as any]: tokens.fontSize,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-font-weight' as any]: tokens.fontWeight,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-gap' as any]: tokens.gap,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-padding-block' as any]: tokens.paddingBlock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-padding-inline' as any]: tokens.paddingInline,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-border-radius' as any]: tokens.borderRadius,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-text' as any]: tokens.colorText,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-text-disabled' as any]: tokens.colorTextDisabled,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-text-selected' as any]: tokens.colorTextSelected,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-background' as any]: tokens.colorBackground,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-background-hover' as any]: tokens.colorBackgroundHover,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-background-selected' as any]: tokens.colorBackgroundSelected,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-border' as any]: tokens.colorBorder,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-color-border-hover' as any]: tokens.colorBorderHover,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-focus-outline-color' as any]: tokens.focusOutlineColor,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--pagination-focus-outline-width' as any]: tokens.focusOutlineWidth,
        }}
      >
        <ul className="pagination__list">
          {/* First button (optional) */}
          {showFirstLast && (
            <li className="pagination__item pagination__item--nav">
              <button
                type="button"
                className="pagination__button pagination__button--nav"
                onClick={() => goToPage(1)}
                disabled={isFirstDisabled}
                aria-label="Go to first page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M11 12l-4-4 4-4v8zm-6-8v8h2V4H5z" />
                </svg>
              </button>
            </li>
          )}

          {items.map((item, index) => renderItem(item, index))}

          {/* Last button (optional) */}
          {showFirstLast && (
            <li className="pagination__item pagination__item--nav">
              <button
                type="button"
                className="pagination__button pagination__button--nav"
                onClick={() => goToPage(count)}
                disabled={isLastDisabled}
                aria-label="Go to last page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5 12l4-4-4-4v8zm6 0V4H9v8h2z" />
                </svg>
              </button>
            </li>
          )}
        </ul>
      </nav>
    );
  }
);

Pagination.displayName = 'Pagination';
