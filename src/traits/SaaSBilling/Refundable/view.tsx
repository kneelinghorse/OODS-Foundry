import type { TraitAdapter } from '../../../types/render-context.js';
import type { ViewExtension } from '../../../types/view-extension.js';
import { Card } from '../../../components/base/Card.js';
import { Text } from '../../../components/base/Text.js';
import { Badge } from '../../../components/base/Badge.js';
import { Button } from '../../../components/base/Button.js';
import { formatDate, formatMoney } from '../../../utils/format.js';
import {
  formatStatus,
  sanitizeString,
} from '../../Statusable/utils.js';
import type { InvoiceRefundableViewData } from '../../../objects/invoice/types.js';

export interface InvoiceRefundableTraitOptions {
  readonly traitId?: string;
  readonly summaryPriority?: number;
  readonly contextPriority?: number;
}

const DEFAULT_TRAIT_ID = 'SaaSBillingRefundable';
const DEFAULT_SUMMARY_PRIORITY = 55;
const DEFAULT_CONTEXT_PRIORITY = 50;

function createRefundSummarySection<Data extends InvoiceRefundableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billing:invoice:refund-window',
    region: 'main',
    type: 'section',
    priority,
    render: ({ data }) => {
      const windowEnd = formatDate(data.refundable_until);
      const lastRefund = formatDate(data.last_refund_at, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const currency = sanitizeString(data.currency) ?? 'usd';
      const totalRefunded = formatMoney(data.total_refunded_minor, currency, {
        minorUnits: true,
      });
      const creditBalance = formatMoney(data.credit_memo_balance_minor, currency, {
        minorUnits: true,
      });
      const approvalRequired = data.requires_manager_approval === true;
      const creditType = sanitizeString(data.credit_memo_type);

      return (
        <Card className="flex flex-col gap-4 border border-slate-200/60 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Text as="h3" size="md" weight="semibold">
                Refund readiness
              </Text>
              <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
                Refund posture and memo balances resolve through canonical semantic tokens.
              </Text>
            </div>
            {approvalRequired ? (
              <Badge tone="warning" emphasis="solid" aria-label="Manager approval required">
                Manager approval required
              </Badge>
            ) : (
              <Badge tone="info" emphasis="subtle">
                Auto approval
              </Badge>
            )}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Refund window
              </Text>
              <Text as="dd" weight="medium">
                {windowEnd || 'Policy governed'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Last refund
              </Text>
              <Text as="dd" weight="medium">
                {lastRefund || 'No refunds issued'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Total refunded
              </Text>
              <Text as="dd" weight="medium" className="text-emerald-600 dark:text-emerald-400">
                {totalRefunded || '$0.00'}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Text as="dt" size="sm" className="text-slate-500 dark:text-slate-400">
                Credit memo balance
              </Text>
              <Text as="dd" weight="medium" className="text-sky-600 dark:text-sky-400">
                {creditBalance || '$0.00'}
              </Text>
            </div>
          </dl>

          {creditType ? (
            <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
              <Text as="span" weight="medium" className="text-slate-600 dark:text-slate-300">
                Credit memo type
              </Text>
              <Text as="span">{formatStatus(creditType)}</Text>
            </div>
          ) : null}
        </Card>
      );
    },
  };
}

function createPolicyPanel<Data extends InvoiceRefundableViewData>(
  priority: number
): ViewExtension<Data> {
  return {
    id: 'billing:invoice:refund-policy',
    region: 'contextPanel',
    type: 'section',
    priority,
    render: ({ data }) => {
      const policyUrl = sanitizeString(data.refund_policy_url);
      const notes = sanitizeString(data.notes);

      return (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Text as="h3" size="md" weight="semibold">
              Refund policy
            </Text>
            <Text as="p" size="sm" className="text-slate-500 dark:text-slate-400">
              Finance policy links render alongside operator notes for this invoice.
            </Text>
          </div>

          {policyUrl ? (
            <Button asChild size="sm" intent="neutral">
              <a href={policyUrl} target="_blank" rel="noreferrer">
                View policy
              </a>
            </Button>
          ) : (
            <Text as="span" size="sm" className="text-slate-500 dark:text-slate-400">
              Policy link unavailable
            </Text>
          )}

          {notes ? (
            <Text as="p" size="sm" className="text-slate-600 dark:text-slate-300">
              {notes}
            </Text>
          ) : null}
        </Card>
      );
    },
  };
}

export function createInvoiceRefundableTraitAdapter<
  Data extends InvoiceRefundableViewData
>(options: InvoiceRefundableTraitOptions = {}): TraitAdapter<Data> {
  const traitId = options.traitId ?? DEFAULT_TRAIT_ID;
  const summaryPriority = options.summaryPriority ?? DEFAULT_SUMMARY_PRIORITY;
  const contextPriority = options.contextPriority ?? DEFAULT_CONTEXT_PRIORITY;

  const extensions: ViewExtension<Data>[] = [
    createRefundSummarySection<Data>(summaryPriority),
    createPolicyPanel<Data>(contextPriority),
  ];

  return Object.freeze({
    id: traitId,
    view: () => extensions,
  });
}
