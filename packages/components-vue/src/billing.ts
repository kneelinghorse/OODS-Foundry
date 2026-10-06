import { defineComponent, h, ref, useId, watch, type PropType } from 'vue';
import {
  BILLING_INTERVALS, BILLING_MINOR_UNITS, billingAmountMessage, billingAmountText,
  billingIntervalMessage, billingSummary, formatReadOnlyValue, formatBillingAmount, parseBillingAmount,
} from '@oods/component-contracts';

const amountProps = { id: String, amount: Number, currency: { type: String, default: 'usd' }, minorUnits: { type: Number, default: BILLING_MINOR_UNITS } };

export const BillingSummaryBadge = defineComponent({
  name: 'BillingSummaryBadge', props: { ...amountProps, interval: String, showInterval: { type: Boolean, default: true } },
  setup: (props) => () => h('span', { id: props.id, class: 'oods-billing-summary', 'data-oods-component': 'BillingSummaryBadge' }, props.showInterval ? billingSummary(props.amount, props.currency, props.minorUnits, props.interval) : formatBillingAmount(props.amount, props.currency, props.minorUnits)),
});

export const BillingAmountInput = defineComponent({
  name: 'BillingAmountInput',
  props: { ...amountProps, label: { type: String, default: 'Billing amount' }, name: String, disabled: Boolean, help: String },
  emits: { change: (value: number | undefined) => value === undefined || Number.isSafeInteger(value) },
  setup(props, { emit }) {
    const generatedId = useId();
    const text = ref(billingAmountText(props.amount, props.minorUnits));
    const error = ref(billingAmountMessage(props.amount, props.minorUnits));
    watch(() => [props.amount, props.minorUnits], () => { text.value = billingAmountText(props.amount, props.minorUnits); error.value = billingAmountMessage(props.amount, props.minorUnits); });
    return () => {
      const id = props.id ?? `billing-amount-${generatedId}`;
      return h('div', { class: 'oods-billing-field', 'data-oods-component': 'BillingAmountInput', 'data-state': error.value ? 'invalid' : 'editing' }, [
        h('label', { for: id }, props.label), h('span', { id: `${id}-currency` }, props.currency.toUpperCase()),
        h('input', { id, name: props.name, type: 'text', inputmode: 'decimal', value: text.value, disabled: props.disabled,
          'data-billing-minor-units': props.minorUnits, 'aria-invalid': error.value ? true : undefined,
          'aria-describedby': [`${id}-currency`, error.value && `${id}-error`].filter(Boolean).join(' '),
          onInput(event: Event) {
            const target = event.currentTarget as HTMLInputElement;
            const result = parseBillingAmount(target.value, props.minorUnits);
            target.setCustomValidity(result.valid ? '' : result.message);
            text.value = target.value; error.value = result.valid ? undefined : result.message;
            if (result.valid) emit('change', result.value);
          },
        }),
        props.help ? h('p', { class: 'oods-field-help' }, props.help) : null,
        error.value ? h('p', { id: `${id}-error`, role: 'alert' }, error.value) : null,
      ]);
    };
  },
});

export const BillingIntervalSelector = defineComponent({
  name: 'BillingIntervalSelector',
  props: { id: String, interval: String, intervals: { type: Array as PropType<readonly string[]>, default: () => [...BILLING_INTERVALS] }, label: { type: String, default: 'Billing interval' }, name: String, disabled: Boolean, help: String },
  emits: { change: (value: string) => typeof value === 'string' },
  setup(props, { emit }) {
    const generatedId = useId();
    const value = ref(props.interval ?? '');
    watch(() => props.interval, () => { value.value = props.interval ?? ''; });
    return () => {
      const id = props.id ?? `billing-interval-${generatedId}`;
      const error = billingIntervalMessage(value.value || undefined, props.intervals);
      return h('div', { class: 'oods-billing-field', 'data-oods-component': 'BillingIntervalSelector', 'data-state': error ? 'invalid' : 'editing' }, [
        h('label', { for: id }, props.label),
        h('select', { id, name: props.name, value: value.value, disabled: props.disabled, 'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : undefined,
          onChange(event: Event) { const next = (event.currentTarget as HTMLSelectElement).value; if (props.intervals.includes(next)) { value.value = next; emit('change', next); } },
        }, [
          !props.intervals.includes(value.value) ? h('option', { value: value.value, disabled: true, selected: true }, value.value || 'Choose interval') : null,
          ...props.intervals.map((option) => h('option', { value: option, selected: option === value.value }, formatReadOnlyValue(option, 'string', true))),
        ]),
        props.help ? h('p', { class: 'oods-field-help' }, props.help) : null,
        error ? h('p', { id: `${id}-error`, role: 'alert' }, error) : null,
      ]);
    };
  },
});
