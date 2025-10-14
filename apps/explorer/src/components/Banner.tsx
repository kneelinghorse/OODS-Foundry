import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode
} from 'react';

export type BannerTone = 'info' | 'success' | 'warning' | 'critical' | 'accent' | 'neutral';

const BANNER_ICONS: Record<BannerTone, string> = {
  info: 'ℹ︎',
  success: '✔︎',
  warning: '⚠︎',
  critical: '⨯',
  accent: '★',
  neutral: '•'
};

export type BannerAction = {
  label: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'neutral';
} & (
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

export type BannerProps = {
  tone?: BannerTone;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: BannerAction[];
  dismissible?: boolean;
  dismissAriaLabel?: string;
  onDismiss?: () => void;
  selected?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export const Banner = forwardRef<HTMLDivElement, BannerProps>(
  (
    {
      tone = 'info',
      title,
      description,
      icon,
      actions = [],
      dismissible = false,
      dismissAriaLabel = 'Dismiss banner',
      onDismiss,
      selected,
      className,
      role = 'status',
      children,
      'aria-live': ariaLiveProp,
      ...rest
    },
    ref
  ) => {
    const glyph = icon ?? BANNER_ICONS[tone];
    const hasActions = actions.length > 0 || dismissible;
    const ariaLive = ariaLiveProp ?? (role === 'alert' ? 'assertive' : 'polite');
    const composedClassName = className ? `cmp-banner ${className}` : 'cmp-banner';

    return (
      <div
        {...rest}
        ref={ref}
        className={composedClassName}
        role={role}
        aria-live={ariaLive}
        data-banner-tone={tone}
        data-selected={selected ? 'true' : undefined}
        data-has-actions={hasActions ? 'true' : 'false'}
      >
        <span className="cmp-banner__icon" aria-hidden>
          {glyph}
        </span>

        <div className="cmp-banner__content">
          <p className="cmp-banner__title">{title}</p>
          {description ? <p className="cmp-banner__message">{description}</p> : null}
          {children}
        </div>

        {hasActions ? (
          <div className="cmp-banner__actions">
            {actions.map(({ label, icon: actionIcon, tone: actionTone, href, ...actionRest }, index) =>
              href ? (
                <a
                  key={`action-link-${index}`}
                  className="cmp-banner__action"
                  data-tone={actionTone}
                  href={href}
                  {...(actionRest as AnchorHTMLAttributes<HTMLAnchorElement>)}
                >
                  {actionIcon ? (
                    <span className="cmp-banner__action-icon" aria-hidden>
                      {actionIcon}
                    </span>
                  ) : null}
                  <span>{label}</span>
                </a>
              ) : (
                <button
                  key={`action-button-${index}`}
                  type="button"
                  className="cmp-banner__action"
                  data-tone={actionTone}
                  {...(actionRest as ButtonHTMLAttributes<HTMLButtonElement>)}
                >
                  {actionIcon ? (
                    <span className="cmp-banner__action-icon" aria-hidden>
                      {actionIcon}
                    </span>
                  ) : null}
                  <span>{label}</span>
                </button>
              )
            )}

            {dismissible ? (
              <button
                type="button"
                className="cmp-banner__dismiss"
                onClick={onDismiss}
                aria-label={dismissAriaLabel}
              >
                ⨯
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
);

Banner.displayName = 'Banner';
