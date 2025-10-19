import * as React from 'react';
import type { InputHTMLAttributes } from 'react';
import {
  resolveFieldMetadata,
  type FieldDensity,
  type FieldValidation,
} from './fieldUtils.js';

type CheckboxInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'children' | 'className' | 'style'
>;

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

export interface CheckboxProps extends CheckboxInputProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly requiredIndicator?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly checkboxClassName?: string;
  readonly checkboxStyle?: React.CSSProperties;
}

type CheckboxElement = React.ElementRef<'input'>;

export const Checkbox = React.forwardRef<CheckboxElement, CheckboxProps>(
  (
    {
      id,
      label,
      description,
      validation,
      density = 'comfortable',
      requiredIndicator,
      className,
      style,
      checkboxClassName,
      checkboxStyle,
      ...rest
    },
    forwardedRef
  ) => {
    const { required, ...checkboxProps } = rest;

    const metadata = resolveFieldMetadata(id, {
      hasDescription: Boolean(description),
      validation,
    });

    const containerClassName = ['form-field', className].filter(Boolean).join(' ');
    const containerStyle = metadata.variables
      ? style
        ? ({ ...metadata.variables, ...style } as React.CSSProperties)
        : metadata.variables
      : style;

    const mergedCheckboxClassName = ['form-field__checkbox', checkboxClassName]
      .filter(Boolean)
      .join(' ');

    const indicator =
      required && requiredIndicator !== null
        ? requiredIndicator ?? DEFAULT_REQUIRED_INDICATOR
        : null;

    return (
      <div
        className={containerClassName}
        style={containerStyle}
        data-density={density}
        data-validation-state={metadata.dataValidationState}
      >
        <div className="form-field__checkbox-row">
          <input
            ref={forwardedRef}
            id={id}
            type="checkbox"
            className={mergedCheckboxClassName}
            style={checkboxStyle}
            aria-describedby={metadata.describedBy}
            aria-invalid={metadata.ariaInvalid}
            data-validation-state={metadata.dataValidationState}
            required={required}
            {...checkboxProps}
          />
          <label className="form-field__label" htmlFor={id}>
            <span>{label}</span>
            {indicator}
          </label>
        </div>
        {description ? (
          <p id={metadata.descriptionId} className="form-field__description">
            {description}
          </p>
        ) : null}
        {validation?.message ? (
          <p
            id={metadata.validationId}
            className="form-field__validation"
            role={validation.state === 'error' ? 'alert' : 'status'}
            aria-live={validation.state === 'error' ? 'assertive' : 'polite'}
            data-state={validation.state}
          >
            {validation.message}
          </p>
        ) : null}
      </div>
    );
  }
);

Checkbox.displayName = 'OODS.Checkbox';
