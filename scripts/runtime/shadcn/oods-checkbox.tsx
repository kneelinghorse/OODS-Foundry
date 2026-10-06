import * as React from 'react';
import type { CheckboxProps } from '@oods/components-react';
import { Checkbox } from '@/registry/new-york-v4/ui/checkbox';
import { Label } from '@/registry/new-york-v4/ui/label';

export const OodsCheckbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function OodsCheckbox(
  { id, label, help, description, validation, density = 'comfortable', requiredIndicator, className, style,
    checkboxClassName, checkboxStyle, onChange, onCheckedChange, onUpdate, required, checked, defaultChecked,
    disabled, readOnly, 'aria-describedby': describedBy, 'aria-label': ariaLabel, ...props }, ref,
) {
  const native = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => native.current!);
  const [local, setLocal] = React.useState(defaultChecked ?? false);
  const selected = checked ?? local;
  const resetting = React.useRef(false);
  React.useEffect(() => {
    const input = native.current;
    const form = input?.form;
    if (!input || !form) return;
    const reset = (event: Event) => {
      // Team checkbox primitives also observe reset. Preserve native reset's lack of change events.
      resetting.current = true;
      queueMicrotask(() => {
        resetting.current = false;
        if (!event.defaultPrevented && checked === undefined) {
          // The browser resets the property without running React's native value setter.
          input.checked = input.checked;
          setLocal(input.checked);
        }
      });
    };
    form.addEventListener('reset', reset, true);
    return () => form.removeEventListener('reset', reset, true);
  }, [checked, props.form]);
  const details = help ?? description;
  const validationId = validation?.id ?? `${id}-validation`;
  const descriptions = [describedBy, details ? `${id}-description` : '', validation?.message ? validationId : ''].filter(Boolean).join(' ') || undefined;
  return <div className={className} style={style} data-density={density} data-validation-state={validation?.state} data-oods-component={undefined} data-oods-adapter="Checkbox">
    <input {...props} ref={native} type="checkbox" checked={checked} defaultChecked={checked === undefined ? defaultChecked : undefined} disabled={disabled} readOnly={readOnly} required={required}
      className="sr-only" tabIndex={-1} aria-hidden="true" data-oods-component={undefined}
      onChange={event => { onChange?.(event); if (!event.defaultPrevented) { const next = event.currentTarget.checked; if (checked === undefined) setLocal(next); onCheckedChange?.(next); onUpdate?.(next); } }} />
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={selected} disabled={disabled} required={required} aria-readonly={readOnly || undefined}
        className={checkboxClassName} style={checkboxStyle} aria-label={ariaLabel} aria-describedby={descriptions} aria-invalid={props['aria-invalid'] ?? (validation?.state === 'error' || undefined)}
        onCheckedChange={() => { if (!readOnly && !resetting.current) native.current?.click(); }} />
      <Label htmlFor={id}>{label}{required && requiredIndicator !== null ? requiredIndicator ?? <span aria-hidden="true"> *</span> : null}</Label>
    </div>
    {details ? <p id={`${id}-description`} className="text-sm text-muted-foreground">{details}</p> : null}
    {validation?.message ? <p id={validationId} role={validation.state === 'error' ? 'alert' : 'status'} aria-live={validation.state === 'error' ? 'assertive' : 'polite'}>{validation.message}</p> : null}
  </div>;
});
