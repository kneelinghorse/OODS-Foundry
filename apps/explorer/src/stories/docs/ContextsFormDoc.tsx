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

const FormDoc: React.FC = () => {
  const formSpec = CONTEXT_MATRIX.form;
  const regions = Object.entries(formSpec).map(([region, tokens]) => ({
    region,
    spacing: tokens.spacing.length ? tokens.spacing.join(', ') : '—',
    typography: tokens.typography.length ? tokens.typography.join(', ') : '—',
    surface: tokens.surface.length ? tokens.surface.join(', ') : '—',
    status: tokens.status.length ? tokens.status.join(', ') : '—'
  }));

  return (
    <div>
      <h1>Form Context Defaults</h1>
      <p>
        The <code>context-form</code> class locks in deliberate rhythm: structural sections use{' '}
        <code>spacing.inset.default</code> while fields rely on <code>spacing.stack.default</code> to keep controls aligned
        without crowding. Typography cascades from <code>text.scale.label-md</code> for labels to{' '}
        <code>text.scale.body-md</code> for inputs—no component branches required.
      </p>
      <p>
        Validation, info, and success states pick up system tokens via <code>--context-surface-*</code> assignments.
        Components continue reading <code>--cmp-*</code> slots; the Tailwind plugin writes the contextual bridge so inputs,
        banners, and status chips stay pure.
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
        <code>{`<div class="context-form">
  <header data-region="pageHeader">...</header>
  <div data-region="viewToolbar">...</div>
  <main data-region="main">
    <form class="form-shell">
      <section class="form-section">...</section>
    </form>
  </main>
</div>`}</code>
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
          <strong>Vertical rhythm:</strong> Section headers use <code>spacing.inset.default</code> while nested controls keep{' '}
          <code>spacing.stack.default</code> so long forms stay scannable.
        </li>
        <li>
          <strong>Line height:</strong> Uses <code>text.line-height.relaxed</code> to add a touch of breathing room for body
          copy and controls, improving readability and error affordance without blowing up density.
        </li>
        <li>
          <strong>Label scale:</strong> <code>text.scale.label-md</code> lifts field labels without overpowering{' '}
          <code>text.scale.body-md</code> inputs—everything remains AA-compliant at 400 zoom.
        </li>
        <li>
          <strong>State tokens:</strong> <code>status.*</code> wildcards flow into validation banners, focus rings, and status
          chips for error/warning/info states.
        </li>
        <li>
          <strong>Pure components:</strong> Inputs stay oblivious to the context—only <code>context-form</code> and{' '}
          <code>data-region</code> drive token remapping.
        </li>
      </ul>
    </div>
  );
};

export default FormDoc;
