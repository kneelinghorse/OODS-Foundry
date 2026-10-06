import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type {
  BadgeProps,
  BannerProps,
  ButtonProps,
  CardProps,
  DialogProps,
  TextProps,
} from './types.js';
import { resolveStatusIcon } from '@oods/component-contracts';
import {
  getBannerToneTokenSet,
  getStatusPresentation,
  getToneTokenSet,
} from './status.js';
import { StatusIcon } from './status-icon.js';

const classes = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      content,
      status,
      domain = 'subscription',
      tone: toneOverride,
      emphasis = 'subtle',
      icon,
      iconPosition = 'start',
      showIcon,
      children,
      className,
      style,
      title,
      'aria-label': ariaLabel,
      ...rest
    },
    ref
  ) => {
    const presentation = status ? getStatusPresentation(domain, status) : undefined;
    const tone = toneOverride ?? presentation?.tone ?? 'neutral';
    const tokenSet = toneOverride !== undefined
      ? getToneTokenSet(tone)
      : emphasis === 'solid'
        ? presentation?.badge.solid ?? getToneTokenSet(tone)
        : presentation?.badge.subtle ?? getToneTokenSet(tone);
    const resolvedContent = children ?? content ?? presentation?.label ?? status;
    const statusIcon = resolveStatusIcon(presentation?.iconName);
    const resolvedIcon = icon ?? (statusIcon ? <StatusIcon name={statusIcon} /> : undefined);
    const resolvedShowIcon = showIcon ?? resolvedIcon !== undefined;
    const iconNode = resolvedShowIcon && resolvedIcon ? (
      <span className="oods-badge__icon" aria-hidden="true">
        {resolvedIcon}
      </span>
    ) : null;

    return (
      <span
        ref={ref}
        className={classes('oods-badge', className)}
        data-oods-component="Badge"
        data-status={status}
        data-domain={domain}
        data-tone={tone}
        data-emphasis={emphasis}
        title={title ?? presentation?.description}
        aria-label={ariaLabel}
        style={{
          '--cmp-badge-background': tokenSet.background,
          '--cmp-badge-border': tokenSet.border,
          '--cmp-badge-text': tokenSet.foreground,
          ...style,
        } as React.CSSProperties}
        {...rest}
      >
        {iconPosition === 'start' ? iconNode : null}
        <span className="oods-badge__label">{resolvedContent}</span>
        {iconPosition === 'end' ? iconNode : null}
      </span>
    );
  }
);
Badge.displayName = 'OODS.Badge';

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  (
    {
      title,
      detail,
      description,
      content,
      status,
      domain = 'subscription',
      tone: toneOverride,
      emphasis = 'subtle',
      icon,
      actions,
      onDismiss,
      dismissLabel = 'Dismiss notification',
      showIcon,
      children,
      className,
      style,
      ...rest
    },
    ref
  ) => {
    const presentation = status ? getStatusPresentation(domain, status) : undefined;
    const tone = toneOverride ?? presentation?.tone ?? 'neutral';
    const tokenSet = emphasis === 'solid'
      ? presentation?.banner.solid ?? getToneTokenSet(tone)
      : presentation?.banner.subtle ?? getBannerToneTokenSet(tone);
    const heading = title ?? presentation?.label ?? status;
    const body = detail ?? description ?? children ?? content ?? presentation?.description;
    const role = tone === 'critical' || tone === 'danger' ? 'alert' : 'status';
    const statusIcon = resolveStatusIcon(presentation?.iconName);
    const resolvedIcon = icon ?? (statusIcon ? <StatusIcon name={statusIcon} /> : undefined);
    const resolvedShowIcon = showIcon ?? resolvedIcon !== undefined;

    return (
      <div
        ref={ref}
        role={role}
        aria-live={role === 'alert' ? 'assertive' : 'polite'}
        className={classes('oods-banner', className)}
        data-oods-component="Banner"
        data-status={status}
        data-domain={domain}
        data-tone={tone}
        data-emphasis={emphasis}
        style={{
          '--cmp-banner-background': tokenSet.background,
          '--cmp-banner-border': tokenSet.border,
          '--cmp-banner-text': tokenSet.foreground,
          ...style,
        } as React.CSSProperties}
        {...rest}
      >
        {resolvedShowIcon && resolvedIcon ? (
          <span className="oods-banner__icon" aria-hidden="true">
            {resolvedIcon}
          </span>
        ) : null}
        <div className="oods-banner__content">
          {heading ? <strong className="oods-banner__title">{heading}</strong> : null}
          {body ? <p className="oods-banner__detail">{body}</p> : null}
          {actions ? <div className="oods-banner__actions">{actions}</div> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="oods-banner-dismiss oods-banner__dismiss"
            aria-label={dismissLabel}
            onClick={() => onDismiss()}
          >
            <StatusIcon name="x" />
          </button>
        ) : null}
      </div>
    );
  }
);
Banner.displayName = 'OODS.Banner';

