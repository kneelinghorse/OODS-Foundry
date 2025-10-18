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

const TimelineDoc: React.FC = () => {
  const timelineSpec = CONTEXT_MATRIX.timeline;
  const regions = Object.entries(timelineSpec).map(([region, tokens]) => ({
    region,
    spacing: tokens.spacing.length ? tokens.spacing.join(', ') : '—',
    typography: tokens.typography.length ? tokens.typography.join(', ') : '—',
    surface: tokens.surface.length ? tokens.surface.join(', ') : '—',
    status: tokens.status.length ? tokens.status.join(', ') : '—'
  }));

  return (
    <div>
      <h1>Timeline Context Defaults</h1>
      <p>
        Timeline views emphasise chronology. The <code>context-timeline</code> class compresses vertical rhythm with{' '}
        <code>spacing.stack.compact</code> while keeping metadata legible via <code>text.scale.body-sm</code> +
        <code>text.scale.caption</code>. Components remain generic—context + <code>data-region</code> do the heavy lifting.
      </p>
      <p>
        Status chips and time badges inherit tone from <code>status.*</code> and <code>surface.*</code> references, ensuring
        consistent markers across billing, usage, and success events.
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
        <code>{`<section class="context-timeline">
  <header data-region="pageHeader">...</header>
  <div data-region="viewToolbar">...</div>
  <main data-region="main">
    <ol class="timeline-stream">
      <li class="timeline-item">...</li>
    </ol>
  </main>
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
          <strong>Stream rhythm:</strong> <code>spacing.stack.compact</code> keeps events dense while column gutters use{' '}
          <code>spacing.inset.compact</code> so markers and cards align.
        </li>
        <li>
          <strong>Line height:</strong> Body copy uses <code>text.line-height.standard</code> to tighten rhythm slightly for
          faster scan without sacrificing legibility.
        </li>
        <li>
          <strong>Legible microcopy:</strong> Metadata leans on <code>text.scale.caption</code> with AA contrast; body content
          sticks to <code>text.scale.body-sm</code> for scannable summaries.
        </li>
        <li>
          <strong>Status binding:</strong> Wildcard <code>status.*</code> covers every SaaS tone—badges, markers, and banners
          all inherit from the same token family.
        </li>
        <li>
          <strong>Composable variants:</strong> Region + context variants allow utilities such as{' '}
          <code>timeline:main:divide-y</code> without writing one-off CSS.
        </li>
      </ul>
    </div>
  );
};

export default TimelineDoc;
