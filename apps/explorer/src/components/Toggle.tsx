import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export type ToggleTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type ToggleProps = {
  tone?: ToggleTone;
  label?: ReactNode;
  supportingText?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>;

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    { tone = 'neutral', label, supportingText, disabled, id, className, onKeyDown, ...rest },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? `cmp-toggle-${generatedId}`;
    const composedClassName = className ? `cmp-toggle ${className}` : 'cmp-toggle';

    return (
      <label className={composedClassName} data-tone={tone} data-disabled={disabled ? 'true' : undefined} htmlFor={inputId}>
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          className="cmp-toggle__input"
          disabled={disabled}
          onKeyDown={(e) => {
            if (onKeyDown) onKeyDown(e);
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).click();
            }
          }}
        />
        <span className="cmp-toggle__track" aria-hidden>
          <span className="cmp-toggle__thumb" aria-hidden />
        </span>
        {label ? <span className="cmp-toggle__label">{label}</span> : null}
        {supportingText ? <span className="cmp-toggle__support">{supportingText}</span> : null}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';

