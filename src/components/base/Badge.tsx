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

export type BadgeEmphasis = 'subtle' | 'solid';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly status?: string;
  readonly domain?: StatusDomain;
  readonly tone?: StatusTone;
  readonly emphasis?: BadgeEmphasis;
  readonly icon?: ReactNode;
  readonly iconPosition?: 'start' | 'end';
  readonly showIcon?: boolean;
}

type BadgeElement = React.ElementRef<'span'>;

const DEFAULT_DOMAIN: StatusDomain = 'subscription';

function resolvePresentation(
  domain: StatusDomain,
  status: string | undefined
): StatusPresentation | undefined {
  if (!status) {
    return undefined;
  }

  return getStatusPresentation(domain, status);
}

export const Badge = React.forwardRef<BadgeElement, BadgeProps>(
  (
    {
      status,
      domain: domainProp,
      tone: toneOverride,
      emphasis = 'subtle',
      icon,
      iconPosition = 'start',
      showIcon,
      children,
      className,
      style,
      title,
      'aria-label': ariaLabelProp,
      ...rest
    },
    forwardedRef
  ) => {
    const domain = (domainProp ?? DEFAULT_DOMAIN) as StatusDomain;
    const presentation = resolvePresentation(domain, status);
    const tone = toneOverride ?? presentation?.tone ?? 'neutral';
    const tokens = presentation?.badge ?? {
      subtle: getToneTokenSet(tone),
      solid: getToneTokenSet(tone),
    };

    const palette = emphasis === 'solid' ? tokens.solid : tokens.subtle;
    const resolvedShowIcon = showIcon ?? Boolean(presentation?.iconName || icon);
    const glyph =
      icon ?? (resolvedShowIcon ? resolveStatusGlyph(presentation?.iconName) : undefined);
    const content = children ?? presentation?.label ?? status ?? null;
    const computedTitle = title ?? presentation?.description;
    const ariaLabel =
      ariaLabelProp ?? (typeof content === 'string' || typeof content === 'number'
        ? undefined
        : presentation?.label);

    const iconNode =
      glyph && resolvedShowIcon ? (
        <span className="statusable-badge__icon" aria-hidden>
          {glyph}
        </span>
      ) : null;

    const mergedClassName = ['statusable-badge', className].filter(Boolean).join(' ');
    const cssVariables = {
      '--statusable-badge-background': palette.background,
      '--statusable-badge-border': palette.border,
      '--statusable-badge-foreground': palette.foreground,
      '--statusable-badge-icon-color': palette.foreground,
    } as React.CSSProperties;

    const mergedStyle = style
      ? ({ ...cssVariables, ...style } as React.CSSProperties)
      : cssVariables;

    return (
      <span
        ref={forwardedRef}
        className={mergedClassName}
        style={mergedStyle}
        data-domain={domain}
        data-status={status}
        data-tone={tone}
        data-emphasis={emphasis}
        aria-label={ariaLabel}
        title={computedTitle}
        {...rest}
      >
        {iconPosition === 'start' ? iconNode : null}
        {content !== null ? (
          <span className="statusable-badge__label">{content}</span>
        ) : null}
        {iconPosition === 'end' ? iconNode : null}
      </span>
    );
  }
);

Badge.displayName = 'OODS.Badge';
