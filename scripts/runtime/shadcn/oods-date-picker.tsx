import * as React from 'react';
import type { DatePickerProps } from '@oods/components-react';
import { Input } from '@/registry/new-york-v4/ui/input';
import { Label } from '@/registry/new-york-v4/ui/label';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Calendar } from '@/registry/new-york-v4/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/registry/new-york-v4/ui/popover';

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateValue(date) === value ? date : undefined;
};

export const OodsDatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(function OodsDatePicker(
  { id, label, help, description, validation, density = 'comfortable', requiredIndicator, className, style,
    inputClassName, inputStyle, pickerClassName, pickerStyle, onChange, onValueChange, onUpdate, required,
    value, defaultValue, disabled, readOnly, min, max, step, 'aria-describedby': describedBy, ...props }, ref,
) {
  const native = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => native.current!);
  const [local, setLocal] = React.useState(String(defaultValue ?? ''));
  const [open, setOpen] = React.useState(false);
  const selected = value === undefined ? local : String(value);
  const details = help ?? description;
  const validationId = validation?.id ?? `${id}-validation`;
  const descriptions = [describedBy, details ? `${id}-description` : '', validation?.message ? validationId : ''].filter(Boolean).join(' ') || undefined;
  const disallowed = (date: Date) => {
    const next = dateValue(date);
    if ((parseDate(min) && next < String(min)) || (parseDate(max) && next > String(max))) return true;
    const interval = step === 'any' ? 1 : Number(step ?? 1);
    const base = parseDate(min) ?? parseDate(String(value ?? defaultValue ?? '')) ?? new Date('1970-01-01T12:00:00');
    return interval > 0 && Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86400000) % interval !== 0;
  };
  const choose = (next: string) => {
    if (!native.current || disabled || readOnly) return;
    // Bypass React's value tracker so the existing native onChange contract sees the calendar edit.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(native.current, next);
    native.current.dispatchEvent(new Event('input', { bubbles: true }));
    setOpen(false);
    native.current.focus();
  };
  return <div className={className} style={style} data-density={density} data-validation-state={validation?.state} data-oods-component={undefined} data-oods-adapter="DatePicker">
    <Label htmlFor={id}>{label}{required && requiredIndicator !== null ? requiredIndicator ?? <span aria-hidden="true"> *</span> : null}</Label>
    <div className="flex items-center gap-2">
      <Input {...props} ref={native} id={id} type="date" value={value} defaultValue={defaultValue} disabled={disabled} readOnly={readOnly} required={required} min={min} max={max} step={step}
        className={[inputClassName, pickerClassName].filter(Boolean).join(' ')} style={{ ...inputStyle, ...pickerStyle }} data-oods-component={undefined}
        aria-describedby={descriptions} aria-invalid={props['aria-invalid'] ?? (validation?.state === 'error' || undefined)}
        onChange={event => { onChange?.(event); const next = event.currentTarget.value; if (value === undefined) setLocal(next); if (!event.defaultPrevented) { onValueChange?.(next); onUpdate?.(next); } }} />
      <Popover open={open} onOpenChange={next => { if (next && value === undefined) setLocal(native.current?.value ?? ''); setOpen(next); }}>
        <PopoverTrigger disabled={disabled || readOnly} aria-label={`Open calendar for ${typeof label === 'string' ? label : id}`} className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm text-foreground">Calendar</PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <Calendar mode="single" selected={parseDate(selected)} defaultMonth={parseDate(selected)} disabled={disallowed} onSelect={date => { if (date) choose(dateValue(date)); }} />
          <Button type="button" variant="ghost" onClick={() => choose('')}>Clear date</Button>
        </PopoverContent>
      </Popover>
    </div>
    {details ? <p id={`${id}-description`} className="text-sm text-muted-foreground">{details}</p> : null}
    {validation?.message ? <p id={validationId} role={validation.state === 'error' ? 'alert' : 'status'} aria-live={validation.state === 'error' ? 'assertive' : 'polite'}>{validation.message}</p> : null}
  </div>;
});
