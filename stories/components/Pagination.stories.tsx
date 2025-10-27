/**
 * Pagination component stories
 *
 * Demonstrates truncation patterns, mobile collapse behaviour, and data table integration.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from '../../src/components/pagination/Pagination.js';
import type { PaginationProps } from '../../src/components/pagination/types.js';

type PaginationStoryArgs = Omit<PaginationProps, 'page' | 'onChange'> & {
  initialPage: number;
};

type Story = StoryObj<PaginationStoryArgs>;

const meta: Meta<PaginationStoryArgs> = {
  title: 'Components/Navigation/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
  },
  args: {
    boundaryCount: 1,
    siblingCount: 1,
    showFirstLast: false,
    'aria-label': 'Pagination navigation',
  },
  argTypes: {
    onChange: { control: false },
  },
};

export default meta;

function useStoryPagination(initialPage: number) {
  const [page, setPage] = React.useState(initialPage);
  React.useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);
  return { page, setPage };
}

const MUTED_TEXT_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--cmp-text-muted, var(--sys-text-muted))',
};

export const SmallDataset: Story = {
  name: 'Small Dataset',
  args: {
    initialPage: 1,
    count: 5,
  },
  render: ({ initialPage, ...rest }) => {
    const { page, setPage } = useStoryPagination(initialPage);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-compact, 0.5rem)',
        }}
      >
        <Pagination {...rest} page={page} onChange={setPage} />
        <span style={MUTED_TEXT_STYLE}>
          Page {page} of {rest.count}
        </span>
      </div>
    );
  },
};

export const LargeDataset: Story = {
  name: 'Large Dataset',
  args: {
    initialPage: 7,
    count: 96,
    showFirstLast: true,
  },
  render: ({ initialPage, ...rest }) => {
    const { page, setPage } = useStoryPagination(initialPage);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-compact, 0.5rem)',
        }}
      >
        <Pagination {...rest} page={page} onChange={setPage} />
        <span style={MUTED_TEXT_STYLE}>
          Jump across {rest.count} pages with truncation and first/last controls.
        </span>
      </div>
    );
  },
};

export const DoubleEllipsis: Story = {
  name: 'Double Ellipsis',
  args: {
    initialPage: 26,
    count: 60,
    siblingCount: 1,
    boundaryCount: 1,
  },
  render: ({ initialPage, ...rest }) => {
    const { page, setPage } = useStoryPagination(initialPage);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-compact, 0.5rem)',
        }}
      >
        <Pagination {...rest} page={page} onChange={setPage} />
        <span style={MUTED_TEXT_STYLE}>
          Current page {page} demonstrates ellipsis on both sides.
        </span>
      </div>
    );
  },
};

export const MobileCollapsed: Story = {
  name: 'Mobile Collapse',
  args: {
    initialPage: 3,
    count: 40,
    siblingCount: 1,
    boundaryCount: 1,
  },
  parameters: {
    layout: 'centered',
  },
  render: ({ initialPage, ...rest }) => {
    const { page, setPage } = useStoryPagination(initialPage);

    return (
      <div
        style={{
          width: 'min(320px, 100%)',
          padding: 'var(--cmp-spacing-inset-default, 1rem)',
          border: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
          borderRadius: 'var(--cmp-spacing-inline-xs, 0.5rem)',
          background: 'var(--cmp-surface-panel, var(--sys-surface-raised))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-compact, 0.5rem)',
        }}
      >
        <span style={MUTED_TEXT_STYLE}>320px viewport preview</span>
        <Pagination {...rest} page={page} onChange={setPage} />
        <span style={MUTED_TEXT_STYLE}>
          Page {page} of {rest.count}
        </span>
      </div>
    );
  },
};

const SAMPLE_ROWS = Array.from({ length: 95 }, (_, index) => ({
  id: index + 1,
  company: `Company ${(index + 1).toString().padStart(3, '0')}`,
  owner: ['Alex Rivera', 'Morgan Lee', 'Priya Patel'][index % 3],
  status: ['Active', 'Pending', 'Archived'][index % 3],
}));

const PAGE_SIZE = 10;

export const WithDataTableIntegration: Story = {
  name: 'With Data Table',
  args: {
    initialPage: 1,
    count: Math.ceil(SAMPLE_ROWS.length / PAGE_SIZE),
    showFirstLast: true,
  },
  render: ({ initialPage, ...rest }) => {
    const totalItems = SAMPLE_ROWS.length;
    const totalPages = rest.count;
    const { page, setPage } = useStoryPagination(Math.min(initialPage, totalPages));
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const pageRows = SAMPLE_ROWS.slice(startIndex, endIndex);

    return (
      <div
        style={{
          width: 'min(720px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cmp-spacing-stack-default, 1rem)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--cmp-text-muted, var(--sys-text-muted))',
            fontSize: '0.875rem',
          }}
        >
          <span>{totalItems} total accounts</span>
          <span>
            Showing <strong>{startIndex + 1}</strong> to <strong>{endIndex}</strong>
          </span>
        </header>

        <div
          style={{
            border: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
            borderRadius: 'var(--cmp-spacing-inline-xs, 0.5rem)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead
              style={{
                background: 'var(--cmp-surface-subtle, var(--sys-surface-subtle))',
                color: 'var(--cmp-text-muted, var(--sys-text-muted))',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <tr>
                <th style={tableHeaderCellStyle}>Account</th>
                <th style={tableHeaderCellStyle}>Owner</th>
                <th style={tableHeaderCellStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => (
                <tr key={row.id}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 600 }}>{row.company}</div>
                    <span style={MUTED_TEXT_STYLE}>ID {row.id.toString().padStart(4, '0')}</span>
                  </td>
                  <td style={tableCellStyle}>{row.owner}</td>
                  <td style={tableCellStyle}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--cmp-spacing-inline-sm, 0.75rem)',
          }}
        >
          <span style={MUTED_TEXT_STYLE}>
            Page {page} of {totalPages}
          </span>
          <Pagination {...rest} page={page} onChange={setPage} />
        </div>
      </div>
    );
  },
};

const tableCellStyle: React.CSSProperties = {
  padding: 'var(--cmp-spacing-inset-compact, 0.75rem)',
  borderBottom: '1px solid var(--cmp-border-default, var(--sys-border-subtle))',
};

const tableHeaderCellStyle: React.CSSProperties = {
  ...tableCellStyle,
  fontWeight: 600,
  fontSize: '0.75rem',
  color: 'var(--cmp-text-muted, var(--sys-text-muted))',
};
