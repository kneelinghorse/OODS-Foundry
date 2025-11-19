import type { ThemeProps } from '@rjsf/core';
import type {
  FieldTemplateProps,
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps,
} from '@rjsf/utils';
import * as RjsfUtils from '@rjsf/utils';
import type { ChangeEvent, ReactNode } from 'react';

import type { FieldDensity } from '@/components/base/fieldUtils.js';

const { getTemplate, getUiOptions } = RjsfUtils;

type DensityAwareContext = FormContextType & {
  readonly density?: FieldDensity;
};

function getDensity(formContext?: DensityAwareContext): FieldDensity {
  return formContext?.density === 'compact' ? 'compact' : 'comfortable';
}

function FieldTemplate<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends DensityAwareContext = DensityAwareContext
>(props: FieldTemplateProps<T, S, F>): ReactNode {
  const {
    id,
    children,
    errors,
    help,
    description,
    hidden,
    required,
    displayLabel,
    label,
    classNames,
    formContext,
    registry,
    uiSchema,
  } = props;

  const uiOptions = getUiOptions(uiSchema);
  const WrapIfAdditionalTemplate = getTemplate<'WrapIfAdditionalTemplate', T, S, F>(
    'WrapIfAdditionalTemplate',
    registry,
    uiOptions
  );

  if (hidden) {
    return <div className="sr-only">{children}</div>;
  }

  const density = getDensity(formContext);
  const containerClassName = ['form-field', 'ods-rjsf-field', classNames]
    .filter(Boolean)
    .join(' ');

  return (
    <WrapIfAdditionalTemplate {...props}>
      <div className={containerClassName} data-density={density}>
        {displayLabel && label ? (
          <label className="form-field__label" htmlFor={id}>
            <span>{label}</span>
            {required ? (
              <span className="form-field__required-indicator" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        ) : null}
        {description ? <div className="form-field__description">{description}</div> : null}
        <div className="form-field__control">{children}</div>
        {errors ? (
          <div className="form-field__validation" role="alert" aria-live="assertive">
            {errors}
          </div>
        ) : null}
        {help ? (
          <div className="form-field__description" aria-live="polite">
            {help}
          </div>
        ) : null}
      </div>
    </WrapIfAdditionalTemplate>
  );
}

function createInputWidget(type: string, coerce?: (value: string, props: WidgetProps) => any) {
  return function InputWidget(props: WidgetProps): ReactNode {
    const {
      id,
      value,
      required,
      disabled,
      readonly,
      options,
      placeholder,
      autofocus,
      onChange,
      onBlur,
      onFocus,
    } = props;
    const resolvedValue = typeof value === 'undefined' || value === null ? '' : value;
    const ariaDescribedBy = props['aria-describedby'];

    return (
      <input
        id={id}
        type={type}
        className="form-field__input"
        value={resolvedValue as string | number}
        required={required}
        disabled={disabled || readonly}
        placeholder={placeholder}
        autoFocus={autofocus}
        aria-describedby={ariaDescribedBy}
        aria-invalid={props.rawErrors && props.rawErrors.length > 0 ? true : undefined}
        onBlur={(event) => onBlur(id, event.target.value)}
        onFocus={(event) => onFocus(id, event.target.value)}
        onChange={(event) => {
          const nextValue = coerce ? coerce(event.target.value, props) : event.target.value;
          onChange(nextValue === '' ? options.emptyValue ?? '' : nextValue);
        }}
      />
    );
  };
}

const TextWidget = createInputWidget('text');
const PasswordWidget = createInputWidget('password');
const EmailWidget = createInputWidget('email');
const UrlWidget = createInputWidget('url');
const DateWidget = createInputWidget('date');
const TimeWidget = createInputWidget('time');
const NumberWidget = createInputWidget('number', (value) => (value === '' ? '' : Number(value)));
const RangeWidget = createInputWidget('range', (value, props) => {
  if (value === '') {
    return props.options.emptyValue ?? '';
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? props.options.emptyValue ?? '' : parsed;
});

function TextareaWidget(props: WidgetProps): ReactNode {
  const {
    id,
    value,
    required,
    disabled,
    readonly,
    placeholder,
    autofocus,
    onChange,
    onBlur,
    onFocus,
  } = props;
  const ariaDescribedBy = props['aria-describedby'];

  return (
    <textarea
      id={id}
      className="form-field__input"
      style={{ minHeight: '5rem' }}
      value={(value as string) ?? ''}
      required={required}
      disabled={disabled || readonly}
      placeholder={placeholder}
      autoFocus={autofocus}
      aria-describedby={ariaDescribedBy}
      aria-invalid={props.rawErrors && props.rawErrors.length > 0 ? true : undefined}
      onBlur={(event) => onBlur(id, event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      onChange={(event) => onChange(event.target.value === '' ? props.options.emptyValue ?? '' : event.target.value)}
    />
  );
}

function SelectWidget(props: WidgetProps): ReactNode {
  const {
    id,
    options,
    value,
    required,
    disabled,
    readonly,
    placeholder,
    multiple,
    onChange,
    onBlur,
    onFocus,
  } = props;
  const enumOptions = options.enumOptions ?? [];
  const ariaDescribedBy = props['aria-describedby'];
  const resolvedValue = multiple
    ? (Array.isArray(value) ? value : [])
    : value ?? '';

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
      onChange(selectedValues);
      return;
    }
    const next = event.target.value;
    onChange(next === '' ? options.emptyValue ?? '' : next);
  };

  return (
    <select
      id={id}
      className="form-field__select"
      value={resolvedValue as string | readonly string[]}
      required={required}
      disabled={disabled || readonly}
      aria-describedby={ariaDescribedBy}
      aria-invalid={props.rawErrors && props.rawErrors.length > 0 ? true : undefined}
      multiple={multiple}
      onBlur={(event) => onBlur(id, multiple ? Array.from(event.target.selectedOptions).map((option) => option.value) : event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      onChange={handleChange}
    >
      {!multiple && !required ? (
        <option value="">
          {placeholder ?? 'Select an option'}
        </option>
      ) : null}
      {enumOptions.map((option) => (
        <option key={String(option.value)} value={option.value as string}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxWidget(props: WidgetProps<boolean>): ReactNode {
  const { id, value, required, disabled, readonly, onChange, onBlur, onFocus } = props;
  const ariaDescribedBy = props['aria-describedby'];
  const accessibleLabel = props.label || id;

  return (
    <input
      id={id}
      type="checkbox"
      className="form-field__checkbox"
      checked={Boolean(value)}
      required={required}
      disabled={disabled || readonly}
      onBlur={(event) => onBlur(id, event.target.checked)}
      onFocus={(event) => onFocus(id, event.target.checked)}
      onChange={(event) => onChange(event.target.checked)}
      aria-describedby={ariaDescribedBy}
      aria-checked={Boolean(value)}
      aria-label={accessibleLabel}
    />
  );
}

function ToggleWidget(props: WidgetProps<boolean>): ReactNode {
  const { id, value, disabled, readonly, onChange, onBlur, onFocus } = props;
  const ariaDescribedBy = props['aria-describedby'];
  const accessibleLabel = props.label || id;

  return (
    <button
      id={id}
      type="button"
      role="switch"
      className="inline-flex items-center gap-2 rounded-full border border-[--cmp-border-strong] bg-[--cmp-surface-subtle] px-3 py-1 text-sm"
      aria-checked={Boolean(value)}
      aria-describedby={ariaDescribedBy}
      aria-label={accessibleLabel}
      data-state={Boolean(value) ? 'on' : 'off'}
      disabled={disabled || readonly}
      onBlur={() => onBlur(id, Boolean(value))}
      onFocus={() => onFocus(id, Boolean(value))}
      onClick={() => onChange(!value)}
    >
      <span
        className={[
          'h-4 w-4 rounded-full border transition-colors',
          Boolean(value) ? 'bg-[--cmp-status-success-surface]' : 'bg-[--cmp-surface-canvas]',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      <span>{Boolean(value) ? 'Enabled' : 'Disabled'}</span>
    </button>
  );
}

function RadioWidget(props: WidgetProps): ReactNode {
  const { id, options, value, required, disabled, readonly, onChange, onBlur, onFocus } = props;
  const enumOptions = options.enumOptions ?? [];

  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-3">
      {enumOptions.map((option) => {
        const optionId = `${id}-${String(option.value)}`;
        const checked = value === option.value;
        return (
          <label key={optionId} className="inline-flex items-center gap-2 text-sm">
            <input
              id={optionId}
              type="radio"
              className="form-field__checkbox"
              checked={checked}
              required={required}
              disabled={disabled || readonly}
              onBlur={(event) => onBlur(id, event.target.value)}
              onFocus={(event) => onFocus(id, event.target.value)}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function CheckboxesWidget(props: WidgetProps<string[]>): ReactNode {
  const {
    id,
    value = [],
    required,
    disabled,
    readonly,
    onChange,
    onBlur,
    onFocus,
    options,
  } = props;
  const enumOptions = options.enumOptions ?? [];

  const toggleValue = (next: string) => {
    const selection = new Set(value);
    if (selection.has(next)) {
      selection.delete(next);
    } else {
      selection.add(next);
    }
    onChange(Array.from(selection));
  };

  return (
    <div role="group" aria-labelledby={id} className="flex flex-wrap gap-3">
      {enumOptions.map((option) => {
        const optionId = `${id}-${String(option.value)}`;
        const checked = value.includes(option.value as string);
        return (
          <label key={optionId} className="inline-flex items-center gap-2 text-sm">
            <input
              id={optionId}
              type="checkbox"
              className="form-field__checkbox"
              checked={checked}
              required={required}
              disabled={disabled || readonly}
              onBlur={(event) => onBlur(id, event.target.value)}
              onFocus={(event) => onFocus(id, event.target.value)}
              onChange={() => toggleValue(option.value as string)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export const oodsRjsfTheme: ThemeProps = {
  templates: {
    FieldTemplate,
  },
  widgets: {
    TextWidget,
    PasswordWidget,
    EmailWidget,
    UrlWidget,
    DateWidget,
    TimeWidget,
    NumberWidget,
    RangeWidget,
    TextareaWidget,
    SelectWidget,
    CheckboxWidget,
    CheckboxesWidget,
    RadioWidget,
    toggle: ToggleWidget,
  },
  fields: {},
};
