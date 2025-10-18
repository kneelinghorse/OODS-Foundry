import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/Button';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const buttonGridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.25rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem'
};

const meta: Meta<typeof Button> = {
  title: 'BrandA/Button',
  component: Button,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'component'] }
  },
  render: () => (
    <BrandADarkSurface>
      <div style={contentCardStyle}>
        <header style={sectionStyle}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Button Spectrum · Brand A Dark</h1>
          <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.6 }}>
            Token-only theming: buttons pull surfaces, borders, and focus rings from Brand A dark without JSX changes.
          </p>
        </header>
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Primary Ramp</h2>
          <div style={buttonGridStyle}>
            <Button leadingIcon="★">Primary</Button>
            <Button selected leadingIcon="★">
              Selected
            </Button>
            <Button disabled leadingIcon="★">
              Disabled
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Tonal Spectrum</h2>
          <div style={buttonGridStyle}>
            <Button tone="success" trailingIcon="✔︎">
              Success
            </Button>
            <Button tone="warning" trailingIcon="⚠︎">
              Warning
            </Button>
            <Button tone="critical" trailingIcon="⨯">
              Critical
            </Button>
            <Button tone="accent" trailingIcon="✺">
              Accent
            </Button>
            <Button tone="neutral" variant="outline">
              Neutral Outline
            </Button>
          </div>
        </section>
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Compact Density</h2>
          <div style={buttonGridStyle}>
            <Button size="sm">Compact</Button>
            <Button size="sm" selected>
              Compact Selected
            </Button>
            <Button size="sm" variant="ghost">
              Compact Ghost
            </Button>
            <Button size="sm" disabled>
              Compact Disabled
            </Button>
          </div>
        </section>
      </div>
    </BrandADarkSurface>
  )
};
