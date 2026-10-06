import * as React from 'react';
import type { SelectProps } from '@oods/components-react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export const OodsSelect = React.forwardRef<HTMLSelectElement, SelectProps>(function OodsSelect(
  { id, label, options = [], value, defaultValue, placeholder, required, disabled, name, help, description, validation,
    onChange, onValueChange, onUpdate, className, style, selectClassName, selectStyle, density, requiredIndicator,
    children, 'aria-describedby': describedBy, 'aria-label': ariaLabel }, ref,
) {
  const native = React.useRef<HTMLSelectElement>(null);
  React.useImperativeHandle(ref, () => native.current!);
  const [local, setLocal] = React.useState(String(defaultValue ?? ''));
  const selected = value === undefined ? local : String(value);
  const empty = '__oods_empty_option__';
  const details = help ?? description;
  const helpId = `${id}-help`, validationId = validation?.id ?? `${id}-validation`;
  const descriptions = [describedBy, details ? helpId : '', validation?.message ? validationId : ''].filter(Boolean).join(' ') || undefined;
  // Keep a real native change event for generated OODS handlers and native form submission.
  const change = (next: string | null) => {
    if (!native.current) return;
    native.current.value = next === empty ? '' : next ?? '';
    native.current.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return <div className={className} style={style} data-oods-component={undefined} data-oods-adapter="Select">
    <Label htmlFor={id}>{label}{required && requiredIndicator !== false ? <span aria-hidden="true"> *</span> : null}</Label>
    <select ref={native} name={name} value={selected} disabled={disabled} tabIndex={-1} aria-hidden="true" style={{ display: 'none' }}
      onChange={event => { onChange?.(event); if (!event.defaultPrevented) { const next = event.currentTarget.value; if (value === undefined) setLocal(next); onValueChange?.(next); onUpdate?.(next); } }}>
      <option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <Select value={selected || (options.some(option => option.value === '') ? empty : '')} disabled={disabled} required={required} onValueChange={change}>
      <SelectTrigger id={id} aria-label={ariaLabel} aria-describedby={descriptions} aria-invalid={validation?.state === 'error' || undefined}
        size={density === 'compact' ? 'sm' : 'default'} className={selectClassName} style={selectStyle}><SelectValue placeholder={placeholder}>{options.find(option => String(option.value) === selected)?.label ?? placeholder}</SelectValue></SelectTrigger>
      <SelectContent>{children ?? options.map(option => <SelectItem key={option.value} value={option.value || empty} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
    {details ? <p id={helpId} className="text-sm text-muted-foreground">{details}</p> : null}
    {validation?.message ? <p id={validationId} role={validation.state === 'error' ? 'alert' : undefined}>{validation.message}</p> : null}
  </div>;
});
