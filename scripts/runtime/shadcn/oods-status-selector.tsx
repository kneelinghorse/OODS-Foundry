import * as React from 'react';
import type { StatusSelectorProps } from '@oods/components-react';
import { formatReadOnlyValue } from '@oods/component-contracts';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/registry/new-york-v4/ui/select';

export const OodsStatusSelector = React.forwardRef<HTMLDivElement, StatusSelectorProps>(function OodsStatusSelector(
  { label, title, help, options, states, value, status, children, className, onChange, onValueChange, onUpdate, ...props }, ref,
) {
  const instance = React.useId();
  const native = React.useRef<HTMLSelectElement>(null);
  const choices = (options ?? states ?? ['draft', 'active', 'inactive']).flatMap(entry => {
    if (entry === undefined || entry === null) return [];
    if (typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const text = (key: string) => typeof record[key] === 'string' && record[key].length > 0 ? record[key] as string : undefined;
      const value = text('value') ?? text('id') ?? text('label') ?? '';
      const label = text('label') ?? text('name') ?? formatReadOnlyValue(value, 'string', true);
      return value || label ? [{ value, label }] : [];
    }
    const value = typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
    return value ? [{ value, label: formatReadOnlyValue(value, 'string', true) }] : [];
  });
  const [local, setLocal] = React.useState(status?.trim() ? status : choices[0]?.value ?? '');
  const selected = value ?? local;
  const empty = '__oods_empty_option__';
  const labelText = [label, title].find(value => value?.trim()) ?? 'Status';
  const authored = React.Children.toArray(children).some(node => typeof node !== 'string' || node.trim().length > 0);
  return <div {...props} ref={ref} className={className} data-oods-component={undefined} data-oods-adapter="StatusSelector" data-summary-type="status-selector">
    {authored ? children : <>
      <label id={`${instance}-label`} htmlFor={instance} className="text-sm font-medium">{labelText}</label>
      <select ref={native} name="status" value={selected} tabIndex={-1} aria-hidden="true" style={{ display: 'none' }}
        onChange={event => { onChange?.(event); if (!event.defaultPrevented) { const next = event.currentTarget.value; if (value === undefined) setLocal(next); onValueChange?.(next); onUpdate?.(next); } }}>
        {choices.length ? choices.map((choice, index) => <option key={index} value={choice.value}>{choice.label}</option>) : <option value="">Select...</option>}
      </select>
      <Select value={selected || empty} onValueChange={next => { if (native.current) { native.current.value = next === empty ? '' : next ?? ''; native.current.dispatchEvent(new Event('change', { bubbles: true })); } }}>
        <SelectTrigger id={instance} aria-labelledby={`${instance}-label`} aria-describedby={help ? `${instance}-help` : undefined}><SelectValue>{choices.find(choice => choice.value === selected)?.label ?? 'Select...'}</SelectValue></SelectTrigger>
        <SelectContent>{choices.length ? choices.map((choice, index) => <SelectItem key={index} value={choice.value || empty}>{choice.label}</SelectItem>) : <SelectItem value={empty}>Select...</SelectItem>}</SelectContent>
      </Select>
    </>}
    {help ? <p id={`${instance}-help`} className="text-sm text-muted-foreground">{help}</p> : null}
  </div>;
});
