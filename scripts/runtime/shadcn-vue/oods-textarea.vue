<script lang="ts">
import { defineComponent, h, ref, useId } from 'vue';
import { Textarea as Contract } from '@oods/components-vue';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Reuse the shipped Vue prop defaults and event vocabulary; the rendered parts belong to the team.
export default defineComponent({
  name: 'OodsTextareaAdapter',
  inheritAttrs: false,
  props: Contract.props,
  emits: Array.isArray(Contract.emits) ? Contract.emits : Object.keys(Contract.emits ?? {}),
  setup(props: any, { attrs, slots, emit }: any) {
    const generated = useId(), local = ref(props.defaultValue);
    const update = (value: string | number) => { const next = String(value); if (props.modelValue === undefined && props.value === undefined) local.value = next; emit('update:modelValue', next); emit('input', next); };
    return () => {
      const id = props.id ?? `oods-textarea-${generated}`, value = props.modelValue ?? props.value ?? local.value;
      const help = slots.help?.() ?? props.help, validation = slots.validation?.() ?? props.validation?.message;
      const described = [attrs['aria-describedby'], help ? id + '-help' : '', validation ? id + '-validation' : ''].filter(Boolean).join(' ') || undefined;
      return h('div', { class: 'grid gap-2', 'data-oods-adapter': 'Textarea' }, [
        slots.label || props.label ? h(Label, { for: id }, { default: () => [slots.label?.() ?? props.label, props.required ? h('span', { 'aria-hidden': 'true' }, '*') : null] }) : null,
        h(Textarea, { ...attrs, 'data-oods-component': undefined, id, type: undefined, name: props.name, modelValue: value,
          'onUpdate:modelValue': update, onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).value),
          class: [props.inputClass, attrs.class], rows: props.rows, placeholder: props.placeholder, required: props.required, disabled: props.disabled, readonly: props.readOnly,
          min: props.min, max: props.max, step: props.step, 'aria-invalid': props.validation?.state === 'error' || undefined, 'aria-describedby': described,
          'aria-errormessage': props.validation?.state === 'error' ? id + '-validation' : undefined,
        }),
        help ? h('p', { id: id + '-help', class: 'text-sm' }, help) : null,
        validation ? h('p', { id: id + '-validation', role: props.validation?.state === 'error' ? 'alert' : undefined, class: 'text-sm' }, validation) : null,
      ]);
    };
  },
});
</script>
