import * as React from 'react';
import type { SelectHTMLAttributes } from 'react';
import {
  resolveFieldMetadata,
  type FieldDensity,
  type FieldValidation,
} from './fieldUtils.js';

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className' | 'style'
>;

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

export interface SelectProps extends NativeSelectProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly requiredIndicator?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly selectClassName?: string;
  readonly selectStyle?: React.CSSProperties;
}

type SelectElement = React.ElementRef<'select'>;

export const Select = React.forwardRef<SelectElement, SelectProps>(
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
      selectClassName,
      selectStyle,
      children,
      ...rest
    },
    forwardedRef
  ) => {
    const { required, ...selectProps } = rest;

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

    const mergedSelectClassName = ['form-field__select', selectClassName]
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
        <label className="form-field__label" htmlFor={id}>
          <span>{label}</span>
          {indicator}
        </label>
        <div className="form-field__control">
          <select
            ref={forwardedRef}
            id={id}
            className={mergedSelectClassName}
            style={selectStyle}
            aria-describedby={metadata.describedBy}
            aria-invalid={metadata.ariaInvalid}
            data-validation-state={metadata.dataValidationState}
            required={required}
            {...selectProps}
          >
            {children}
          </select>
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

Select.displayName = 'OODS.Select';
