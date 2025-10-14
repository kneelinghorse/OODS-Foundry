import {
  forwardRef,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  useCallback,
} from 'react';

export type RadioTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type RadioProps = {
  tone?: RadioTone;
  label?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>;

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ tone = 'neutral', label, disabled, id, className, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? `cmp-radio-${generatedId}`;
    const composedClassName = className ? `cmp-radio ${className}` : 'cmp-radio';

    return (
      <label className={composedClassName} data-tone={tone} data-disabled={disabled ? 'true' : undefined} htmlFor={inputId}>
        <input {...rest} ref={ref} id={inputId} type="radio" className="cmp-radio__input" disabled={disabled} />
        <span className="cmp-radio__control" aria-hidden>
          <span className="cmp-radio__dot" aria-hidden />
        </span>
        {label ? <span className="cmp-radio__label">{label}</span> : null}
      </label>
    );
  }
);

Radio.displayName = 'Radio';

export type RadioGroupOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps = {
  name: string;
  options: RadioGroupOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  tone?: RadioTone;
  ariaLabel?: string;
};

export const RadioGroup = ({ name, options, value, defaultValue, onChange, tone = 'neutral', ariaLabel }: RadioGroupProps) => {
  const isControlled = typeof value !== 'undefined';
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const currentValue = isControlled ? value : internal;
  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  const inputs = useRef<HTMLInputElement[]>([]);
  inputs.current = [];

  const enabledIndexes = useMemo(() => options.map((o, idx) => (o.disabled ? -1 : idx)).filter((i) => i >= 0), [options]);
  const currentIndex = useMemo(() => options.findIndex((o) => o.value === currentValue), [options, currentValue]);

  const focusAt = (idx: number) => {
    const el = inputs.current[idx];
    if (el) {
      el.focus();
      el.click();
      setValue(options[idx].value);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    e.preventDefault();
    if (enabledIndexes.length === 0) return;

    if (key === 'Home') {
      focusAt(enabledIndexes[0]);
      return;
    }
    if (key === 'End') {
      focusAt(enabledIndexes[enabledIndexes.length - 1]);
      return;
    }
    const dir = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    let next = currentIndex;
    do {
      next = (next + dir + options.length) % options.length;
    } while (options[next]?.disabled);
    focusAt(next);
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="cmp-radio-group" data-tone={tone} onKeyDown={onKeyDown}>
      {options.map((opt, idx) => (
        <label key={opt.value} className="cmp-radio" data-tone={tone} data-disabled={opt.disabled ? 'true' : undefined}>
          <input
            ref={(el) => {
              if (el) inputs.current[idx] = el;
            }}
            type="radio"
            name={name}
            value={opt.value}
            checked={currentValue === opt.value}
            onChange={() => setValue(opt.value)}
            className="cmp-radio__input"
            disabled={opt.disabled}
            tabIndex={currentValue === opt.value || (!currentValue && !opt.disabled && idx === 0) ? 0 : -1}
          />
          <span className="cmp-radio__control" aria-hidden>
            <span className="cmp-radio__dot" aria-hidden />
          </span>
          <span className="cmp-radio__label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

