import { dateTimeInputValue } from '@oods/component-contracts';
import {
  computed,
  defineComponent,
  h,
  ref,
  useId,
  type ComputedRef,
  type PropType,
  type Slots,
  type VNode,
  type VNodeChild,
} from 'vue';

import type { SelectOption, ValidationMessage } from './types.js';

type FieldPresentation = {
  id?: string;
  label?: string;
  help?: string;
  required?: boolean;
  validation?: ValidationMessage;
};

type FieldMetadata = {
  controlId: ComputedRef<string>;
  helpId: ComputedRef<string>;
  validationId: ComputedRef<string>;
  describedBy: ComputedRef<string | undefined>;
};

function validationStyle(validation?: ValidationMessage): Record<string, string> | undefined {
  if (!validation) return undefined;
  const tone = validation.state === 'error' ? 'critical' : validation.state;
  return {
    '--cmp-input-message-border': `var(--sys-status-${tone}-border)`,
    '--cmp-input-message-text': `var(--sys-status-${tone}-text)`,
  };
}

function useFieldMetadata(
  componentName: string,
  props: FieldPresentation,
  slots: Slots,
): FieldMetadata {
  const generatedId = useId();
  const controlId = computed(() => props.id || `oods-${componentName.toLowerCase()}-${generatedId}`);
  const helpId = computed(() => `${controlId.value}-help`);
  const validationId = computed(() => `${controlId.value}-validation`);
  const describedBy = computed(() => {
    const ids: string[] = [];
    if (props.help || slots.help) ids.push(helpId.value);
    if (props.validation?.message || slots.validation) ids.push(validationId.value);
    return ids.length > 0 ? ids.join(' ') : undefined;
  });
  return { controlId, helpId, validationId, describedBy };
}

function renderField(
  componentName: string,
  props: FieldPresentation,
  slots: Slots,
  metadata: FieldMetadata,
  control: VNode,
): VNode {
  const label = slots.label?.() ?? props.label;
  const help = slots.help?.() ?? props.help;
  const validation = slots.validation?.() ?? props.validation?.message;
  return h('div', {
    class: 'oods-field',
    'data-oods-component': componentName,
    style: validationStyle(props.validation),
  }, [
    label
      ? h('label', { class: 'oods-field-label', for: metadata.controlId.value }, [label, props.required ? h('span', { class: 'oods-field-required', 'aria-hidden': 'true' }, '*') : null])
      : null,
    control,
    help
      ? h('p', { id: metadata.helpId.value, class: 'oods-field-help' }, help)
      : null,
    validation
      ? h('p', {
          id: metadata.validationId.value,
          class: 'oods-field-error',
          role: props.validation?.state === 'error' ? 'alert' : undefined,
        }, validation)
      : null,
  ]);
}

const textFieldProps = {
  id: String,
  label: String,
  modelValue: String,
  value: String,
  defaultValue: { type: String, default: '' },
  placeholder: String,
  required: Boolean,
  disabled: Boolean,
  readOnly: Boolean,
  help: String,
  validation: Object as PropType<ValidationMessage>,
  name: String,
  min: String,
  max: String,
  step: [String, Number] as PropType<string | number>,
} as const;

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

