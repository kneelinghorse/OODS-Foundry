import type { HTMLAttributes, ReactNode } from 'react';

export type RequiredOptionalProps = {
  required?: boolean;
  labelRequired?: ReactNode;
  labelOptional?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

/**
 * Inline label helper for required/optional state.
 * Uses muted text token via cmp-input__support class to avoid new style branches.
 */
export function RequiredOptional({
  required,
  labelRequired = 'Required',
  labelOptional = 'Optional',
  className,
  ...rest
}: RequiredOptionalProps) {
  const composed = className ? `cmp-required-optional cmp-input__support ${className}` : 'cmp-required-optional cmp-input__support';
  return (
    <span {...rest} className={composed} aria-live="off">
      ({required ? labelRequired : labelOptional})
    </span>
  );
}

RequiredOptional.displayName = 'RequiredOptional';

