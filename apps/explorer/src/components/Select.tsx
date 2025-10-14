import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
};

/**
 * Select implemented with button + listbox pattern.
 * Keyboard: ArrowUp/Down, Home/End, Enter/Space (select), Escape (close), optional type-to-search.
 * Visuals are token-driven via CSS classes; no inline color literals.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    { options, value, defaultValue, onChange, placeholder = 'Select…', ariaLabel, disabled, className, name },
    ref
  ) => {
    const isControlled = typeof value !== 'undefined';
    const [internal, setInternal] = useState<string | undefined>(defaultValue);
    const selectedValue = isControlled ? value : internal;

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const listboxRef = useRef<HTMLUListElement | null>(null);
    const portalRef = useRef<HTMLDivElement | null>(null);
    const composedRef = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [ref]
    );

    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const idBase = useId();
    const listboxId = `cmp-select-list-${idBase}`;
    const optionId = (idx: number) => `cmp-select-opt-${idBase}-${idx}`;

    const enabledIndexes = useMemo(() => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [options]);
    const selectedIndex = useMemo(() => options.findIndex((o) => o.value === selectedValue), [options, selectedValue]);

    const setSelected = useCallback(
      (next: string) => {
        if (!isControlled) setInternal(next);
        onChange?.(next);
      },
      [isControlled, onChange]
    );

    const openWithIndex = (idx: number) => {
      setOpen(true);
      setActiveIndex(idx);
      // focus into listbox after open
      requestAnimationFrame(() => {
        listboxRef.current?.focus();
      });
    };

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const onDocMouseDown = (e: MouseEvent) => {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t)) return;
        if (portalRef.current?.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener('mousedown', onDocMouseDown);
      return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [open]);

    // Type-to-search buffer
    const searchBuf = useRef<string>('');
    const searchTimeout = useRef<number | undefined>(undefined);

    const applyTypeahead = (key: string) => {
      const isChar = key.length === 1 && /[\p{L}\p{N}\s]/u.test(key);
      if (!isChar) return false;
      window.clearTimeout(searchTimeout.current);
      searchBuf.current += key.toLowerCase();
      const idx = options.findIndex((o) => !o.disabled && typeof o.label === 'string' && o.label.toLowerCase().startsWith(searchBuf.current));
      if (idx >= 0) setActiveIndex(idx);
      searchTimeout.current = window.setTimeout(() => {
        searchBuf.current = '';
      }, 500);
      return true;
    };

    // Prevent infinite loops when all options are disabled
    const nextEnabledFrom = (start: number, delta: 1 | -1): number => {
      if (options.length === 0 || enabledIndexes.length === 0) return -1;
      let steps = 0;
      let idx = start;
      do {
        idx = (idx + delta + options.length) % options.length;
        steps++;
        if (!options[idx]?.disabled) return idx;
      } while (steps < options.length);
      return -1;
    };

    const onTriggerKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
      if (disabled) return;
      const key = e.key;
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar', 'Home', 'End'].includes(key)) {
        e.preventDefault();
      }
      if (key === 'ArrowDown') {
        if (enabledIndexes.length === 0) return;
        const start = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1;
        const next = start < 0 ? enabledIndexes[0]! : nextEnabledFrom(start, 1);
        const idx = next >= 0 ? next : enabledIndexes[0]!;
        openWithIndex(idx);
      } else if (key === 'ArrowUp') {
        if (enabledIndexes.length === 0) return;
        const start = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1;
        const next = start < 0 ? enabledIndexes[enabledIndexes.length - 1]! : nextEnabledFrom(start, -1);
        const idx = next >= 0 ? next : enabledIndexes[enabledIndexes.length - 1]!;
        openWithIndex(idx);
      } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        if (enabledIndexes.length === 0) return;
        const idx = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0]!;
        openWithIndex(idx);
      } else if (key === 'Home') {
        if (enabledIndexes.length === 0) return;
        openWithIndex(enabledIndexes[0]!);
      } else if (key === 'End') {
        if (enabledIndexes.length === 0) return;
        openWithIndex(enabledIndexes[enabledIndexes.length - 1]!);
      } else if (applyTypeahead(key)) {
        if (enabledIndexes.length === 0) return;
        if (!open) openWithIndex(enabledIndexes[0]!);
      }
    };

    const onListboxKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
      const key = e.key;
      if (
        !['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar', 'Escape', 'Home', 'End'].includes(key) &&
        !/[\p{L}\p{N}\s]/u.test(key)
      )
        return;
      e.preventDefault();
      if (key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (key === 'Home') {
        if (enabledIndexes.length === 0) return;
        setActiveIndex(enabledIndexes[0]!);
        return;
      }
      if (key === 'End') {
        if (enabledIndexes.length === 0) return;
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1]!);
        return;
      }
      if (applyTypeahead(key)) return;

      if (key === 'ArrowDown') {
        if (enabledIndexes.length === 0) return;
        const start = activeIndex >= 0 ? activeIndex : enabledIndexes[0]!;
        const next = nextEnabledFrom(start, 1);
        if (next >= 0) setActiveIndex(next);
      } else if (key === 'ArrowUp') {
        if (enabledIndexes.length === 0) return;
        const start = activeIndex >= 0 ? activeIndex : enabledIndexes[0]!;
        const next = nextEnabledFrom(start, -1);
        if (next >= 0) setActiveIndex(next);
      } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        const opt = options[activeIndex];
        if (opt && !opt.disabled) {
          setSelected(opt.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };

    const onOptionClick = (idx: number) => {
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      setSelected(opt.value);
      setOpen(false);
      triggerRef.current?.focus();
    };

    useEffect(() => {
      if (open) {
        // when opening, align activeIndex with selection or first enabled
        const idx = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1;
        setActiveIndex(idx);
      }
    }, [open, selectedIndex, enabledIndexes]);

    const selectedLabel = useMemo(() => {
      const found = options.find((o) => o.value === selectedValue);
      return found?.label ?? placeholder;
    }, [options, selectedValue, placeholder]);

    const composedClassName = className ? `cmp-select ${className}` : 'cmp-select';

    return (
      <div className={composedClassName} data-disabled={disabled ? 'true' : undefined}>
        {/* Hidden input for forms if name provided */}
        {name ? <input type="hidden" name={name} value={selectedValue ?? ''} /> : null}
        <button
          ref={composedRef}
          type="button"
          className="cmp-select__trigger"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open ? true : false}
          aria-controls={listboxId}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (open) setOpen(false);
            else openWithIndex(selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? 0);
          }}
          onKeyDown={onTriggerKeyDown}
        >
          <span className="cmp-select__label">{selectedLabel}</span>
          <span className="cmp-select__icon" aria-hidden>
            ▾
          </span>
        </button>

        {open ? (
          <div ref={portalRef} className="cmp-select__popover" role="presentation">
            <ul
              id={listboxId}
              role="listbox"
              className="cmp-select__listbox"
              tabIndex={0}
              ref={listboxRef}
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              onKeyDown={onListboxKeyDown}
            >
              {options.map((opt, idx) => {
                const selected = idx === selectedIndex;
                const active = idx === activeIndex;
                return (
                  <li
                    key={opt.value}
                    id={optionId(idx)}
                    role="option"
                    aria-selected={selected}
                    className="cmp-select__option"
                    data-active={active ? 'true' : undefined}
                    data-selected={selected ? 'true' : undefined}
                    aria-disabled={opt.disabled ? true : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onOptionClick(idx)}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
