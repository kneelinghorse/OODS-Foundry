import React from 'react';
import { CONTEXT_MATRIX } from '~/packages/tw-variants/dist/context-matrix.js';
import '../../styles/index.css';

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 8px',
  marginTop: '1.5rem'
};

const headCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cmp-text-body)',
  padding: '0.4rem 0.75rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default) 60%, transparent)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.75rem 0.75rem',
  background: 'var(--cmp-surface-panel)',
  borderRadius: '0.8rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 55%, transparent)',
  verticalAlign: 'top'
};

const DetailDoc: React.FC = () => {
  const detailSpec = CONTEXT_MATRIX.detail;
  const listSpec = CONTEXT_MATRIX.list;

  const regions = Object.entries(detailSpec).map(([region, tokens]) => ({
    region,
    spacing: tokens.spacing.length ? tokens.spacing.join(', ') : '—',
    typography: tokens.typography.length ? tokens.typography.join(', ') : '—',
    surface: tokens.surface.length ? tokens.surface.join(', ') : '—',
    status: tokens.status.length ? tokens.status.join(', ') : '—'
  }));

  const compare = (region: string, property: keyof typeof detailSpec[keyof typeof detailSpec]) => {
    const listRegion: any = (listSpec as any)[region] || {};
    const detailRegion: any = (detailSpec as any)[region] || {};
    const listTokens: string[] = Array.isArray(listRegion[property]) ? listRegion[property] : [];
    const detailTokens: string[] = Array.isArray(detailRegion[property]) ? detailRegion[property] : [];
    if (JSON.stringify(listTokens) === JSON.stringify(detailTokens)) {
      return 'matches list';
    }
    const from = listTokens.length ? listTokens.join(', ') : '—';
    const to = detailTokens.length ? detailTokens.join(', ') : '—';
    return `${from} → ${to}`;
  };

  return (
    <div>
      <h1>Detail Context Defaults</h1>
      <p>
        Detail views trade density for long-form comprehension. The <code>context-detail</code> class widens inset spacing,
        boosts headings to <code>text.scale.headingXl</code>, and relaxes body line-heights, all without touching component code.
      </p>
      <p>
        Components remain unaware of the context: they continue reading <code>--cmp-*</code> slot tokens that the Tailwind plugin
        remaps. This keeps structural layout decisions inside contexts while components stay reusable.
      </p>
      <pre
        style={{
          background: 'var(--cmp-surface-subtle)',
          borderRadius: '0.75rem',
          padding: '1rem',
          border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
          fontSize: '0.85rem',
          overflowX: 'auto'
        }}
      >
        <code>{`<article class="context-detail">
  <header data-region="header">...</header>
  <section data-region="body">...</section>
  <aside data-region="sidebar">...</aside>
</article>`}</code>
      </pre>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...headCellStyle, width: '18%' }}>Region</th>
            <th style={{ ...headCellStyle, width: '22%' }}>Spacing</th>
            <th style={{ ...headCellStyle, width: '22%' }}>Typography</th>
            <th style={{ ...headCellStyle, width: '22%' }}>Surface</th>
            <th style={headCellStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((entry) => (
            <tr key={entry.region}>
              <td style={cellStyle}>
                <strong>{entry.region}</strong>
              </td>
              <td style={cellStyle}>
                <code>{entry.spacing}</code>
              </td>
              <td style={cellStyle}>
                <code>{entry.typography}</code>
              </td>
              <td style={cellStyle}>
                <code>{entry.surface}</code>
              </td>
              <td style={cellStyle}>
                <code>{entry.status}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Key Deltas vs List</h2>
      <ul>
        <li>
          <strong>Header:</strong> {compare('header', 'typography')} unlocks hero-level hierarchy while {compare('header', 'spacing')} restores breathing room.
        </li>
        <li>
          <strong>Body:</strong> {compare('body', 'spacing')} and {compare('body', 'typography')} enable long-form reading with <code>text.lineHeight.loose</code>.
        </li>
        <li>
          <strong>Badges:</strong> {compare('badges', 'spacing')} widens chip gutters so metadata feels deliberate instead of cramped.
        </li>
        <li>
          <strong>Sidebar & footer:</strong> {compare('sidebar', 'spacing')} and {compare('footer', 'spacing')} keep secondary panels visually aligned with the main narrative.
        </li>
      </ul>

      <h2>Implementation Notes</h2>
      <ul>
        <li>
          Regions that require relaxed reading (<code>body</code>, <code>meta</code>) swap to <code>text.lineHeight.loose</code> while
          the same components still read <code>--cmp-*</code>.
        </li>
        <li>
          The context class composes with region variants, e.g. <code>detail:body:prose</code>, so teams can layer Tailwind utilities
          without bespoke CSS.
        </li>
        <li>
          Surface tokens stay largely aligned with list views; only spacing/typography change, ensuring colour semantics remain consistent.
        </li>
      </ul>
    </div>
  );
};

export default DetailDoc;
