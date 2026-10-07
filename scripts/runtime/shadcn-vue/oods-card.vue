<script lang="ts">
import { defineComponent, h } from 'vue';
import { Card as Contract } from '@oods/components-vue';
import { Card } from '@/components/ui/card';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsCardAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots }: any) {
    return () => h(['div','article','section','aside','main','li'].includes(props.as) ? props.as : 'div', {
      ...attrs, 'data-oods-component': undefined, 'data-oods-adapter': 'Card', 'data-elevated': String(props.elevated),
    }, [h(Card, { class: props.elevated ? 'shadow-lg' : undefined }, slots)]);
  },
});
</script>
