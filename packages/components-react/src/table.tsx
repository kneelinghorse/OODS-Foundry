import * as React from 'react';
import { getStatusPresentation, getToneTokenSet } from './status.js';
import type {
  TableBodyProps,
  TableCaptionProps,
  TableCellProps,
  TableCompound,
  TableHeadProps,
  TableHeaderCellProps,
  TableProps,
  TableRowProps,
} from './types.js';

const classes = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

export const TableHead = React.forwardRef<HTMLTableSectionElement, TableHeadProps>(
  ({ className, ...rest }, ref) => (
    <thead ref={ref} className={classes('oods-table__header', className)} {...rest} />
  )
);
TableHead.displayName = 'OODS.Table.Head';

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...rest }, ref) => (
    <tbody ref={ref} className={classes('oods-table__body', className)} {...rest} />
  )
);
TableBody.displayName = 'OODS.Table.Body';

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...rest }, ref) => (
    <caption ref={ref} className={classes('oods-table__caption', className)} {...rest} />
  )
);
TableCaption.displayName = 'OODS.Table.Caption';

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  (
    {
      selectable = false,
      selected = false,
      onActivate,
      className,
      tabIndex,
      onClick,
      onKeyDown,
      ...rest
    },
    ref
  ) => {
    const handleClick: React.MouseEventHandler<HTMLTableRowElement> = event => {
      onClick?.(event);
      if (!event.defaultPrevented) onActivate?.(event);
    };
    const handleKeyDown: React.KeyboardEventHandler<HTMLTableRowElement> = event => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && selectable && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onActivate?.(event);
      }
    };
    return (
      <tr
        ref={ref}
        className={classes('oods-table__row', className)}
        data-selectable={selectable ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        aria-selected={selectable ? selected : undefined}
        tabIndex={selectable ? tabIndex ?? 0 : tabIndex}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      />
    );
  }
);
TableRow.displayName = 'OODS.Table.Row';

export const TableHeaderCell = React.forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  ({ numeric = false, className, scope = 'col', ...rest }, ref) => (
    <th
      ref={ref}
      className={classes(
        'oods-table__header-cell',
        numeric && 'oods-table__header-cell--numeric',
        className
      )}
      data-numeric={numeric ? 'true' : undefined}
      scope={scope}
      {...rest}
    />
  )
);
TableHeaderCell.displayName = 'OODS.Table.HeaderCell';

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  (
    {
      numeric = false,
      status,
      statusDomain = 'subscription',
      tone: toneOverride,
      statusEmphasis = 'surface',
      className,
      children,
      style,
      title,
      ...rest
    },
    ref
  ) => {
    const presentation = status ? getStatusPresentation(statusDomain, status) : undefined;
    const tone = toneOverride ?? presentation?.tone;
    const tokens = tone ? getToneTokenSet(tone) : undefined;
    const statusStyle = tokens
      ? statusEmphasis === 'text'
        ? { '--table-cell-status-foreground': tokens.foreground }
        : {
            '--table-cell-status-background': tokens.background,
            '--table-cell-status-border': tokens.border,
            '--table-cell-status-foreground': tokens.foreground,
          }
      : {};
    return (
      <td
        ref={ref}
        className={classes(
          'oods-table__cell',
          numeric && 'oods-table__cell--numeric',
          status && 'oods-table__cell--status',
          className
        )}
        data-numeric={numeric ? 'true' : undefined}
        data-status={status}
        data-status-domain={status ? statusDomain : undefined}
        data-status-tone={status ? tone : undefined}
        data-status-emphasis={status ? statusEmphasis : undefined}
        data-has-status={status ? 'true' : undefined}
        title={title ?? presentation?.description}
        style={{ ...statusStyle, ...style } as React.CSSProperties}
        {...rest}
      >
        {children ?? presentation?.label ?? status}
      </td>
    );
  }
);
TableCell.displayName = 'OODS.Table.Cell';

const TableRoot = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      caption,
      showCaption = true,
      columns,
      rows,
      density = 'comfortable',
      selectable = false,
      onRowActivate,
      children,
      containerClassName,
      containerStyle,
      className,
      ...rest
    },
    ref
  ) => (
    <div
      className={classes('oods-table__container', containerClassName)}
      style={containerStyle}
      data-density={density}
    >
      <table
        ref={ref}
        className={classes('oods-table', className)}
        data-oods-component="Table"
        data-density={density}
        {...rest}
      >
        {children ?? (
          <>
            {caption ? <TableCaption data-visually-hidden={showCaption ? undefined : 'true'}>{caption}</TableCaption> : null}
            <TableHead>
              <tr className="oods-table__row">
                {columns?.map(column => (
                  <TableHeaderCell key={column.key} numeric={column.numeric}>
                    {column.label}
                  </TableHeaderCell>
                ))}
              </tr>
            </TableHead>
            <TableBody>
              {(rows?.length ?? 0) === 0 ? (
                <tr className="oods-table__row">
                  <TableCell colSpan={Math.max(columns?.length ?? 0, 1)}>
                    No rows available.
                  </TableCell>
                </tr>
              ) : (
                rows?.map(row => (
                  <tr
                    key={row.id}
                    className="oods-table__row"
                    data-selectable={selectable ? 'true' : undefined}
                  >
                    {columns?.map((column, columnIndex) => {
                      const value = row[column.key];
                      const rendered = column.render ? column.render(value, row) : String(value ?? '');
                      return (
                        <TableCell key={column.key} numeric={column.numeric}>
                          {selectable && columnIndex === 0 ? (
                            <button
                              type="button"
                              className="oods-table-row-action"
                              onClick={event => onRowActivate?.(row.id, row, event)}
                            >
                              {rendered}
                            </button>
                          ) : (
                            rendered
                          )}
                        </TableCell>
                      );
                    })}
                  </tr>
                ))
              )}
            </TableBody>
          </>
        )}
      </table>
    </div>
  )
);
TableRoot.displayName = 'OODS.Table';

export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Caption: TableCaption,
  Row: TableRow,
  HeaderCell: TableHeaderCell,
  Cell: TableCell,
}) as TableCompound;
