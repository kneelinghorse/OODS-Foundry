import * as React from 'react';
import type { ReactNode } from 'react';
import {
  getStatusPresentation,
  getToneTokenSet,
  type StatusDomain,
  type StatusPresentation,
  type StatusTone,
} from '../statusables/statusRegistry.js';
import { resolveStatusGlyph } from '../statusables/statusGlyph.js';

type ToastElement = React.ElementRef<'div'>;

interface FocusableElement {
  focus?(options?: { preventScroll?: boolean }): void;
}

type DocumentLike = {
  readonly activeElement?: unknown;
};

function getDocument(): DocumentLike | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  const candidate = (globalThis as Record<string, unknown>).document;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  return candidate as DocumentLike;
}

function asFocusable(candidate: unknown): FocusableElement | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as FocusableElement;
  return typeof value.focus === 'function' ? value : null;
}

export interface ToastProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  readonly status?: string;
  readonly domain?: StatusDomain;
  readonly tone?: StatusTone;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly open: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly autoDismissAfter?: number;
  readonly dismissLabel?: string;
  readonly showIcon?: boolean;
  readonly children?: ReactNode;
}

const DEFAULT_DOMAIN: StatusDomain = 'subscription';

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | React.MutableRefObject<T | null> | undefined>
): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

function resolvePresentation(
  domain: StatusDomain,
  status: string | undefined
): StatusPresentation | undefined {
  if (!status) {
    return undefined;
  }

  return getStatusPresentation(domain, status);
}

export const Toast = React.forwardRef<ToastElement, ToastProps>(
  (
    {
      status,
      domain: domainProp,
      tone: toneOverride,
      title,
      description,
      icon,
      action,
      open,
      onOpenChange,
      autoDismissAfter,
      dismissLabel = 'Dismiss notification',
      showIcon,
      className,
      style,
      children,
      ...rest
    },
    forwardedRef
  ) => {
    const domain = (domainProp ?? DEFAULT_DOMAIN) as StatusDomain;
    const presentation = resolvePresentation(domain, status);
    const tone = toneOverride ?? presentation?.tone ?? 'neutral';
    const palette = getToneTokenSet(tone);
    const resolvedShowIcon = showIcon ?? Boolean(icon || presentation?.iconName);
    const glyph =
      icon ?? (resolvedShowIcon ? resolveStatusGlyph(presentation?.iconName) : undefined);
    const heading = title ?? presentation?.label ?? status;
    const detail = description ?? presentation?.description ?? children;

    const localRef = React.useRef<HTMLDivElement | null>(null);
    const previousFocusRef = React.useRef<FocusableElement | null>(null);
    const mergedRef = mergeRefs(localRef, forwardedRef);

    React.useEffect(() => {
      const node = localRef.current;
      if (!node) {
        return;
      }

      if (open) {
        const activeElement = getDocument()?.activeElement;
        const previous = asFocusable(activeElement);
        if (previous) {
          previousFocusRef.current = previous;
        }

        const focusableNode = asFocusable(node);
        const timeout = setTimeout(() => {
          if (focusableNode && typeof focusableNode.focus === 'function') {
            focusableNode.focus({ preventScroll: true });
          }
        }, 0);

        return () => clearTimeout(timeout);
      }

      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;

      return undefined;
    }, [open]);

    React.useEffect(() => {
      if (!open || !autoDismissAfter || autoDismissAfter <= 0) {
        return;
      }

      const timer = setTimeout(() => {
        onOpenChange?.(false);
      }, autoDismissAfter);

      return () => clearTimeout(timer);
    }, [open, autoDismissAfter, onOpenChange]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    const handleDismiss = () => {
      onOpenChange?.(false);
    };

    const mergedClassName = ['statusable-toast', className].filter(Boolean).join(' ');
    const cssVariables = {
      '--statusable-toast-background': palette.background,
      '--statusable-toast-border': palette.border,
      '--statusable-toast-foreground': palette.foreground,
      '--statusable-toast-icon-color': palette.foreground,
    } as React.CSSProperties;

    const mergedStyle = style
      ? ({ ...cssVariables, ...style } as React.CSSProperties)
      : cssVariables;

    const iconNode =
      glyph && resolvedShowIcon ? (
        <span className="statusable-toast__icon" aria-hidden>
          {glyph}
        </span>
      ) : null;

    return (
      <div
        ref={mergedRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        tabIndex={-1}
        className={mergedClassName}
        style={mergedStyle}
        data-state={open ? 'open' : 'closed'}
        data-domain={domain}
        data-status={status}
        data-tone={tone}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {iconNode}
        <div className="statusable-toast__content">
          {heading ? <p className="statusable-toast__title">{heading}</p> : null}
          {detail ? <p className="statusable-toast__description">{detail}</p> : null}
          {action}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="statusable-toast__dismiss"
          aria-label={dismissLabel}
        >
          ×
        </button>
      </div>
    );
  }
);

Toast.displayName = 'OODS.Toast';
