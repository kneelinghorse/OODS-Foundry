import * as React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import {
  getStatusPresentation,
  getToneTokenSet,
  type StatusDomain,
  type StatusTone,
} from '../statusables/statusRegistry.js';
import type { FieldDensity } from './fieldUtils.js';

const DEFAULT_STATUS_DOMAIN: StatusDomain = 'subscription';

type TableElement = React.ElementRef<'table'>;
type TableSectionElement = React.ElementRef<'thead'>;
type TableBodyElement = React.ElementRef<'tbody'>;
type TableCaptionElement = React.ElementRef<'caption'>;
type TableRowElement = React.ElementRef<'tr'>;
type TableHeaderCellElement = React.ElementRef<'th'>;
type TableCellElement = React.ElementRef<'td'>;

type TableCellStatusEmphasis = 'surface' | 'text';

function buildStatusVariables(
  tone: StatusTone,
  emphasis: TableCellStatusEmphasis
): React.CSSProperties {
  const tokens = getToneTokenSet(tone);

  if (emphasis === 'text') {
    return {
      '--table-cell-status-foreground': tokens.foreground,
    } as React.CSSProperties;
  }

  return {
    '--table-cell-status-background': tokens.background,
    '--table-cell-status-border': tokens.border,
    '--table-cell-status-foreground': tokens.foreground,
  } as React.CSSProperties;
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  readonly density?: FieldDensity;
  readonly containerClassName?: string;
  readonly containerStyle?: React.CSSProperties;
}

export const Table = React.forwardRef<TableElement, TableProps>(
  (
    {
      density = 'comfortable',
      containerClassName,
      containerStyle,
      className,
      children,
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const containerClasses = ['oods-table__container', containerClassName]
      .filter(Boolean)
      .join(' ');
    const tableClasses = ['oods-table', className].filter(Boolean).join(' ');

    return (
      <div
        className={containerClasses}
        style={containerStyle}
        data-density={density}
      >
        <table
          ref={forwardedRef}
          className={tableClasses}
          data-density={density}
          style={style}
          {...rest}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'OODS.Table';

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader = React.forwardRef<TableSectionElement, TableHeaderProps>(
  ({ className, ...rest }, forwardedRef) => {
    const headerClassName = ['oods-table__header', className].filter(Boolean).join(' ');

    return <thead ref={forwardedRef} className={headerClassName} {...rest} />;
  }
);

TableHeader.displayName = 'OODS.TableHeader';

export interface TableBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = React.forwardRef<TableBodyElement, TableBodyProps>(
  ({ className, ...rest }, forwardedRef) => {
    const bodyClassName = ['oods-table__body', className].filter(Boolean).join(' ');

    return <tbody ref={forwardedRef} className={bodyClassName} {...rest} />;
  }
);

TableBody.displayName = 'OODS.TableBody';

export type TableCaptionProps = ComponentPropsWithoutRef<'caption'>;

export const TableCaption = React.forwardRef<TableCaptionElement, TableCaptionProps>(
  ({ className, ...rest }, forwardedRef) => {
    const captionClassName = ['oods-table__caption', className].filter(Boolean).join(' ');

    return <caption ref={forwardedRef} className={captionClassName} {...rest} />;
  }
);

TableCaption.displayName = 'OODS.TableCaption';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  readonly selectable?: boolean;
  readonly selected?: boolean;
  readonly onActivate?: (
    event:
      | React.MouseEvent<HTMLTableRowElement>
      | React.KeyboardEvent<HTMLTableRowElement>
  ) => void;
}

export const TableRow = React.forwardRef<TableRowElement, TableRowProps>(
  (
    { selectable = false, selected = false, onActivate, className, tabIndex, onClick, onKeyDown, ...rest },
    forwardedRef
  ) => {
    const rowClassName = ['oods-table__row', className].filter(Boolean).join(' ');
    const computedTabIndex = selectable ? tabIndex ?? 0 : tabIndex;

    const handleClick: React.MouseEventHandler<HTMLTableRowElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        onActivate?.(event);
      }
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLTableRowElement> = (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      if (selectable && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onActivate?.(event);
      }
    };

    return (
      <tr
        ref={forwardedRef}
        className={rowClassName}
        data-selectable={selectable ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        aria-selected={selectable ? selected : undefined}
        tabIndex={computedTabIndex}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      />
    );
  }
);

TableRow.displayName = 'OODS.TableRow';

export interface TableHeaderCellProps
  extends ComponentPropsWithoutRef<'th'> {
  readonly numeric?: boolean;
}

export const TableHeaderCell = React.forwardRef<
  TableHeaderCellElement,
  TableHeaderCellProps
>(({ numeric = false, className, scope, ...rest }, forwardedRef) => {
  const headerCellClassName = [
    'oods-table__header-cell',
    numeric ? 'oods-table__header-cell--numeric' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <th
      ref={forwardedRef}
      className={headerCellClassName}
      data-numeric={numeric ? 'true' : undefined}
      scope={scope ?? 'col'}
      {...rest}
    />
  );
});

TableHeaderCell.displayName = 'OODS.TableHeaderCell';

export interface TableCellProps extends ComponentPropsWithoutRef<'td'> {
  readonly numeric?: boolean;
  readonly status?: string;
  readonly statusDomain?: StatusDomain;
  readonly tone?: StatusTone;
  readonly statusEmphasis?: TableCellStatusEmphasis;
}

export const TableCell = React.forwardRef<TableCellElement, TableCellProps>(
  (
    {
      numeric = false,
      status,
      statusDomain = DEFAULT_STATUS_DOMAIN,
      tone,
      statusEmphasis = 'surface',
      className,
      style,
      children,
      title,
      ...rest
    },
    forwardedRef
  ) => {
    const presentation = status ? getStatusPresentation(statusDomain, status) : undefined;
    const resolvedTone = tone ?? presentation?.tone;
    const statusVariables =
      resolvedTone !== undefined ? buildStatusVariables(resolvedTone, statusEmphasis) : undefined;

    const mergedStyle = statusVariables
      ? style
        ? ({ ...statusVariables, ...style } as React.CSSProperties)
        : statusVariables
      : style;

    const cellClassName = [
      'oods-table__cell',
      numeric ? 'oods-table__cell--numeric' : null,
      status ? 'oods-table__cell--status' : null,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const hasCustomContent = children !== undefined && children !== null;
    const content = hasCustomContent
      ? children
      : status
        ? presentation?.label ?? status
        : children;

    const resolvedTitle =
      title ?? (status ? presentation?.description : undefined);

    return (
      <td
        ref={forwardedRef}
        className={cellClassName}
        style={mergedStyle}
        data-numeric={numeric ? 'true' : undefined}
        data-status-tone={status && resolvedTone ? resolvedTone : undefined}
        data-status-domain={status ? statusDomain : undefined}
        data-status-emphasis={status ? statusEmphasis : undefined}
        data-has-status={status ? 'true' : undefined}
        title={resolvedTitle}
        {...rest}
      >
        {content}
      </td>
    );
  }
);

TableCell.displayName = 'OODS.TableCell';

export type { TableCellStatusEmphasis };
