import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  PerfProfiler,
  initProfilerMetrics,
  clearProfilerMetrics,
  measureSync,
} from '~/src/perf/instrumentation';
import { Button } from '~/src/components/base/Button';
import '~/src/styles/globals.css';

const meta: Meta = {
  title: 'Explorer/Performance/Usage Aggregation Harness',
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: true },
    controls: { hideNoControlsWarning: true },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

const Panel: React.FC<React.PropsWithChildren<{ readonly id: string }>> = ({ id, children }) => {
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
      <section
        style={{
          display: 'grid',
          gap: '1rem',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.05)',
        }}
      >
        {children}
      </section>
    </PerfProfiler>
  );
};

const UsageAggregationDemo: React.FC = () => {
  const events = useMemo(
    () =>
      Array.from({ length: 1000 }, (_, index) => ({
        timestamp: Date.now() - index * 60_000,
        value: Math.random() * 100,
        unit: 'api_calls',
      })),
    [],
  );

  const dailyAggregates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        day: index,
        total: Math.random() * 8000,
        count: Math.floor(Math.random() * 1200),
      })),
    [],
  );

  const [dailyDuration, setDailyDuration] = useState<number | null>(null);
  const [weeklyDuration, setWeeklyDuration] = useState<number | null>(null);
  const [billingDuration, setBillingDuration] = useState<number | null>(null);
  const [aggregatedDaily, setAggregatedDaily] = useState<{ total: number; count: number } | null>(null);
  const [weeklyRollup, setWeeklyRollup] = useState<{ total: number; count: number } | null>(null);
  const [billingTotal, setBillingTotal] = useState<number | null>(null);

  const handleDailyAggregation = () => {
    const { result, duration } = measureSync('UsageAggregation.Daily', () => {
      return events.reduce(
        (acc, event) => {
          acc.total += event.value;
          acc.count += 1;
          return acc;
        },
        { total: 0, count: 0 },
      );
    });

    setAggregatedDaily(result);
    setDailyDuration(duration);
  };

  const handleWeeklyRollup = () => {
    const { result, duration } = measureSync('UsageAggregation.WeeklyRollup', () => {
      return dailyAggregates.reduce(
        (acc, day) => {
          acc.total += day.total;
          acc.count += day.count;
          return acc;
        },
        { total: 0, count: 0 },
      );
    });

    setWeeklyRollup(result);
    setWeeklyDuration(duration);
  };

  const handleBillingCalculation = () => {
    const rates = {
      apiCalls: 0.001,
      storage: 0.1,
      bandwidth: 0.05,
    } as const;

    const usage = {
      apiCalls: 50_000,
      storage: 1024,
      bandwidth: 512,
    };

    const { result, duration } = measureSync('UsageAggregation.BillingCalculation', () => {
      return (
        usage.apiCalls * rates.apiCalls +
        usage.storage * rates.storage +
        usage.bandwidth * rates.bandwidth
      );
    });

    setBillingTotal(result);
    setBillingDuration(duration);
  };

  return (
    <Panel id="UsageAggregation.Root">
      <header>
        <h2 style={{ margin: 0 }}>Usage aggregation scenarios</h2>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#1f2937' }}>
          Each action measures aggregation/transform performance using the User Timing API helpers.
        </p>
      </header>

      <article>
        <h3 style={{ marginBottom: '0.25rem' }}>Daily aggregation</h3>
        <Button data-testid="perf-usage-daily" onClick={handleDailyAggregation}>
          Aggregate 1000 events
        </Button>
        <p style={{ fontSize: '0.75rem', color: '#4b5563' }}>
          Duration:{' '}
          <strong data-testid="perf-usage-daily-duration">
            {dailyDuration !== null ? `${dailyDuration.toFixed(2)} ms` : '—'}
          </strong>
          {aggregatedDaily && (
            <>
              {' '}
              • Total:{' '}
              <strong data-testid="perf-usage-daily-total">
                {aggregatedDaily.total.toFixed(2)}
              </strong>{' '}
              • Samples:{' '}
              <strong data-testid="perf-usage-daily-count">{aggregatedDaily.count}</strong>
            </>
          )}
        </p>
      </article>

      <article>
        <h3 style={{ marginBottom: '0.25rem' }}>Weekly rollup</h3>
        <Button data-testid="perf-usage-weekly" onClick={handleWeeklyRollup}>
          Roll up 7 daily aggregates
        </Button>
        <p style={{ fontSize: '0.75rem', color: '#4b5563' }}>
          Duration:{' '}
          <strong data-testid="perf-usage-weekly-duration">
            {weeklyDuration !== null ? `${weeklyDuration.toFixed(2)} ms` : '—'}
          </strong>
          {weeklyRollup && (
            <>
              {' '}
              • Total:{' '}
              <strong data-testid="perf-usage-weekly-total">
                {weeklyRollup.total.toFixed(2)}
              </strong>{' '}
              • Samples:{' '}
              <strong data-testid="perf-usage-weekly-count">{weeklyRollup.count}</strong>
            </>
          )}
        </p>
      </article>

      <article>
        <h3 style={{ marginBottom: '0.25rem' }}>Billing calculation</h3>
        <Button data-testid="perf-usage-billing" onClick={handleBillingCalculation}>
          Calculate billing total
        </Button>
        <p style={{ fontSize: '0.75rem', color: '#4b5563' }}>
          Duration:{' '}
          <strong data-testid="perf-usage-billing-duration">
            {billingDuration !== null ? `${billingDuration.toFixed(2)} ms` : '—'}
          </strong>
          {billingTotal !== null && (
            <>
              {' '}
              • Total:{' '}
              <strong data-testid="perf-usage-billing-total">
                ${billingTotal.toFixed(2)}
              </strong>
            </>
          )}
        </p>
      </article>
    </Panel>
  );
};

export const UsageAggregation: Story = {
  name: 'Usage aggregation scenarios',
  render: () => <UsageAggregationDemo />,
};
