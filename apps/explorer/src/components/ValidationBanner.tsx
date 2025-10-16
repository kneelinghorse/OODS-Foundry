import { forwardRef, type ReactNode } from 'react';
import { Banner, type BannerProps, type BannerTone } from './Banner';

export type ValidationBannerStatus = 'info' | 'warning' | 'error' | 'success' | 'pending';

type StatusDefaults = {
  tone: Extract<BannerTone, 'info' | 'warning' | 'critical' | 'success' | 'accent' | 'neutral'>;
  role: BannerProps['role'];
  ariaLive: NonNullable<BannerProps['aria-live']>;
  icon?: ReactNode;
};

const STATUS_DEFAULTS: Record<ValidationBannerStatus, StatusDefaults> = {
  info: { tone: 'info', role: 'status', ariaLive: 'polite' },
  warning: { tone: 'warning', role: 'alert', ariaLive: 'assertive' },
  error: { tone: 'critical', role: 'alert', ariaLive: 'assertive' },
  success: { tone: 'success', role: 'status', ariaLive: 'polite', icon: '✔︎' },
  pending: { tone: 'accent', role: 'status', ariaLive: 'polite', icon: '…' }
};

export type ValidationBannerProps = Omit<BannerProps, 'tone' | 'role' | 'aria-live'> & {
  tone?: Extract<BannerTone, 'info' | 'warning' | 'critical' | 'success' | 'accent' | 'neutral'>;
  role?: BannerProps['role'];
  'aria-live'?: BannerProps['aria-live'];
  status?: ValidationBannerStatus;
};

/**
 * ValidationBanner wraps Banner and pins tone to status.* mappings for form use.
 * Avoids focus traps by remaining a non-modal, inline status/alert region.
 */
export const ValidationBanner = forwardRef<HTMLDivElement, ValidationBannerProps>(
  ({ tone, role, status, icon, 'aria-live': ariaLive, ...rest }, ref) => {
    const defaults = status ? STATUS_DEFAULTS[status] : undefined;
    const resolvedTone = tone ?? defaults?.tone ?? 'info';
    const resolvedRole =
      role ?? defaults?.role ?? (resolvedTone === 'critical' || resolvedTone === 'warning' ? 'alert' : 'status');
    const resolvedLive = ariaLive ?? defaults?.ariaLive ?? (resolvedRole === 'alert' ? 'assertive' : 'polite');
    const resolvedIcon = icon ?? defaults?.icon;

    const { ['aria-busy']: ariaBusyProp, ...restWithoutBusy } = rest;
    const ariaBusy = ariaBusyProp ?? (status === 'pending' ? true : undefined);

    return (
      <Banner
        ref={ref}
        tone={resolvedTone}
        role={resolvedRole}
        aria-live={resolvedLive}
        icon={resolvedIcon}
        aria-busy={ariaBusy}
        data-validation-status={status ?? undefined}
        data-busy={status === 'pending' ? 'true' : undefined}
        {...restWithoutBusy}
      />
    );
  }
);

ValidationBanner.displayName = 'ValidationBanner';
