import * as React from 'react';
import type { SearchInputProps } from '@oods/components-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const OodsSearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function OodsSearchInput(
  { id, label = 'Search', value, defaultValue = '', placeholder = 'Search…', clearable = true, debounceMs, debounce,
    minQueryLength = 0, field, placeholderParameter, debounceParameter, minQueryLengthParameter, clearableParameter,
    onChange, onValueChange, onUpdate, onSearch, onClear, onKeyDown, className, disabled, ...props }, ref,
) {
  void [field, placeholderParameter, debounceParameter, minQueryLengthParameter, clearableParameter];
  const instance = React.useId();
  const inputId = id ?? `oods-search-${instance.replaceAll(':', '')}`;
  const [local, setLocal] = React.useState(defaultValue);
  const current = value ?? local;
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const update = (next: string) => {
    if (value === undefined) setLocal(next);
    clearTimeout(timer.current);
    const emit = () => { if (next.length >= minQueryLength || next === '') { onValueChange?.(next); onUpdate?.(next); onSearch?.(next); } };
    const delay = Math.max(0, debounceMs ?? debounce ?? 0);
    if (delay) timer.current = setTimeout(emit, delay); else emit();
  };
  const clear = () => { onClear?.(); update(''); };
  return <div role="search" aria-label={label} className={className} data-oods-component={undefined} data-oods-adapter="SearchInput">
    <Label htmlFor={inputId}>{label}</Label><div className="flex gap-2">
      <Input {...props} ref={ref} id={inputId} type="search" placeholder={placeholder} disabled={disabled} value={current}
        onChange={event => { onChange?.(event); if (!event.defaultPrevented) update(event.currentTarget.value); }}
        onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'Escape' && current) clear(); }} />
      {clearable && current ? <Button type="button" variant="ghost" disabled={disabled} aria-label="Clear search" onClick={clear}>×</Button> : null}
    </div>
  </div>;
});
