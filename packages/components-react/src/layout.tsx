import * as React from 'react';
import type { GridProps, LayoutGap, StackProps } from './types.js';

const classes = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

const GAP_VALUES: Record<string, string> = {
  xs: 'var(--cmp-spacing-inline-xs, 0.5rem)',
  sm: 'var(--cmp-spacing-inline-sm, 0.75rem)',
  md: 'var(--cmp-spacing-stack-default, 1rem)',
  lg: 'var(--cmp-spacing-stack-lg, 1.5rem)',
  xl: 'var(--cmp-spacing-stack-xl, 2rem)',
};

const resolveGap = (gap: LayoutGap | undefined): string | undefined =>
  gap ? GAP_VALUES[gap] ?? gap : undefined;

/** A numeric column count is a maximum the shared CSS wraps below (s206-m01); `auto-fit` has none. */
const maxColumns = (columns: number | string | undefined): number | undefined => {
  const count = Number(columns);
  return Number.isFinite(count) && count > 0 ? count : undefined;
};

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      columns = 'auto-fit',
      minColumnWidth = '16rem',
      gap = 'md',
      align = 'stretch',
      justify = 'normal',
      className,
      style,
      ...rest
    },
    ref
  ) => (
    <div
      ref={ref}
      className={classes('oods-grid', className)}
      data-oods-component="Grid"
      data-max-columns={maxColumns(columns)}
      style={{
        '--oods-grid-columns': columns,
        '--oods-grid-min-column': minColumnWidth,
        '--oods-layout-gap': resolveGap(gap),
        '--oods-layout-align': align,
        '--oods-layout-justify': justify,
        ...style,
      } as React.CSSProperties}
      {...rest}
    />
  )
);
Grid.displayName = 'OODS.Grid';

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'column',
      gap = 'md',
      align = 'stretch',
      justify = 'flex-start',
      wrap = false,
      className,
      style,
      ...rest
    },
    ref
  ) => (
    <div
      ref={ref}
      className={classes('oods-stack', className)}
      data-oods-component="Stack"
      data-direction={direction}
      data-wrap={wrap ? 'true' : 'false'}
      style={{
        '--oods-stack-direction': direction,
        '--oods-stack-wrap': wrap ? 'wrap' : 'nowrap',
        '--oods-layout-gap': resolveGap(gap),
        '--oods-layout-align': align,
        '--oods-layout-justify': justify,
        ...style,
      } as React.CSSProperties}
      {...rest}
    />
  )
);
Stack.displayName = 'OODS.Stack';
