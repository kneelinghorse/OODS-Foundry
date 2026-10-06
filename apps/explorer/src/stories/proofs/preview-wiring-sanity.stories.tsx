import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';

const BRAND_STORAGE_KEY = 'oods:storybook:brand';
const SAMPLE_VARS = ['--theme-surface-canvas', '--cmp-text-body', '--sys-focus-ring-outer'] as const;
type SampleVar = (typeof SAMPLE_VARS)[number];

interface Diagnostics {
  htmlTheme: string | null;
  htmlBrand: string | null;
  bodyTheme: string | null;
  bodyBrand: string | null;
  variables: Record<SampleVar, string>;
  storedBrand: string | null;
}

const PreviewWiringSanityProbe: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const body = document.body;

    const report = () => {
      const computed = getComputedStyle(root);
      const variables = {} as Record<SampleVar, string>;
      SAMPLE_VARS.forEach((token) => {
        variables[token] = computed.getPropertyValue(token).trim();
      });

      let storedBrand: string | null = null;
      try {
        storedBrand = window.localStorage.getItem(BRAND_STORAGE_KEY);
      } catch {
        storedBrand = null;
      }

      setDiagnostics({
        htmlTheme: root.getAttribute('data-theme'),
        htmlBrand: root.getAttribute('data-brand'),
        bodyTheme: body.getAttribute('data-theme'),
        bodyBrand: body.getAttribute('data-brand'),
        variables,
        storedBrand,
      });
    };

    report();

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(report);
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-brand'] });
      observer.observe(body, { attributes: true, attributeFilter: ['data-theme', 'data-brand'] });
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      const intervalId = window.setInterval(report, 250);
      return () => window.clearInterval(intervalId);
    }

    return undefined;
  }, []);

  const vars = diagnostics?.variables ?? ({} as Record<SampleVar, string>);

  return (
    <div
      role="region"
      aria-live="polite"
      style={{
        display: 'grid',
        gap: 'var(--cmp-spacing-stack-default, 16px)',
        minWidth: 320,
        maxWidth: 640,
        padding: 'var(--cmp-spacing-inset-default, 16px)',
      }}
    >
      <header style={{ display: 'grid', gap: '0.25rem' }}>
        <h1 style={{ fontSize: '1.125rem', margin: 0 }}>Preview wiring sanity check</h1>
        <p style={{ margin: 0, color: 'var(--cmp-text-muted, #4f4f4f)' }}>
          Toggle the Theme and Brand toolbars — this panel mirrors the applied document attributes and a
          snapshot of core token slots.
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Document attributes</h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '0.25rem 1rem',
            margin: 0,
          }}
        >
          <dt>html[data-theme]</dt>
          <dd>{diagnostics?.htmlTheme ?? '—'}</dd>
          <dt>html[data-brand]</dt>
          <dd>{diagnostics?.htmlBrand ?? '—'}</dd>
          <dt>body[data-theme]</dt>
          <dd>{diagnostics?.bodyTheme ?? '—'}</dd>
          <dt>body[data-brand]</dt>
          <dd>{diagnostics?.bodyBrand ?? '—'}</dd>
          <dt>localStorage brand</dt>
          <dd>{diagnostics?.storedBrand ?? '—'}</dd>
        </dl>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Sample token values</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {SAMPLE_VARS.map((token) => (
            <li
              key={token}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.125rem',
                background: 'var(--cmp-surface-panel, #ffffff)',
                borderRadius: '0.75rem',
                padding: 'var(--cmp-spacing-inset-default, 16px)',
                boxShadow:
                  '0 12px 32px color-mix(in srgb, var(--sys-focus-ring-outer, rgba(0,0,0,0.2)) 18%, transparent)',
              }}
            >
              <code style={{ fontSize: '0.875rem' }}>{token}</code>
              <span style={{ fontSize: '0.875rem' }}>{vars[token] || '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Visual probes">
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div
            style={{
              background: 'var(--cmp-surface-panel, #ffffff)',
              color: 'var(--cmp-text-body, #111111)',
              borderRadius: '1rem',
              padding: 'var(--cmp-spacing-inset-default, 16px)',
              boxShadow:
                '0 18px 40px color-mix(in srgb, var(--sys-focus-ring-outer, rgba(0,0,0,0.2)) 20%, transparent)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Component canvas</strong>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.4 }}>
              Uses cmp tokens mapped from theme/system variables. Brand overrides should recolor this block in
              step with toolbar changes.
            </p>
          </div>
          <div
            style={{
              background: 'var(--cmp-surface-action, #0047ff)',
              color: 'var(--cmp-text-on_action, #ffffff)',
              borderRadius: '999px',
              padding: 'var(--cmp-spacing-inset-compact, 12px)',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              minHeight: 96,
            }}
          >
            <span style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
              Focus ring outer → <br />
              <strong>{vars['--sys-focus-ring-outer'] || '—'}</strong>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

const meta: Meta<typeof PreviewWiringSanityProbe> = {
  title: 'Explorer/Proofs/Preview Wiring Sanity',
  component: PreviewWiringSanityProbe,
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: false },
    docs: {
      description: {
        component:
          'Sanity probe that surfaces document attributes, localStorage persistence, and sample token resolution for the preview globals.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const PreviewDiagnostics: Story = {
  name: 'Preview Diagnostics',
  render: () => <PreviewWiringSanityProbe />,
};
