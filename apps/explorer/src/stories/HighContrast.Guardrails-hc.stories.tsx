import type { Meta, StoryObj } from '@storybook/react';
import { type CSSProperties, type ReactNode, useId } from 'react';

import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { ensureDomainInContext, selectStatuses } from '../config/statusMap';

type Story = StoryObj;

const meta: Meta = {
  title: 'Brand/High Contrast/Proof Gallery',
  parameters: {
    layout: 'fullscreen',
    controls: { hideNoControlsWarning: true },
    docs: {
      description: {
        component:
          'Proof stories exercising the high-contrast guardrails. Enable Windows High Contrast or a forced-colors emulator to validate the system tokens.',
      },
    },
    globals: { theme: 'light', brand: 'brand-a' },
    chromatic: { disableSnapshot: false },
  },
  tags: ['proof', 'forced-colors'],
  decorators: [
    (StoryComponent, context) => {
      const brandSetting = (context.globals?.brand as string | undefined) ?? 'brand-a';
      const domBrand = brandSetting === 'brand-b' ? 'B' : 'A';
      return (
      <div
        data-theme="light"
        data-brand={domBrand}
        style={{
          padding: '2.5rem',
          minHeight: '100vh',
          background: 'var(--sys-surface-canvas, Canvas)',
          color: 'var(--sys-text-primary, CanvasText)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <StoryComponent />
      </div>
      );
    },
  ],
};

export default meta;

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
  padding: '1.5rem',
  borderRadius: '1.1rem',
  border: '1px solid transparent',
  background: 'var(--cmp-surface-panel, Canvas)',
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--cmp-border-default, CanvasText) 24%, transparent), var(--cmp-shadow-panel, none)',
};

const sectionHeadingStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  margin: 0,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.5rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

const tokenStackStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  alignItems: 'stretch',
};

const statusMatrixStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
};

const focusGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
};

ensureDomainInContext('list', 'subscription');
const [ACTIVE_STATUS, PAST_DUE_STATUS, PAUSED_STATUS, CANCELED_STATUS, TRIALING_STATUS] = selectStatuses(
  'list',
  'subscription',
  [2, 3, 4, 9, 1]
);

export const InteractiveSurfaces: Story = {
  name: 'Interactive Surfaces',
  render: () => (
    <div style={gridStyle}>
      <GuardrailCard
        title="Primary tokens"
        description="Primary surface → hover/pressed follow ΔL/ΔC guardrails. In forced-colors the buttons remap to Highlight/HighlightText."
      >
        <div style={tokenStackStyle}>
          <Button tone="primary">Primary</Button>
          <Button tone="primary" selected>
            Selected
          </Button>
          <Button tone="primary" variant="ghost">
            Ghost
          </Button>
        </div>
      </GuardrailCard>
      <GuardrailCard
        title="Status surfaces"
        description="Semantic ramps stay legible and reserve borders for Highlight mapping."
      >
        <div style={tokenStackStyle}>
          <Button tone="success">Success</Button>
          <Button tone="warning">Warning</Button>
          <Button tone="critical">Critical</Button>
          <Button tone="neutral">Neutral</Button>
        </div>
      </GuardrailCard>
    </div>
  ),
};

export const StatusChips: Story = {
  name: 'Status Chips',
  render: () => (
    <GuardrailCard
      title="Status token mapping"
      description="System tokens route through the high-contrast map. With forced-colors active, chips flip to CanvasText/Highlight pairings while outlines stay crisp."
    >
      <div style={statusMatrixStyle}>
        <StatusChip status={ACTIVE_STATUS} domain="subscription" />
        <StatusChip status={PAST_DUE_STATUS} domain="subscription" />
        <StatusChip status={PAUSED_STATUS} domain="subscription" />
        <StatusChip status={CANCELED_STATUS} domain="subscription" />
        <StatusChip status={TRIALING_STATUS} domain="subscription" />
      </div>
    </GuardrailCard>
  ),
};

export const FocusIndicators: Story = {
  name: 'Focus Indicators',
  render: () => {
    const hintId = useId();
    return (
      <GuardrailCard
        title="Reserved border + outline focus"
        description="Transparent borders keep reserve space for forced system colors. Tab through the samples to view the dual-ring focus style."
      >
        <p id={hintId} style={{ margin: 0, color: 'var(--cmp-text-muted, GrayText)' }}>
          Press <kbd>Tab</kbd> to cycle focus. In forced-colors the outline swaps to Highlight while the inner
          guard maintains Canvas separation.
        </p>
        <div style={focusGridStyle} aria-describedby={hintId}>
          <Button tone="primary">Primary focus</Button>
          <Button tone="neutral">Neutral focus</Button>
          <Button tone="accent">Accent focus</Button>
        </div>
      </GuardrailCard>
    );
  },
};

type GuardrailCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function GuardrailCard({ title, description, children }: GuardrailCardProps) {
  return (
    <section style={cardStyle}>
      <header style={sectionHeadingStyle}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--cmp-text-muted, GrayText)', fontSize: '0.95rem' }}>{description}</p>
      </header>
      <div>{children}</div>
    </section>
  );
}
