import type { StatusableViewData } from '../../traits/Statusable/types.js';
import type { TaggableViewData } from '../../traits/Taggable/types.js';
import type { TimestampableViewData } from '../../traits/Timestampable/view.js';

export interface InvoiceLineItem {
  readonly id?: string | null;
  readonly description: string;
  readonly quantity?: number | null;
  readonly amount_minor: number;
  readonly unit_amount_minor?: number | null;
  readonly product_code?: string | null;
  readonly plan_interval?: string | null;
}

export interface InvoiceAttachment {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly description?: string | null;
}

export interface InvoicePayableViewData
  extends StatusableViewData,
    TaggableViewData,
    TimestampableViewData {
  readonly invoice_id: string;
  readonly invoice_number: string;
  readonly subscription_id?: string | null;
  readonly provider: string;
  readonly provider_invoice_id?: string | null;
  readonly provider_status?: string | null;
  readonly status_note?: string | null;
  readonly issued_at: string;
  readonly due_at?: string | null;
  readonly paid_at?: string | null;
  readonly total_minor: number;
  readonly balance_minor?: number | null;
  readonly currency: string;
  readonly payment_terms?: string | null;
  readonly collection_state?: string | null;
  readonly last_reminder_at?: string | null;
  readonly aging_bucket_days?: number | null;
  readonly memo?: string | null;
  readonly billing_contact_name?: string | null;
  readonly billing_contact_email?: string | null;
  readonly billing_contact_title?: string | null;
  readonly collection_owner?: string | null;
  readonly collection_owner_email?: string | null;
  readonly tax_minor?: number | null;
  readonly discount_minor?: number | null;
  readonly subtotal_minor?: number | null;
  readonly line_items?: readonly InvoiceLineItem[] | null;
  readonly attachments?: readonly InvoiceAttachment[] | null;
  readonly portal_url?: string | null;
  readonly dunning_step?: string | null;
  readonly payment_source?: string | null;
  readonly risk_segment?: string | null;
  readonly health_score?: number | null;
  readonly collection_channels?: readonly string[] | null;
}

export interface InvoiceRefundableViewData {
  readonly refundable_until?: string | null;
  readonly refund_policy_url?: string | null;
  readonly total_refunded_minor?: number | null;
  readonly credit_memo_balance_minor?: number | null;
  readonly credit_memo_type?: string | null;
  readonly last_refund_at?: string | null;
  readonly requires_manager_approval?: boolean | null;
  readonly notes?: string | null;
  readonly currency?: string | null;
}

export type InvoiceRecord = InvoicePayableViewData &
  InvoiceRefundableViewData & {
    readonly provider_region?: string | null;
    readonly collection_team?: string | null;
    readonly retry_attempt?: number | null;
  };

export type { InvoicePayableViewData as InvoiceViewData };
