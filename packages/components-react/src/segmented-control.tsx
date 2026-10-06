import * as React from 'react';
import type { SegmentedControlProps } from './types.js';

/**
 * s223-m02 (#2527 ruling 10): one choice from two to five options, shown as joined segments. One markup with Vue and the
 * HTML renderer: a radiogroup named by the visible label, each option a native radio inside its own label. The radio is
 * transparent over its whole segment, so the shared focus rule draws its ring on the segment, and the browser gives the
 * radio-group keyboard (the arrows move and check, Tab enters at the checked option) with no script.
 */
export const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  (
    {
      id,
      label,
      options,
      value,
      defaultValue,
      name,
      size = 'md',
      disabled,
      className,
      style,
      onChange,
      onValueChange,
      onUpdate,
      ...rest
    },
    ref
  ) => {
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = event => {
      onChange?.(event);
      if (event.defaultPrevented) return;
      onValueChange?.(event.currentTarget.value);
      onUpdate?.(event.currentTarget.value);
    };
    return (
      <div
        className={className ? `oods-field oods-segmented-control ${className}` : 'oods-field oods-segmented-control'}
        style={style}
        data-oods-component="SegmentedControl"
        data-size={size}
      >
        <span id={`${id}-label`} className="oods-field-label">{label}</span>
        <div
          ref={ref}
          id={id}
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          className="oods-segmented-control__track"
          {...rest}
        >
          {options.map(option => (
            <label key={option.value} className="oods-segmented-control__option">
              <input
                type="radio"
                className="oods-segmented-control__input"
                name={name || id}
                value={option.value}
                {...(value === undefined
                  ? { defaultChecked: option.value === defaultValue }
                  : { checked: option.value === value })}
                disabled={disabled || option.disabled}
                onChange={handleChange}
              />
              <span className="oods-segmented-control__label">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
);
SegmentedControl.displayName = 'OODS.SegmentedControl';
