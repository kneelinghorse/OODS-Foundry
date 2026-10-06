import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  PerfProfiler,
  initProfilerMetrics,
  clearProfilerMetrics,
  measureSync,
} from '~/src/perf/instrumentation';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '~/src/components/base/Table.js';
import { Tabs } from '~/src/components/tabs/Tabs.js';
import type { TabItem } from '~/src/components/tabs/types.js';
import '~/src/styles/globals.css';

const meta: Meta = {
  title: 'Explorer/Performance/List Harness',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
    controls: { hideNoControlsWarning: true },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const InstrumentedCard: React.FC<React.PropsWithChildren<{ readonly id: string }>> = ({
  id,
  children,
}) => {
  if (typeof window !== 'undefined' && !Array.isArray(window.__PERF_PROFILER_METRICS__)) {
    initProfilerMetrics();
  }
  useEffect(() => {
    return () => {
      clearProfilerMetrics();
    };
  }, []);
  return (
    <PerfProfiler id={id}>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          maxWidth: '48rem',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          backgroundColor: 'rgba(15, 23, 42, 0.04)',
        }}
      >
        {children}
      </div>
    </PerfProfiler>
  );
};

type TableRowData = {
  id: string;
  customer: string;
  plan: string;
  status: string;
  mrr: string;
};

const createRows = (count: number): TableRowData[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `SUB-${String(1000 + index)}`,
    customer: `Customer ${index + 1}`,
    plan: index % 3 === 0 ? 'Starter' : index % 3 === 1 ? 'Growth' : 'Scale',
    status: index % 4 === 0 ? 'active' : index % 4 === 1 ? 'trialing' : index % 4 === 2 ? 'delinquent' : 'terminated',
    mrr: `$${(250 + index * 5).toLocaleString()}`,
  }));

const TableLargeDataset: React.FC = () => {
  const rows = useMemo(() => createRows(100), []);

  return (
    <InstrumentedCard id="List.Table.100Rows">
      <h2 style={{ margin: 0 }}>Large dataset render</h2>
      <TableCaption>100 subscription records render inside the PerfProfiler wrapper.</TableCaption>
      <Table density="comfortable">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Subscription</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Plan</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell numeric>MRR</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.plan}</TableCell>
              <TableCell status={row.status} statusDomain="subscription" />
              <TableCell numeric>{row.mrr}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InstrumentedCard>
  );
};

const FilteredTable: React.FC = () => {
  const rows = useMemo(() => createRows(250), []);
  const [filter, setFilter] = useState('');
  const [filteredRows, setFilteredRows] = useState<TableRowData[]>(rows.slice(0, 50));
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const handleFilterChange = (value: string) => {
    const { result, duration } = measureSync('List.Table.FilterApply', () => {
      if (!value) {
        return rows.slice(0, 50);
      }
      return rows.filter((row) => row.customer.toLowerCase().includes(value.toLowerCase())).slice(0, 50);
    });

    setFilter(value);
    setFilteredRows(result);
    setLastDuration(duration);
  };

  return (
    <InstrumentedCard id="List.Table.FilterApply">
      <label htmlFor="perf-filter-input" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Filter by customer name
      </label>
      <input
        id="perf-filter-input"
        data-testid="perf-filter-input"
        type="search"
        value={filter}
        onChange={(event) => handleFilterChange(event.currentTarget.value)}
        placeholder="Type to filter..."
        style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(15, 23, 42, 0.12)',
        }}
      />
      <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
        Last filter duration:{' '}
        <strong data-testid="perf-filter-duration">
          {lastDuration !== null ? `${lastDuration.toFixed(2)} ms` : '—'}
        </strong>
      </span>
      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Subscription</TableHeaderCell>
            <TableHeaderCell>Customer</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell status={row.status} statusDomain="subscription" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InstrumentedCard>
  );
};

const tabsItems: TabItem[] = [
  { id: 'overview', label: 'Overview', panel: <p>Aggregate entity metrics and health.</p> },
  { id: 'activity', label: 'Activity', panel: <p>Recent operational events streamed in near real-time.</p> },
  { id: 'billing', label: 'Billing', panel: <p>Key usage signals for billing triage.</p> },
  { id: 'settings', label: 'Settings', panel: <p>Configuration and automation toggles.</p> },
];

const TabsNavigation: React.FC = () => {
  const [selectedId, setSelectedId] = useState('overview');
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const handleChange = (nextId: string) => {
    const { duration } = measureSync('List.Tabs.NavigationSwitch', () => {
      setSelectedId(nextId);
      return true;
    });
    setLastDuration(duration);
  };

  return (
    <InstrumentedCard id="List.Tabs.NavigationSwitch">
      <h2 style={{ margin: 0 }}>Tabs navigation</h2>
      <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
        Last switch duration:{' '}
        <strong data-testid="perf-tab-duration">
          {lastDuration !== null ? `${lastDuration.toFixed(2)} ms` : '—'}
        </strong>
      </span>
      <Tabs
        items={tabsItems}
        selectedId={selectedId}
        onChange={(id) => handleChange(id)}
        aria-label="Performance tabs"
      />
    </InstrumentedCard>
  );
};

export const TableRender: Story = {
  name: 'Table render (100 rows)',
  render: () => <TableLargeDataset />,
};

export const TableFilter: Story = {
  name: 'Table filter apply',
  render: () => <FilteredTable />,
};

export const TabsSwitch: Story = {
  name: 'Tabs navigation',
  render: () => <TabsNavigation />,
};
