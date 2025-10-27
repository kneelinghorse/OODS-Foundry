/**
 * @file Breadcrumbs component
 * @module components/breadcrumbs/Breadcrumbs
 */

import * as React from 'react';
import type { BreadcrumbsProps, BreadcrumbItem } from './types.js';
import { resolveBreadcrumbsTokens } from './tokens.js';
import { Popover } from '../Popover/Popover.js';
import './breadcrumbs.css';

type BreadcrumbsElement = React.ElementRef<'nav'>;
type BreadcrumbsHandle = BreadcrumbsElement | null;

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const WIDTH_TOLERANCE_PX = 1;

interface IndexedBreadcrumbItem {
  item: BreadcrumbItem;
  index: number;
  key: string;
}

const buildItemKey = (item: BreadcrumbItem, index: number): string => {
  if (item.id) {
    return item.id;
  }
  const labelToken = item.label.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  return `breadcrumb-${index}-${labelToken || 'item'}`;
};

const sanitizeMaxVisibleItems = (maxVisibleItems: number): number => {
  if (!Number.isFinite(maxVisibleItems)) {
    return Number.POSITIVE_INFINITY;
  }

  if (maxVisibleItems <= 0) {
    return 0;
  }

  return Math.floor(maxVisibleItems);
};

export const Breadcrumbs = React.forwardRef<BreadcrumbsHandle, BreadcrumbsProps>(
  (
    {
      items,
      overflowLabel = '...',
      'aria-label': ariaLabelProp = 'breadcrumb',
      className,
      maxVisibleItems = 5,
      onItemClick,
    },
    forwardedRef
  ) => {
    const tokens = resolveBreadcrumbsTokens();
    const navRef = React.useRef<BreadcrumbsElement | null>(null);
    const measurementListRef = React.useRef<HTMLOListElement | null>(null);

    const assignNavRef = React.useCallback(
      (node: BreadcrumbsElement | null) => {
        navRef.current = node;

        if (!forwardedRef) {
          return;
        }

        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const normalizedMaxVisible = React.useMemo(
      () => sanitizeMaxVisibleItems(maxVisibleItems),
      [maxVisibleItems]
    );

    const indexedItems = React.useMemo<IndexedBreadcrumbItem[]>(
      () =>
        items.map((item, index) => ({
          item,
          index,
          key: buildItemKey(item, index),
        })),
      [items]
    );

    const shouldOverflowByCount = React.useMemo(() => {
      if (indexedItems.length <= 2) {
        return false;
      }

      if (normalizedMaxVisible === 0) {
        return true;
      }

      if (!Number.isFinite(normalizedMaxVisible)) {
        return false;
      }

      return indexedItems.length > normalizedMaxVisible;
    }, [indexedItems, normalizedMaxVisible]);

    const [isOverflowing, setIsOverflowing] = React.useState<boolean>(
      indexedItems.length > 2 && shouldOverflowByCount
    );

    const checkOverflow = React.useCallback(() => {
      const nav = navRef.current;
      const measurementList = measurementListRef.current;
      const fallbackOverflow = indexedItems.length > 2 && shouldOverflowByCount;

      if (!nav || !measurementList) {
        setIsOverflowing((prev) => (prev !== fallbackOverflow ? fallbackOverflow : prev));
        return;
      }

      const availableWidth = nav.clientWidth;
      const contentWidth = measurementList.scrollWidth;

      if (availableWidth === 0 || contentWidth === 0) {
        setIsOverflowing((prev) => (prev !== fallbackOverflow ? fallbackOverflow : prev));
        return;
      }

      const widthOverflow = contentWidth - availableWidth > WIDTH_TOLERANCE_PX;
      const resolvedOverflow =
        indexedItems.length > 2 && (shouldOverflowByCount || widthOverflow);

      setIsOverflowing((prev) => (prev !== resolvedOverflow ? resolvedOverflow : prev));
    }, [indexedItems, shouldOverflowByCount]);

    useIsomorphicLayoutEffect(() => {
      checkOverflow();
    }, [checkOverflow]);

    useIsomorphicLayoutEffect(() => {
      const nav = navRef.current;
      if (!nav) {
        return;
      }

      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(() => {
          checkOverflow();
        });
        observer.observe(nav);
        return () => observer.disconnect();
      }

      if (typeof window === 'undefined') {
        return;
      }

      const handleResize = () => checkOverflow();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [checkOverflow]);

    const visibleEntries = React.useMemo<IndexedBreadcrumbItem[]>(() => {
      if (!isOverflowing) {
        return indexedItems;
      }

      if (indexedItems.length === 0) {
        return [];
      }

      if (indexedItems.length === 1) {
        return [indexedItems[0]];
      }

      return [indexedItems[0], indexedItems[indexedItems.length - 1]];
    }, [indexedItems, isOverflowing]);

    const overflowEntries = React.useMemo<IndexedBreadcrumbItem[]>(() => {
      if (!isOverflowing || indexedItems.length <= 2) {
        return [];
      }
      return indexedItems.slice(1, -1);
    }, [indexedItems, isOverflowing]);

    const hasOverflow = overflowEntries.length > 0;

    const handleItemClick = (item: BreadcrumbItem, event: React.MouseEvent<HTMLElement>) => {
      if (item.disabled) {
        event.preventDefault();
        return;
      }
      onItemClick?.(item);
    };

    const renderItem = (
      item: BreadcrumbItem,
      isLast: boolean,
      disableInteraction = false
    ): React.ReactNode => {
      const isCurrent = isLast;

      if (isCurrent) {
        return (
          <span className="breadcrumbs__item breadcrumbs__item--current" aria-current="page">
            {item.label}
          </span>
        );
      }

      if (item.disabled) {
        return <span className="breadcrumbs__item breadcrumbs__item--disabled">{item.label}</span>;
      }

      if (item.href) {
        return (
          <a
            href={item.href}
            className="breadcrumbs__item breadcrumbs__link"
            onClick={
              disableInteraction
                ? undefined
                : (event) => {
                    handleItemClick(item, event);
                  }
            }
          >
            {item.label}
          </a>
        );
      }

      return (
        <button
          type="button"
          className="breadcrumbs__item breadcrumbs__link"
          onClick={
            disableInteraction
              ? undefined
              : (event) => {
                  handleItemClick(item, event);
                }
          }
        >
          {item.label}
        </button>
      );
    };

    const separatorIcon = (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="breadcrumbs__separator"
      >
        <path d="M6 12l4-4-4-4v8z" />
      </svg>
    );

    const renderListItems = (
      entries: IndexedBreadcrumbItem[],
      options: {
        disableInteraction?: boolean;
        includeDataAttribute?: boolean;
        keyPrefix?: string;
      } = {}
    ) =>
      entries.map((entry, position) => {
        const isLast = position === entries.length - 1;
        const fragmentKey = `${options.keyPrefix ?? ''}${entry.key}-${position}`;
        const dataAttributes = options.includeDataAttribute
          ? { 'data-breadcrumb-id': entry.key }
          : undefined;

        return (
          <React.Fragment key={fragmentKey}>
            <li className="breadcrumbs__list-item" {...dataAttributes}>
              {renderItem(entry.item, isLast, options.disableInteraction)}
            </li>
            {!isLast && (
              <li className="breadcrumbs__list-item" aria-hidden="true">
                {separatorIcon}
              </li>
            )}
          </React.Fragment>
        );
      });

    const ariaLabel = ariaLabelProp ?? 'breadcrumb';

    return (
      <nav
        ref={assignNavRef}
        aria-label={ariaLabel}
        className={className ? `breadcrumbs ${className}` : 'breadcrumbs'}
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-font-size' as any]: tokens.fontSize,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-font-weight' as any]: tokens.fontWeight,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-gap' as any]: tokens.gap,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-padding-block' as any]: tokens.paddingBlock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-padding-inline' as any]: tokens.paddingInline,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-text' as any]: tokens.colorText,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-text-disabled' as any]: tokens.colorTextDisabled,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-text-current' as any]: tokens.colorTextCurrent,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-link' as any]: tokens.colorLink,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-link-hover' as any]: tokens.colorLinkHover,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-color-separator' as any]: tokens.colorSeparator,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-focus-outline-color' as any]: tokens.focusOutlineColor,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--breadcrumbs-focus-outline-width' as any]: tokens.focusOutlineWidth,
        }}
      >
        <ol
          ref={measurementListRef}
          className="breadcrumbs__list breadcrumbs__list--measurement"
          aria-hidden="true"
        >
          {renderListItems(indexedItems, {
            disableInteraction: true,
            includeDataAttribute: false,
            keyPrefix: 'measurement-',
          })}
        </ol>

        <ol className="breadcrumbs__list" data-breadcrumbs="visible">
          {!hasOverflow ? (
            renderListItems(visibleEntries)
          ) : (
            <>
              {visibleEntries[0] ? (
                <li
                  className="breadcrumbs__list-item"
                  data-breadcrumb-id={visibleEntries[0].key}
                >
                  {renderItem(visibleEntries[0].item, visibleEntries.length === 1)}
                </li>
              ) : null}

              <li className="breadcrumbs__list-item" aria-hidden="true">
                {separatorIcon}
              </li>

              <li className="breadcrumbs__list-item">
                <Popover
                  trigger={
                    <button
                      type="button"
                      className="breadcrumbs__overflow-trigger"
                      aria-label={`Show ${overflowEntries.length} hidden breadcrumb levels`}
                    >
                      {overflowLabel}
                    </button>
                  }
                  title="Navigation path"
                >
                  <div className="breadcrumbs__overflow-menu" role="menu">
                    {overflowEntries.map((entry) => {
                      const isDisabled = !!entry.item.disabled;

                      if (entry.item.href && !isDisabled) {
                        return (
                          <a
                            key={`overflow-${entry.key}`}
                            role="menuitem"
                            href={entry.item.href}
                            className="breadcrumbs__overflow-item"
                            onClick={(event) => {
                              handleItemClick(entry.item, event);
                            }}
                          >
                            {entry.item.label}
                          </a>
                        );
                      }

                      return (
                        <button
                          key={`overflow-${entry.key}`}
                          role="menuitem"
                          type="button"
                          disabled={isDisabled}
                          onClick={(event) => {
                            if (isDisabled) {
                              return;
                            }
                            handleItemClick(entry.item, event);
                          }}
                          className={`breadcrumbs__overflow-item${
                            isDisabled ? ' breadcrumbs__overflow-item--disabled' : ''
                          }`}
                        >
                          {entry.item.label}
                        </button>
                      );
                    })}
                  </div>
                </Popover>
              </li>

              {visibleEntries.length > 1 ? (
                <>
                  <li className="breadcrumbs__list-item" aria-hidden="true">
                    {separatorIcon}
                  </li>
                  <li
                    className="breadcrumbs__list-item"
                    data-breadcrumb-id={visibleEntries[visibleEntries.length - 1].key}
                  >
                    {renderItem(visibleEntries[visibleEntries.length - 1].item, true)}
                  </li>
                </>
              ) : null}
            </>
          )}
        </ol>
      </nav>
    );
  }
);

Breadcrumbs.displayName = 'Breadcrumbs';
