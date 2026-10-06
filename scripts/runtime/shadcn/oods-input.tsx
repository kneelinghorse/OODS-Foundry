import * as React from 'react';
import type { InputProps } from '@oods/components-react';
import { dateTimeInputValue } from '@oods/component-contracts';
import { Input } from '@/registry/new-york-v4/ui/input';
import { Label } from '@/registry/new-york-v4/ui/label';

export const OodsInput = React.forwardRef<HTMLInputElement, InputProps>(function OodsInput(
  { id, label, help, description, validation, density = 'comfortable', requiredIndicator, className, style,
    inputClassName, inputStyle, onChange, onValueChange, onUpdate, required, type = 'text', 'aria-describedby': describedBy, ...props }, ref,
) {
  if (type === 'datetime-local') {
    if (props.value !== undefined) props.value = dateTimeInputValue(props.value);
    if (props.defaultValue !== undefined) props.defaultValue = dateTimeInputValue(props.defaultValue);
  }
  const details = help ?? description;
  const validationId = validation?.id ?? `${id}-validation`;
  const descriptions = [describedBy, details ? `${id}-description` : '', validation?.message ? validationId : ''].filter(Boolean).join(' ') || undefined;
  return <div className={className} style={style} data-density={density} data-validation-state={validation?.state} data-oods-component={undefined} data-oods-adapter="Input">
    <Label htmlFor={id}>{label}{required && requiredIndicator !== null ? requiredIndicator ?? <span aria-hidden="true"> *</span> : null}</Label>
    <Input {...props} ref={ref} id={id} type={type} required={required} className={[density === 'compact' ? 'py-1' : '', inputClassName].filter(Boolean).join(' ')} style={inputStyle}
      data-oods-component={undefined} data-validation-state={validation?.state} aria-describedby={descriptions} aria-invalid={props['aria-invalid'] ?? (validation?.state === 'error' || undefined)}
      onChange={event => { onChange?.(event); if (!event.defaultPrevented) { onValueChange?.(event.currentTarget.value); onUpdate?.(event.currentTarget.value); } }} />
    {details ? <p id={`${id}-description`} className="text-sm text-muted-foreground">{details}</p> : null}
    {validation?.message ? <p id={validationId} role={validation.state === 'error' ? 'alert' : 'status'} aria-live={validation.state === 'error' ? 'assertive' : 'polite'}>{validation.message}</p> : null}
  </div>;
});
