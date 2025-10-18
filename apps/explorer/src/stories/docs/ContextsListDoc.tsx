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

const ListDoc: React.FC = () => {
  const spec = CONTEXT_MATRIX.list;
  const regions = Object.entries(spec).map(([region, tokens]) => ({
    region,
    spacing: tokens.spacing.length ? tokens.spacing.join(', ') : '—',
    typography: tokens.typography.length ? tokens.typography.join(', ') : '—',
    surface: tokens.surface.length ? tokens.surface.join(', ') : '—',
    status: tokens.status.length ? tokens.status.join(', ') : '—'
  }));

  return (
    <div>
      <h1>List Context Defaults</h1>
      <p>
        List views prioritise information density. The <code>context-list</code> class, paired with <code>data-region</code> attributes,
        applies compact spacing, smaller typography scales, and subtle surface treatments via CSS variables.
      </p>
      <p>
        Components remain unaware of the context: they continue reading <code>--cmp-*</code> slot tokens that the Tailwind plugin
        remaps. This keeps the variant plugin as the integration point for context-aware adjustments.
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
        <code>{`<section class="context-list">
  <header data-region="header">...</header>
  <div data-region="body">...</div>
  <footer data-region="footer">...</footer>
</section>`}</code>
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

      <h2>Design Notes</h2>
      <ul>
        <li>
          <strong>Compact rhythm:</strong> <code>spacing.inset.compact</code> and <code>spacing.inline.xs</code> keep cards legible while
          maximising density.
        </li>
        <li>
          <strong>Readable microcopy:</strong> Metadata and badges use <code>text.scale.caption</code> to stay subordinate without
          dropping below accessible contrast sizes.
        </li>
        <li>
          <strong>Badge inheritance:</strong> Regions that render status chips rely on wildcards such as <code>surface.badge.*</code> so the
          same class supports every SaaS status tone out of the box.
        </li>
        <li>
          <strong>Pure components:</strong> Slots continue reading <code>--cmp-*</code>; they never branch on context. The variant plugin is
          the single integration point for context-aware adjustments.
        </li>
      </ul>
    </div>
  );
};

export default ListDoc;