// Intent, size, radius and focus are painted by @oods/component-styles from the
// cmp roles through data-intent and data-size; no utility class carries chrome.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      content,
      children,
      className,
      intent = 'neutral',
      size = 'md',
      style,
      type,
      onClick,
      onActivate,
      ...rest
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'button';
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = event => {
      onClick?.(event);
      if (!event.defaultPrevented) onActivate?.(event);
    };
    const nativeProps = asChild ? {} : { type: type ?? 'button' };

    return (
      <Component
        ref={ref}
        className={classes('oods-button', className)}
        data-oods-component="Button"
        data-intent={intent}
        data-size={size}
        style={{
          '--cmp-button-background': 'var(--sys-surface-interactive-primary-default)',
          '--cmp-button-background-hover': 'var(--sys-surface-interactive-primary-hover)',
          '--cmp-button-background-disabled': 'var(--sys-surface-disabled)',
          '--cmp-button-border': 'var(--sys-border-subtle)',
          '--cmp-button-text': 'var(--sys-text-on-interactive)',
          '--cmp-button-text-disabled': 'var(--sys-text-disabled)',
          ...style,
        } as React.CSSProperties}
        onClick={handleClick}
        {...nativeProps}
        {...rest}
      >
        {children ?? content}
      </Component>
    );
  }
);
Button.displayName = 'OODS.Button';

const noSubscription = () => () => undefined;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;
const canShowModal = () =>
  typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
const hasContent = (node: React.ReactNode) => node !== undefined && node !== null && node !== false && node !== '';

// s223-m02 (#2527 ruling 13b): while a modal dialog is open the page behind it does not scroll. Every open dialog shares one
// lock, and when the last one closes the page's own inline overflow and right padding (the padding stands in for the
// scrollbar the lock hides, so nothing shifts) come back exactly as they were.
let pageLocks = 0;
let pageStyle: { overflow: string; paddingRight: string } | undefined;
function lockPageScroll(): () => void {
  const page = document.documentElement;
  if (pageLocks++ === 0) {
    const scrollbar = window.innerWidth - page.clientWidth;
    pageStyle = { overflow: page.style.overflow, paddingRight: page.style.paddingRight };
    if (scrollbar > 0) page.style.paddingRight = `${parseFloat(getComputedStyle(page).paddingRight) + scrollbar}px`;
    page.style.overflow = 'hidden';
  }
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    if (--pageLocks === 0 && pageStyle) {
      page.style.overflow = pageStyle.overflow;
      page.style.paddingRight = pageStyle.paddingRight;
      pageStyle = undefined;
    }
  };
}

/** A click on a modal dialog's backdrop reaches the dialog element itself, at a point outside its box. */
const outsideBox = (event: { clientX: number; clientY: number }, dialog: Element) => {
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
};

