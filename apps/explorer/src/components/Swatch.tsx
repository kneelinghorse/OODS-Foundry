import { Fragment, ReactNode, useMemo } from 'react';
import { contrastRatio, isHexColor } from '../../../../../tools/a11y/contrast.js';

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
const FALLBACK_FOREGROUND = '#0f172a';
const FALLBACK_BACKGROUND = '#ffffff';

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
    const fg = isHexColor(foreground ?? '') ? (foreground as string) : undefined;
    const bg = isHexColor(background ?? '') ? (background as string) : undefined;

    return {
      foreground: fg ?? FALLBACK_FOREGROUND,
      background: bg ?? FALLBACK_BACKGROUND,
      borderColour: isHexColor(border ?? '') ? (border as string) : undefined,
      canMeasure: Boolean(fg && bg)
    };
  }, [foreground, background, border]);

  const contrast = useMemo(() => {
    if (!previewColours.canMeasure) {
      return { ratio: null, passes: null };
    }

    try {
      const ratio = contrastRatio(previewColours.foreground, previewColours.background);
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
        border: '1px solid rgba(148, 163, 184, 0.4)',
        borderRadius: '0.75rem',
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        backgroundColor: '#f8fafc'
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
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{label}</div>
          {description ? (
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#334155' }}>
            {formatContrast(contrast.ratio)}
          </span>
          {passLabel ? (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                backgroundColor: contrast.passes ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.18)',
                color: contrast.passes ? '#166534' : '#b91c1c'
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
          border: previewColours.borderColour ? `1px solid ${previewColours.borderColour}` : '1px solid rgba(148, 163, 184, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          minHeight: '3.75rem',
          boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.03)'
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
            color: '#334155'
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
