import React from 'react';

export type ToastTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'accent';

export type ToastProps = {
  tone?: ToastTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  role?: 'status' | 'alert';
  ariaLive?: 'polite' | 'assertive' | 'off';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
};

/**
 * Tokenized Toast with ARIA live region semantics.
 * - Variants (tone) derived from status.* via component tokens
 * - Motion v1 tokens for reveal; reduced-motion disables transitions globally
 */
export function Toast({
  tone = 'info',
  title,
  children,
  role = 'status',
  ariaLive = 'polite',
  dismissible = false,
  onDismiss,
  className,
}: ToastProps) {
  const composed = className ? `cmp-toast ${className}` : 'cmp-toast';

  return (
    <div
      className={composed}
      data-toast-tone={tone}
      data-open="true"
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <div className="cmp-toast__icon" aria-hidden>
        {/* Simple glyphs via tone; can be replaced by icons later */}
        {tone === 'success' ? '✔︎' : tone === 'warning' ? '⚠︎' : tone === 'critical' ? '⨯' : tone === 'accent' ? '★' : tone === 'info' ? 'ℹ︎' : '•'}
      </div>
      <div className="cmp-toast__body">
        {title ? <div className="cmp-toast__title">{title}</div> : null}
        {children ? <div className="cmp-toast__message">{children}</div> : null}
      </div>
      {dismissible ? (
        <button
          type="button"
          className="cmp-toast__close"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

Toast.displayName = 'Toast';

