import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export type CheckboxTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type CheckboxProps = {
  tone?: CheckboxTone;
  label?: ReactNode;
  supportingText?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      tone = 'neutral',
      label,
      supportingText,
      disabled,
      id,
      className,
      'aria-invalid': ariaInvalidProp,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? `cmp-checkbox-${generatedId}`;
    const describedBy = supportingText ? `${inputId}-support` : undefined;
    const ariaInvalid = ariaInvalidProp ?? (tone === 'critical' ? true : undefined);
    const composedClassName = className ? `cmp-checkbox ${className}` : 'cmp-checkbox';

    return (
      <label className={composedClassName} data-tone={tone} data-disabled={disabled ? 'true' : undefined} htmlFor={inputId}>
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="checkbox"
          className="cmp-checkbox__input"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
        />
        <span className="cmp-checkbox__box" aria-hidden>
          <span className="cmp-checkbox__icon" aria-hidden>
            ✓
          </span>
        </span>
        {label ? <span className="cmp-checkbox__label">{label}</span> : null}
        {supportingText ? (
          <span id={describedBy} className="cmp-checkbox__support">
            {supportingText}
          </span>
        ) : null}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

