import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
  type PropType,
  type VNodeChild,
} from 'vue';

import { statusIcon } from './status-icon.js';
import type { ComboboxOption, ValidationMessage } from './types.js';

/**
 * s223-m02 (#2527 ruling 11): pick one value from a list by typing to filter it, in one markup with React and the HTML
 * renderer. It follows the WAI-ARIA combobox pattern with a listbox popup: focus stays in the input, and the active option
 * is its aria-activedescendant. Typing filters the options to those whose label contains the text, ignoring case, and
 * opens the list. Down opens the list and moves, Up moves (and opens the list at its end), Home and End go to the ends of
 * an open list, Enter picks the active option, Escape closes the list and, with the list closed, clears the field, and
 * Tab closes the list without picking. Disabled options are skipped and cannot be picked. Leaving the field restores the
 * chosen label. Picking emits update:modelValue and change with the option's value.
 */
export const Combobox = defineComponent({
  name: 'OodsCombobox',
  props: {
    id: String,
    label: String,
    options: { type: Array as PropType<readonly ComboboxOption[]>, default: () => [] },
    modelValue: String,
    value: String,
    defaultValue: { type: String, default: '' },
    placeholder: String,
    name: String,
    required: Boolean,
    disabled: Boolean,
    help: String,
    validation: Object as PropType<ValidationMessage>,
    /** The control height, as Button, Input and Select: xs 24, sm 28, md 32 (default) or lg 40. */
    size: { type: String as PropType<'xs' | 'sm' | 'md' | 'lg'>, default: 'md' },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const generatedId = useId();
    const controlId = computed(() => props.id || `oods-combobox-${generatedId}`);
    const internalValue = ref(props.defaultValue);
    const query = ref<string | null>(null);
    const open = ref(false);
    const active = ref(-1);
    const root = ref<HTMLElement | null>(null);
    const listbox = ref<HTMLElement | null>(null);

    const chosenValue = computed(() => props.modelValue ?? props.value ?? internalValue.value);
    const chosen = computed(() => props.options.find((option) => option.value === chosenValue.value));
    const text = computed(() => query.value ?? chosen.value?.label ?? '');
    const matches = computed(() => {
      const needle = (query.value ?? '').trim().toLowerCase();
      return props.options.map((option) => needle === '' || option.label.toLowerCase().includes(needle));
    });
    // The options the keyboard can reach: shown by the filter and not disabled, in list order.
    const reachable = computed(() => props.options.flatMap((option, index) => (matches.value[index] && !option.disabled ? [index] : [])));
    const optionId = (index: number) => `${controlId.value}-option-${index}`;

    const close = () => {
      open.value = false;
      active.value = -1;
    };
    const commit = (next: string) => {
      if (props.modelValue === undefined && props.value === undefined) internalValue.value = next;
      emit('update:modelValue', next);
      emit('change', next);
    };
    const pick = (index: number) => {
      const option = props.options[index];
      if (!option || option.disabled) return;
      query.value = null;
      close();
      if (option.value !== chosenValue.value) commit(option.value);
    };

    // An outside click closes the list; a click inside keeps the input focused (the popup's mousedown is prevented).
    const outside = (event: Event) => {
      if (!root.value?.contains(event.target as Node)) close();
    };
    watch(open, (isOpen) => {
      if (isOpen) document.addEventListener('pointerdown', outside);
      else document.removeEventListener('pointerdown', outside);
    });
    onBeforeUnmount(() => {
      if (typeof document !== 'undefined') document.removeEventListener('pointerdown', outside);
    });

    // The active option stays in view inside the scrolling popup.
    watch([open, active], async () => {
      if (!open.value || active.value < 0) return;
      await nextTick();
      const element = listbox.value?.children[active.value] as HTMLElement | undefined;
      element?.scrollIntoView?.({ block: 'nearest' });
    });

    const keydown = (event: KeyboardEvent) => {
      // While an input method composes text, Enter and the arrows belong to it.
      if (event.defaultPrevented || props.disabled || event.isComposing) return;
      const order = reachable.value;
      const first = order[0] ?? -1;
      const last = order[order.length - 1] ?? -1;
      const at = order.indexOf(active.value);
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          active.value = !open.value || at === -1 ? first : order[(at + 1) % order.length]!;
          open.value = true;
          return;
        case 'ArrowUp':
          event.preventDefault();
          active.value = !open.value || at <= 0 ? last : order[at - 1]!;
          open.value = true;
          return;
        case 'Home':
        case 'End':
          // With the list closed they move the caret, as in any text field.
          if (!open.value) return;
          event.preventDefault();
          active.value = event.key === 'Home' ? first : last;
          return;
        case 'Enter':
          if (!open.value) return;
          event.preventDefault();
          if (active.value >= 0) pick(active.value);
          return;
        case 'Escape':
          if (open.value) {
            event.preventDefault();
            close();
            return;
          }
          // Nothing to clear: the key goes on, so a dialog around the field still closes.
          if (text.value === '' && chosenValue.value === '') return;
          event.preventDefault();
          query.value = null;
          if (chosenValue.value !== '') commit('');
          return;
        case 'Tab':
          if (open.value) close();
          return;
        default:
      }
    };

    return () => {
      const id = controlId.value;
      const label: VNodeChild = slots.label?.() ?? props.label;
      const help: VNodeChild = slots.help?.() ?? props.help;
      const validation: VNodeChild = slots.validation?.() ?? props.validation?.message;
      const tone = props.validation ? (props.validation.state === 'error' ? 'critical' : props.validation.state) : undefined;
      const describedBy = [help ? `${id}-help` : undefined, validation ? `${id}-validation` : undefined].filter(Boolean).join(' ') || undefined;
      const noMatches = open.value && !matches.value.some(Boolean);
      return h('div', {
        ref: root,
        class: 'oods-field oods-combobox',
        ...(tone ? { style: { '--cmp-input-message-border': `var(--sys-status-${tone}-border)`, '--cmp-input-message-text': `var(--sys-status-${tone}-text)` } } : {}),
        'data-oods-component': 'Combobox',
        'data-size': props.size,
        'data-validation-state': props.validation?.state,
      }, [
        h('label', { id: `${id}-label`, class: 'oods-field-label', for: id }, [
          label,
          props.required ? h('span', { class: 'oods-field-required', 'aria-hidden': 'true' }, '*') : null,
        ]),
        h('div', { class: 'oods-combobox__control' }, [
          h('input', {
            id,
            type: 'text',
            role: 'combobox',
            class: 'oods-field-control oods-combobox__input',
            value: text.value,
            placeholder: props.placeholder,
            autocomplete: 'off',
            'aria-autocomplete': 'list',
            'aria-expanded': open.value ? 'true' : 'false',
            'aria-controls': `${id}-listbox`,
            'aria-activedescendant': open.value && active.value >= 0 ? optionId(active.value) : undefined,
            'aria-describedby': describedBy,
            'aria-invalid': props.validation?.state === 'error' ? 'true' : undefined,
            required: props.required,
            disabled: props.disabled,
            onInput: (event: Event) => {
              query.value = (event.target as HTMLInputElement).value;
              open.value = true;
              active.value = -1;
            },
            onKeydown: keydown,
            onClick: () => {
              if (!props.disabled) open.value = true;
            },
            onBlur: () => {
              query.value = null;
              close();
            },
          }),
          h('span', { class: 'oods-combobox__chevron', 'aria-hidden': 'true' }, [statusIcon('chevron-down')]),
          h('div', {
            class: 'oods-combobox__popup',
            hidden: !open.value,
            onMousedown: (event: MouseEvent) => event.preventDefault(),
          }, [
            h('ul', { ref: listbox, id: `${id}-listbox`, class: 'oods-combobox__listbox', role: 'listbox', 'aria-labelledby': `${id}-label` },
              props.options.map((option, index) => h('li', {
                key: option.value,
                id: optionId(index),
                class: 'oods-combobox__option',
                role: 'option',
                'aria-selected': option.value === chosenValue.value ? 'true' : 'false',
                'aria-disabled': option.disabled ? 'true' : undefined,
                'data-value': option.value,
                'data-active': index === active.value ? 'true' : undefined,
                hidden: !matches.value[index],
                onClick: () => pick(index),
                onPointermove: () => {
                  if (!option.disabled && index !== active.value) active.value = index;
                },
              }, [
                h('span', { class: 'oods-combobox__option-label' }, option.label),
                h('span', { class: 'oods-combobox__check', 'aria-hidden': 'true' }, [statusIcon('check')]),
              ]))),
            h('p', { class: 'oods-combobox__empty', role: 'status' }, noMatches ? 'No matches' : ''),
          ]),
        ]),
        props.name ? h('input', { type: 'hidden', name: props.name, value: chosenValue.value }) : null,
        help ? h('p', { id: `${id}-help`, class: 'oods-field-help' }, help) : null,
        validation
          ? h('p', { id: `${id}-validation`, class: 'oods-field-error', role: props.validation?.state === 'error' ? 'alert' : undefined }, validation)
          : null,
      ]);
    };
  },
});
