import * as React from 'react';

import { StatusIcon } from './status-icon.js';
import type { ComboboxProps } from './types.js';

const classes = (...values: Array<string | false | null | undefined>): string => values.filter(Boolean).join(' ');

/**
 * s223-m02 (#2527 ruling 11): pick one value from a list by typing to filter it, in one markup with Vue and the HTML
 * renderer. It follows the WAI-ARIA combobox pattern with a listbox popup: focus stays in the input, and the active option
 * is its aria-activedescendant. Typing filters the options to those whose label contains the text, ignoring case, and
 * opens the list. Down opens the list and moves, Up moves (and opens the list at its end), Home and End go to the ends of
 * an open list, Enter picks the active option, Escape closes the list and, with the list closed, clears the field, and
 * Tab closes the list without picking. Disabled options are skipped and cannot be picked. Leaving the field restores the
 * chosen label.
 */
export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      id,
      label,
      options = [],
      value,
      defaultValue = '',
      placeholder,
      name,
      required,
      disabled,
      help,
      validation,
      size = 'md',
      className,
      style,
      onValueChange,
      onUpdate,
      onKeyDown,
      onBlur,
      onClick,
      'aria-describedby': nativeDescription,
      ...rest
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const [query, setQuery] = React.useState<string | null>(null);
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState(-1);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listboxRef = React.useRef<HTMLUListElement>(null);

    const chosenValue = value ?? internalValue;
    const chosen = options.find(option => option.value === chosenValue);
    const text = query ?? chosen?.label ?? '';
    const needle = (query ?? '').trim().toLowerCase();
    const matches = options.map(option => needle === '' || option.label.toLowerCase().includes(needle));
    const matchCount = matches.filter(Boolean).length;
    // The options the keyboard can reach: shown by the filter and not disabled, in list order.
    const reachable = options.flatMap((option, index) => (matches[index] && !option.disabled ? [index] : []));
    const optionId = (index: number) => `${id}-option-${index}`;
    const validationId = validation?.id ?? `${id}-validation`;
    const describedBy = [nativeDescription, help ? `${id}-help` : undefined, validation?.message ? validationId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
    const tone = validation ? (validation.state === 'error' ? 'critical' : validation.state) : undefined;

    const close = () => {
      setOpen(false);
      setActive(-1);
    };
    const emit = (next: string) => {
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
      onUpdate?.(next);
    };
    const pick = (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      setQuery(null);
      close();
      if (option.value !== chosenValue) emit(option.value);
    };

    // An outside click closes the list; a click inside keeps the input focused (the popup's mousedown is prevented).
    React.useEffect(() => {
      if (!open) return undefined;
      const outside = (event: Event) => {
        if (!rootRef.current?.contains(event.target as Node)) close();
      };
      document.addEventListener('pointerdown', outside);
      return () => document.removeEventListener('pointerdown', outside);
    }, [open]);

    // The active option stays in view inside the scrolling popup.
    React.useEffect(() => {
      if (!open || active < 0) return;
      const element = listboxRef.current?.children[active] as HTMLElement | undefined;
      element?.scrollIntoView?.({ block: 'nearest' });
    }, [open, active]);

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = event => {
      onKeyDown?.(event);
      // While an input method composes text, Enter and the arrows belong to it.
      if (event.defaultPrevented || disabled || event.nativeEvent.isComposing) return;
      const first = reachable[0] ?? -1;
      const last = reachable[reachable.length - 1] ?? -1;
      const at = reachable.indexOf(active);
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setOpen(true);
          setActive(!open || at === -1 ? first : reachable[(at + 1) % reachable.length]!);
          return;
        case 'ArrowUp':
          event.preventDefault();
          setOpen(true);
          setActive(!open || at <= 0 ? last : reachable[at - 1]!);
          return;
        case 'Home':
        case 'End':
          // With the list closed they move the caret, as in any text field.
          if (!open) return;
          event.preventDefault();
          setActive(event.key === 'Home' ? first : last);
          return;
        case 'Enter':
          if (!open) return;
          event.preventDefault();
          if (active >= 0) pick(active);
          return;
        case 'Escape':
          if (open) {
            event.preventDefault();
            close();
            return;
          }
          // Nothing to clear: the key goes on, so a dialog around the field still closes.
          if (text === '' && chosenValue === '') return;
          event.preventDefault();
          setQuery(null);
          if (chosenValue !== '') emit('');
          return;
        case 'Tab':
          if (open) close();
          return;
        default:
      }
    };

    return (
      <div
        ref={rootRef}
        className={classes('oods-field', 'oods-combobox', className)}
        style={{
          ...(tone
            ? {
                '--cmp-input-message-border': `var(--sys-status-${tone}-border)`,
                '--cmp-input-message-text': `var(--sys-status-${tone}-text)`,
              }
            : {}),
          ...style,
        } as React.CSSProperties}
        data-oods-component="Combobox"
        data-size={size}
        data-validation-state={validation?.state}
      >
        <label id={`${id}-label`} className="oods-field-label" htmlFor={id}>
          {label}
          {required ? <span className="oods-field-required" aria-hidden="true">*</span> : null}
        </label>
        <div className="oods-combobox__control">
          <input
            {...rest}
            ref={ref}
            id={id}
            type="text"
            role="combobox"
            className="oods-field-control oods-combobox__input"
            value={text}
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-describedby={describedBy}
            aria-invalid={validation?.state === 'error' || undefined}
            required={required}
            disabled={disabled}
            onChange={event => {
              setQuery(event.currentTarget.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={handleKeyDown}
            onClick={event => {
              onClick?.(event);
              if (!event.defaultPrevented && !disabled) setOpen(true);
            }}
            onBlur={event => {
              onBlur?.(event);
              setQuery(null);
              close();
            }}
          />
          <span className="oods-combobox__chevron" aria-hidden="true">
            <StatusIcon name="chevron-down" />
          </span>
          <div className="oods-combobox__popup" hidden={!open} onMouseDown={event => event.preventDefault()}>
            <ul ref={listboxRef} id={`${id}-listbox`} className="oods-combobox__listbox" role="listbox" aria-labelledby={`${id}-label`}>
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  className="oods-combobox__option"
                  role="option"
                  aria-selected={option.value === chosenValue}
                  aria-disabled={option.disabled || undefined}
                  data-value={option.value}
                  data-active={index === active ? 'true' : undefined}
                  hidden={!matches[index]}
                  onClick={() => pick(index)}
                  onPointerMove={() => {
                    if (!option.disabled && index !== active) setActive(index);
                  }}
                >
                  <span className="oods-combobox__option-label">{option.label}</span>
                  <span className="oods-combobox__check" aria-hidden="true">
                    <StatusIcon name="check" />
                  </span>
                </li>
              ))}
            </ul>
            <p className="oods-combobox__empty" role="status">{open && matchCount === 0 ? 'No matches' : ''}</p>
          </div>
        </div>
        {name ? <input type="hidden" name={name} value={chosenValue} /> : null}
        {help ? <p id={`${id}-help`} className="oods-field-help">{help}</p> : null}
        {validation?.message ? (
          <p id={validationId} className="oods-field-error" role={validation.state === 'error' ? 'alert' : undefined}>
            {validation.message}
          </p>
        ) : null}
      </div>
    );
  }
);
Combobox.displayName = 'OODS.Combobox';
