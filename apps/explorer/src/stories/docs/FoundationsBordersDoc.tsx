import React from 'react';
import '../../styles/index.css';
import { flatTokens } from '~/src/utils/design-tokens';

const hyphenate = (token: string) =>
  token.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const lookup = (key: string): string => {
  const entry = flatTokens[key as keyof typeof flatTokens];
  const value = entry?.value ?? null;
  if (value == null) {
    return '—';
  }
  return typeof value === 'string' ? value : String(value);
};

const tokenValue = (token: string, property: string) => lookup(`${hyphenate(token)}-${property}`);

const borderSamples = [
  {
    name: 'Surface Default',
    token: 'border.surface.default',
    usage: 'Card frames, inset panels, quiet containers',
    copy:
      'Default surface borders lean on Theme 0 neutrals. Use them to outline cards that rest directly on the canvas.',
    styles: {
      background: 'var(--theme-surface-raised)',
      text: 'var(--sys-text-primary)',
      icon: 'var(--sys-icon-primary)'
    }
  },
  {
    name: 'Critical Banner',
    token: 'border.status.critical',
    usage: 'Blocking alerts, system incidents, destructive confirmations',
    copy:
      'Critical banners inherit their border colour from the status ramp and maintain consistent curvature with compact surfaces.',
    styles: {
      background: 'var(--theme-status-critical-surface)',
      text: 'var(--theme-status-critical-text)',
      icon: 'var(--theme-status-critical-icon)'
    }
  }
];

const specimenContainer: React.CSSProperties = {
  display: 'grid',
  gap: '1.6rem',
  marginTop: '1.25rem'
};

const specimenCard = (token: string, styles: { background: string; text: string; icon: string }): React.CSSProperties => ({
  background: styles.background,
  color: styles.text,
  borderWidth: `var(--oods-${hyphenate(token)}-width, 1px)`,
  borderStyle: `var(--oods-${hyphenate(token)}-style, solid)`,
  borderColor: `var(--oods-${hyphenate(token)}-color, rgba(148,163,184,0.55))`,
  borderRadius: `var(--oods-${hyphenate(token)}-radius, 12px)`,
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  maxWidth: '32rem'
});

const iconBadge = (color: string): React.CSSProperties => ({
  width: '2rem',
  height: '2rem',
  borderRadius: '999px',
  background: color,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.2rem',
  color: 'var(--theme-surface-canvas)'
});

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 8px',
  marginTop: '1rem'
};

const headCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cmp-text-body)',
  padding: '0.35rem 0.65rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default) 55%, transparent)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.65rem',
  background: 'var(--cmp-surface-panel)',
  borderRadius: '0.75rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
  verticalAlign: 'top'
};

const BorderDoc: React.FC = () => (
  <div style={{ display: 'grid', gap: '1.5rem', paddingBottom: '2rem' }}>
    <section style={{ display: 'grid', gap: '0.35rem' }}>
      <h1>Border Composites</h1>
      <p>
        Border composites bundle <code>width</code>, <code>style</code>, <code>color</code>, and <code>radius</code> so outlines and
        frames can be applied without hand-tuning each property. The specimens below demonstrate how the same structure adapts to
        subtle surfaces and critical banners.
      </p>
    </section>

    <section style={specimenContainer}>
      {borderSamples.map((sample) => (
        <article key={sample.token} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--cmp-text-body)' }}>
            <strong style={{ color: 'var(--sys-text-primary)' }}>{sample.name}</strong>
            <span>{sample.usage}</span>
            <code>{sample.token}</code>
          </div>
          <div style={specimenCard(sample.token, sample.styles)}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span style={iconBadge(sample.styles.icon)} aria-hidden>
                !
              </span>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <strong style={{ fontSize: '1.05rem' }}>{sample.name}</strong>
                <span style={{ fontSize: '0.9rem' }}>{sample.copy}</span>
              </div>
            </div>
            <code style={{ fontSize: '0.78rem' }}>
              border: {`var(--oods-${hyphenate(sample.token)}-width)`} {`var(--oods-${hyphenate(sample.token)}-style)`}{' '}
              {`var(--oods-${hyphenate(sample.token)}-color)`}; radius:{' '}
              {`var(--oods-${hyphenate(sample.token)}-radius)`}
            </code>
          </div>
        </article>
      ))}
    </section>

    <section>
      <h2>Token Breakdown</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...headCellStyle, width: '26%' }}>Composite</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Width</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Style</th>
            <th style={{ ...headCellStyle, width: '20%' }}>Color</th>
            <th style={headCellStyle}>Radius</th>
          </tr>
        </thead>
        <tbody>
          {borderSamples.map((sample) => (
            <tr key={sample.token}>
              <td style={cellStyle}>
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  <strong>{sample.name}</strong>
                  <code>{sample.token}</code>
                </div>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'width')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'style')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'color')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'radius')}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  </div>
);

export default BorderDoc;
