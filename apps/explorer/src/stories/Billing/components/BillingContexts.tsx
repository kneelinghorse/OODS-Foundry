import React from 'react';
import '../../../styles/index.css';
import stripeFixture from '~/domains/saas-billing/examples/stripe.json';
import chargebeeFixture from '~/domains/saas-billing/examples/chargebee.json';
import { StatusChip } from '../../../components/StatusChip';
import { FieldGroup } from '../../../components/FieldGroup';
import { Input } from '../../../components/Input';
import { TextArea } from '../../../components/TextArea';
import { HelpText } from '../../../components/HelpText';
import { ValidationBanner } from '../../../components/ValidationBanner';

const fixtures = [stripeFixture, chargebeeFixture] as const;

type UsageSample = {
  timestamp: string;
  value: number;
};

type SubscriptionFixture = {
  subscription_id: string;
  provider: string;
  provider_subscription_id?: string;
  account_name: string;
  account_key?: string;
  account_owner?: string;
  account_owner_email?: string;
  status: string;
  status_note?: string;
  current_period_start: string;
  current_period_end: string;
  trial_end_at?: string | null;
  cancellation_effective_at?: string | null;
  renewal_rate_minor?: number;
  amount_minor: number;
  currency: string;
  plan_code: string;
  plan_name: string;
  billing_interval: string;
  interval_count?: number;
  collection_method?: string;
  billing_anchor_day?: number;
  pricing_model?: string;
  health_score?: number;
  risk_segment?: string;
  notes?: string;
  meter_name?: string;
  included_quantity?: number;
  consumed_quantity?: number;
  unit_label?: string;
  period_start?: string;
  period_end?: string;
  rollover_strategy?: string;
  overage_rate_minor?: number;
  projected_overage_minor?: number;
  samples?: UsageSample[];
  refundable_until?: string | null;
  refund_policy_url?: string | null;
  total_refunded_minor?: number;
  credit_memo_balance_minor?: number;
  credit_memo_type?: string | null;
} & Record<string, unknown>;

type InvoiceLineItem = {
  description: string;
  quantity: number;
  amount_minor: number;
  unit_amount_minor?: number;
};

type InvoiceFixture = {
  invoice_id: string;
  subscription_id: string;
  provider: string;
  provider_invoice_id?: string;
  invoice_number: string;
  status: string;
  provider_status?: string;
  issued_at: string;
  due_at?: string | null;
  paid_at?: string | null;
  total_minor: number;
  balance_minor?: number;
  currency: string;
  payment_terms?: string;
  collection_state?: string;
  last_reminder_at?: string | null;
  aging_bucket_days?: number;
  memo?: string;
  billing_contact_name?: string;
  billing_contact_email?: string;
  tax_minor?: number;
  discount_minor?: number;
  subtotal_minor?: number;
  line_items?: InvoiceLineItem[];
  attachments?: Array<Record<string, unknown>>;
  portal_url?: string;
  dunning_step?: string;
  payment_source?: string;
} & Record<string, unknown>;

type PlanFixture = {
  plan_id: string;
  product_family: string;
  status: string;
  plan_code: string;
  plan_name: string;
  billing_interval: string;
  interval_count?: number;
  amount_minor: number;
  currency: string;
  trial_period_days?: number | null;
  collection_method?: string;
  billing_anchor_day?: number;
  pricing_model?: string;
  feature_matrix?: Array<Record<string, unknown>>;
  add_on_ids?: string[];
  upgrade_targets?: string[];
  downgrade_targets?: string[];
  notes?: string;
  meter_name?: string;
  included_quantity?: number;
  consumed_quantity?: number;
  unit_label?: string;
  period_start?: string;
  period_end?: string;
  rollover_strategy?: string;
  overage_rate_minor?: number;
  projected_overage_minor?: number;
  samples?: UsageSample[];
} & Record<string, unknown>;

type UsageFixture = {
  usage_id: string;
  subscription_id: string;
  provider: string;
  meter_id: string;
  status: string;
  trend_percent?: number;
  variance_minor?: number;
  last_reported_at: string;
  meter_name?: string;
  included_quantity?: number;
  consumed_quantity?: number;
  unit_label?: string;
  period_start?: string;
  period_end?: string;
  rollover_strategy?: string;
  overage_rate_minor?: number;
  projected_overage_minor?: number;
  samples?: UsageSample[];
} & Record<string, unknown>;

type ProviderFixture = {
  provider: string;
  subscription: SubscriptionFixture;
  invoice: InvoiceFixture;
  plan: PlanFixture;
  usage: UsageFixture;
};

