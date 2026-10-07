<script lang="ts">
import { defineComponent, h, ref, useId } from 'vue';
import { Select as Contract } from '@oods/components-vue';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsSelectAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    const generated = useId(), local = ref(props.defaultValue ?? ''), native = ref<HTMLInputElement>();
    return () => {
      const id = props.id ?? `oods-select-${generated}`;
      const status = false;
      if (status && slots.default) return h('div', { ...attrs, 'data-oods-component': undefined, 'data-oods-adapter': 'Select' }, slots.default());
      const choices = (props.options ?? props.states ?? (status ? ['draft','active','inactive'] : [])).map((option: any) => typeof option === 'object' ? { ...option, value: String(option.value ?? option.id ?? option.name ?? ''), label: option.label ?? option.name ?? String(option.value ?? option.id ?? '') } : { value: String(option), label: String(option) });
      // Reka reserves ''; keep the public empty option and never leak the transport value into forms or events.
      let empty = '__oods_empty_option__';
      while (choices.some((option: any) => option.value === empty)) empty += '_';
      const selected = String(props.modelValue ?? props.value ?? props.status ?? local.value);
      const change = (value: unknown) => { const next = value === empty ? '' : String(value ?? ''); if (native.value) { native.value.value = next; native.value.dispatchEvent(new Event('change', { bubbles: true })); } if (props.modelValue === undefined && props.value === undefined) local.value = next; emit('update:modelValue', next); emit('change', next); };
      const name = props.name ?? (status ? 'status' : undefined);
      const label = slots.label?.() ?? props.label ?? props.title ?? (status ? 'Status' : undefined);
      const help = slots.help?.() ?? props.help, validation = slots.validation?.() ?? props.validation?.message;
      return h('div', { class: 'grid gap-2', 'data-oods-adapter': 'Select' }, [
        label ? h(Label, { for: id + '-control' }, { default: () => label }) : null,
        h('input', { id, ref: native, type: 'hidden', name, value: selected, disabled: props.disabled }),
        h(Select, { modelValue: selected === '' && choices.some((option: any) => option.value === '') ? empty : selected, 'onUpdate:modelValue': change, disabled: props.disabled, required: props.required }, { default: () => [
          h(SelectTrigger, { ...attrs, 'data-oods-component': undefined, id: id + '-control', 'aria-invalid': props.validation?.state === 'error' || undefined, 'aria-describedby': [attrs['aria-describedby'], help ? id + '-help' : '', validation ? id + '-validation' : ''].filter(Boolean).join(' ') || undefined }, { default: () => h(SelectValue, { placeholder: props.placeholder }, { default: () => choices.find((option: any) => option.value === selected)?.label ?? props.placeholder }) }),
          h(SelectContent, {}, { default: () => choices.map((option: any) => h(SelectItem, { value: option.value === '' ? empty : option.value, disabled: option.disabled }, { default: () => slots.option?.({ option }) ?? option.label })) }),
        ] }),
        help ? h('p', { id: id + '-help', class: 'text-sm' }, help) : null,
        validation ? h('p', { id: id + '-validation', role: props.validation?.state === 'error' ? 'alert' : undefined }, validation) : null,
      ]);
    };
  },
});
</script>
