import { forwardRef, useId, type FieldsetHTMLAttributes, type ReactNode } from 'react';
import type { InputTone } from './Input';
import { RequiredOptional } from './RequiredOptional';
import { HelpText } from './HelpText';
import { ErrorText } from './ErrorText';

export type FieldGroupProps = {
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  messageTone?: InputTone;
  required?: boolean;
  children?: ReactNode;
} & Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'children'>;

/**
 * FieldGroup is a semantic fieldset wrapper that groups related controls,
 * providing shared label, supporting description, and status messaging.
 * It relies on context/tokens for visuals (class-only surface).
 */
export const FieldGroup = forwardRef<HTMLFieldSetElement, FieldGroupProps>(
  ({ label, description, message, messageTone = 'neutral', required, children, className, id, ...rest }, ref) => {
    const generatedId = useId();
    const groupId = id ?? `cmp-fieldgroup-${generatedId}`;
    const descId = description ? `${groupId}-desc` : undefined;
    const msgId = message ? `${groupId}-msg` : undefined;

    const describedBy = [descId, msgId].filter(Boolean).join(' ') || undefined;
    const composed = className ? `cmp-field-group ${className}` : 'cmp-field-group';

    return (
      <fieldset {...rest} ref={ref} id={groupId} className={composed} aria-describedby={describedBy}>
        {label ? (
          <legend className="cmp-field-group__legend">
            <span className="cmp-field-group__label">{label}</span>{' '}
            <RequiredOptional required={Boolean(required)} />
          </legend>
        ) : null}

        {description ? <HelpText id={descId}>{description}</HelpText> : null}

        <div className="cmp-field-group__fields">{children}</div>

        {message ? (
          <ErrorText id={msgId} tone={messageTone} className="cmp-field-group__message">
            {message}
          </ErrorText>
        ) : null}
      </fieldset>
    );
  }
);

FieldGroup.displayName = 'FieldGroup';