// s222-m02 (#2502 ruling 11): one markup with Vue and the HTML renderer: a native dialog named by its h2 title and
// described by its description, a close button, the body and a footer of actions. The consumer owns open; the close
// button, Escape and a browser close request call onClose, and the dialog stays open until open becomes false. On the
// server and while hydrating, open is the open attribute; in a browser a modal dialog opens with showModal() instead,
// so the attribute is never React's to write while the dialog is in the top layer. modal false keeps it in place.
export const Dialog = React.forwardRef<HTMLDialogElement, DialogProps>(
  (
    {
      id,
      open = false,
      modal = true,
      title,
      description,
      dismissLabel = 'Close',
      size = 'md',
      actions,
      children,
      className,
      onClose,
      onKeyDown,
      onMouseDown,
      onClick,
      ...rest
    },
    ref
  ) => {
    const generatedId = React.useId().replace(/[^\w-]/g, '');
    const dialogId = id ?? `oods-dialog-${generatedId}`;
    const element = React.useRef<HTMLDialogElement | null>(null);
    const openRef = React.useRef(open);
    const scrollLock = React.useRef<(() => void) | null>(null);
    const pressedBackdrop = React.useRef(false);
    const serverMarkup = React.useSyncExternalStore(noSubscription, () => false, () => true);
    const managed = modal && !serverMarkup && canShowModal();
    const setRef = React.useCallback((node: HTMLDialogElement | null) => {
      element.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }, [ref]);
    const releaseScroll = React.useCallback(() => {
      scrollLock.current?.();
      scrollLock.current = null;
    }, []);
    useIsomorphicLayoutEffect(() => {
      openRef.current = open;
      const dialog = element.current;
      if (!dialog || !managed) return;
      if (open && !dialog.open) dialog.showModal();
      else if (!open && dialog.open) dialog.close();
      // The page stays put while the dialog is open; its close event, or unmounting, releases it.
      if (open && dialog.open) scrollLock.current ??= lockPageScroll();
    }, [open, managed]);
    React.useEffect(() => releaseScroll, [releaseScroll]);
    const requestClose = (event: React.SyntheticEvent) => {
      event.preventDefault();
      onClose?.();
    };

    return (
      <dialog
        ref={setRef}
        id={dialogId}
        className={classes('oods-dialog', className)}
        data-oods-component="Dialog"
        data-size={size}
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={hasContent(description) ? `${dialogId}-description` : undefined}
        open={managed ? undefined : open}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (event.key === 'Escape' && !event.defaultPrevented) requestClose(event);
        }}
        onCancel={requestClose}
        onClose={() => {
          // A close event from moving a hydrated dialog into the top layer finds it open again, and is not reported. Any
          // other close releases the page; when the browser closed it (a close request it would not let be cancelled)
          // while open is still true, it is reported.
          if (element.current?.open) return;
          releaseScroll();
          if (openRef.current) onClose?.();
        }}
        onMouseDown={event => {
          onMouseDown?.(event);
          pressedBackdrop.current = managed && event.target === event.currentTarget && outsideBox(event, event.currentTarget);
        }}
        onClick={event => {
          onClick?.(event);
          // s223-m02 (#2527 ruling 13b): a click on the backdrop reports close, as the close control does. A press that
          // began inside the dialog (text selected and dragged out) is not a backdrop click.
          const backdrop = pressedBackdrop.current && event.target === event.currentTarget && outsideBox(event, event.currentTarget);
          pressedBackdrop.current = false;
          if (backdrop && !event.defaultPrevented) onClose?.();
        }}
        {...rest}
      >
        <div className="oods-dialog__header">
          <div className="oods-dialog__heading">
            <h2 id={`${dialogId}-title`} className="oods-dialog__title">{title}</h2>
            {hasContent(description) ? (
              <p id={`${dialogId}-description`} className="oods-dialog__description">{description}</p>
            ) : null}
          </div>
          <button type="button" className="oods-dialog__close" aria-label={dismissLabel} onClick={() => onClose?.()}>
            <StatusIcon name="x" />
          </button>
        </div>
        {hasContent(children) ? <div className="oods-dialog__body">{children}</div> : null}
        {hasContent(actions) ? <div className="oods-dialog__footer">{actions}</div> : null}
      </dialog>
    );
  }
);
Dialog.displayName = 'OODS.Dialog';

export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ as = 'div', elevated = false, className, ...rest }, ref) => {
    const Element = as;
    return (
      <Element
        ref={ref as React.Ref<HTMLDivElement>}
        className={classes('oods-card', className)}
        data-oods-component="Card"
        data-elevated={elevated ? 'true' : 'false'}
        {...rest}
      />
    );
  }
);
Card.displayName = 'OODS.Card';

export const Text = React.forwardRef<HTMLElement, TextProps>(
  (
    {
      as = 'span',
      content,
      children,
      label,
      size = 'md',
      weight = 'regular',
      className,
      'aria-description': ariaDescription,
      ...rest
    },
    ref
  ) => {
    const Element = as;
    return (
      <Element
        ref={ref as React.Ref<never>}
        className={classes('oods-text', className)}
        data-oods-component="Text"
        data-size={size}
        data-weight={weight}
        aria-description={ariaDescription ?? label}
        {...rest}
      >
        {children ?? content}
      </Element>
    );
  }
);
Text.displayName = 'OODS.Text';
