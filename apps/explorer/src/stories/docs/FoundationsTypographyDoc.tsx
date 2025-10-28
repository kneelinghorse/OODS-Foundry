import React, { Fragment } from 'react';
import '../../styles/index.css';
import { flatTokens } from '~/src/utils/design-tokens';

type FlatTokenKey = keyof typeof flatTokens;

const hyphenate = (token: string) =>
  token.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const normalizeValue = (value: unknown) => {
  if (value == null) {
    return '—';
  }
  return typeof value === 'string' ? value : String(value);
};

const getFlatTokenValue = (key: string) => {
  const entry = flatTokens[key as FlatTokenKey];
  return normalizeValue(entry?.value);
};

const tokenValue = (token: string, property: string) => {
  const baseKey = hyphenate(token);
  if (property === 'value') {
    return getFlatTokenValue(baseKey);
  }
  return getFlatTokenValue(`${baseKey}-${property}`);
};

const sampleStyle = (token: string): React.CSSProperties => {
  const slug = hyphenate(token);
  return {
    fontFamily: `var(--oods-${slug}-font-family, Inter, system-ui, sans-serif)`,
    fontWeight: `var(--oods-${slug}-font-weight, 400)`,
    fontSize: `var(--oods-${slug}-font-size, 1rem)`,
    lineHeight: `var(--oods-${slug}-line-height, 1.4)`,
    letterSpacing: `var(--oods-${slug}-letter-spacing, 0em)`,
    textTransform: `var(--oods-${slug}-text-case, none)` as React.CSSProperties['textTransform']
  };
};

const ramp = [
  { name: 'Heading XL', token: 'text.scale.headingXl', sample: 'Audit trails that read like receipts', usage: 'Detail page hero / primary view titles', contexts: 'detail header' },
  { name: 'Heading LG', token: 'text.scale.headingLg', sample: 'Billing health snapshot', usage: 'Card titles, section headers, list headers', contexts: 'list header, detail panels' },
  { name: 'Body MD', token: 'text.scale.bodyMd', sample: 'Receivables variance is holding steady at 2.4%.', usage: 'Detail body copy and long-form reading', contexts: 'detail body' },
  { name: 'Body SM', token: 'text.scale.bodySm', sample: 'Last invoice sent 18 hours ago to Ops team.', usage: 'Dense list items, sidebars, tables', contexts: 'list body, detail sidebar' },
  { name: 'Label MD', token: 'text.scale.labelMd', sample: 'Payment method', usage: 'Form labels, actionable UI chrome', contexts: 'forms, list actions' },
  { name: 'Caption', token: 'text.scale.caption', sample: 'Net ARR shift', usage: 'Metadata, badge copy, supporting hints', contexts: 'badges, meta, status banners' }
];

const lineHeights = [
  { token: 'text.lineHeight.tight', label: 'Tight', usage: 'Headlines in compact headers' },
  { token: 'text.lineHeight.standard', label: 'Standard', usage: 'Default UI rhythm' },
  { token: 'text.lineHeight.relaxed', label: 'Relaxed', usage: 'Supporting copy with extra air' },
  { token: 'text.lineHeight.loose', label: 'Loose', usage: 'Detail narratives and analytical explanations' }
];

const letterSpacing = [
  { token: 'text.letter-spacing.tight', label: 'Tight', usage: 'Display headings' },
  { token: 'text.letter-spacing.default', label: 'Default', usage: 'Body copy and labels' },
  { token: 'text.letter-spacing.wide', label: 'Wide', usage: 'Uppercase captions and metadata' }
];

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 10px',
  marginTop: '1.5rem'
};

const headCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cmp-text-body)',
  padding: '0.35rem 0.75rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default) 65%, transparent)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.85rem 0.75rem',
  background: 'var(--cmp-surface-panel)',
  borderRadius: '0.85rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 55%, transparent)',
  verticalAlign: 'top'
};

const detailListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.25rem'
};