export const Input = defineComponent({
  name: 'OodsInput',
  props: {
    ...textFieldProps,
    type: { type: String, default: 'text' },
    /** A class for the input element itself, as React's inputClassName; the field's own class stays on its frame. */
    inputClass: String,
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    input: (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const internalValue = ref(props.defaultValue);
    const currentValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    const metadata = useFieldMetadata('Input', props, slots);
    const updateValue = (nextValue: string) => {
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = nextValue;
      emit('update:modelValue', nextValue);
      emit('input', nextValue);
    };

    return () => renderField('Input', props, slots, metadata, h('input', {
      id: metadata.controlId.value,
      class: props.inputClass ? ['oods-field-control', props.inputClass] : 'oods-field-control',
      type: props.type,
      name: props.name,
      value: props.type === 'datetime-local' ? dateTimeInputValue(currentValue.value) : currentValue.value,
      placeholder: props.placeholder,
      required: props.required,
      disabled: props.disabled,
      readonly: props.readOnly,
      min: props.min,
      max: props.max,
      step: props.step,
      'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
      'aria-describedby': metadata.describedBy.value,
      'aria-errormessage': props.validation?.state === 'error' ? metadata.validationId.value : undefined,
      onInput: (event: Event) => updateValue(eventValue(event)),
      onChange: (event: Event) => emit('change', eventValue(event)),
    }));
  },
});

export const DatePicker = defineComponent({
  name: 'OodsDatePicker',
  inheritAttrs: false,
  props: textFieldProps,
  emits: {
    'update:modelValue': (_value: string) => true,
    input: (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { attrs, emit, slots }) {
    return () => h('div', {
      ...attrs,
      class: ['oods-date-picker', attrs.class],
      'data-oods-component': 'DatePicker',
    }, [h(Input, {
      ...props,
      type: 'date',
      'onUpdate:modelValue': (value: string) => emit('update:modelValue', value),
      onInput: (value: string) => emit('input', value),
      onChange: (value: string) => emit('change', value),
    }, slots)]);
  },
});

export const Textarea = defineComponent({
  name: 'OodsTextarea',
  props: {
    ...textFieldProps,
    rows: { type: Number, default: 3 },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    input: (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const internalValue = ref(props.defaultValue);
    const currentValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    const metadata = useFieldMetadata('Textarea', props, slots);
    const updateValue = (nextValue: string) => {
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = nextValue;
      emit('update:modelValue', nextValue);
      emit('input', nextValue);
    };

    return () => renderField('Textarea', props, slots, metadata, h('textarea', {
      id: metadata.controlId.value,
      class: 'oods-field-control',
      name: props.name,
      value: currentValue.value,
      rows: props.rows,
      placeholder: props.placeholder,
      required: props.required,
      disabled: props.disabled,
      readonly: props.readOnly,
      'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
      'aria-describedby': metadata.describedBy.value,
      'aria-errormessage': props.validation?.state === 'error' ? metadata.validationId.value : undefined,
      onInput: (event: Event) => updateValue(eventValue(event)),
      onChange: (event: Event) => emit('change', eventValue(event)),
    }));
  },
});

export const Select = defineComponent({
  name: 'OodsSelect',
  props: {
    id: String,
    label: String,
    modelValue: String,
    value: String,
    defaultValue: { type: String, default: '' },
    placeholder: String,
    required: Boolean,
    disabled: Boolean,
    help: String,
    validation: Object as PropType<ValidationMessage>,
    name: String,
    options: { type: Array as PropType<readonly SelectOption[]>, default: () => [] },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const internalValue = ref(props.defaultValue);
    const currentValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    const metadata = useFieldMetadata('Select', props, slots);
    const selectValue = (nextValue: string) => {
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = nextValue;
      emit('update:modelValue', nextValue);
      emit('change', nextValue);
    };

    return () => renderField('Select', props, slots, metadata, h('select', {
      id: metadata.controlId.value,
      class: 'oods-field-control',
      name: props.name,
      value: currentValue.value,
      required: props.required,
      disabled: props.disabled,
      'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
      'aria-describedby': metadata.describedBy.value,
      'aria-errormessage': props.validation?.state === 'error' ? metadata.validationId.value : undefined,
      onChange: (event: Event) => selectValue(eventValue(event)),
    }, [
      props.placeholder
        ? h('option', {
            value: '',
            selected: currentValue.value === '',
            disabled: true,
          }, props.placeholder)
        : null,
      ...props.options.map((option) => h('option', {
        key: option.value,
        value: option.value,
        selected: option.value === currentValue.value,
        disabled: option.disabled,
      }, slots.option?.({ option }) ?? option.label)),
    ]));
  },
});

export const Checkbox = defineComponent({
  name: 'OodsCheckbox',
  props: {
    id: String,
    label: String,
    modelValue: { type: Boolean, default: undefined },
    checked: { type: Boolean, default: undefined },
    defaultChecked: Boolean,
    required: Boolean,
    disabled: Boolean,
    help: String,
    validation: Object as PropType<ValidationMessage>,
    name: String,
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    change: (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const internalChecked = ref(props.defaultChecked);
    const currentChecked = computed(() => props.modelValue ?? props.checked ?? internalChecked.value);
    const metadata = useFieldMetadata('Checkbox', props, slots);
    const change = (event: Event) => {
      const checked = (event.target as HTMLInputElement).checked;
      if (props.modelValue === undefined && props.checked === undefined) internalChecked.value = checked;
      emit('update:modelValue', checked);
      emit('change', checked);
    };

    return () => {
      const label: VNodeChild = slots.label?.() ?? props.label;
      const help: VNodeChild = slots.help?.() ?? props.help;
      const validation: VNodeChild = slots.validation?.() ?? props.validation?.message;
      return h('div', {
        class: 'oods-field',
        'data-oods-component': 'Checkbox',
        style: validationStyle(props.validation),
      }, [
        h('label', { class: 'oods-checkbox', for: metadata.controlId.value }, [
          h('input', {
            id: metadata.controlId.value,
            type: 'checkbox',
            name: props.name,
            checked: currentChecked.value,
            required: props.required,
            disabled: props.disabled,
            'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
            'aria-describedby': metadata.describedBy.value,
            'aria-errormessage': props.validation?.state === 'error' ? metadata.validationId.value : undefined,
            onChange: change,
          }),
          h('span', { class: 'oods-field-label' }, [
            label,
            props.required
              ? h('span', { class: 'oods-field-required', 'aria-hidden': 'true' }, '*')
              : null,
          ]),
        ]),
        help ? h('p', { id: metadata.helpId.value, class: 'oods-field-help' }, help) : null,
        validation
          ? h('p', {
              id: metadata.validationId.value,
              class: 'oods-field-error',
              role: props.validation?.state === 'error' ? 'alert' : undefined,
            }, validation)
          : null,
      ]);
    };
  },
});

// s222-m02 (#2502 ruling 11): one markup with React and the HTML renderer. The control is a button with role switch; its
// label names it through aria-labelledby (a button takes no name from a label element in every reader, axe included),
// and the label's for keeps a click on the label toggling it. Help and error text describe it.
export const Switch = defineComponent({
  name: 'OodsSwitch',
  props: {
    id: String,
    label: String,
    modelValue: { type: Boolean, default: undefined },
    checked: { type: Boolean, default: undefined },
    defaultChecked: Boolean,
    required: Boolean,
    disabled: Boolean,
    help: String,
    validation: Object as PropType<ValidationMessage>,
    size: { type: String as PropType<'sm' | 'md'>, default: 'md' },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    change: (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const internalChecked = ref(props.defaultChecked);
    const currentChecked = computed(() => props.modelValue ?? props.checked ?? internalChecked.value);
    const metadata = useFieldMetadata('Switch', props, slots);
    const toggle = () => {
      const next = !currentChecked.value;
      if (props.modelValue === undefined && props.checked === undefined) internalChecked.value = next;
      emit('update:modelValue', next);
      emit('change', next);
    };

    return () => {
      const label: VNodeChild = slots.label?.() ?? props.label;
      const help: VNodeChild = slots.help?.() ?? props.help;
      const validation: VNodeChild = slots.validation?.() ?? props.validation?.message;
      const controlId = metadata.controlId.value;
      return h('div', {
        class: 'oods-field oods-switch',
        style: validationStyle(props.validation),
        'data-oods-component': 'Switch',
        'data-size': props.size,
        'data-validation-state': props.validation?.state,
      }, [
        h('div', { class: 'oods-switch__row' }, [
          h('button', {
            id: controlId,
            type: 'button',
            role: 'switch',
            class: 'oods-switch__control',
            'aria-checked': currentChecked.value ? 'true' : 'false',
            'aria-labelledby': `${controlId}-label`,
            'aria-describedby': metadata.describedBy.value,
            'aria-required': props.required ? 'true' : undefined,
            'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
            disabled: props.disabled,
            onClick: toggle,
          }, [h('span', { class: 'oods-switch__thumb', 'aria-hidden': 'true' })]),
          h('label', { id: `${controlId}-label`, class: 'oods-field-label oods-switch__label', for: controlId }, [
            label,
            props.required ? h('span', { class: 'oods-field-required', 'aria-hidden': 'true' }, '*') : null,
          ]),
        ]),
        help ? h('p', { id: metadata.helpId.value, class: 'oods-field-help' }, help) : null,
        validation
          ? h('p', {
              id: metadata.validationId.value,
              class: 'oods-field-error',
              role: props.validation?.state === 'error' ? 'alert' : undefined,
            }, validation)
          : null,
      ]);
    };
  },
});
