import React from 'react';

const metrics = [
  { label: 'Release', value: 'v1.0 RC' },
  { label: 'Tests', value: '754 / 754' },
  { label: 'A11y', value: '49 / 49' },
  { label: 'Viz System', value: 'Sprint 21-23' },
];

const quickLinks = [
  {
    title: 'Foundations',
    description: 'Color, typography, spacing, motion tokens with OKLCH deltas and WCAG guardrails.',
  },
  {
    title: 'Components',
    description: '40+ production components: primitives, statusables, inputs, overlays, data displays.',
  },
  {
    title: 'Contexts',
    description: 'List/Detail/Form/Timeline render contexts with responsive density and semantic regions.',
  },
  {
    title: 'Visualization',
    description: '5 chart types, layout compositions (facet/layer), 35+ patterns, dual-renderer support.',
  },
  {
    title: 'Domains',
    description: 'End-to-end flows: Billing (subscription, invoice, usage), Account management, Authorization.',
  },
  {
    title: 'Brand & Accessibility',
    description: 'Multi-brand theming (A/B), dark mode, forced-colors snapshots, automated compliance.',
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
          Build from meaning, not markup
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '1.05rem',
            lineHeight: 1.6,
            color: 'var(--cmp-text-muted)',
          }}
        >
          Describe your objects once—User, Subscription, Product. Compose from traits—Statusable, Timestamped, Addressable. Render in any
          context—List, Detail, Dashboard, Chart. The system generates types, views, tokens, tests, and documentation. Object-oriented design,
          trait-first composition, agent-native architecture.
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
          href="https://github.com/kneelinghorse/OODS-Foundry"
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
            textDecoration: 'none',
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub ↗︎
        </a>
        <a
          href="https://github.com/kneelinghorse/OODS-Foundry/blob/main/README.md"
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
            textDecoration: 'none',
          }}
        >
          Read Documentation ↗︎
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
          Browse the sidebar or start with any section below. Navigation follows: Intro → Docs → Foundations → Components → Visualization →
          Contexts → Domains → Patterns → Brand.
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
          <article
            key={link.title}
            style={{
              borderRadius: '1.25rem',
              padding: '1.35rem',
              background: 'var(--cmp-surface-panel)',
              border: '1px solid color-mix(in srgb, var(--cmp-border-default) 35%, transparent)',
              display: 'grid',
              gap: '0.6rem',
            }}
          >
            <strong style={{ fontSize: '1rem' }}>{link.title}</strong>
            <span style={{ color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>{link.description}</span>
          </article>
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
      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Theme & accessibility</h2>
      <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>
        Stories default to Brand A • Light mode. Brand B, dark theme, and forced-colors (high-contrast) variants live under Brand navigation.
        Chromatic captures all four global combinations and automated WCAG 2.2 AA checks ensure contrast + OKLCH guardrails stay enforced.
      </p>
    </section>
  </div>
);

export default IntroSplash;
