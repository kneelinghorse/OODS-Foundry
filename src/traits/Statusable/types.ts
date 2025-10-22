export interface StatusTransitionEvent {
  readonly from_state?: string | null;
  readonly to_state?: string | null;
  readonly timestamp?: string | null;
  readonly actor_id?: string | null;
  readonly reason?: string | null;
}

export interface StatusableViewData {
  readonly name?: string | null;
  readonly preferred_name?: string | null;
  readonly description?: string | null;
  readonly primary_email?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly status?: string | null;
  readonly state_history?: readonly StatusTransitionEvent[] | null;
}

export interface SubscriptionStatusableViewData extends StatusableViewData {
  readonly plan_name?: string | null;
  readonly plan_interval?: string | null;
  readonly customer_name?: string | null;
  readonly customer_email?: string | null;
  readonly subscription_id?: string | null;
}

export interface StatusableContributionOptions {
  readonly statusDomain?: string;
  readonly summaryTitle?: string;
  readonly summaryDescription?: string;
}
