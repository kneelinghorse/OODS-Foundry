import { formatBillingAmount } from './billing.js';

export interface BillingCycleValues {
  progress?: number;
  periodStart?: string;
  periodEnd?: string;
  interval?: string;
  now?: string;
}

/**
 * Use an injected clock in deterministic consumers and SSR. Dates are UTC instants.
 *
 * s211-m02: progress and days remaining come from one clock: the injected `now`, else the instant a stored progress
 * stands for within the period, else the current time. A stored 23% beside days counted from today read "23% complete ·
 * 9 days remaining" for a 30-day period.
 */
export function billingCycle(values: BillingCycleValues) {
  const start = Date.parse(values.periodStart ?? '');
  const end = Date.parse(values.periodEnd ?? '');
  const period = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const stored = values.progress !== undefined && Number.isFinite(values.progress) ? Math.min(1, Math.max(0, values.progress)) : undefined;
  const now = values.now !== undefined ? Date.parse(values.now) : period && stored !== undefined ? start + stored * (end - start) : Date.now();
  const ended = Number.isFinite(end) && Number.isFinite(now) && now >= end;
  const fraction = ended ? 1 : period && Number.isFinite(now) ? (now - start) / (end - start) : stored;
  const percent = fraction === undefined || !Number.isFinite(fraction) ? undefined : Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const remainingDays = Number.isFinite(end) && Number.isFinite(now) ? Math.max(0, Math.ceil((end - now) / 86_400_000)) : undefined;
  const announcement = `${percent === undefined ? 'Progress unavailable' : `${percent}% complete`} · ${remainingDays === undefined ? 'Remaining days unavailable' : `${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} remaining`}`;
  return { percent, remainingDays, announcement, ended };
}

const PERIOD_MONTHS: Readonly<Record<string, number>> = { monthly: 1, quarterly: 3, yearly: 12, annual: 12 };

/**
 * The end of a billing period that starts at `start` and lasts one `interval` (UTC). A month keeps the start's day, or
 * the month's last day when it is shorter. An interval with no fixed length has no computable end: undefined.
 */
export function billingPeriodEnd(start: string, interval: string | undefined): string | undefined {
  const date = new Date(start);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (interval === 'weekly') return new Date(date.getTime() + 7 * 86_400_000).toISOString();
  const months = interval ? PERIOD_MONTHS[interval] : undefined;
  if (!months) return undefined;
  const end = new Date(date);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCDate(Math.min(date.getUTCDate(), new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()));
  return end.toISOString();
}

/**
 * s220-m01 (#2461): Billable's billing-anchor reset (traits/financial/Billable.trait.yaml). When the terms an active
 * record is billed at change (price, currency or interval), a new billing period starts at the change. Billable charges
 * at a period's start (prepaid), so the new period's payment is due at once, and nothing has collected it: pending.
 * Progress is left to the clock the period is measured by. Recorded payments are history and keep their own amounts.
 * Before it, an edit to "€19.99 · yearly" kept the monthly period (77% complete, 7 days remaining, next payment in a month).
 */
export function restartedBillingPeriod(at: string, interval: string | undefined) {
  return {
    current_period_start: at,
    current_period_end: billingPeriodEnd(at, interval),
    current_period_progress: undefined,
    next_payment_due_at: at,
    payment_status: 'pending' as const,
  };
}

export interface BillingPaymentValues {
  lastPayment?: string;
  nextPayment?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  minorUnits?: number;
}

export const NO_NEXT_PAYMENT = 'No payment scheduled';
export const NO_LAST_PAYMENT = 'No previous payment';

export function billingDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

/** Both public payment IDs share this chronological value model. Undated terms follow dated events. */
export function billingPaymentRows(values: BillingPaymentValues) {
  const rows = [
    { kind: 'last', label: 'Last payment', at: values.lastPayment, empty: NO_LAST_PAYMENT },
    { kind: 'next', label: 'Next payment', at: values.nextPayment, empty: NO_NEXT_PAYMENT },
  ];
  return rows.map((row) => ({ ...row, at: row.at && Number.isFinite(Date.parse(row.at)) ? row.at : undefined }))
    .sort((a, b) => (a.at ? Date.parse(a.at) : Infinity) - (b.at ? Date.parse(b.at) : Infinity))
    .map((row) => ({ ...row, text: row.at ? billingDate(row.at) : row.empty }));
}

export function billingPaymentSummary(values: BillingPaymentValues): string {
  return `${formatBillingAmount(values.amount, values.currency, values.minorUnits)} ${(values.currency ?? 'usd').toUpperCase()} · ${(values.paymentStatus ?? 'pending').replaceAll('_', ' ')}`;
}

