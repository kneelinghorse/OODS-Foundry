import { defineComponent, h } from 'vue';
export const TeamButton = defineComponent({
  inheritAttrs: false, props: ['caption', 'appearance', 'disabled', 'type'], emits: ['activate'],
  setup(props, { attrs, slots, emit }) { return () => h('button', { ...attrs, type: props.type ?? 'button', disabled: props.disabled,
    'data-team-component': 'Button', 'data-appearance': props.appearance ?? 'quiet',
    style: { color: 'var(--sys-text-primary)', background: 'var(--sys-surface-raised)', border: '2px solid currentColor', borderRadius: '10px', padding: '8px 16px' },
    onClick: (event: Event) => { if (typeof attrs.onClick === 'function') attrs.onClick(event); if (!event.defaultPrevented) emit('activate', event); } }, slots.default?.() ?? props.caption); },
});
export const TeamStatusBadge = defineComponent({
  inheritAttrs: false, props: ['state', 'value', 'label', 'content', 'tone'],
  setup(props, { slots }) { return () => h('span', { 'data-team-component': 'StatusBadge', 'data-state': props.state ?? props.value, 'data-tone': props.tone,
    style: { border: '2px solid currentColor', borderRadius: '4px', padding: '2px 8px' } }, slots.default?.() ?? props.label ?? props.content ?? ((props.state ?? props.value) ? String(props.state ?? props.value).replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'Unknown')); },
});
export const TeamInput = defineComponent({
  inheritAttrs: false, props: ['id', 'caption', 'help', 'validation', 'currentValue', 'modelValue', 'value', 'defaultValue'], emits: ['input', 'change', 'update', 'update:modelValue'],
  setup(props, { attrs, emit }) { return () => h('div', { 'data-team-component': 'Input' }, [
    h('label', { for: props.id }, props.caption), h('input', { ...attrs, id: props.id, value: props.currentValue ?? props.modelValue ?? props.value ?? props.defaultValue,
      'aria-invalid': props.validation?.state === 'error' || undefined,
      'aria-describedby': [props.help && `${props.id}-help`, props.validation?.message && `${props.id}-validation`].filter(Boolean).join(' ') || undefined,
      onInput: (event: Event) => { const value = (event.target as HTMLInputElement).value; emit('input', value); emit('update', value); emit('update:modelValue', value); },
      onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).value) }),
    props.help && h('div', { id: `${props.id}-help` }, props.help),
    props.validation?.message && h('div', { id: `${props.id}-validation`, role: props.validation.state === 'error' ? 'alert' : undefined }, props.validation.message),
  ]); },
});
export const BrokenButton = defineComponent({ inheritAttrs: false, setup() { return () => h('div', { 'data-team-component': 'BrokenButton' }, 'Unavailable action'); } });
