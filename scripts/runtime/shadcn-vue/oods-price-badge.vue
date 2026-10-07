<script lang="ts">
import { defineComponent, h } from 'vue';
import { PriceBadge as Contract } from '@oods/components-vue';
import { Badge } from '@/components/ui/badge';
import { currencyMinorUnits } from '@oods/component-contracts';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsPriceBadgeAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots }: any) {
    return () => {
      const currency = props.currency ?? props.currencyCode;
      const cents = props.amountCents ?? props.unitAmountCents;
      const amount = cents === undefined ? props.amount ?? props.unitAmount : cents / currencyMinorUnits(currency, props.minorUnits);
      let formatted = 'Price';
      if (amount !== undefined && Number.isFinite(amount)) {
        try { formatted = new Intl.NumberFormat('en-US', currency ? { style: 'currency', currency: currency.toUpperCase() } : { maximumFractionDigits: 2 }).format(amount); }
        catch { formatted = `${currency?.toUpperCase() ?? ''} ${amount.toFixed(2)}`.trim(); }
      }
      return h(Badge, { ...attrs, 'data-oods-component': undefined, variant: props.emphasis === 'solid' ? 'default' : 'secondary',
        'data-oods-adapter': 'PriceBadge', 'data-price': 'true', 'data-currency': currency?.toUpperCase(), title: attrs.title ?? props.label,
      }, { default: () => slots.default?.() ?? props.label ?? props.value ?? formatted });
    };
  },
});
</script>
