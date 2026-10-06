import * as React from 'react';
import type { TagInputProps } from '@oods/components-react';
import { InputGroup, InputGroupInput } from '@/registry/new-york-v4/ui/input-group';
import { Badge } from '@/registry/new-york-v4/ui/badge';

export const OodsTagInput = React.forwardRef<HTMLFieldSetElement, TagInputProps>(function OodsTagInput(
  { title, label, heading, name, description, subtitle, hint, tags, value, placeholder, children, className, onChange, onValueChange, onUpdate, ...props }, ref,
) {
  const firstText = (...values: Array<string | undefined>) => values.find(value => value?.trim());
  const titleText = firstText(title, label, heading, name) ?? 'Tag Input';
  const details = firstText(description, subtitle, hint);
  const inputId = React.useId();
  const items = (tags ?? []).flatMap(entry => {
    if (entry === undefined || entry === null) return [];
    if (typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const value = ['label', 'name', 'role', 'value', 'id'].map(key => record[key]).find(value => ['string', 'number', 'boolean'].includes(typeof value) && String(value).length > 0);
      return value === undefined ? [] : [String(value)];
    }
    const value = typeof entry === 'object' ? JSON.stringify(entry) : String(entry);
    return value ? [value] : [];
  });
  const authored = React.Children.toArray(children).some(node => typeof node !== 'string' || node.trim().length > 0);
  return <fieldset {...props} ref={ref} className={className} data-oods-component={undefined} data-oods-adapter="TagInput" data-form-type="tag-input">
    <legend className="font-medium">{titleText}</legend>
    {details ? <p className="text-sm text-muted-foreground">{details}</p> : null}
    {authored ? children : <>
      <label htmlFor={inputId} className="text-sm font-medium">Tag</label>
      <InputGroup><InputGroupInput id={inputId} type="text" name="tag" placeholder={firstText(placeholder)} value={value}
        onChange={event => { onChange?.(event); if (!event.defaultPrevented) { onValueChange?.(event.currentTarget.value); onUpdate?.(event.currentTarget.value); } }} /></InputGroup>
      {items.length ? <div data-tag-list="true" className="mt-2 flex flex-wrap gap-1">{items.map((tag, index) => <Badge key={index} variant="secondary" data-tag-item="true">{tag}</Badge>)}</div> : null}
    </>}
  </fieldset>;
});
