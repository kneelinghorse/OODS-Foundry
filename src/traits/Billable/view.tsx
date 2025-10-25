import type { TraitAdapter } from '../../types/render-context.js';
import type { ViewExtension } from '../../types/view-extension.js';
import { Card } from '../../components/base/Card.js';
import { Text } from '../../components/base/Text.js';
import { Button } from '../../components/base/Button.js';
import { formatMoney, formatDate } from '../../utils/format.js';

export interface BillableViewData {
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly billing_interval?: string | null;
  readonly status?: string | null;
  readonly last_payment_at?: string | null;
  readonly next_payment_due_at?: string | null;
}

export interface BillableTraitOptions {
  readonly traitId?: string;
  readonly summaryPriority?: number;
  readonly actionPriority?: number;
}

const INTERVAL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  monthly: 'month',
  yearly: 'year',
  annual: 'year',
  quarterly: 'quarter',
});

function humanizeInterval(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return INTERVAL_LABELS[normalized] ?? normalized;
}

function normalizeStatus(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value.trim().toLowerCase();
}

function buildBillingSummary<Data extends BillableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billable:price-summary',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      const amount = formatMoney(data.amount, data.currency, { minorUnits: true });
      const interval = humanizeInterval(data.billing_interval);
      const lastPayment = formatDate(data.last_payment_at);
      const nextPayment = formatDate(data.next_payment_due_at);

      if (!amount) {
        return null;
      }

      return (
        <Card className="flex flex-col gap-3">
          <div>
            <Text as="h2" size="lg" weight="semibold">
              Billing
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              {interval ? `${amount} / ${interval}` : amount}
            </Text>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lastPayment ? (
              <div className="flex flex-col gap-1">
                <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                  Last payment
                </Text>
                <Text as="dd" weight="medium">
                  {lastPayment}
                </Text>
              </div>
            ) : null}
            {nextPayment ? (
              <div className="flex flex-col gap-1">
                <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                  Next payment due
                </Text>
                <Text as="dd" weight="medium">
                  {nextPayment}
                </Text>
              </div>
            ) : null}
          </dl>
        </Card>
      );
    },
  };
}

function buildPastDueAction<Data extends BillableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billable:update-payment-action',
    region: 'viewToolbar',
    type: 'action',
    priority,
    render: ({ data }) => {
      if (normalizeStatus(data.status) !== 'delinquent') {
        return null;
      }

      return (
        <Button intent="warning" id="subscription-update-payment">
          Update payment
        </Button>
      );
    },
  };
}

export function createBillableTraitAdapter<Data extends BillableViewData>(
  options: BillableTraitOptions = {}
): TraitAdapter<Data> {
  const traitId = options.traitId ?? 'Billable';
  const summaryPriority = options.summaryPriority ?? 40;
  const actionPriority = options.actionPriority ?? 45;

  const extensions: ViewExtension<Data>[] = [
    buildBillingSummary<Data>(summaryPriority),
    buildPastDueAction<Data>(actionPriority),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