const PROVIDERS: ProviderFixture[] = fixtures as unknown as ProviderFixture[];

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const formatCurrency = (amountMinor: number, currency: string): string => {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  const formatter = currencyFormatters.get(currency)!;
  return formatter.format(amountMinor / 100);
};

const formatDate = (iso: string | null | undefined, withTime = false): string => {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  if (withTime) {
    return `${date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })} • ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const titleCase = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  return value
    .split(/[\s_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const buildRenewalCopy = (fixture: ProviderFixture): string => {
  const renewalSource = fixture.invoice.due_at || fixture.subscription.current_period_end;
  return `Due ${formatDate(renewalSource)}`;
};

const formatInterval = (subscription: SubscriptionFixture): string => {
  const interval = titleCase(subscription.billing_interval);
  const count = subscription.interval_count && subscription.interval_count > 1 ? ` × ${subscription.interval_count}` : '';
  return interval ? `${interval}${count}` : 'Custom cadence';
};

const estimateProrationCredit = (subscription: SubscriptionFixture, partialDays: number): number => {
  const cadence = subscription.billing_interval?.toLowerCase();
  const perPeriodMinor = subscription.renewal_rate_minor ?? subscription.amount_minor;
  const intervalCount = subscription.interval_count ?? 1;

  const daysPerInterval = (interval: string | undefined): number => {
    switch (interval) {
      case 'day':
        return 1;
      case 'week':
        return 7;
      case 'quarter':
        return 90;
      case 'year':
        return 365;
      default:
        return 30;
    }
  };

  const periodDays = Math.max(daysPerInterval(cadence) * intervalCount, 1);
  const dailyRateMinor = perPeriodMinor / periodDays;
  return Math.round(dailyRateMinor * partialDays);
};

const computeVariancePercent = (baseline: number, proposed: number): number => {
  if (baseline <= 0) return 0;
  return Math.round(((proposed - baseline) / baseline) * 100);
};

const buildSubscriptionListRows = () =>
  PROVIDERS.map((fixture) => {
    const { subscription } = fixture;
    const renewalValue = subscription.renewal_rate_minor ?? subscription.amount_minor;

    return {
      id: `${fixture.provider}-${subscription.subscription_id}`,
      account: subscription.account_name,
      plan: `${subscription.plan_name} • ${formatInterval(subscription)}`,
      amount: formatCurrency(renewalValue, subscription.currency),
      amountMinor: renewalValue,
      currency: subscription.currency,
      renewal: buildRenewalCopy(fixture),
      owner: subscription.account_owner ?? 'Unassigned',
      status: subscription.status,
      provider: titleCase(fixture.provider)
    };
  });

const buildInvoiceListRows = () =>
  PROVIDERS.map((fixture) => {
    const { invoice } = fixture;
    return {
      id: `${fixture.provider}-${invoice.invoice_id}`,
      number: invoice.invoice_number,
      total: formatCurrency(invoice.total_minor, invoice.currency),
      due: buildRenewalCopy(fixture),
      status: invoice.status,
      providerStatus: invoice.provider_status ?? invoice.status,
      paymentSource: invoice.payment_source ?? 'unspecified',
      provider: titleCase(fixture.provider)
    };
  });

const buildSubscriptionEvents = () =>
  PROVIDERS.flatMap((fixture) => {
    const { subscription, invoice } = fixture;

    const periodStart = {
      id: `${fixture.provider}-period-start`,
      time: subscription.current_period_start,
      title: `${titleCase(fixture.provider)} period started`,
      description: `Billing cycle anchored on day ${subscription.billing_anchor_day ?? 1}.`,
      status: 'active',
      domain: 'subscription' as const
    };

    const invoiceIssued = {
      id: `${fixture.provider}-invoice-issued`,
      time: invoice.issued_at,
      title: `${invoice.invoice_number} issued`,
      description: invoice.memo ?? 'Invoice generated from provider feed.',
      status: invoice.status,
      domain: 'invoice' as const
    };

    const renewalDue = {
      id: `${fixture.provider}-renewal`,
      time: invoice.due_at ?? subscription.current_period_end,
      title: `${titleCase(fixture.provider)} renewal checkpoint`,
      description: subscription.status_note ?? 'Monitoring renewal health.',
      status: subscription.status,
      domain: 'subscription' as const
    };

    return [periodStart, invoiceIssued, renewalDue];
  }).sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

const buildInvoiceEvents = () =>
  PROVIDERS.flatMap((fixture) => {
    const { invoice } = fixture;

    const issued = {
      id: `${fixture.provider}-invoice-created`,
      time: invoice.issued_at,
      title: `${invoice.invoice_number} finalized`,
      description: `Payment terms ${invoice.payment_terms ?? 'unspecified'} established.`,
      status: invoice.status,
      domain: 'invoice' as const
    };

    const due = {
      id: `${fixture.provider}-invoice-due`,
      time: invoice.due_at ?? invoice.issued_at,
      title: `${invoice.invoice_number} due date`,
      description: `Collector state ${invoice.collection_state ?? 'unknown'}.`,
      status: invoice.status === 'paid' ? 'paid' : invoice.status,
      domain: 'invoice' as const
    };

    const reminder = invoice.last_reminder_at
      ? {
          id: `${fixture.provider}-invoice-reminder`,
          time: invoice.last_reminder_at,
          title: `${invoice.invoice_number} reminder`,
          description: 'Automated reminder sent to billing contact.',
          status: invoice.status,
          domain: 'invoice' as const
        }
      : null;

    return [issued, reminder, due].filter(Boolean) as Array<{
      id: string;
      time: string;
      title: string;
      description: string;
      status: string;
      domain: 'invoice';
    }>;
  }).sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

const renderListCard = (row: ReturnType<typeof buildSubscriptionListRows>[number]) => (
  <article key={row.id} className="list-card" data-item="true">
    <div className="list-card__heading">
      <div className="list-card__identity">
        <span className="list-card__name">{row.account}</span>
        <span className="list-card__plan">{row.plan}</span>
      </div>
      <StatusChip status={row.status} domain="subscription" context="list" />
    </div>

    <dl className="list-card__meta">
      <div>
        <dt>ARR</dt>
        <dd>{row.amount}</dd>
      </div>
      <div>
        <dt>Renewal</dt>
        <dd>{row.renewal}</dd>
      </div>
      <div>
        <dt>Owner</dt>
        <dd>{row.owner}</dd>
      </div>
    </dl>

    <footer className="list-card__footer">
      <span className="list-card__provider">{row.provider}</span>
    </footer>
  </article>
);

const renderInvoiceCard = (row: ReturnType<typeof buildInvoiceListRows>[number]) => (
  <article key={row.id} className="list-card" data-item="true">
    <div className="list-card__heading">
      <div className="list-card__identity">
        <span className="list-card__name">{row.number}</span>
        <span className="list-card__plan">{row.provider}</span>
      </div>
      <StatusChip status={row.status} domain="invoice" context="list" />
    </div>

    <dl className="list-card__meta">
      <div>
        <dt>Total</dt>
        <dd>{row.total}</dd>
      </div>
      <div>
        <dt>Due</dt>
        <dd>{row.due}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{titleCase(row.paymentSource)}</dd>
      </div>
    </dl>

    <footer className="list-card__footer">
      <span className="list-card__provider">Provider badge: {row.providerStatus}</span>
    </footer>
  </article>
);

export const SubscriptionListExample: React.FC = () => {
  const rows = buildSubscriptionListRows();
  const arrCurrency = rows[0]?.currency ?? 'usd';
  return (
    <div className="explorer-view context-list list-view" data-context="list">
      <header className="view-header" data-region="header">
        <div className="view-header__text">
          <p className="view-eyebrow">Subscriptions</p>
          <h1 className="view-title">Provider normalized renewal board</h1>
          <p className="view-caption">
            Both providers share the same markup—status chips resolve via the shared mapping file with no provider
            conditionals.
          </p>
        </div>

        <dl className="view-metrics" data-region="meta">
          <div>
            <dt>Active providers</dt>
            <dd>{PROVIDERS.length}</dd>
          </div>
          <div>
            <dt>Total ARR</dt>
            <dd>
              {formatCurrency(
                rows.reduce((acc, row) => acc + row.amountMinor, 0),
                arrCurrency
              )}
            </dd>
          </div>
          <div>
            <dt>At risk</dt>
            <dd>{rows.filter((row) => row.status !== 'active').length}</dd>
          </div>
        </dl>
      </header>

      <section className="list-board detail:body:gap-4 list:body:gap-2" data-region="body" aria-label="Subscription list">
        {rows.map(renderListCard)}
      </section>
    </div>
  );
};

export const InvoiceListExample: React.FC = () => {
  const rows = buildInvoiceListRows();
  return (
    <div className="explorer-view context-list list-view" data-context="list">
      <header className="view-header" data-region="header">
        <div className="view-header__text">
          <p className="view-eyebrow">Invoices</p>
          <h1 className="view-title">Cross-provider collections dashboard</h1>
          <p className="view-caption">
            Canonical invoice statuses drive token selections. Provider specific badges remain informative without
            changing surface styling.
          </p>
        </div>
        <dl className="view-metrics" data-region="meta">
          <div>
            <dt>Open balance</dt>
            <dd>
              {formatCurrency(
                PROVIDERS.reduce((sum, fixture) => sum + (fixture.invoice.balance_minor ?? fixture.invoice.total_minor), 0),
                'usd'
              )}
            </dd>
          </div>
          <div>
            <dt>Posted invoices</dt>
            <dd>{rows.length}</dd>
          </div>
          <div>
            <dt>Overdue</dt>
            <dd>{rows.filter((row) => row.status === 'past_due').length}</dd>
          </div>
        </dl>
      </header>

      <section className="list-board detail:body:gap-4 list:body:gap-2" data-region="body" aria-label="Invoice list">
        {rows.map(renderInvoiceCard)}
      </section>
    </div>
  );
};

const SubscriptionDetailCard: React.FC<{ fixture: ProviderFixture }> = ({ fixture }) => {
  const { subscription, invoice, usage } = fixture;
  return (
    <article className="detail-panel">
      <header>
        <h2>{subscription.account_name}</h2>
        <p>
          {titleCase(fixture.provider)} • {subscription.plan_name} ({formatInterval(subscription)})
        </p>
      </header>

      <dl className="detail-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusChip status={subscription.status} domain="subscription" context="detail" />
          </dd>
        </div>
        <div>
          <dt>Invoice</dt>
          <dd>
            <StatusChip status={invoice.status} domain="invoice" context="detail" />
          </dd>
        </div>
        <div>
          <dt>ARR</dt>
          <dd>{formatCurrency(subscription.renewal_rate_minor ?? subscription.amount_minor, subscription.currency)}</dd>
        </div>
        <div>
          <dt>Collection</dt>
          <dd>{titleCase(subscription.collection_method)}</dd>
        </div>
        <div>
          <dt>Health score</dt>
          <dd>{subscription.health_score ?? '—'}</dd>
        </div>
        <div>
          <dt>Usage</dt>
          <dd>
            {usage.consumed_quantity ?? 0} / {usage.included_quantity ?? subscription.included_quantity ?? 0}{' '}
            {usage.unit_label ?? subscription.unit_label ?? ''}
          </dd>
        </div>
      </dl>

      <p className="detail-panel__note">{subscription.notes ?? 'No account notes captured.'}</p>
    </article>
  );
};

export const SubscriptionDetailExample: React.FC = () => (
  <div className="explorer-view context-detail detail-view" data-context="detail">
    <header className="detail-header" data-region="header">
      <div>
        <p className="view-eyebrow">Billing domain</p>
        <h1 className="view-title">Subscription dossier</h1>
        <p className="view-caption">
          Detail context reuses the same tokens—statuses render identically whether originating from Stripe or
          Chargebee feeds.
        </p>
      </div>

      <div className="detail-header__badges">
        <StatusChip status={PROVIDERS[0].subscription.status} domain="subscription" context="detail" />
        <StatusChip status={PROVIDERS[1].subscription.status} domain="subscription" context="detail" />
      </div>
    </header>

    <main className="detail-body detail:body:gap-6 list:body:gap-3" data-region="body">
      {PROVIDERS.map((fixture) => (
        <SubscriptionDetailCard key={`${fixture.provider}-detail`} fixture={fixture} />
      ))}
    </main>

    <aside className="detail-sidebar" data-region="sidebar" aria-label="Invoice quick view">
      <h2>Most recent invoices</h2>
      <ul>
        {PROVIDERS.map((fixture) => (
          <li key={`${fixture.provider}-invoice`} className="invoice-row">
            <div className="invoice-row__meta">
              <span className="invoice-row__id">{fixture.invoice.invoice_number}</span>
              <span className="invoice-row__total">
                {formatCurrency(fixture.invoice.total_minor, fixture.invoice.currency)}
              </span>
            </div>
            <div className="invoice-row__status">
              <StatusChip status={fixture.invoice.status} domain="invoice" context="detail" />
              <span className="invoice-row__due">{buildRenewalCopy(fixture)}</span>
            </div>
            <p className="invoice-row__note">{fixture.invoice.memo ?? 'No memo provided.'}</p>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);

const buildFormFieldId = (prefix: string, provider: string) => `${prefix}-${provider}`;

const SubscriptionFormSection: React.FC<{ fixture: ProviderFixture }> = ({ fixture }) => {
  const { subscription, invoice } = fixture;
  return (
    <section className="form-section" aria-labelledby={`section-${fixture.provider}`}>
      <header className="form-section__header">
        <h2 id={`section-${fixture.provider}`}>{titleCase(fixture.provider)} subscription</h2>
        <p>Data hydrates directly from the normalized object—no component overrides for provider drift.</p>
      </header>

      <div className="form-grid">
        <div className="form-field" data-state="valid">
          <label className="form-field__label" htmlFor={buildFormFieldId('account-name', fixture.provider)}>
            Account name
          </label>
          <input
            id={buildFormFieldId('account-name', fixture.provider)}
            className="form-field__control"
            type="text"
            defaultValue={subscription.account_name}
          />
        </div>

        <div className="form-field" data-state="valid">
          <label className="form-field__label" htmlFor={buildFormFieldId('owner', fixture.provider)}>
            Success owner
          </label>
          <input
            id={buildFormFieldId('owner', fixture.provider)}
            className="form-field__control"
            type="text"
            defaultValue={subscription.account_owner ?? ''}
          />
        </div>

        <div className="form-field" data-state="info">
          <label className="form-field__label" htmlFor={buildFormFieldId('plan', fixture.provider)}>
            Plan
          </label>
          <select id={buildFormFieldId('plan', fixture.provider)} className="form-field__control" defaultValue={subscription.plan_code}>
            <option value={subscription.plan_code}>
              {subscription.plan_name} • {formatInterval(subscription)}
            </option>
          </select>
          <p className="form-field__hint">Pulled from catalog manifest via SaaS billing traits.</p>
        </div>

        <div className="form-field" data-state="valid">
          <label className="form-field__label" htmlFor={buildFormFieldId('renewal', fixture.provider)}>
            Renewal date
          </label>
          <input
            id={buildFormFieldId('renewal', fixture.provider)}
            className="form-field__control"
            type="text"
            defaultValue={formatDate(invoice.due_at ?? subscription.current_period_end)}
            readOnly
          />
        </div>
      </div>
    </section>
  );
};

export const SubscriptionFormExample: React.FC = () => (
  <div className="billing-form-rail" style={{ display: 'grid', gap: '1.5rem' }}>
    {PROVIDERS.map((fixture) => (
      <div key={`${fixture.provider}-form`} className="explorer-view context-form form-view" data-context="form">
        <header className="form-header" data-region="header">
          <div className="form-header__text">
            <p className="view-eyebrow">Subscription workflow</p>
            <h1 className="view-title">Contract adjustments</h1>
            <p className="view-caption">
              Toolbar chips below read from the same status manifest—no provider specific overrides required.
            </p>
          </div>

          <dl className="form-header__meta" data-region="meta">
            <div>
              <dt>Plan</dt>
              <dd>{fixture.subscription.plan_name}</dd>
            </div>
            <div>
              <dt>Current ARR</dt>
              <dd>
                {formatCurrency(
                  fixture.subscription.renewal_rate_minor ?? fixture.subscription.amount_minor,
                  fixture.subscription.currency
                )}
              </dd>
            </div>
            <div>
              <dt>Terms</dt>
              <dd>{titleCase(fixture.invoice.payment_terms)}</dd>
            </div>
          </dl>
        </header>

        <div className="form-toolbar" data-region="actions">
          <div className="form-toolbar__steps" role="group" aria-label="Status overview">
            <StatusChip status={fixture.subscription.status} domain="subscription" context="form" />
            <StatusChip status={fixture.invoice.status} domain="invoice" context="form" />
          </div>
          <div className="form-toolbar__summary">
            <span className="form-toolbar__summary-step">Provider: {titleCase(fixture.provider)}</span>
            <span>{buildRenewalCopy(fixture)}</span>
          </div>
        </div>

        <main className="form-main" data-region="body">
          <form className="form-shell" noValidate>
            <SubscriptionFormSection fixture={fixture} />
          </form>
        </main>
      </div>
    ))}
  </div>
);

const toneByStatus: Record<string, 'success' | 'info' | 'warning' | 'critical'> = {
  active: 'success',
  paid: 'success',
  posted: 'info',
  open: 'info',
  processing: 'info',
  future: 'info',
  trialing: 'info',
  pending_cancellation: 'warning',
  non_renewing: 'warning',
  past_due: 'warning',
  paused: 'warning',
  incomplete: 'warning',
  refunded: 'info',
  draft: 'info',
  void: 'critical',
  uncollectible: 'critical',
  canceled: 'critical',
  incomplete_expired: 'critical'
};

const resolveToneForStatus = (status: string): 'success' | 'info' | 'warning' | 'critical' =>
  toneByStatus[status] ?? 'info';

const renderTimelineItem = (
  event: ReturnType<typeof buildSubscriptionEvents>[number] & { description: string }
) => {
  const timestamp = formatDate(event.time, true);
  return (
    <li key={event.id} className="timeline-item" data-tone={resolveToneForStatus(event.status)}>
      <div className="timeline-item__marker" aria-hidden>
        <span className="timeline-item__dot" />
      </div>

      <article className="timeline-item__card">
        <header className="timeline-item__header">
          <time className="timeline-item__time" dateTime={event.time}>
            {timestamp}
          </time>
          <StatusChip status={event.status} domain={event.domain} context="timeline" />
        </header>
        <h3 className="timeline-item__title">{event.title}</h3>
        <p className="timeline-item__description">{event.description}</p>
      </article>
    </li>
  );
};

export const SubscriptionTimelineExample: React.FC = () => {
  const events = buildSubscriptionEvents().map((event) => ({
    ...event,
    description: event.description
  }));

  return (
    <div className="explorer-view context-timeline timeline-view" data-context="timeline">
      <header className="timeline-header" data-region="header">
        <div>
          <p className="view-eyebrow">Subscription lifecycle</p>
          <h1 className="view-title">Renewal activity feed</h1>
          <p className="view-caption">Events unify provider data with the same badge component and token map.</p>
        </div>
      </header>

      <main className="timeline-main" data-region="body">
        <ol className="timeline-stream" data-region="timeline">
          {events.map((event) => renderTimelineItem(event))}
        </ol>
      </main>
    </div>
  );
};

export const InvoiceTimelineExample: React.FC = () => {
  const events = buildInvoiceEvents().map((event) => ({
    ...event,
    description: event.description
  }));

  return (
    <div className="explorer-view context-timeline timeline-view" data-context="timeline">
      <header className="timeline-header" data-region="header">
        <div>
          <p className="view-eyebrow">Invoice lifecycle</p>
          <h1 className="view-title">Collection milestones</h1>
          <p className="view-caption">
            Canonical invoice states drive tone tokens—stripe and chargebee emit the same surface without extra logic.
          </p>
        </div>
      </header>

      <main className="timeline-main" data-region="body">
        <ol className="timeline-stream" data-region="timeline">
          {events.map((event) => renderTimelineItem(event))}
        </ol>
      </main>
    </div>
  );
};

const InvoiceDetailCard: React.FC<{ fixture: ProviderFixture }> = ({ fixture }) => {
  const { invoice } = fixture;
  return (
    <article className="detail-panel">
      <header>
        <h2>{invoice.invoice_number}</h2>
        <p>
          {titleCase(fixture.provider)} • {statusSummary(invoice)}
        </p>
      </header>
      <dl className="detail-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusChip status={invoice.status} domain="invoice" context="detail" />
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatCurrency(invoice.total_minor, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{formatCurrency(invoice.balance_minor ?? invoice.total_minor, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{formatDate(invoice.due_at)}</dd>
        </div>
        <div>
          <dt>Payment source</dt>
          <dd>{titleCase(invoice.payment_source)}</dd>
        </div>
        <div>
          <dt>Collector state</dt>
          <dd>{titleCase(invoice.collection_state)}</dd>
        </div>
      </dl>
      <p className="detail-panel__note">{invoice.memo ?? 'No memo provided.'}</p>
    </article>
  );
};

const statusSummary = (invoice: InvoiceFixture): string => {
  const providerBadge = invoice.provider_status ? ` • Provider badge ${titleCase(invoice.provider_status)}` : '';
  return `${titleCase(invoice.status)}${providerBadge}`;
};

export const InvoiceDetailExample: React.FC = () => (
  <div className="explorer-view context-detail detail-view" data-context="detail">
    <header className="detail-header" data-region="header">
      <div>
        <p className="view-eyebrow">Invoice dossier</p>
        <h1 className="view-title">Collection overview</h1>
        <p className="view-caption">Aligned tokens ensure finance sees consistent signals independent of source.</p>
      </div>
    </header>

    <main className="detail-body detail:body:gap-6 list:body:gap-3" data-region="body">
      {PROVIDERS.map((fixture) => (
        <InvoiceDetailCard key={`${fixture.provider}-invoice-detail`} fixture={fixture} />
      ))}
    </main>
  </div>
);

export const InvoiceFormExample: React.FC = () => (
  <div className="billing-form-rail" style={{ display: 'grid', gap: '1.5rem' }}>
    {PROVIDERS.map((fixture) => (
      <div key={`${fixture.provider}-invoice-form`} className="explorer-view context-form form-view" data-context="form">
        <header className="form-header" data-region="header">
          <div className="form-header__text">
            <p className="view-eyebrow">Invoice adjustments</p>
            <h1 className="view-title">Prepare credit memo</h1>
            <p className="view-caption">Single form shell hydrates against normalized fields for any provider.</p>
          </div>
        </header>

        <main className="form-main" data-region="body">
          <form className="form-shell" noValidate>
            <div className="form-grid">
              <div className="form-field" data-state="valid">
                <label className="form-field__label" htmlFor={buildFormFieldId('invoice-number', fixture.provider)}>
                  Invoice number
                </label>
                <input
                  id={buildFormFieldId('invoice-number', fixture.provider)}
                  className="form-field__control"
                  type="text"
                  defaultValue={fixture.invoice.invoice_number}
                  readOnly
                />
              </div>

              <div className="form-field" data-state="info">
                <label className="form-field__label" htmlFor={buildFormFieldId('provider-status', fixture.provider)}>
                  Provider badge
                </label>
                <input
                  id={buildFormFieldId('provider-status', fixture.provider)}
                  className="form-field__control"
                  type="text"
                  defaultValue={fixture.invoice.provider_status ?? 'n/a'}
                  readOnly
                />
                <p className="form-field__hint">Display only; canonical status drives UI.</p>
              </div>

              <div className="form-field" data-state="valid">
                <label className="form-field__label" htmlFor={buildFormFieldId('balance', fixture.provider)}>
                  Outstanding balance
                </label>
                <input
                  id={buildFormFieldId('balance', fixture.provider)}
                  className="form-field__control"
                  type="text"
                  defaultValue={formatCurrency(
                    fixture.invoice.balance_minor ?? fixture.invoice.total_minor,
                    fixture.invoice.currency
                  )}
                  readOnly
                />
              </div>

              <div className="form-field" data-state="valid">
                <label className="form-field__label" htmlFor={buildFormFieldId('credit-amount', fixture.provider)}>
                  Credit amount (minor units)
                </label>
                <input
                  id={buildFormFieldId('credit-amount', fixture.provider)}
                  className="form-field__control"
                  type="number"
                  defaultValue={fixture.subscription.credit_memo_balance_minor ?? 0}
                />
              </div>
            </div>
          </form>
        </main>
      </div>
    ))}
  </div>
);

export const SubscriptionFormScenarios: React.FC = () => {
  const fixture = PROVIDERS[0];
  const providerName = titleCase(fixture.provider);
  const ownerName = fixture.subscription.account_owner ?? 'Success Owner';
  const ownerEmail = fixture.subscription.account_owner_email ?? 'success@example.com';
  const usageBaseline = fixture.subscription.consumed_quantity ?? fixture.subscription.included_quantity ?? 0;
  const proposedSeats =
    usageBaseline > 0 ? Math.max(usageBaseline + 1, Math.ceil(usageBaseline * 1.48)) : (fixture.subscription.included_quantity ?? 5) + 5;
  const variancePercent = computeVariancePercent(usageBaseline, proposedSeats);
  const prorationDays = 17;
  const prorationCreditMinor = estimateProrationCredit(fixture.subscription, prorationDays);
  const prorationCredit = formatCurrency(prorationCreditMinor, fixture.subscription.currency);
  const renewalAmount = formatCurrency(
    fixture.subscription.renewal_rate_minor ?? fixture.subscription.amount_minor,
    fixture.subscription.currency
  );
  const cancellationWindow = formatDate(
    fixture.subscription.cancellation_effective_at ?? fixture.subscription.current_period_end
  );

  return (
    <div className="explorer-view context-form form-view" data-context="form">
      <header className="form-header" data-region="header">
        <div className="form-header__text">
          <p className="view-eyebrow">Subscription workflow</p>
          <h1 className="view-title">Validation scenarios</h1>
          <p className="view-caption">
            Group-level states surface required, warning, invalid, and disabled form patterns without custom color overrides.
          </p>
        </div>
        <dl className="form-header__meta" data-region="meta">
          <div>
            <dt>Provider</dt>
            <dd>{providerName}</dd>
          </div>
          <div>
            <dt>Renewal</dt>
            <dd>{renewalAmount}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{`${fixture.subscription.plan_name} • ${formatInterval(fixture.subscription)}`}</dd>
          </div>
        </dl>
      </header>

      <main className="form-main" data-region="body">
        <form className="form-shell" noValidate>
          <ValidationBanner
            status="pending"
            title="Submitting contract adjustments"
            description="Approvers see the proration credit and seat variance before the MCP applies changes."
          />

          <div className="form-grid">
            <FieldGroup
              label="Account owner"
              required
              state="valid"
              message={`Matches CRM owner record for ${ownerName}.`}
              messageTone="success"
              description="Updates from this form sync back to the canonical billing traits."
            >
              <Input label="Success owner" defaultValue={ownerName} required />
              <Input label="Owner email" type="email" defaultValue={ownerEmail} />
            </FieldGroup>

            <FieldGroup
              label="Plan & seats"
              required
              state="invalid"
              message={`Proposed commitment is ${variancePercent}% above observed usage.`}
            >
              <Input
                label="Plan"
                defaultValue={`${fixture.subscription.plan_name} • ${formatInterval(fixture.subscription)}`}
                readOnly
              />
              <Input
                label="Seat commitment"
                type="number"
                tone="critical"
                defaultValue={String(proposedSeats)}
                supportingText={`Observed usage: ${usageBaseline} seats`}
                message="Add approval notes when exceeding usage by more than 30%."
                aria-invalid
                required
              />
            </FieldGroup>

            <FieldGroup
              label="Proration preview"
              state="info"
              description={`${prorationDays}-day credit computed from renewal cadence.`}
            >
              <Input
                label="Credit to apply"
                defaultValue={prorationCredit}
                supportingText={`${prorationDays} of the current ${formatInterval(fixture.subscription).toLowerCase()} cycle`}
                tone="info"
                readOnly
                selected
              />
              <HelpText>Preview remains tokens-only—no inline color adjustments.</HelpText>
            </FieldGroup>

            <FieldGroup
              label="Approval notes"
              required
              state="warning"
              message="Provide context for finance before routing the request."
            >
              <TextArea
                label="Notes for finance"
                tone="warning"
                placeholder="Document backfill hires, discounts, or seasonal ramps."
                rows={4}
              />
            </FieldGroup>

            <FieldGroup
              label="Cancellation window"
              state="disabled"
              description="Locked while submission is pending reviewer decision."
            >
              <Input label="Effective through" defaultValue={cancellationWindow} readOnly disabled />
            </FieldGroup>
          </div>
        </form>
      </main>
    </div>
  );
};

export const InvoiceFormScenarios: React.FC = () => {
  const fixture = PROVIDERS[0];
  const outstandingMinor = fixture.invoice.balance_minor ?? fixture.invoice.total_minor;
  const creditMinor = Math.round(outstandingMinor * 0.6);
  const creditMajor = formatCurrency(creditMinor, fixture.invoice.currency);
  const reminderTimestamp = formatDate(fixture.invoice.last_reminder_at, true);
  const nextReminder = formatDate(fixture.invoice.due_at ?? fixture.invoice.issued_at, true);
  const collectionState = titleCase(fixture.invoice.collection_state);

  return (
    <div className="explorer-view context-form form-view" data-context="form">
      <header className="form-header" data-region="header">
        <div className="form-header__text">
          <p className="view-eyebrow">Invoice remediation</p>
          <h1 className="view-title">Collector validation scenarios</h1>
          <p className="view-caption">
            Credit, contact, and dunning fields share the same token map so invoice workflows stay provider-agnostic.
          </p>
        </div>
      </header>

      <main className="form-main" data-region="body">
        <form className="form-shell" noValidate>
          <ValidationBanner
            status="error"
            title="Submission blocked"
            description={`Invoice ${fixture.invoice.invoice_number} is ${collectionState.toLowerCase()}; add collector contact details.`}
          />

          <div className="form-grid">
            <FieldGroup
              label="Collector follow-up"
              required
              state="invalid"
              message="Add billing contact details before issuing a credit memo."
            >
              <Input
                label="Billing contact email"
                type="email"
                tone="critical"
                placeholder={fixture.invoice.billing_contact_email ?? 'billing@example.com'}
                aria-invalid
                required
              />
              <TextArea
                label="Collector notes"
                tone="critical"
                placeholder="Call out payment plan, outreach attempts, or escalations."
                rows={3}
              />
            </FieldGroup>

            <FieldGroup
              label="Credit memo draft"
              required
              state="warning"
              description="Credits above 50% require finance sign-off."
            >
              <Input
                label="Outstanding balance"
                defaultValue={formatCurrency(outstandingMinor, fixture.invoice.currency)}
                readOnly
              />
              <Input
                label="Proposed credit (minor units)"
                type="number"
                tone="warning"
                defaultValue={String(creditMinor)}
                supportingText={`≈ ${creditMajor}`}
              />
              <HelpText>Connector sync applies the credit after approval.</HelpText>
            </FieldGroup>

            <FieldGroup
              label="Notification summary"
              state="valid"
              message={`Last reminder sent ${reminderTimestamp}.`}
              messageTone="success"
            >
              <Input label="Next reminder" defaultValue={`Scheduled for ${nextReminder}`} readOnly />
            </FieldGroup>

            <FieldGroup
              label="Dunning stage"
              state="disabled"
              description="Stage locks once provider acknowledges the reminder."
            >
              <Input
                label="Current stage"
                defaultValue={titleCase(fixture.invoice.dunning_step ?? 'unknown')}
                readOnly
                disabled
              />
            </FieldGroup>
          </div>
        </form>
      </main>
    </div>
  );
};
