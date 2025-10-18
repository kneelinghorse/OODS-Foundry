import React, { Fragment } from 'react';
import '../../styles/index.css';

type TokenEntry = {
  label: string;
  token: string;
  swatch: string;
  oklch: string;
  fallback: string;
  usage: string;
};

type StatusGroup = {
  heading: string;
  rows: TokenEntry[];
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 6px'
};

const headerCellStyle: React.CSSProperties = {
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--cmp-text-body)',
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--cmp-border-strong)'
};

const cellStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  background: 'var(--cmp-surface-panel)',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default) 60%, transparent)',
  borderRadius: '8px'
};

const Swatch: React.FC<{ token: string; fallback?: string }> = ({ token, fallback = '#ffffff' }) => (
  <div
    style={{
      width: '3rem',
      height: '3rem',
      borderRadius: '0.75rem',
      border: '1px solid var(--cmp-border-strong)',
      background: `var(${token}, ${fallback})`,
      boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.05)',
      flexShrink: 0
    }}
    aria-hidden
  />
);

const Row: React.FC<{ entry: TokenEntry }> = ({ entry }) => (
  <tr>
    <td style={{ ...cellStyle, minWidth: '11rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <strong style={{ fontSize: '0.92rem' }}>{entry.label}</strong>
        <code style={{ fontSize: '0.75rem' }}>{entry.token}</code>
      </div>
    </td>
    <td style={{ ...cellStyle, width: '5rem' }}>
      <Swatch token={entry.token} fallback={entry.fallback} />
    </td>
    <td style={{ ...cellStyle, minWidth: '13rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span>
          <strong>{entry.swatch}</strong>
        </span>
        <code style={{ fontSize: '0.75rem' }}>{entry.oklch}</code>
        <code style={{ fontSize: '0.75rem' }}>{entry.fallback}</code>
      </div>
    </td>
    <td style={{ ...cellStyle }}>{entry.usage}</td>
  </tr>
);

const surfaceEntries: TokenEntry[] = [
  { label: 'surface-page', token: '--sys-surface-canvas', swatch: 'Neutral-50', oklch: 'oklch(0.9913 0.0013 286.38)', fallback: '#FCFCFD', usage: 'Primary page background and application canvas.' },
  { label: 'surface-primary', token: '--sys-surface-raised', swatch: 'Neutral-100', oklch: 'oklch(0.9816 0.0017 247.84)', fallback: '#F8F9FA', usage: 'Raised cards, dialogs and prominent panels.' },
  { label: 'surface-secondary', token: '--sys-surface-subtle', swatch: 'Neutral-200', oklch: 'oklch(0.9417 0.0052 247.88)', fallback: '#E9ECEF', usage: 'Secondary sections and muted surface layers.' },
  { label: 'surface-disabled', token: '--sys-surface-disabled', swatch: 'Neutral-200', oklch: 'oklch(0.9417 0.0052 247.88)', fallback: '#E9ECEF', usage: 'Disabled or read-only component backgrounds.' },
  { label: 'surface-interactive-default', token: '--sys-surface-interactive-primary-default', swatch: 'Primary-500', oklch: 'oklch(0.5631 0.1717 274.55)', fallback: '#5A67D8', usage: 'Primary action default state.' },
  { label: 'surface-interactive-hover', token: '--sys-surface-interactive-primary-hover', swatch: 'Primary-600', oklch: 'oklch(0.5002 0.1462 274.33)', fallback: '#4C58B5', usage: 'Relative-color hover (fallback shown for legacy browsers).' },
  { label: 'surface-interactive-pressed', token: '--sys-surface-interactive-primary-pressed', swatch: 'Primary-700', oklch: 'oklch(0.434 0.1225 274.42)', fallback: '#3E4893', usage: 'Relative-color pressed/active state (fallback shown).' },
  { label: 'surface-backdrop', token: '--sys-surface-backdrop', swatch: 'Neutral-900', oklch: 'oklch(0.313 0.0171 266.40)', fallback: '#2D313A', usage: 'Scrims behind modals and drawers.' },
  { label: 'surface-inverse', token: '--sys-surface-inverse', swatch: 'Neutral-900', oklch: 'oklch(0.313 0.0171 266.40)', fallback: '#2D313A', usage: 'Inverse treatments and pill backgrounds.' },
  { label: 'border-subtle', token: '--sys-border-subtle', swatch: 'Neutral-200', oklch: 'oklch(0.9417 0.0052 247.88)', fallback: '#E9ECEF', usage: 'Default outline/border for surfaces.' },
  { label: 'border-strong', token: '--sys-border-strong', swatch: 'Neutral-300', oklch: 'oklch(0.8875 0.0147 264.49)', fallback: '#D5DAE4', usage: 'High-contrast dividers and component boundaries.' }
];

const textEntries: TokenEntry[] = [
  { label: 'text-primary', token: '--sys-text-primary', swatch: 'Neutral-900', oklch: 'oklch(0.313 0.0171 266.40)', fallback: '#2D313A', usage: 'Primary body copy and titles.' },
  { label: 'text-secondary', token: '--sys-text-secondary', swatch: 'Neutral-700', oklch: 'oklch(0.5109 0.0264 269.16)', fallback: '#606676', usage: 'Supporting text with AA contrast on light surfaces.' },
  { label: 'text-muted', token: '--sys-text-muted', swatch: 'Neutral-600', oklch: 'oklch(0.5595 0.0225 270.01)', fallback: '#6F7482', usage: 'Helper copy, captions and tertiary affordances.' },
  { label: 'text-on-interactive', token: '--sys-text-on-interactive', swatch: 'Neutral-100', oklch: 'oklch(0.9816 0.0017 247.84)', fallback: '#F8F9FA', usage: 'Foreground contrast on primary interactive states.' },
  { label: 'text-disabled', token: '--sys-text-disabled', swatch: 'Neutral-400', oklch: 'oklch(0.7951 0.0148 268.46)', fallback: '#B8BCC6', usage: 'Disabled or inactive text.' },
  { label: 'text-accent', token: '--sys-text-accent', swatch: 'Primary-600', oklch: 'oklch(0.5002 0.1462 274.33)', fallback: '#4C58B5', usage: 'Selective accent text (not for long-form copy).' },
  { label: 'icon-primary', token: '--sys-icon-primary', swatch: 'Neutral-800', oklch: 'oklch(0.4239 0.021 267.53)', fallback: '#494E5A', usage: 'Primary iconography and glyphs.' },
  { label: 'icon-muted', token: '--sys-icon-muted', swatch: 'Neutral-500', oklch: 'oklch(0.6929 0.0198 269.00)', fallback: '#979CA9', usage: 'Muted or secondary icons.' },
  { label: 'icon-on-interactive', token: '--sys-icon-on-interactive', swatch: 'Neutral-100', oklch: 'oklch(0.9816 0.0017 247.84)', fallback: '#F8F9FA', usage: 'Icons on interactive primary surfaces.' }
];

const statusGroups: StatusGroup[] = [
  {
    heading: 'Info',
    rows: [
      { label: 'status-info-surface', token: '--sys-status-info-surface', swatch: 'Info-100', oklch: 'oklch(0.9685 0.0148 260.73)', fallback: '#EFF5FF', usage: 'Informational toast and alert backgrounds.' },
      { label: 'status-info-border', token: '--sys-status-info-border', swatch: 'Info-300', oklch: 'oklch(0.8191 0.0763 260.81)', fallback: '#A8C5F6', usage: 'Informational border accents.' },
      { label: 'status-info-text', token: '--sys-status-info-text', swatch: 'Info-900', oklch: 'oklch(0.3847 0.1344 263.74)', fallback: '#1C3D8A', usage: 'Informational body text.' },
      { label: 'status-info-icon', token: '--sys-status-info-icon', swatch: 'Info-700', oklch: 'oklch(0.5466 0.1806 263.48)', fallback: '#3668D8', usage: 'Informational icons.' }
    ]
  },
  {
    heading: 'Success',
    rows: [
      { label: 'status-success-surface', token: '--sys-status-success-surface', swatch: 'Success-100', oklch: 'oklch(0.9743 0.0192 167.94)', fallback: '#EBFBF4', usage: 'Success surface background.' },
      { label: 'status-success-border', token: '--sys-status-success-border', swatch: 'Success-300', oklch: 'oklch(0.8671 0.0772 165.25)', fallback: '#A3E4C7', usage: 'Success border.' },
      { label: 'status-success-text', token: '--sys-status-success-text', swatch: 'Success-900', oklch: 'oklch(0.4315 0.0821 163.04)', fallback: '#185E43', usage: 'Success text.' },
      { label: 'status-success-icon', token: '--sys-status-success-icon', swatch: 'Success-700', oklch: 'oklch(0.6005 0.1199 161.34)', fallback: '#279669', usage: 'Success iconography.' }
    ]
  },
  {
    heading: 'Warning',
    rows: [
      { label: 'status-warning-surface', token: '--sys-status-warning-surface', swatch: 'Warning-100', oklch: 'oklch(0.9795 0.026 90.09)', fallback: '#FFF8E5', usage: 'Warning surface background.' },
      { label: 'status-warning-border', token: '--sys-status-warning-border', swatch: 'Warning-300', oklch: 'oklch(0.8949 0.1177 87.87)', fallback: '#FDD87D', usage: 'Warning border.' },
      { label: 'status-warning-text', token: '--sys-status-warning-text', swatch: 'Warning-900', oklch: 'oklch(0.4914 0.1012 82.20)', fallback: '#7D5A00', usage: 'Warning text.' },
      { label: 'status-warning-icon', token: '--sys-status-warning-icon', swatch: 'Warning-700', oklch: 'oklch(0.6573 0.1198 81.65)', fallback: '#B6892B', usage: 'Warning iconography.' }
    ]
  },
  {
    heading: 'Critical',
    rows: [
      { label: 'status-critical-surface', token: '--sys-status-critical-surface', swatch: 'Critical-100', oklch: 'oklch(0.9672 0.0163 12.78)', fallback: '#FFF0F1', usage: 'Critical surface background.' },
      { label: 'status-critical-border', token: '--sys-status-critical-border', swatch: 'Critical-300', oklch: 'oklch(0.824 0.0834 19.01)', fallback: '#F7B0B0', usage: 'Critical border.' },
      { label: 'status-critical-text', token: '--sys-status-critical-text', swatch: 'Critical-900', oklch: 'oklch(0.465 0.147 24.94)', fallback: '#9B2C2C', usage: 'Critical text.' },
      { label: 'status-critical-icon', token: '--sys-status-critical-icon', swatch: 'Critical-700', oklch: 'oklch(0.6039 0.1827 24.43)', fallback: '#D94747', usage: 'Critical iconography.' }
    ]
  },
  {
    heading: 'Accent',
    rows: [
      { label: 'status-accent-surface', token: '--sys-status-accent-surface', swatch: 'Accent-100', oklch: 'oklch(0.9563 0.0277 225.69)', fallback: '#DEF5FF', usage: 'Accent surface background.' },
      { label: 'status-accent-border', token: '--sys-status-accent-border', swatch: 'Accent-300', oklch: 'oklch(0.5631 0.1717 274.55)', fallback: '#5A67D8', usage: 'Accent border.' },
      { label: 'status-accent-text', token: '--sys-status-accent-text', swatch: 'Accent-500', oklch: 'oklch(0.434 0.1225 274.42)', fallback: '#3E4893', usage: 'Accent text.' },
      { label: 'status-accent-icon', token: '--sys-status-accent-icon', swatch: 'Accent-400', oklch: 'oklch(0.5002 0.1462 274.33)', fallback: '#4C58B5', usage: 'Accent icons.' }
    ]
  },
  {
    heading: 'Neutral',
    rows: [
      { label: 'status-neutral-surface', token: '--sys-status-neutral-surface', swatch: 'Neutral-100', oklch: 'oklch(0.9816 0.0017 247.84)', fallback: '#F8F9FA', usage: 'Neutral status background.' },
      { label: 'status-neutral-border', token: '--sys-status-neutral-border', swatch: 'Neutral-300', oklch: 'oklch(0.8875 0.0147 264.49)', fallback: '#D5DAE4', usage: 'Neutral status border.' },
      { label: 'status-neutral-text', token: '--sys-status-neutral-text', swatch: 'Neutral-800', oklch: 'oklch(0.4239 0.021 267.53)', fallback: '#494E5A', usage: 'Neutral status text.' },
      { label: 'status-neutral-icon', token: '--sys-status-neutral-icon', swatch: 'Neutral-700', oklch: 'oklch(0.5109 0.0264 269.16)', fallback: '#606676', usage: 'Neutral status icon.' }
    ]
  }
];

const focusEntries: TokenEntry[] = [
  { label: 'focus-ring-outer', token: '--sys-focus-ring-outer', swatch: 'Neutral-900', oklch: 'oklch(0.313 0.0171 266.40)', fallback: '#2D313A', usage: 'Outer halo for focus indicators.' },
  { label: 'focus-ring-inner', token: '--sys-focus-ring-inner', swatch: 'Neutral-100', oklch: 'oklch(0.9816 0.0017 247.84)', fallback: '#F8F9FA', usage: 'Inner contrast ring for focus outlines.' },
  { label: 'focus-text', token: '--sys-focus-text', swatch: 'Primary-600', oklch: 'oklch(0.5002 0.1462 274.33)', fallback: '#4C58B5', usage: 'Focus icon/text accents.' }
];

const ColorsDoc: React.FC = () => (
  <Fragment>
    <h1>Theme 0 – OKLCH Palette Integration</h1>
    <p>
      Theme 0 replaces placeholder sRGB swatches with a perceptually uniform OKLCH palette. Surfaces and text lean on a cool neutral ramp,
      interactive states derive from the primary accent via relative color syntax, and status colours reuse pre-tested swatches that preserve AA contrast.
    </p>
    <blockquote>
      Hover and pressed states are authored with <code>oklch(from …)</code> in CSS. The static values shown below serve as build-time fallbacks for browsers
      without relative color support.
    </blockquote>

    <h2>Surfaces &amp; Borders</h2>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={headerCellStyle}>Token</th>
          <th style={headerCellStyle}>Swatch</th>
          <th style={headerCellStyle}>Values</th>
          <th style={headerCellStyle}>Usage</th>
        </tr>
      </thead>
      <tbody>
        {surfaceEntries.map((entry) => (
          <Row key={entry.label} entry={entry} />
        ))}
      </tbody>
    </table>

    <h2>Text &amp; Iconography</h2>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={headerCellStyle}>Token</th>
          <th style={headerCellStyle}>Swatch</th>
          <th style={headerCellStyle}>Values</th>
          <th style={headerCellStyle}>Usage</th>
        </tr>
      </thead>
      <tbody>
        {textEntries.map((entry) => (
          <Row key={entry.label} entry={entry} />
        ))}
      </tbody>
    </table>

    <h2>Status Roles</h2>
    {statusGroups.map((group) => (
      <Fragment key={group.heading}>
        <h3 style={{ marginTop: '2rem' }}>{group.heading}</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Token</th>
              <th style={headerCellStyle}>Swatch</th>
              <th style={headerCellStyle}>Values</th>
              <th style={headerCellStyle}>Usage</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((entry) => (
              <Row key={entry.label} entry={entry} />
            ))}
          </tbody>
        </table>
      </Fragment>
    ))}

    <h2>Focus</h2>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={headerCellStyle}>Token</th>
          <th style={headerCellStyle}>Swatch</th>
          <th style={headerCellStyle}>Values</th>
          <th style={headerCellStyle}>Usage</th>
        </tr>
      </thead>
      <tbody>
        {focusEntries.map((entry) => (
          <Row key={entry.label} entry={entry} />
        ))}
      </tbody>
    </table>

    <h3>Relative State Behaviour</h3>
    <ul>
      <li>
        Hover: <code>oklch(from var(--sys-surface-interactive-primary-default) calc(l - 0.10) calc(c + 0.015) h)</code>
      </li>
      <li>
        Pressed: <code>oklch(from var(--sys-surface-interactive-primary-default) calc(l - 0.14) calc(c + 0.025) h)</code>
      </li>
    </ul>
    <p>
      Legacy browsers fall back to the precomputed swatches published in <code>theme0-assignment.csv</code>. The Explorer shell promotes these
      variables into component-friendly <code>--cmp-*</code> tokens, ensuring Storybook and product surfaces stay in sync.
    </p>
  </Fragment>
);

export default ColorsDoc;
