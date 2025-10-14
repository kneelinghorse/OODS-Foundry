import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export type InputTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

const MESSAGE_ICONS: Record<InputTone, string> = {
  neutral: '•',
  info: 'ℹ︎',
  accent: '★',
  success: '✔︎',
  warning: '⚠︎',
  critical: '⨯'
};

export type InputProps = {
  tone?: InputTone;
  label?: ReactNode;
  supportingText?: ReactNode;
  message?: ReactNode;
  messageIcon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  selected?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      tone = 'neutral',
      label,
      supportingText,
      message,
      messageIcon,
      prefix,
      suffix,
      selected,
      className,
      id,
      disabled,
      children: _children,
      type = 'text',
      'aria-describedby': ariaDescribedByProp,
      'aria-invalid': ariaInvalidProp,
      ...rest
    },
    ref
  ) => {
    // Intentional no-op to acknowledge children are not rendered directly
    void _children;

    const generatedId = useId();
    const inputId = id ?? `cmp-input-${generatedId}`;
    const supportId = supportingText ? `${inputId}-support` : undefined;
    const messageId = message ? `${inputId}-message` : undefined;

    const describedByParts = [ariaDescribedByProp, supportId, messageId].filter((value): value is string => Boolean(value));
    const describedBy = describedByParts.length ? describedByParts.join(' ') : undefined;

    const ariaInvalid = ariaInvalidProp ?? (tone === 'critical' ? true : undefined);
    const messageRole = tone === 'critical' || tone === 'warning' ? 'alert' : 'note';
    const resolvedMessageIcon = messageIcon ?? (tone === 'neutral' ? undefined : MESSAGE_ICONS[tone]);
    const composedClassName = className ? `cmp-input ${className}` : 'cmp-input';

    return (
      <div
        className={composedClassName}
        data-tone={tone}
        data-selected={selected ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
      >
        {label ? (
          <label className="cmp-input__label" htmlFor={inputId}>
            {label}
          </label>
        ) : null}

        {supportingText ? (
          <p className="cmp-input__support" id={supportId}>
            {supportingText}
          </p>
        ) : null}

        <div className="cmp-input__control">
          {prefix ? (
            <span className="cmp-input__affix" aria-hidden>
              {prefix}
            </span>
          ) : null}
          <input
            {...rest}
            ref={ref}
            id={inputId}
            type={type}
            className="cmp-input__field"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={describedBy}
          />
          {suffix ? (
            <span className="cmp-input__affix" aria-hidden>
              {suffix}
            </span>
          ) : null}
        </div>

        {message ? (
          <div className="cmp-input__message" id={messageId} role={messageRole}>
            {resolvedMessageIcon ? (
              <span className="cmp-input__message-icon" aria-hidden>
                {resolvedMessageIcon}
              </span>
            ) : null}
            <span>{message}</span>
          </div>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
