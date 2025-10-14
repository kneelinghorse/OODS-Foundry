import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../components/Badge';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const badgeGridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.25rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: '0.8rem'
};

const meta: Meta<typeof Badge> = {
  title: 'BrandA/Badge',
  component: Badge,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'component'] }
  },
  render: () => (
    <BrandADarkSurface style={{ alignItems: 'center' }}>
      <div style={{ ...contentCardStyle, gap: '1.75rem' }}>
        <header style={sectionStyle}>
          <h1 style={{ margin: 0, fontSize: '1.65rem' }}>Badge States · Brand A Dark</h1>
          <p style={{ margin: 0, color: 'var(--cmp-text-muted, #94a3b8)', lineHeight: 1.6 }}>
            Badge surfaces, text, and icons resolve via Brand A tone tokens—no inline style overrides required.
          </p>
        </header>
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Primary Ramp</h2>
          <div style={badgeGridStyle}>
            <Badge>Neutral</Badge>
            <Badge selected>Selected</Badge>
            <Badge disabled>Disabled</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="neutral" selected>
              Neutral Selected
            </Badge>
          </div>
        </section>
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Status Spectrum</h2>
          <div style={badgeGridStyle}>
            <Badge tone="info" leadingIcon="ℹ︎">
              Info
            </Badge>
            <Badge tone="accent" leadingIcon="★">
              Accent
            </Badge>
            <Badge tone="success" leadingIcon="✔︎">
              Success
            </Badge>
            <Badge tone="warning" leadingIcon="⚠︎">
              Warning
            </Badge>
            <Badge tone="critical" leadingIcon="⨯">
              Critical
            </Badge>
          </div>
        </section>
      </div>
    </BrandADarkSurface>
  )
};
