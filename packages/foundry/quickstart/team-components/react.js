import { createElement } from 'react';

export function TeamButton({ caption, appearance = 'quiet', children, onActivate, onClick, disabled, type = 'button', ...rest }) {
  return createElement('button', { ...rest, type, disabled, 'data-team-component': 'Button', 'data-appearance': appearance,
    style: { color: 'var(--sys-text-primary)', background: 'var(--sys-surface-raised)', border: '2px solid currentColor', borderRadius: 10, padding: '8px 16px', font: 'inherit' },
    onClick: event => { onClick?.(event); if (!event.defaultPrevented) onActivate?.(event); }
  }, children ?? caption);
}
