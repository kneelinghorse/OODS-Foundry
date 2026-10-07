<script lang="ts">
import { defineComponent, h, ref, useId } from 'vue';
import { Checkbox as Contract } from '@oods/components-vue';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsCheckboxAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    const generated = useId(), local = ref(props.defaultChecked), native = ref<HTMLInputElement>();
    const change = (value: boolean | 'indeterminate') => { const next = value === true; if (native.value) { native.value.checked = next; native.value.dispatchEvent(new Event('change', { bubbles: true })); } if (props.modelValue === undefined && props.checked === undefined) local.value = next; emit('update:modelValue', next); emit('change', next); };
    return () => {
      const id = props.id ?? `oods-checkbox-${generated}`, help = slots.help?.() ?? props.help, validation = slots.validation?.() ?? props.validation?.message;
      return h('div', { class: 'grid gap-2', 'data-oods-adapter': 'Checkbox' }, [
        h('input', { id, ref: native, type: 'checkbox', class: 'sr-only', tabIndex: -1, 'aria-hidden': 'true', name: props.name, disabled: props.disabled, required: props.required, checked: props.modelValue ?? props.checked ?? local.value }),
        h('div', { class: 'flex items-center gap-2' }, [h(Checkbox, { ...attrs, 'data-oods-component': undefined, id: id + '-control', required: props.required, disabled: props.disabled,
          modelValue: props.modelValue ?? props.checked ?? local.value, 'onUpdate:modelValue': change,
          'aria-invalid': props.validation?.state === 'error' || undefined, 'aria-describedby': [attrs['aria-describedby'], help ? id + '-help' : '', validation ? id + '-validation' : ''].filter(Boolean).join(' ') || undefined,
        }), h(Label, { for: id + '-control' }, { default: () => [slots.label?.() ?? props.label, props.required ? h('span', { 'aria-hidden': 'true' }, '*') : null] })]),
        help ? h('p', { id: id + '-help', class: 'text-sm' }, help) : null,
        validation ? h('p', { id: id + '-validation', role: props.validation?.state === 'error' ? 'alert' : undefined }, validation) : null,
      ]);
    };
  },
});
</script>
