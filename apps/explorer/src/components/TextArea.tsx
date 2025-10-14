import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

export type TextAreaTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type TextAreaProps = {
  tone?: TextAreaTone;
  label?: ReactNode;
  supportingText?: ReactNode;
  message?: ReactNode;
  selected?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      tone = 'neutral',
      label,
      supportingText,
      message,
      selected,
      className,
      id,
      disabled,
      rows = 4,
      'aria-describedby': ariaDescribedByProp,
      'aria-invalid': ariaInvalidProp,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const fieldId = id ?? `cmp-textarea-${generatedId}`;
    const supportId = supportingText ? `${fieldId}-support` : undefined;
    const messageId = message ? `${fieldId}-message` : undefined;

    const describedByParts = [ariaDescribedByProp, supportId, messageId].filter((v): v is string => Boolean(v));
    const describedBy = describedByParts.length ? describedByParts.join(' ') : undefined;

    const ariaInvalid = ariaInvalidProp ?? (tone === 'critical' ? true : undefined);
    const composedClassName = className ? `cmp-input cmp-textarea ${className}` : 'cmp-input cmp-textarea';

    return (
      <div
        className={composedClassName}
        data-tone={tone}
        data-selected={selected ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
      >
        {label ? (
          <label className="cmp-input__label" htmlFor={fieldId}>
            {label}
          </label>
        ) : null}

        {supportingText ? (
          <p className="cmp-input__support" id={supportId}>
            {supportingText}
          </p>
        ) : null}

        <div className="cmp-input__control">
          <textarea
            {...rest}
            ref={ref}
            id={fieldId}
            className="cmp-input__field"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={describedBy}
            rows={rows}
          />
        </div>

        {message ? (
          <div className="cmp-input__message" id={messageId} role={tone === 'critical' || tone === 'warning' ? 'alert' : 'note'}>
            <span>{message}</span>
          </div>
        ) : null}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

