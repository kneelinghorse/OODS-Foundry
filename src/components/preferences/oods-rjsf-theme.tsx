import type { ThemeProps } from '@rjsf/core';
import type { FieldTemplateProps, WidgetProps } from '@rjsf/utils';
import type { ReactNode } from 'react';

const ERROR_TEXT_COLOR = 'var(--sys-status-critical-text)';
const HELP_TEXT_COLOR = 'var(--sys-text-muted)';
const LABEL_COLOR = 'var(--sys-text-primary)';

function FieldTemplate(props: FieldTemplateProps): ReactNode {
  const {
    id,
    classNames,
    label,
    required,
    displayLabel,
    description,
    errors,
    help,
    children,
    hidden,
  } = props;

  if (hidden) {
    return children;
  }

  return (
    <div className={['mb-3 flex flex-col gap-1', classNames].filter(Boolean).join(' ')}>
      {displayLabel && label ? (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: LABEL_COLOR }}
        >
          {label}
          {required ? <span className="ml-1 text-xs" style={{ color: ERROR_TEXT_COLOR }}>*</span> : null}
        </label>
      ) : null}
      {description ? (
        <div className="text-xs" style={{ color: HELP_TEXT_COLOR }}>
          {description}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
      {errors ? (
        <div className="text-xs font-medium" style={{ color: ERROR_TEXT_COLOR }}>
          {errors}
        </div>
      ) : null}
      {help ? (
        <div className="text-xs" style={{ color: HELP_TEXT_COLOR }}>
          {help}
        </div>
      ) : null}
    </div>
  );
}

function ToggleWidget({ id, value, required, disabled, readonly, onChange }: WidgetProps<boolean>): ReactNode {
  return (
    <label className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border border-slate-300"
        checked={Boolean(value)}
        required={required}
        disabled={disabled || readonly}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export const oodsRjsfTheme: ThemeProps = {
  templates: {
    FieldTemplate,
  },
  widgets: {
    toggle: ToggleWidget,
  },
  fields: {},
};