const TypographyDoc: React.FC = () => (
  <Fragment>
    <h1>Typography Ramp</h1>
    <p>
      Typography composites follow the DTCG <code>typography</code> shape. Each scale references particle tokens for family, size, weight,
      line-height, and letter-spacing. Applying a single utility class (for example <code>context-list</code>) resolves the entire ramp through CSS variables — no component overrides required.
    </p>

    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={{ ...headCellStyle, width: '24%' }}>Scale</th>
          <th style={{ ...headCellStyle, width: '32%' }}>Preview</th>
          <th style={{ ...headCellStyle, width: '22%' }}>Token</th>
          <th style={{ ...headCellStyle }}>Resolved Values</th>
        </tr>
      </thead>
      <tbody>
        {ramp.map((entry) => {
          const slug = hyphenate(entry.token);
          return (
            <tr key={entry.token}>
              <td style={cellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <strong>{entry.name}</strong>
                  <span style={{ color: 'var(--cmp-text-body)', fontSize: '0.82rem' }}>{entry.usage}</span>
                  <code style={{ fontSize: '0.75rem' }}>context: {entry.contexts}</code>
                </div>
              </td>
              <td style={cellStyle}>
                <div
                  style={{
                    ...sampleStyle(entry.token),
                    background: 'var(--cmp-surface-subtle)',
                    padding: '1.1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)'
                  }}
                >
                  {entry.sample}
                </div>
              </td>
              <td style={cellStyle}>
                <div style={detailListStyle}>
                  <code>{entry.token}</code>
                  <code>{`--oods-${slug}-*`}</code>
                </div>
              </td>
              <td style={cellStyle}>
                <dl style={{ ...detailListStyle, gridTemplateColumns: 'auto auto', columnGap: '0.75rem' }}>
                  <Fragment>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Font</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'font-family')}</dd>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Size</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'font-size')}</dd>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Weight</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'font-weight')}</dd>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Line height</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'line-height')}</dd>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Letter spacing</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'letter-spacing')}</dd>
                    <dt style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cmp-text-body)' }}>Case</dt>
                    <dd style={{ margin: 0 }}>{tokenValue(entry.token, 'text-case')}</dd>
                  </Fragment>
                </dl>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <h2>Line-Height Tokens</h2>
    <p>
      Line-height hooks attach to layout contexts independently of the scale. Detail bodies switch to <code>text.lineHeight.loose</code> while list bodies remain compact.
    </p>
    <table style={{ ...tableStyle, borderSpacing: '0 6px' }}>
      <thead>
        <tr>
          <th style={{ ...headCellStyle, width: '28%' }}>Token</th>
          <th style={{ ...headCellStyle, width: '18%' }}>Value</th>
          <th style={headCellStyle}>Usage</th>
        </tr>
      </thead>
      <tbody>
        {lineHeights.map((entry) => (
          <tr key={entry.token}>
            <td style={cellStyle}>
              <div style={detailListStyle}>
                <strong>{entry.label}</strong>
                <code>{entry.token}</code>
              </div>
            </td>
            <td style={cellStyle}>
              <code>{tokenValue(entry.token, 'value')}</code>
            </td>
            <td style={cellStyle}>{entry.usage}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Letter-Spacing Tokens</h2>
    <table style={{ ...tableStyle, borderSpacing: '0 6px' }}>
      <thead>
        <tr>
          <th style={{ ...headCellStyle, width: '28%' }}>Token</th>
          <th style={{ ...headCellStyle, width: '18%' }}>Value</th>
          <th style={headCellStyle}>Usage</th>
        </tr>
      </thead>
      <tbody>
        {letterSpacing.map((entry) => (
          <tr key={entry.token}>
            <td style={cellStyle}>
              <div style={detailListStyle}>
                <strong>{entry.label}</strong>
                <code>{entry.token}</code>
              </div>
            </td>
            <td style={cellStyle}>
              <code>{tokenValue(entry.token, 'value')}</code>
            </td>
            <td style={cellStyle}>{entry.usage}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Implementation Notes</h2>
    <ul>
      <li>
        The Tailwind <code>context-*</code> plugin writes <code>--context-typography-*</code> variables that map straight to these tokens. Components
        continue reading slot-level <code>--cmp-*</code> hooks — no prop plumbing.
      </li>
      <li>
        All typography tokens chain to Theme&nbsp;0&apos;s <code>ref.typography</code> particles. Alternate themes can override the ramp by swapping particle references without touching component code.
      </li>
      <li>
        When authoring new scales, ensure the composite resolves to the same family + fallback stack to preserve layout metrics.
      </li>
    </ul>
  </Fragment>
);

export default TypographyDoc;
