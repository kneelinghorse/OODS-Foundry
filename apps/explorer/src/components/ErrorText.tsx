import type { HTMLAttributes, ReactNode } from 'react';

export type ErrorTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

export type ErrorTextProps = {
  children: ReactNode;
  tone?: ErrorTone;
} & HTMLAttributes<HTMLDivElement>;

/**
 * ErrorText shows validation or status messages using the same tokenized
 * message visuals as inputs (cmp-input__message). A lightweight wrapper
 * div with class cmp-input enables tone-based CSS var remapping.
 */
export function ErrorText({ children, tone = 'critical', className, id, ...rest }: ErrorTextProps) {
  const wrapperClass = className ? `cmp-error-text cmp-input ${className}` : 'cmp-error-text cmp-input';
  const messageRole = tone === 'critical' || tone === 'warning' ? 'alert' : 'note';
  return (
    <div {...rest} className={wrapperClass} data-tone={tone}>
      <div className="cmp-input__message" id={id} role={messageRole}>
        <span>{children}</span>
      </div>
    </div>
  );
}

ErrorText.displayName = 'ErrorText';

