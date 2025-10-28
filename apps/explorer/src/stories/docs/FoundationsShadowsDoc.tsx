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

const buildShadow = (token: string) => {
  const slug = hyphenate(token);
  const parts = [
    `var(--oods-${slug}-offset-x, 0px)`,
    `var(--oods-${slug}-offset-y, 0px)`,
    `var(--oods-${slug}-blur, 0px)`,
    `var(--oods-${slug}-spread, 0px)`,
    `var(--oods-${slug}-color, rgba(15, 23, 42, 0.12)`
  ];
  return parts.join(' ');
};

const shadowSamples = [
  {
    name: 'Raised Card',
    token: 'shadow.elevation.card',
    usage: 'Primary cards, inset panels, dashboard widgets',
    copy:
      'Cards lift off the canvas without overpowering surrounding surfaces. The shadow stays soft while preserving depth cues.'
  },
  {
    name: 'High Overlay',
    token: 'shadow.elevation.overlay',
    usage: 'Dialogs, drawers, command palettes',
    copy:
      'High elevation overlays expand the blur radius and opacity to create strong foreground separation.'
  }
];

const headlineStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem'
};

const specimenGrid: React.CSSProperties = {
  display: 'grid',
  gap: '1.6rem',
  marginTop: '1.25rem'
};

const specimenCard = (token: string): React.CSSProperties => ({
  background: 'var(--theme-surface-raised)',
  color: 'var(--sys-text-primary)',
  borderRadius: 'var(--oods-border-surface-default-radius, 12px)',
  borderWidth: 'var(--oods-border-surface-default-width, 1px)',
  borderStyle: 'var(--oods-border-surface-default-style, solid)',
  borderColor: 'color-mix(in srgb, var(--theme-border-subtle) 70%, transparent)',
  padding: '1.4rem',
  boxShadow: buildShadow(token),
  maxWidth: '32rem',
  transition: 'box-shadow 0.2s ease',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem'
});

const infoPanel: React.CSSProperties = {
  display: 'grid',
  gap: '0.4rem',
  fontSize: '0.82rem',
  color: 'var(--cmp-text-body)'
};

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

const ShadowDoc: React.FC = () => (
  <div style={{ display: 'grid', gap: '1.5rem', paddingBottom: '2rem' }}>
    <section style={headlineStyle}>
      <h1>Shadow Composites</h1>
      <p>
        Shadow composites expose the <code>offsetX</code>, <code>offsetY</code>, <code>blur</code>, <code>spread</code>, and{' '}
        <code>color</code> sub-keys so layout systems can compose elevation declaratively. Each specimen below resolves entirely
        through CSS variables emitted by <code>shadow.json</code>.
      </p>
    </section>

    <section style={specimenGrid}>
      {shadowSamples.map((sample) => (
        <article key={sample.token} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={infoPanel}>
            <strong>{sample.name}</strong>
            <span>{sample.usage}</span>
            <code>{sample.token}</code>
          </div>
          <div style={specimenCard(sample.token)}>
            <h3 style={{ margin: 0 }}>{sample.name}</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--sys-text-secondary)' }}>{sample.copy}</p>
            <code style={{ marginTop: '0.2rem', fontSize: '0.78rem' }}>
              box-shadow: {buildShadow(sample.token)}
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
            <th style={{ ...headCellStyle, width: '24%' }}>Composite</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Offset X</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Offset Y</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Blur</th>
            <th style={{ ...headCellStyle, width: '18%' }}>Spread</th>
            <th style={headCellStyle}>Color</th>
          </tr>
        </thead>
        <tbody>
          {shadowSamples.map((sample) => (
            <tr key={sample.token}>
              <td style={cellStyle}>
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  <strong>{sample.name}</strong>
                  <code>{sample.token}</code>
                </div>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'offset-x')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'offset-y')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'blur')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'spread')}</code>
              </td>
              <td style={cellStyle}>
                <code>{tokenValue(sample.token, 'color')}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  </div>
);

export default ShadowDoc;
