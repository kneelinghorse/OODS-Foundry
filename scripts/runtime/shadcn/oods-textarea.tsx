import * as React from 'react';
import type { TextareaProps } from '@oods/components-react';
import { Textarea } from '@/registry/new-york-v4/ui/textarea';
import { Label } from '@/registry/new-york-v4/ui/label';

export const OodsTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function OodsTextarea(
  { id, label, help, description, validation, density = 'comfortable', requiredIndicator, className, style,
    textareaClassName, textareaStyle, onChange, onValueChange, onUpdate, required, rows = 4, 'aria-describedby': describedBy, ...props }, ref,
) {

  const details = help ?? description;
  const validationId = validation?.id ?? `${id}-validation`;
  const descriptions = [describedBy, details ? `${id}-description` : '', validation?.message ? validationId : ''].filter(Boolean).join(' ') || undefined;
  return <div className={className} style={style} data-density={density} data-validation-state={validation?.state} data-oods-component={undefined} data-oods-adapter="Textarea">
    <Label htmlFor={id}>{label}{required && requiredIndicator !== null ? requiredIndicator ?? <span aria-hidden="true"> *</span> : null}</Label>
    <Textarea {...props} ref={ref} id={id} rows={rows} required={required} className={[density === 'compact' ? 'py-1' : '', textareaClassName].filter(Boolean).join(' ')} style={textareaStyle}
      data-oods-component={undefined} data-validation-state={validation?.state} aria-describedby={descriptions} aria-invalid={props['aria-invalid'] ?? (validation?.state === 'error' || undefined)}
      onChange={event => { onChange?.(event); if (!event.defaultPrevented) { onValueChange?.(event.currentTarget.value); onUpdate?.(event.currentTarget.value); } }} />
    {details ? <p id={`${id}-description`} className="text-sm text-muted-foreground">{details}</p> : null}
    {validation?.message ? <p id={validationId} role={validation.state === 'error' ? 'alert' : 'status'} aria-live={validation.state === 'error' ? 'assertive' : 'polite'}>{validation.message}</p> : null}
  </div>;
});
