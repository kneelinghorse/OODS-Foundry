import type { SubscriptionStatefulViewData } from '../../traits/Stateful/view.js';
import type { CancellableViewData } from '../../traits/Cancellable/view.js';
import type { SubscriptionTimestampableViewData } from '../../traits/Timestampable/view.js';
import type { BillableViewData } from '../../traits/Billable/view.js';
import type { TaggableViewData } from '../../traits/Taggable/types.js';

export type SubscriptionRecord = SubscriptionStatefulViewData &
  CancellableViewData &
  SubscriptionTimestampableViewData &
  BillableViewData &
  TaggableViewData & {
    readonly subscription_id: string;
    readonly plan_name: string;
    readonly plan_code?: string | null;
    readonly plan_interval?: string | null;
    readonly customer_name?: string | null;
    readonly customer_email?: string | null;
    readonly status: string;
    readonly amount: number;
    readonly currency: string;
    readonly billing_interval?: string | null;
    readonly current_period_start: string;
    readonly current_period_end: string;
  };
