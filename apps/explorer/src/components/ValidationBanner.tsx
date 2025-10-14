import { forwardRef } from 'react';
import { Banner, type BannerProps, type BannerTone } from './Banner';

export type ValidationBannerProps = Omit<BannerProps, 'tone' | 'role' | 'aria-live'> & {
  tone?: Extract<BannerTone, 'info' | 'warning' | 'critical' | 'success' | 'accent' | 'neutral'>;
  role?: BannerProps['role'];
  'aria-live'?: BannerProps['aria-live'];
};

/**
 * ValidationBanner wraps Banner and pins tone to status.* mappings for form use.
 * Avoids focus traps by remaining a non-modal, inline status/alert region.
 */
export const ValidationBanner = forwardRef<HTMLDivElement, ValidationBannerProps>(
  ({ tone = 'info', role, 'aria-live': ariaLive, ...rest }, ref) => {
    const resolvedRole = role ?? (tone === 'critical' || tone === 'warning' ? 'alert' : 'status');
    const resolvedLive = ariaLive ?? (resolvedRole === 'alert' ? 'assertive' : 'polite');
    return <Banner ref={ref} tone={tone} role={resolvedRole} aria-live={resolvedLive} {...rest} />;
  }
);

ValidationBanner.displayName = 'ValidationBanner';
