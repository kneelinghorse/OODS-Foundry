import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { TraitAdapter } from '../../../types/render-context.js';
import type { ViewExtension } from '../../../types/view-extension.js';
import type { ContextKind } from '../../../contexts/index.js';
import { PageHeader } from '../../../components/page/PageHeader.js';
import { Card } from '../../../components/base/Card.js';
import { Text } from '../../../components/base/Text.js';
import { Badge } from '../../../components/base/Badge.js';
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '../../../components/base/Table.js';
import { Button } from '../../../components/base/Button.js';
import { formatDate, formatMoney } from '../../../utils/format.js';
import {
  registerStatusableContributions,
  type RegisterStatusableContributionsInput,
} from '../../Statusable/contrib/statusable-contributions.js';
import { registerActionableContributions } from '../../Actionable/contrib/actionable-contributions.js';
import { registerAuditableContributions } from '../../Auditable/contrib/auditable-contributions.js';
import {
  sanitizeString,
  formatStatus,
  resolveDisplayName,
} from '../../Statusable/utils.js';
import type {
  InvoicePayableViewData,
  InvoiceLineItem,
} from '../../../objects/invoice/types.js';

export interface InvoicePayableTraitOptions {
  readonly traitId?: string;
  readonly headerId?: string;
  readonly headerPriority?: number;
  readonly summaryPriority?: number;
  readonly lineItemsPriority?: number;
  readonly contextPanelPriority?: number;
  readonly contexts?: readonly ContextKind[];
}

const DEFAULT_TRAIT_ID = 'SaaSBillingPayable';
const DEFAULT_HEADER_ID = 'billing:invoice:page-header';
const DEFAULT_HEADER_PRIORITY = 15;
const DEFAULT_SUMMARY_PRIORITY = 30;
const DEFAULT_LINE_ITEMS_PRIORITY = 45;
const DEFAULT_CONTEXT_PANEL_PRIORITY = 35;
const DEFAULT_CONTEXTS: readonly ContextKind[] = Object.freeze([
  'detail',
  'list',
  'form',
  'timeline',
]);

interface PageHeaderOptions<Data> {
  readonly id: string;
  readonly priority: number;
  readonly buildTitle: (data: Data) => ReactNode;
  readonly buildSubtitle?: (data: Data) => ReactNode;
  readonly buildDescription?: (data: Data) => ReactNode;
  readonly buildMetadata?: (data: Data) => ReactNode;
}

function registerSharedContributions<Data extends InvoicePayableViewData>(
  traitId: string,
  contexts: readonly ContextKind[]
): void {
  const statusableInput: RegisterStatusableContributionsInput = {
    traitId,
    options: {
      statusDomain: 'invoice',
      summaryTitle: 'Collections summary',
      summaryDescription:
        'Invoice state, contact, and retry posture resolve through canonical tokens.',
    },
    contexts,
  };

  registerStatusableContributions<Data>(statusableInput);

  registerActionableContributions<Data>({
    traitId,
    contexts,
  });

  registerAuditableContributions<Data>(traitId);
}

function renderMetadata(data: InvoicePayableViewData): ReactNode {
  const entries: Array<{ readonly label: string; readonly value: string }> = [];

  const dueDate = formatDate(data.due_at);
  if (dueDate) {
    entries.push({
      label: 'Due',
      value: dueDate,
    });
  }

  const balance = formatMoney(data.balance_minor, data.currency, {
    minorUnits: true,
  });
  if (balance) {
    entries.push({
      label: 'Open balance',
      value: balance,
    });
  }

  const retry = sanitizeString(data.collection_state);
  if (retry) {
    entries.push({
      label: 'Collection state',
      value: formatStatus(retry),
    });
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col text-right text-sm text-slate-500 dark:text-slate-400">
      {entries.map(({ label, value }) => (
        <Fragment key={label}>
          <Text as="span" size="sm" className="text-xs uppercase tracking-wide">
            {label}
          </Text>
          <Text as="span" size="sm" weight="medium">
            {value}
          </Text>
        </Fragment>
      ))}
    </div>
  );
}

function createPageHeaderExtension<Data extends InvoicePayableViewData>(
  options: PageHeaderOptions<Data>
): ViewExtension<Data> {
  return {
    id: options.id,
    region: 'pageHeader',
    type: 'section',
    priority: options.priority,
    render: ({ data }) => (
      <PageHeader
        title={options.buildTitle(data)}
        subtitle={options.buildSubtitle ? options.buildSubtitle(data) : undefined}
        description={
          options.buildDescription ? options.buildDescription(data) : undefined
        }
        metadata={options.buildMetadata ? options.buildMetadata(data) : undefined}
      />
    ),
  };
}

function resolveTitle(data: InvoicePayableViewData): string {
  const invoiceNumber = sanitizeString(data.invoice_number);
  if (invoiceNumber) {
    return `Invoice ${invoiceNumber}`;
  }

  return `Invoice ${sanitizeString(data.invoice_id) ?? 'unknown'}`;
}

