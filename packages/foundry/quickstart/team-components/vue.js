import { defineComponent, h } from 'vue';

export const TeamButton = defineComponent({
  inheritAttrs: false, props: ['caption', 'appearance', 'disabled', 'type'], emits: ['activate'],
  setup(props, { attrs, slots, emit }) {
    return () => h('button', { ...attrs, type: props.type ?? 'button', disabled: props.disabled,
      'data-team-component': 'Button', 'data-appearance': props.appearance ?? 'quiet',
      style: { color: 'var(--sys-text-primary)', background: 'var(--sys-surface-raised)', border: '2px solid currentColor', borderRadius: '10px', padding: '8px 16px', font: 'inherit' },
      onClick: event => { if (typeof attrs.onClick === 'function') attrs.onClick(event); if (!event.defaultPrevented) emit('activate', event); }
    }, slots.default?.() ?? props.caption);
  }
});
