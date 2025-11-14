import React from 'react';
import '../../styles/index.css';
import DarkModeDemo from '../../pages/DarkModeDemo';

const summaryList = [
  {
    heading: 'Surface & Text',
    copy:
      'Canvas, panel, and subtle surfaces shift to cool neutrals with ≥4.5:1 contrast against primary text. Text tokens stay in sync so components keep reading --cmp-text-* without branching.'
  },
  {
    heading: 'Status Ramps',
    copy:
      'All five status ramps (info, success, warning, critical, neutral) now provide dark surfaces, borders, text, and icons. StatusChip picks them up automatically via its tone data attribute.'
  },
  {
    heading: 'Elevation',
    copy:
      'Shadow tokens pivot to outline-first rendering: lowered opacity glows pair with a stronger border mix so cards never bloom on black backgrounds.'
  }
];

const tokenRows = [
  { token: 'theme-dark.surface.canvas', usage: 'Canvas & shell backgrounds' },
  { token: 'theme-dark.text.primary', usage: 'Primary body text' },
  { token: 'theme-dark.status.success.surface', usage: 'Positive banners & chips' },
  { token: 'theme-dark.focus.ring.outer', usage: 'Focus outline contrast' },
  { token: 'theme-dark.shadow.elevation.card.color', usage: 'Raised card glow colour' }
];

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 8px'
};

const headCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--cmp-text-muted)',
  padding: '0.45rem 0.75rem',
  borderBottom: '1px solid color-mix(in srgb, var(--cmp-border-default) 55%, transparent)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.75rem 0.75rem',
  background: 'var(--cmp-surface-panel)',
  borderRadius: '0.8rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
  verticalAlign: 'top'
};

const ContextsDarkDoc: React.FC = () => (
  <div className="docs-dark-surface" style={{ display: 'grid', gap: '1.8rem', paddingBottom: '2.5rem' }}>
    <section style={{ display: 'grid', gap: '0.75rem' }}>
      <h1>Dark Theme Context</h1>
      <p>
        Dark mode is a pure theme-layer override. Components rely on the same <code>--cmp-*</code> slots they consume in Theme 0
        while <code>html[data-theme='dark']</code> remaps <code>--theme-*</code> tokens to dark OKLCH values. No conditional logic,
        no duplicate component styling.
      </p>
      <ul>
        {summaryList.map((entry) => (
          <li key={entry.heading}>
            <strong>{entry.heading}:</strong> {entry.copy}
          </li>
        ))}
      </ul>
    </section>

    <DarkModeDemo />

    <section style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Key Token Overrides</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...headCellStyle, width: '40%' }}>Token</th>
            <th style={headCellStyle}>Usage</th>
          </tr>
        </thead>
        <tbody>
          {tokenRows.map((row) => (
            <tr key={row.token}>
              <td style={cellStyle}>
                <code>{row.token}</code>
              </td>
              <td style={cellStyle}>{row.usage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <h2>Validation Checklist</h2>
      <ul>
        <li>
          Run <code>npm run build:tokens</code> after editing theme JSON to refresh CSS/TS/Tailwind outputs.
        </li>
        <li>
          Ensure <code>html[data-theme='dark']</code> is set before executing <code>npm run a11y:check</code> or{' '}
          <code>npm run a11y:diff</code>; both commands expect zero new critical/serious issues.
        </li>
        <li>
          Keep hover/pressed states within the relative-colour guardrails; the new values add ≤ +0.08 ΔL to respect the established
          bounds.
        </li>
      </ul>
    </section>
  </div>
);

export default ContextsDarkDoc;
