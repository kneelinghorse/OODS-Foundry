import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Foundations/Tokens Roundtrip',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj;

const RoundtripPreview = () => (
  <div
    className="w-[28rem] space-y-6"
    style={{ gap: 'var(--sys-space-stack-default, 20px)' }}
  >
    <header className="space-y-2 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
        Figma → Repo → Tailwind
      </p>
      <h2 className="text-2xl font-semibold text-text">
        Informational Banner handshake
      </h2>
      <p className="text-base text-text-muted">
        The CSS variables below are generated from the exported DTCG tokens in{' '}
        <code>tokens/*.json</code> via <code>scripts/tokens/transform.ts</code>.
      </p>
    </header>

    <section className="rounded-xl border border-info-border bg-info-surface px-6 py-5 text-info-text shadow-card">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-info-border"
          style={{ color: 'var(--sys-status-info-icon)' }}
        >
          ℹ️
        </span>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">Tokens synced</h3>
          <p className="leading-relaxed text-text-muted">
            This block pulls <code>sys.status.info.*</code> tokens that originate from the DTCG export,
            proving the Figma ↔ Repo handshake.
          </p>
        </div>
      </div>
    </section>
  </div>
);

export const Demo: Story = {
  render: () => <RoundtripPreview />,
};
