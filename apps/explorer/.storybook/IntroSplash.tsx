import React from 'react';

const metrics = [
  { label: 'Release Target', value: 'v1.0 RC' },
  { label: 'Tests', value: '754 / 754' },
  { label: 'A11y', value: '49 / 49 axes' },
  { label: 'Guardrails', value: 'Purity • Tokens • Perf' },
];

const quickLinks = [
  {
    title: 'Foundations',
    description: 'Color, typography, and motion guardrails with OKLCH deltas.',
    href: '?path=/docs/docs-foundations-colors--docs',
  },
  {
    title: 'Components',
    description: 'Statusable primitives and feedback components wired to tokens.',
    href: '?path=/docs/components-feedback-emptystate-guidelines--docs',
  },
  {
    title: 'Contexts',
    description: 'Detail/List/Form/Timeline render contexts with domain wiring.',
    href: '?path=/story/contexts-domain-context-gallery--docs',
  },
  {
    title: 'Brand & Accessibility',
    description: 'High contrast proofs plus Brand B showcase snapshots.',
    href: '?path=/story/brand-high-contrast-proof-gallery--primary',
  },
];

const IntroSplash: React.FC = () => (
  <div
    style={{
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      background:
        'radial-gradient(circle at top, color-mix(in srgb, var(--cmp-surface-subtle) 60%, transparent) 0%, transparent 55%), var(--cmp-surface-canvas)',
      minHeight: '100vh',
      padding: 'clamp(2rem, 4vw, 4rem)',
      color: 'var(--cmp-text-body)',
      display: 'grid',
      gap: 'clamp(2rem, 2vw, 3rem)',
      boxSizing: 'border-box',
    }}
  >
    <section
      style={{
        display: 'grid',
        gap: '1.5rem',
        padding: 'clamp(2rem, 3vw, 3rem)',
        borderRadius: '2rem',
        background:
          'linear-gradient(125deg, color-mix(in srgb, var(--cmp-surface-panel) 85%, transparent), color-mix(in srgb, var(--cmp-surface-action) 40%, transparent))',
        boxShadow:
          '0 32px 64px -32px color-mix(in srgb, var(--cmp-text-body) 24%, transparent)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--cmp-text-muted)',
          }}
        >
          OODS Foundry
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
            lineHeight: 1.05,
          }}
        >
          Trait-based objects. Purpose-built docs. Public-ready Storybook.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '1.05rem',
            lineHeight: 1.6,
            color: 'var(--cmp-text-muted)',
          }}
        >
          Explore how traits compose canonical billing objects, how statusables inherit semantic tokens, and how the Explorer keeps documentation,
          proofs, and guardrails in one place.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <a
          href="?path=/docs/docs-contexts-detail--docs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: '999px',
            padding: '0.65rem 1.5rem',
            fontWeight: 600,
            color: 'var(--cmp-text-on_action)',
            background: 'var(--cmp-surface-action)',
            border: '1px solid transparent',
            boxShadow: 'inset 0 -1px 0 color-mix(in srgb, currentColor 18%, transparent)',
          }}
        >
          Enter Explorer
        </a>
        <a
          href="https://github.com/systemsystems/oods-foundry/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: '999px',
            padding: '0.65rem 1.5rem',
            fontWeight: 600,
            color: 'var(--cmp-text-action)',
            border: '1px solid var(--cmp-border-default)',
            background: 'transparent',
          }}
        >
          View README ↗︎
        </a>
      </div>
    </section>

    <section
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
      }}
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          style={{
            borderRadius: '1.25rem',
            padding: '1.25rem',
            background: 'var(--cmp-surface-panel)',
            border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
            display: 'grid',
            gap: '0.35rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--cmp-text-muted)',
            }}
          >
            {metric.label}
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{metric.value}</p>
        </article>
      ))}
    </section>

    <section
      style={{
        display: 'grid',
        gap: '1.25rem',
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: '1.35rem',
          }}
        >
          What to explore
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--cmp-text-muted)' }}>
          Navigation is curated: Intro → Docs → Foundations → Components → Contexts → Domains → Patterns → Explorer → Brand.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
        }}
      >
        {quickLinks.map((link) => (
          <a
            key={link.title}
            href={link.href}
            style={{
              borderRadius: '1.25rem',
              padding: '1.35rem',
              background: 'var(--cmp-surface-panel)',
              border: '1px solid color-mix(in srgb, var(--cmp-border-default) 35%, transparent)',
              textDecoration: 'none',
              color: 'inherit',
              display: 'grid',
              gap: '0.6rem',
            }}
          >
            <strong style={{ fontSize: '1rem' }}>{link.title}</strong>
            <span style={{ color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>{link.description}</span>
          </a>
        ))}
      </div>
    </section>

    <section
      style={{
        display: 'grid',
        gap: '0.75rem',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        background: 'color-mix(in srgb, var(--cmp-surface-panel) 85%, transparent)',
        border: '1px dashed color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Brand & theme guidance</h2>
      <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>
        The toolbar is fixed to Brand A • Light for consistency. Brand B, dark theme, and high-contrast snapshots live under their dedicated nav
        entries. Chromatic continues to capture all four global combinations via Storybook globals.
      </p>
    </section>
  </div>
);

export default IntroSplash;
