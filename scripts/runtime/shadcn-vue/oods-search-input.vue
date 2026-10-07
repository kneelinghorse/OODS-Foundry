<script lang="ts">
import { defineComponent, h, ref, useId, onBeforeUnmount } from 'vue';
import { SearchInput as Contract } from '@oods/components-vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsSearchInputAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, emit }: any) {
    const generated = useId(), local = ref(props.defaultValue);
    let timer: ReturnType<typeof setTimeout> | undefined;
    onBeforeUnmount(() => clearTimeout(timer));
    const current = () => props.modelValue ?? props.value ?? local.value;
    const search = (value: string) => { if (value && value.length < Math.max(0, props.minQueryLength)) return; emit('valueChange', value); emit('update', value); emit('search', value); };
    const update = (value: string | number) => { const next = String(value); if (props.modelValue === undefined && props.value === undefined) local.value = next; emit('update:modelValue', next); emit('input', next); clearTimeout(timer); const delay = Math.max(0, props.debounceMs || props.debounce || 0); if (delay) timer = setTimeout(() => search(next), delay); else search(next); };
    const clear = () => { if (props.disabled || !current()) return; update(''); emit('clear'); };
    return () => { const id = props.id ?? `oods-search-${generated}`; return h('div', { ...attrs, 'data-oods-component': undefined, class: ['flex flex-wrap items-center gap-2', attrs.class], role: 'search', 'aria-label': attrs['aria-label'] ?? props.label ?? props.placeholder, 'data-oods-adapter': 'SearchInput' }, [
      props.label ? h(Label, { for: id }, { default: () => props.label }) : null,
      h(Input, { id, type: 'search', modelValue: current(), 'onUpdate:modelValue': update, placeholder: props.placeholder, disabled: props.disabled, 'aria-label': props.label ? undefined : attrs['aria-label'] ?? props.placeholder,
        onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); if (event.key === 'Enter') { event.preventDefault(); clearTimeout(timer); if (!props.disabled) search(current()); } },
      }), props.clearable && current() ? h(Button, { type: 'button', variant: 'ghost', disabled: props.disabled, 'aria-label': 'Clear search', onClick: clear }, { default: () => '×' }) : null,
    ]); };

  },
});
</script>
