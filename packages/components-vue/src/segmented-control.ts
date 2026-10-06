import { computed, defineComponent, h, ref, useId, type PropType, type VNodeChild } from 'vue';

import type { SelectOption } from './types.js';

/**
 * s223-m02 (#2527 ruling 10): one choice from two to five options, shown as joined segments. One markup with React and
 * the HTML renderer: a radiogroup named by the visible label, each option a native radio inside its own label. The radio
 * is transparent over its whole segment, so the shared focus rule draws its ring on the segment, and the browser gives
 * the radio-group keyboard (the arrows move and check, Tab enters at the checked option) with no script. Select's value
 * API: modelValue or value (controlled), else defaultValue; each change emits update:modelValue and change.
 */
export const SegmentedControl = defineComponent({
  name: 'OodsSegmentedControl',
  props: {
    id: String,
    label: String,
    modelValue: String,
    value: String,
    defaultValue: { type: String, default: '' },
    name: String,
    size: { type: String as PropType<'xs' | 'sm' | 'md' | 'lg'>, default: 'md' },
    disabled: Boolean,
    options: { type: Array as PropType<readonly SelectOption[]>, default: () => [] },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const generatedId = useId();
    const internalValue = ref(props.defaultValue);
    const currentValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    const select = (event: Event) => {
      const next = (event.target as HTMLInputElement).value;
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = next;
      emit('update:modelValue', next);
      emit('change', next);
    };

    return () => {
      const id = props.id || `oods-segmentedcontrol-${generatedId}`;
      const label: VNodeChild = slots.label?.() ?? props.label;
      return h('div', {
        class: 'oods-field oods-segmented-control',
        'data-oods-component': 'SegmentedControl',
        'data-size': props.size,
      }, [
        h('span', { id: `${id}-label`, class: 'oods-field-label' }, [label]),
        h('div', {
          id,
          role: 'radiogroup',
          'aria-labelledby': `${id}-label`,
          class: 'oods-segmented-control__track',
        }, props.options.map((option) => h('label', { key: option.value, class: 'oods-segmented-control__option' }, [
          h('input', {
            type: 'radio',
            class: 'oods-segmented-control__input',
            name: props.name || id,
            value: option.value,
            checked: option.value === currentValue.value,
            disabled: props.disabled || option.disabled,
            onChange: select,
          }),
          h('span', { class: 'oods-segmented-control__label' }, option.label),
        ]))),
      ]);
    };
  },
});
