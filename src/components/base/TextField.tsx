import * as React from 'react';
import type { InputHTMLAttributes } from 'react';
import {
  resolveFieldMetadata,
  type FieldDensity,
  type FieldValidation,
} from './fieldUtils.js';

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'children' | 'className' | 'style'
>;

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

export interface TextFieldProps extends InputProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly requiredIndicator?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly inputClassName?: string;
  readonly inputStyle?: React.CSSProperties;
}

type TextFieldElement = React.ElementRef<'input'>;

export const TextField = React.forwardRef<TextFieldElement, TextFieldProps>(
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
      inputClassName,
      inputStyle,
      type = 'text',
      ...rest
    },
    forwardedRef
  ) => {
    const { required, ...inputProps } = rest;

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

    const inputClasses = ['form-field__input', inputClassName].filter(Boolean).join(' ');
    const inputStyles = inputStyle;

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
        <label className="form-field__label" htmlFor={id}>
          <span>{label}</span>
          {indicator}
        </label>
        <div className="form-field__control">
          <input
            ref={forwardedRef}
            id={id}
            type={type}
            className={inputClasses}
            style={inputStyles}
            aria-describedby={metadata.describedBy}
            aria-invalid={metadata.ariaInvalid}
            data-validation-state={metadata.dataValidationState}
            required={required}
            {...inputProps}
          />
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

TextField.displayName = 'OODS.TextField';
