import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '../../src/components/base/Table.js';

describe('OODS.Table', () => {
  it('renders selectable rows with focus affordance metadata', () => {
    const markup = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Subscription</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selectable selected tabIndex={0}>
            <TableCell>SUB-1001</TableCell>
            <TableCell status="active" statusDomain="subscription" />
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(markup).toContain('data-selectable="true"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('tabindex="0"');
  });

  it('maps status cells to tone tokens and fallback labels', () => {
    const markup = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell status="delinquent" statusDomain="subscription" />
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(markup).toContain('data-has-status="true"');
    expect(markup).toContain('--table-cell-status-background');
    expect(markup).toContain('Delinquent');
  });
});
