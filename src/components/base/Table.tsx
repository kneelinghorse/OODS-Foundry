import { Table as CanonicalTable } from '../../../packages/components-react/src/index.js';

/** @deprecated Import the compound Table from @oods/components-react. */
export const Table = CanonicalTable;
export const TableHeader = CanonicalTable.Head;
export const TableBody = CanonicalTable.Body;
export const TableCaption = CanonicalTable.Caption;
export const TableRow = CanonicalTable.Row;
export const TableHeaderCell = CanonicalTable.HeaderCell;
export const TableCell = CanonicalTable.Cell;

export type {
  TableProps,
  TableHeadProps as TableHeaderProps,
  TableBodyProps,
  TableCaptionProps,
  TableRowProps,
  TableHeaderCellProps,
  TableCellProps,
} from '../../../packages/components-react/src/index.js';

export type TableCellStatusEmphasis = 'surface' | 'text';
