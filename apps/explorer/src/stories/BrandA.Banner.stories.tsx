import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from '../components/Banner';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const stackStyle: CSSProperties = {
  display: 'grid',
  gap: '1.5rem'
};

const meta: Meta<typeof Banner> = {
  title: 'BrandA/Banner',
  component: Banner,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Banner>;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'component'] }
  },
  render: () => (
    <BrandADarkSurface style={{ alignItems: 'center' }}>
      <div style={{ ...contentCardStyle, gap: '1.5rem' }}>
        <header style={{ display: 'grid', gap: '0.8rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.65rem' }}>Banner Spectrum · Brand A Dark</h1>
          <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.6 }}>
            Status messaging inherits brand tokens through system surfaces and focus rings—component logic stays pure.
          </p>
        </header>
        <div style={stackStyle}>
          <Banner tone="info" title="Scheduled maintenance" description="Service window from 02:00–02:30 UTC on Oct 15." />
          <Banner
            tone="success"
            title="Expansion signed"
            description="Growth operations finalized the renewal paperwork."
            actions={[{ label: 'View contract', href: '#contract', tone: 'primary' }]}
          />
          <Banner
            tone="warning"
            title="Quota nearing limits"
            description="Provision buffers or revisit the usage commitment before renewal."
          />
          <Banner
            tone="critical"
            title="Action required"
            description="Pricing exceptions need director approval before invoicing."
            role="alert"
          />
          <Banner
            tone="accent"
            title="Launch prep"
            description="Enable campaign templates before the next workspace sync."
          />
        </div>
      </div>
    </BrandADarkSurface>
  )
};
