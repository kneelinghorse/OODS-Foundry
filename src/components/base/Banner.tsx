import * as React from 'react';
import type { ReactNode } from 'react';
import {
  getBannerToneTokenSet,
  getStatusPresentation,
  getToneTokenSet,
  type StatusDomain,
  type StatusPresentation,
  type StatusTone,
} from '../statusables/statusRegistry.js';
import { resolveStatusGlyph } from '../statusables/statusGlyph.js';

export type BannerEmphasis = 'subtle' | 'solid';

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  readonly status?: string;
  readonly domain?: StatusDomain;
  readonly tone?: StatusTone;
  readonly emphasis?: BannerEmphasis;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly actions?: ReactNode;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
  readonly showIcon?: boolean;
  readonly children?: ReactNode;
}

type BannerElement = React.ElementRef<'div'>;

const DEFAULT_DOMAIN: StatusDomain = 'subscription';
const NEGATIVE_TONES = new Set<StatusTone>(['critical']);

function resolvePresentation(
  domain: StatusDomain,
  status: string | undefined
): StatusPresentation | undefined {
  if (!status) {
    return undefined;
  }

  return getStatusPresentation(domain, status);
}

export const Banner = React.forwardRef<BannerElement, BannerProps>(
  (
    {
      status,
      domain: domainProp,
      tone: toneOverride,
      emphasis = 'subtle',
      title,
      description,
      icon,
      actions,
      onDismiss,
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
    const tokens = presentation?.banner ?? {
      subtle: getBannerToneTokenSet(tone),
      solid: getToneTokenSet(tone),
    };

    const palette = emphasis === 'solid' ? tokens.solid : tokens.subtle;
    const resolvedShowIcon = showIcon ?? Boolean(icon || presentation?.iconName);
    const glyph =
      icon ?? (resolvedShowIcon ? resolveStatusGlyph(presentation?.iconName) : undefined);
    const heading = title ?? presentation?.label ?? status;
    const detail = description ?? presentation?.description ?? children;
    const role: 'alert' | 'status' = NEGATIVE_TONES.has(tone) ? 'alert' : 'status';
    const ariaLive = role === 'alert' ? 'assertive' : 'polite';

    const iconNode =
      glyph && resolvedShowIcon ? (
        <span className="statusable-banner__icon" aria-hidden>
          {glyph}
        </span>
      ) : null;

    const mergedClassName = ['statusable-banner', className].filter(Boolean).join(' ');
    const cssVariables = {
      '--statusable-banner-background': palette.background,
      '--statusable-banner-border': palette.border,
      '--statusable-banner-foreground': palette.foreground,
      '--statusable-banner-icon-color': palette.foreground,
    } as React.CSSProperties;

    const mergedStyle = style
      ? ({ ...cssVariables, ...style } as React.CSSProperties)
      : cssVariables;

    return (
      <div
        ref={forwardedRef}
        role={role}
        aria-live={ariaLive}
        className={mergedClassName}
        style={mergedStyle}
        data-domain={domain}
        data-status={status}
        data-tone={tone}
        data-emphasis={emphasis}
        {...rest}
      >
        {iconNode}
        <div className="statusable-banner__content">
          {heading ? (
            <p className="statusable-banner__title">{heading}</p>
          ) : null}
          {detail ? (
            <p className="statusable-banner__description">{detail}</p>
          ) : null}
          {actions ? (
            <div className="statusable-banner__actions" role="group">
              {actions}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="statusable-banner__dismiss"
            aria-label={dismissLabel}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }
);

Banner.displayName = 'OODS.Banner';
