import type { JSX } from 'react';

import type { SLAMetrics } from '@/traits/communication/sla-monitor.js';

export interface DeliveryHealthMetrics {
  readonly timeToSend: SLAMetrics;
  readonly successRate: SLAMetrics;
  readonly retryExhaustionRate: number;
  readonly trend: readonly number[];
}

export interface DeliveryHealthWidgetProps {
  readonly metrics: DeliveryHealthMetrics;
  readonly timeWindow: string;
}

export function DeliveryHealthWidget({
  metrics,
  timeWindow,
}: DeliveryHealthWidgetProps): JSX.Element {
  const statusTone = resolveTone(metrics.successRate.value, metrics.retryExhaustionRate);

  const maxTrend = metrics.trend.reduce((max, value) => Math.max(max, value), 0) || 1;

  return (
    <section
      className="space-y-4 rounded-2xl border border-[--cmp-communication-policy-editor-border] bg-[--cmp-surface] p-4"
      aria-label="Delivery health"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[--sys-text-primary]">Delivery health</h3>
          <p className="text-xs text-[--sys-text-muted]">Window: {timeWindow}</p>
        </div>
        <span
          className={healthBadgeClass(statusTone)}
          aria-label={`Delivery health: ${statusTone}`}
        >
          {statusTone === 'success' ? 'Healthy' : statusTone === 'warning' ? 'Attention' : 'At risk'}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Time to send (avg)"
          value={`${Math.round(metrics.timeToSend.value / 1000)}s`}
          primaryTone={statusTone}
          min={0}
          max={Math.max(metrics.timeToSend.p95, metrics.timeToSend.value) || 1}
          current={metrics.timeToSend.value}
          ariaLabel="Average time to send messages"
        />
        <MetricCard
          label="Success rate"
          value={`${metrics.successRate.value.toFixed(1)}%`}
          primaryTone={statusTone}
          min={0}
          max={100}
          current={metrics.successRate.value}
          ariaLabel="Delivery success rate"
        />
        <MetricCard
          label="Retry exhaustion"
          value={`${metrics.retryExhaustionRate.toFixed(1)}%`}
          primaryTone={statusTone}
          min={0}
          max={100}
          current={metrics.retryExhaustionRate}
          ariaLabel="Retry exhaustion rate"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[--sys-text-primary]">Volume trend</p>
        <div className="flex h-12 items-end gap-1" aria-hidden="true">
          {metrics.trend.map((value, index) => {
            const heightRatio = Math.max(0.05, value / maxTrend);
            return (
              <div
                key={index}
                className="flex-1 rounded-sm bg-[--cmp-status-success-icon]"
                style={{ height: `${heightRatio * 100}%` }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly primaryTone: HealthTone;
  readonly min: number;
  readonly max: number;
  readonly current: number;
  readonly ariaLabel: string;
}

type HealthTone = 'success' | 'warning' | 'critical';

function MetricCard({
  label,
  value,
  primaryTone,
  min,
  max,
  current,
  ariaLabel,
}: MetricCardProps): JSX.Element {
  const percentage = max > min ? Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100)) : 0;

  return (
    <div className="space-y-1 rounded-md border border-[--cmp-border-subtle] bg-[--cmp-surface] p-3">
      <p className="text-xs font-medium text-[--sys-text-muted]">{label}</p>
      <p className="text-sm font-semibold text-[--sys-text-primary]">{value}</p>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        className="mt-1 h-2 w-full rounded-full bg-[--cmp-border-subtle]"
      >
        <div
          className={progressBarClass(primaryTone)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function resolveTone(successRate: number, retryExhaustionRate: number): HealthTone {
  if (successRate >= 98 && retryExhaustionRate < 1) {
    return 'success';
  }
  if (successRate >= 94 && retryExhaustionRate < 5) {
    return 'warning';
  }
  return 'critical';
}

function healthBadgeClass(tone: HealthTone): string {
  const base =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
  if (tone === 'success') {
    return `${base} bg-[--cmp-status-success-surface] text-[--cmp-status-success-text]`;
  }
  if (tone === 'warning') {
    return `${base} bg-[--cmp-status-warning-surface] text-[--cmp-status-warning-text]`;
  }
  return `${base} bg-[--cmp-status-critical-surface] text-[--cmp-status-critical-text]`;
}

function progressBarClass(tone: HealthTone): string {
  const base = 'h-full rounded-full';
  if (tone === 'success') {
    return `${base} bg-[--cmp-status-success-icon]`;
  }
  if (tone === 'warning') {
    return `${base} bg-[--cmp-status-warning-icon]`;
  }
  return `${base} bg-[--cmp-status-critical-icon]`;
}
