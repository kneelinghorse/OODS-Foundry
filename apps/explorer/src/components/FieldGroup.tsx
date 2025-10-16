import { forwardRef, useId, type FieldsetHTMLAttributes, type ReactNode } from 'react';
import type { InputTone } from './Input';
import { RequiredOptional } from './RequiredOptional';
import { HelpText } from './HelpText';
import { ErrorText } from './ErrorText';

export type FieldGroupState =
  | 'neutral'
  | 'info'
  | 'accent'
  | 'success'
  | 'warning'
  | 'valid'
  | 'invalid'
  | 'disabled';

const MESSAGE_TONE_BY_STATE: Record<FieldGroupState, InputTone> = {
  neutral: 'neutral',
  info: 'info',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  valid: 'success',
  invalid: 'critical',
  disabled: 'neutral'
};

export type FieldGroupProps = {
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  messageTone?: InputTone;
  required?: boolean;
  children?: ReactNode;
  state?: FieldGroupState;
} & Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'children'>;

/**
 * FieldGroup is a semantic fieldset wrapper that groups related controls,
 * providing shared label, supporting description, and status messaging.
 * It relies on context/tokens for visuals (class-only surface).
 */
export const FieldGroup = forwardRef<HTMLFieldSetElement, FieldGroupProps>(
  ({ label, description, message, messageTone, required, children, className, id, state = 'neutral', ...rest }, ref) => {
    const {
      ['aria-describedby']: ariaDescribedByProp,
      ['aria-invalid']: ariaInvalidProp,
      disabled,
      ...fieldsetRest
    } = rest;

    const generatedId = useId();
    const groupId = id ?? `cmp-fieldgroup-${generatedId}`;
    const descId = description ? `${groupId}-desc` : undefined;
    const msgId = message ? `${groupId}-msg` : undefined;

    const describedByParts = [ariaDescribedByProp, descId, msgId].filter(
      (value): value is string => Boolean(value)
    );
    const describedBy = describedByParts.length ? describedByParts.join(' ') : undefined;

    const composed = className ? `cmp-field-group ${className}` : 'cmp-field-group';
    const resolvedMessageTone = messageTone ?? MESSAGE_TONE_BY_STATE[state] ?? 'neutral';
    const ariaInvalid = ariaInvalidProp ?? (state === 'invalid' ? true : undefined);
    const isDisabled = disabled ?? (state === 'disabled' ? true : undefined);
    const dataState = state === 'neutral' ? undefined : state;
    const toneAttr = MESSAGE_TONE_BY_STATE[state];

    return (
      <fieldset
        {...fieldsetRest}
        ref={ref}
        id={groupId}
        className={composed}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        disabled={isDisabled ? true : undefined}
        data-state={dataState}
        data-tone={toneAttr && toneAttr !== 'neutral' ? toneAttr : undefined}
        data-disabled={isDisabled ? 'true' : undefined}
      >
        {label ? (
          <legend className="cmp-field-group__legend">
            <span className="cmp-field-group__label">{label}</span>{' '}
            <RequiredOptional required={Boolean(required)} />
          </legend>
        ) : null}

        {description ? <HelpText id={descId}>{description}</HelpText> : null}

        <div className="cmp-field-group__fields">{children}</div>

        {message ? (
          <ErrorText id={msgId} tone={resolvedMessageTone} className="cmp-field-group__message">
            {message}
          </ErrorText>
        ) : null}
      </fieldset>
    );
  }
);

FieldGroup.displayName = 'FieldGroup';
