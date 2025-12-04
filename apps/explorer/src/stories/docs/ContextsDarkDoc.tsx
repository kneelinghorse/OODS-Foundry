import React, { useLayoutEffect } from 'react';
import '../../styles/index.css';
import { StatusChip } from '../../components/StatusChip';

const ContextsDarkDoc: React.FC = () => {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  });

  return (
    <div
      className="sb-unstyled"
      data-theme="dark"
      style={{
        padding: '2rem',
        minHeight: '100vh',
        background: 'var(--cmp-surface-canvas, #0f172a)',
        color: 'var(--cmp-text-body, #f1f5f9)',
      }}
    >
      <h1>Dark Theme Context</h1>
      <p style={{ marginBottom: '1.5rem', maxWidth: '65ch' }}>
        Dark mode is a pure theme-layer override. Components rely on the same <code>--cmp-*</code> slots
        they consume in light theme while <code>data-theme="dark"</code> remaps <code>--theme-*</code> tokens
        to dark OKLCH values. No conditional logic, no duplicate component styling.
      </p>

      <ul style={{ marginBottom: '2rem', paddingLeft: '1.5rem' }}>
        <li><strong>Surface &amp; Text:</strong> Canvas, panel, and subtle surfaces shift to cool neutrals with ≥4.5:1 contrast.</li>
        <li><strong>Status Ramps:</strong> All five status ramps provide dark surfaces, borders, text, and icons.</li>
        <li><strong>Elevation:</strong> Shadow tokens pivot to outline-first rendering with lowered opacity glows.</li>
      </ul>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Status Chips</h2>
        <p style={{ marginBottom: '1rem' }}>
          StatusChip picks up dark tokens automatically via its tone data attribute:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <StatusChip status="active" domain="subscription" />
          <StatusChip status="trialing" domain="subscription" />
          <StatusChip status="paused" domain="subscription" />
          <StatusChip status="past_due" domain="subscription" />
          <StatusChip status="canceled" domain="subscription" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <StatusChip status="draft" domain="invoice" />
          <StatusChip status="open" domain="invoice" />
          <StatusChip status="paid" domain="invoice" />
          <StatusChip status="processing" domain="invoice" />
          <StatusChip status="void" domain="invoice" />
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Action Buttons</h2>
        <p style={{ marginBottom: '1rem' }}>
          Buttons read <code>--cmp-surface-action*</code> slots; the theme remaps them to dark values:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button type="button" className="demo-button">
            <span>Primary Action</span>
            <span className="demo-button__glyph">↗︎</span>
          </button>
          <button type="button" className="demo-button" data-variant="quiet">
            <span>Secondary Action</span>
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Banners</h2>
        <p style={{ marginBottom: '1rem' }}>
          Status banners reuse <code>--sys-status-*</code> tokens for colour and contrast:
        </p>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <article className="demo-banner" data-banner-tone="info" data-has-action="false">
            <span className="demo-banner__icon">ℹ︎</span>
            <div className="demo-banner__content">
              <strong>Scheduled maintenance</strong>
              <p>API will be unavailable 22:00–23:00 UTC for schema updates.</p>
            </div>
          </article>
          <article className="demo-banner" data-banner-tone="success" data-has-action="false">
            <span className="demo-banner__icon">✔︎</span>
            <div className="demo-banner__content">
              <strong>Payment captured</strong>
              <p>Invoice INV-20410 was paid successfully.</p>
            </div>
          </article>
          <article className="demo-banner" data-banner-tone="critical" data-has-action="false">
            <span className="demo-banner__icon">⨯</span>
            <div className="demo-banner__content">
              <strong>Certificate expiring</strong>
              <p>SAML certificate expires in 3 days. Rotate now.</p>
            </div>
          </article>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Key Token Overrides</h2>
        <table style={{ width: '100%', maxWidth: '600px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}>Token</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}><code>--theme-surface-canvas</code></td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}>Canvas backgrounds</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}><code>--theme-text-primary</code></td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}>Primary body text</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}><code>--theme-status-success-surface</code></td>
              <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--cmp-border-default)' }}>Positive banners &amp; chips</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem' }}><code>--theme-focus-ring-outer</code></td>
              <td style={{ padding: '0.75rem' }}>Focus outline contrast</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Usage</h2>
        <p style={{ marginBottom: '0.75rem' }}>Set dark mode at document level:</p>
        <pre style={{ background: 'var(--cmp-surface-panel)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto' }}>
          <code>{`<html data-theme="dark">
  {/* Entire app renders in dark mode */}
</html>`}</code>
        </pre>
      </section>
    </div>
  );
};

export default ContextsDarkDoc;
