import { Fragment, ReactNode, useMemo } from 'react';
import { contrastRatio, isHexColor } from '../../../../tools/a11y/contrast.js';

type SwatchDetail = {
  label: string;
  value?: ReactNode;
};

export type SwatchProps = {
  label: string;
  description?: string;
  sampleText?: string;
  foreground?: string;
  background?: string;
  border?: string;
  threshold?: number;
  iconLabel?: string;
  details?: SwatchDetail[];
};

const DEFAULT_TEXT = 'Aa';
const FALLBACK_FOREGROUND = 'var(--cmp-text-body)';
const FALLBACK_BACKGROUND = 'var(--cmp-surface-panel)';
const SWATCH_TOKENS = {
  textBody: 'var(--cmp-text-body)',
  textMuted: 'var(--cmp-text-muted)',
  textSecondary: 'var(--cmp-text-secondary, var(--sys-text-secondary))',
  surfacePanel: 'var(--cmp-surface-panel)',
  borderSoft: 'color-mix(in srgb, var(--cmp-border-default) 40%, transparent)',
  borderSubtle: 'color-mix(in srgb, var(--cmp-border-default) 25%, transparent)',
  badgePassBackground: 'color-mix(in srgb, var(--sys-status-success-surface) 45%, transparent)',
  badgeFailBackground: 'color-mix(in srgb, var(--sys-status-critical-surface) 45%, transparent)',
  badgePassText: 'var(--sys-status-success-text)',
  badgeFailText: 'var(--sys-status-critical-text)',
  insetShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--cmp-text-body) 3%, transparent)'
} as const;

const formatContrast = (ratio: number | null) => {
  if (ratio === null) {
    return '—';
  }
  return `${ratio.toFixed(2)}:1`;
};

const getPassLabel = (passes: boolean | null) => {
  if (passes === null) {
    return null;
  }
  return passes ? 'Pass' : 'Fail';
};

export const Swatch = ({
  label,
  description,
  sampleText = DEFAULT_TEXT,
  foreground,
  background,
  border,
  threshold = 4.5,
  iconLabel,
  details = []
}: SwatchProps) => {
  const previewColours = useMemo(() => {
    const normalise = (value?: string) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalisedForeground = normalise(foreground as string | undefined);
    const normalisedBackground = normalise(background as string | undefined);
    const normalisedBorder = normalise(border);

    return {
      foreground: normalisedForeground ?? FALLBACK_FOREGROUND,
      background: normalisedBackground ?? FALLBACK_BACKGROUND,
      borderColour: normalisedBorder,
      measurableForeground: normalisedForeground && isHexColor(normalisedForeground) ? normalisedForeground : undefined,
      measurableBackground: normalisedBackground && isHexColor(normalisedBackground) ? normalisedBackground : undefined
    };
  }, [foreground, background, border]);

  const contrast = useMemo(() => {
    if (!previewColours.measurableForeground || !previewColours.measurableBackground) {
      return { ratio: null, passes: null };
    }

    try {
      const ratio = contrastRatio(previewColours.measurableForeground, previewColours.measurableBackground);
      const rounded = Number(ratio.toFixed(2));
      const passes = rounded + Number.EPSILON >= threshold;
      return { ratio: rounded, passes };
    } catch {
      return { ratio: null, passes: null };
    }
  }, [previewColours, threshold]);

  const passLabel = getPassLabel(contrast.passes);

  return (
    <div
      style={{
        border: `1px solid ${SWATCH_TOKENS.borderSoft}`,
        borderRadius: '0.75rem',
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        backgroundColor: SWATCH_TOKENS.surfacePanel
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}
      >
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: SWATCH_TOKENS.textBody }}>
            {label}
          </div>
          {description ? (
            <div
              style={{ fontSize: '0.8rem', color: SWATCH_TOKENS.textMuted, marginTop: '0.25rem' }}
            >
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span
            style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: SWATCH_TOKENS.textSecondary }}
          >
            {formatContrast(contrast.ratio)}
          </span>
          {passLabel ? (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                backgroundColor: contrast.passes
                  ? SWATCH_TOKENS.badgePassBackground
                  : SWATCH_TOKENS.badgeFailBackground,
                color: contrast.passes ? SWATCH_TOKENS.badgePassText : SWATCH_TOKENS.badgeFailText
              }}
            >
              {passLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          borderRadius: '0.65rem',
          padding: '1rem',
          backgroundColor: previewColours.background,
          color: previewColours.foreground,
          border: previewColours.borderColour
            ? `1px solid ${previewColours.borderColour}`
            : `1px solid ${SWATCH_TOKENS.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          minHeight: '3.75rem',
          boxShadow: SWATCH_TOKENS.insetShadow
        }}
      >
        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{sampleText}</span>
        {iconLabel ? (
          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', opacity: 0.8 }}>{iconLabel}</span>
        ) : null}
      </div>

      {details.length > 0 ? (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: '0.75rem',
            rowGap: '0.4rem',
            fontSize: '0.78rem',
            color: SWATCH_TOKENS.textSecondary
          }}
        >
          {details.map((detail) => (
            <Fragment key={`${label}-${detail.label}`}>
              <dt style={{ fontWeight: 600 }}>{detail.label}</dt>
              <dd style={{ margin: 0, fontFamily: detail.label.toLowerCase().includes('token') ? 'monospace' : undefined }}>
                {detail.value ?? '—'}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  );
};
