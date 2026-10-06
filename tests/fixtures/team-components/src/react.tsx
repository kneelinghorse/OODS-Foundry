import React from 'react';

// Authored team components. Renamed props force Forge's substitution to do real work.
export function TeamButton({ caption, appearance = 'quiet', children, onActivate, onClick, disabled, type = 'button', ...rest }: any) {
  return <button {...rest} type={type} disabled={disabled} data-team-component="Button" data-appearance={appearance}
    style={{ color: 'var(--sys-text-primary)', background: 'var(--sys-surface-raised)', border: '2px solid currentColor', borderRadius: 10, padding: '8px 16px' }}
    onClick={event => { onClick?.(event); if (!event.defaultPrevented) onActivate?.(event); }}>{children ?? caption}</button>;
}
export function TeamStatusBadge({ state, value, label, content, children, tone, ...rest }: any) {
  state ??= value;
  const text = children ?? label ?? content ?? (state ? String(state).replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'Unknown');
  return <span data-team-component="StatusBadge" data-state={state} data-tone={tone} style={{ border: '2px solid currentColor', borderRadius: 4, padding: '2px 8px' }}>{text}</span>;
}
export function TeamInput({ id, caption, currentValue, help, validation, onValueChange, onUpdate, onChange, ...rest }: any) {
  const described = [help && `${id}-help`, validation?.message && `${id}-validation`].filter(Boolean).join(' ') || undefined;
  return <div data-team-component="Input"><label htmlFor={id}>{caption}</label><input {...rest} value={currentValue ?? rest.value} id={id} aria-describedby={described} aria-invalid={validation?.state === 'error' || undefined}
    onChange={event => { onChange?.(event); onValueChange?.(event.currentTarget.value); onUpdate?.(event.currentTarget.value); }} />
    {help && <div id={`${id}-help`}>{help}</div>}{validation?.message && <div id={`${id}-validation`} role={validation.state === 'error' ? 'alert' : undefined}>{validation.message}</div>}</div>;
}
// Negative control: drops the supplied name, native role, activation and disabled semantics.
export function BrokenButton() { return <div data-team-component="BrokenButton">Unavailable action</div>; }
