<script lang="ts">
import { defineComponent, h } from 'vue';
import { Button as Contract } from '@oods/components-vue';
import { Button } from '@/components/ui/button';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsButtonAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    return () => h(Button, { ...attrs, 'data-oods-component': undefined, type: props.type, disabled: props.disabled,
      variant: ({ primary: 'default', neutral: 'outline', secondary: 'secondary', success: 'secondary', warning: 'secondary', danger: 'destructive', ghost: 'ghost' } as any)[props.intent] ?? 'default',
      size: props.size === 'md' ? 'default' : props.size === 'xs' ? 'sm' : props.size,
      class: [props.intent === 'danger' ? 'bg-destructive text-background hover:bg-destructive dark:bg-destructive dark:hover:bg-destructive' : '', attrs.class],
      'data-oods-adapter': 'Button', onClick: (event: MouseEvent) => emit('activate', event),
    }, { default: () => slots.default?.() ?? props.content });
  },
});
</script>
