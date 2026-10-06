import { defineComponent, h, type PropType } from 'vue';
import { formatDateTime, type CollectionEvent, billingCycle, billingPaymentRows, billingPaymentSummary, billingSummary, type BillingPaymentValues } from '@oods/component-contracts';

export const CycleProgressCard = defineComponent({
  name: 'CycleProgressCard', props: { id: String, title: { type: String, default: 'Billing cycle' }, progress: Number, periodStart: String, periodEnd: String, interval: String, now: String },
  setup: (props) => () => {
    const cycle = billingCycle(props);
    return h('section', { id: props.id, class: 'oods-billing-cycle', 'data-oods-component': 'CycleProgressCard', 'aria-label': props.title }, [
      h('h2', props.title), h('p', cycle.announcement), cycle.percent !== undefined ? h('progress', { max: 100, value: cycle.percent, 'aria-label': cycle.announcement }) : null,
      props.interval ? h('p', { class: 'oods-billing-muted' }, props.interval) : null,
    ]);
  },
});

const paymentProps = { id: String, title: String, lastPayment: String, nextPayment: String, paymentStatus: String, amount: Number, currency: String, minorUnits: Number };
function renderBillingTimeline(props: BillingPaymentValues & { id?: string; title?: string }, component: string, includeMethod: boolean) {
  const heading = props.title ?? (includeMethod ? 'Payments' : 'Payment events');
  return h('section', { id: props.id, class: 'oods-payment-timeline', 'data-oods-component': component, role: 'log', 'aria-label': heading }, [
    h('h2', heading), h('p', billingPaymentSummary(props)), includeMethod ? h('p', { class: 'oods-billing-muted' }, `Payment method: ${props.paymentMethod ?? 'Not provided'}`) : null,
    h('ol', billingPaymentRows(props).map((row) => h('li', { key: row.kind, 'data-payment-kind': row.kind }, [h('strong', row.label), row.at ? h('time', { datetime: row.at }, row.text) : h('span', row.text)]))),
  ]);
}
export const PaymentTimeline = defineComponent({ name: 'PaymentTimeline', props: { ...paymentProps, paymentMethod: String }, setup: (props) => () => renderBillingTimeline(props, 'PaymentTimeline', true) });
export const PaymentEventTimeline = defineComponent({ name: 'PaymentEventTimeline', props: { ...paymentProps, event: Object as PropType<CollectionEvent> }, setup: (props) => () => props.event
  ? h('section', { id: props.id, 'data-oods-component': 'PaymentEventTimeline', 'aria-label': props.event.title ?? 'Payment event' }, [h('strong', props.event.title), h('time', { datetime: props.event.at }, formatDateTime(props.event.at)), h('p', props.event.description)])
  : renderBillingTimeline(props, 'PaymentEventTimeline', false) });

export const BillingCardMeta = defineComponent({
  name: 'BillingCardMeta', props: { id: String, amount: Number, currency: String, minorUnits: Number, interval: String },
  setup: (props) => () => h('span', { id: props.id, class: 'oods-billing-card-meta', 'data-oods-component': 'BillingCardMeta' }, billingSummary(props.amount, props.currency, props.minorUnits, props.interval)),
});

export const ArchivedRowOverlay = defineComponent({
  name: 'ArchivedRowOverlay', props: { id: String, isArchived: Boolean, showBadge: { type: Boolean, default: true }, separateTab: { type: Boolean, default: true }, tabLabel: { type: String, default: 'Archived' }, label: String },
  setup: (props, { slots }) => () => h('span', { id: props.id, class: 'oods-archived-row', 'data-oods-component': 'ArchivedRowOverlay', 'data-archived': props.isArchived ? 'true' : undefined,
    'data-archive-tab': props.separateTab ? props.tabLabel : undefined, role: props.isArchived ? 'group' : undefined, 'aria-hidden': props.isArchived ? false : undefined,
    'aria-label': props.isArchived ? `${props.tabLabel}${props.label ? `: ${props.label}` : ''}` : undefined,
  }, [slots.default?.(), props.isArchived && props.showBadge ? h('span', { class: 'oods-archive-badge' }, props.tabLabel) : null]),
});