function resolveSubtitle(data: InvoicePayableViewData): string | undefined {
  const provider = sanitizeString(data.provider);
  const terms = sanitizeString(data.payment_terms);
  const source = sanitizeString(data.payment_source);

  const parts = [
    provider ? formatStatus(provider) : null,
    terms ? `Terms · ${formatStatus(terms)}` : null,
    source ? `Source · ${formatStatus(source)}` : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' • ');
}

function resolveDescription(data: InvoicePayableViewData): string | undefined {
  const subscription = sanitizeString(data.subscription_id);
  const memo = sanitizeString(data.memo);

  const parts = [
    subscription ? `Subscription ${subscription}` : null,
    memo,
  ].filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' • ');
}

function buildSummaryMetrics(
  data: InvoicePayableViewData
): Array<{ readonly label: string; readonly value: ReactNode }> {
  const totals: Array<{ label: string; value: ReactNode }> = [];

  const issuedAt = formatDate(data.issued_at);
  if (issuedAt) {
    totals.push({
      label: 'Issued',
      value: issuedAt,
    });
  }

  const dueAt = formatDate(data.due_at);
  if (dueAt) {
    totals.push({
      label: 'Due',
      value: dueAt,
    });
  }

  const total = formatMoney(data.total_minor, data.currency, {
    minorUnits: true,
  });
  if (total) {
    totals.push({
      label: 'Total',
      value: total,
    });
  }

  const balance = formatMoney(data.balance_minor, data.currency, {
    minorUnits: true,
  });
  if (balance) {
    totals.push({
      label: 'Balance',
      value: balance,
    });
  }

  const aging = typeof data.aging_bucket_days === 'number' ? data.aging_bucket_days : null;
  if (aging !== null && Number.isFinite(aging)) {
    totals.push({
      label: 'Aging',
      value: `${aging} days`,
    });
  }

  const reminder = formatDate(data.last_reminder_at, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (reminder) {
    totals.push({
      label: 'Last reminder',
      value: reminder,
    });
  }

  return totals;
}

function renderSummaryMetrics(
  metrics: Array<{ readonly label: string; readonly value: ReactNode }>
): ReactNode {
  if (metrics.length === 0) {
    return (
      <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
        Collections metadata will populate once the invoice is issued.
      </Text>
    );
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {metrics.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1">
          <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
            {label}
          </Text>
          <Text as="dd" weight="medium">
            {value}
          </Text>
        </div>
      ))}
    </dl>
  );
}

function createFinancialSummarySection<Data extends InvoicePayableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billing:invoice:summary',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      const metrics = buildSummaryMetrics(data);
      const contact = sanitizeString(data.billing_contact_name) || resolveDisplayName(data);
      const contactEmail = sanitizeString(data.billing_contact_email);
      const dunningStep = sanitizeString(data.dunning_step);
      const providerStatus = sanitizeString(data.provider_status);
      const statusNote = sanitizeString(data.status_note);

      return (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Text as="h2" size="lg" weight="semibold">
                Collections overview
              </Text>
              <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
                Status, totals, and contact context resolve through canonical billing tokens.
              </Text>
            </div>
            {sanitizeString(data.status) ? (
              <Badge status={data.status ?? undefined} domain="invoice" emphasis="solid" />
            ) : null}
          </div>

          {providerStatus || dunningStep || statusNote ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300/80 bg-slate-50/70 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              {providerStatus ? (
                <Text as="span" size="sm" weight="medium">
                  Provider status · {formatStatus(providerStatus)}
                </Text>
              ) : null}
              {dunningStep ? (
                <Text as="span" size="sm">
                  Dunning step · {formatStatus(dunningStep)}
                </Text>
              ) : null}
              {statusNote ? (
                <Text as="span" size="sm">
                  {statusNote}
                </Text>
              ) : null}
            </div>
          ) : null}

          {renderSummaryMetrics(metrics)}

          <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Text as="span" weight="medium" className="text-slate-600 dark:text-slate-300">
              Billing contact
            </Text>
            <Text as="span" className="text-slate-700 dark:text-slate-200">
              {contact || 'Unassigned'}
            </Text>
            {contactEmail ? (
              <Text as="span" className="text-slate-500 dark:text-slate-400">
                {contactEmail}
              </Text>
            ) : null}
          </div>
        </Card>
      );
    },
  };
}

