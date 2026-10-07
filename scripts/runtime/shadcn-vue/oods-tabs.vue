<script lang="ts">
import { defineComponent, h, ref } from 'vue';
import { Tabs as Contract } from '@oods/components-vue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsTabsAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    const local = ref(props.defaultSelectedId ?? props.items.find((item: any) => !item.disabled && !item.isDisabled)?.id);
    const selected = () => props.items.find((item: any) => item.id === (props.selectedId ?? local.value) && !item.disabled && !item.isDisabled)?.id ?? props.items.find((item: any) => !item.disabled && !item.isDisabled)?.id;
    const change = (value: string | number) => { const id = String(value); if (id === selected()) return; if (props.selectedId === undefined) local.value = id; emit('update:selectedId', id); emit('change', id); };
    return () => h(Tabs, { ...attrs, 'data-oods-component': undefined, modelValue: selected(), 'onUpdate:modelValue': change, 'data-oods-adapter': 'Tabs' }, { default: () => [
      h('div', { class: 'max-w-full overflow-x-auto' }, [h(TabsList, { 'aria-label': props.ariaLabel }, { default: () => props.items.map((item: any) => h(TabsTrigger, {
        value: item.id, disabled: item.disabled || item.isDisabled, 'data-tab-id': item.id,
      }, { default: () => slots.itemLabel?.({ item, selected: item.id === selected() }) ?? item.label })) })]),
      ...props.items.map((item: any) => h(TabsContent, { value: item.id }, { default: () => slots.panel?.({ item, selected: item.id === selected() }) ?? item.panel })),
    ] });
  },
});
</script>