function renderLineItems(items: readonly InvoiceLineItem[], currency: string): ReactNode {
  if (items.length === 0) {
    return (
      <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
        Line items will surface after the provider finalizes the invoice.
      </Text>
    );
  }

  return (
    <Table density="comfortable">
      <TableHeader>
        <TableRow>
          <TableHeaderCell scope="col">Description</TableHeaderCell>
          <TableHeaderCell scope="col">Plan cadence</TableHeaderCell>
          <TableHeaderCell scope="col">Quantity</TableHeaderCell>
          <TableHeaderCell scope="col" numeric>
            Unit price
          </TableHeaderCell>
          <TableHeaderCell scope="col" numeric>
            Amount
          </TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => {
          const key = item.id ?? `${item.description}-${index}`;
          const quantity =
            typeof item.quantity === 'number' && Number.isFinite(item.quantity)
              ? item.quantity
              : '—';
          const unitAmount = formatMoney(item.unit_amount_minor, currency, {
            minorUnits: true,
          });
          const amount = formatMoney(item.amount_minor, currency, {
            minorUnits: true,
          });

          return (
            <TableRow key={key}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Text as="span" weight="medium">
                    {item.description}
                  </Text>
                  {item.product_code ? (
                    <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
                      Product · {item.product_code}
                    </Text>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {sanitizeString(item.plan_interval)
                  ? formatStatus(item.plan_interval as string)
                  : '—'}
              </TableCell>
              <TableCell>{quantity}</TableCell>
              <TableCell numeric>{unitAmount || '—'}</TableCell>
              <TableCell numeric>{amount || '—'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function createLineItemsSection<Data extends InvoicePayableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billing:invoice:line-items',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      const items = Array.isArray(data.line_items) ? data.line_items.filter(Boolean) : [];
      const subtotal = formatMoney(data.subtotal_minor, data.currency, {
        minorUnits: true,
      });
      const tax = formatMoney(data.tax_minor, data.currency, {
        minorUnits: true,
      });
      const discount = formatMoney(data.discount_minor, data.currency, {
        minorUnits: true,
      });

      return (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Text as="h3" size="md" weight="semibold">
              Invoice line items
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              Provider items render through canonical money formatting with semantic tokens.
            </Text>
          </div>

          {renderLineItems(items, data.currency)}

          <dl className="grid gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Subtotal
              </Text>
              <Text as="dd" weight="medium">
                {subtotal || '—'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Tax
              </Text>
              <Text as="dd" weight="medium">
                {tax || '—'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Discounts
              </Text>
              <Text as="dd" weight="medium">
                {discount || '—'}
              </Text>
            </div>
          </dl>
        </Card>
      );
    },
  };
}

function createContextPanel<Data extends InvoicePayableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billing:invoice:collections-notes',
    region: 'contextPanel',
    type: 'section',
    priority,
    render: ({ data }) => {
      const owner = sanitizeString(data.collection_owner);
      const ownerEmail = sanitizeString(data.collection_owner_email);
      const provider = sanitizeString(data.provider);
      const portalUrl = sanitizeString(data.portal_url);
      const channels = Array.isArray(data.collection_channels)
        ? data.collection_channels.filter(Boolean)
        : [];

      return (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Text as="h3" size="md" weight="semibold">
              Playbook context
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              Collections notes render alongside provider metadata and retry posture.
            </Text>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <Text as="span" weight="medium" className="text-slate-600 dark:text-slate-300">
              Owner
            </Text>
            <Text as="span" className="text-slate-700 dark:text-slate-200">
              {owner ?? 'Unassigned'}
            </Text>
            {ownerEmail ? (
              <Text as="span" className="text-slate-500 dark:text-slate-400">
                {ownerEmail}
              </Text>
            ) : null}
          </div>

          {provider ? (
            <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
              <Text as="span" weight="medium" className="text-slate-600 dark:text-slate-300">
                Provider
              </Text>
              <Text as="span">{formatStatus(provider)}</Text>
            </div>
          ) : null}

          {channels.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Text as="span" size="sm" weight="medium" className="text-slate-600 dark:text-slate-300">
                Collection channels
              </Text>
              <ul className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
                {channels.map((channel) => (
                  <li key={channel}>{formatStatus(channel)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {portalUrl ? (
            <Button asChild intent="neutral" size="sm">
              <a href={portalUrl} target="_blank" rel="noreferrer">
                Open invoice portal
              </a>
            </Button>
          ) : null}
        </Card>
      );
    },
  };
}

export function createInvoicePayableTraitAdapter<
  Data extends InvoicePayableViewData
>(options: InvoicePayableTraitOptions = {}): TraitAdapter<Data> {
  const traitId = options.traitId ?? DEFAULT_TRAIT_ID;
  const headerId = options.headerId ?? DEFAULT_HEADER_ID;
  const contexts = options.contexts ?? DEFAULT_CONTEXTS;
  const headerPriority = options.headerPriority ?? DEFAULT_HEADER_PRIORITY;
  const summaryPriority = options.summaryPriority ?? DEFAULT_SUMMARY_PRIORITY;
  const lineItemsPriority = options.lineItemsPriority ?? DEFAULT_LINE_ITEMS_PRIORITY;
  const contextPanelPriority =
    options.contextPanelPriority ?? DEFAULT_CONTEXT_PANEL_PRIORITY;

  registerSharedContributions<Data>(traitId, contexts);

  const extensions: ViewExtension<Data>[] = [
    createPageHeaderExtension<Data>({
      id: headerId,
      priority: headerPriority,
      buildTitle: resolveTitle,
      buildSubtitle: resolveSubtitle,
      buildDescription: resolveDescription,
      buildMetadata: renderMetadata,
    }),
    createFinancialSummarySection<Data>(summaryPriority),
    createLineItemsSection<Data>(lineItemsPriority),
    createContextPanel<Data>(contextPanelPriority),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
