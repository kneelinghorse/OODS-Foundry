import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/Input';
import { TextArea } from '../components/TextArea';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.5rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
};

const meta: Meta<typeof Input> = {
  title: 'BrandA/Input',
  component: Input,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'form'] }
  },
  render: () => (
    <BrandADarkSurface>
      <div style={{ ...contentCardStyle, gap: '1.75rem' }}>
        <header style={{ display: 'grid', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Inputs &amp; Text Areas · Brand A Dark</h1>
          <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.6 }}>
            Controls showcase neutral, warning, critical, and success states with brand surfaces + contrast-safe focus rings.
          </p>
        </header>
        <div style={gridStyle}>
          <Input
            label="Workspace ID"
            supportingText="Lowercase, 3–24 characters. Brand tokens paint the supporting text."
            defaultValue="brand-a-workspace"
          />
          <Input
            label="Billing email"
            supportingText="Use a verified domain."
            defaultValue="billing@acme"
            tone="critical"
            message="Domain must match acmeanalytics.com"
          />
          <Input
            label="Usage commitment (%)"
            supportingText="Context remaps warning hues without component overrides."
            defaultValue="150"
            suffix="%"
            tone="warning"
            message="Exceeds historical usage by 48%."
          />
          <TextArea
            label="Pilot considerations"
            placeholder="Document migration blockers, SLAs, or legal guardrails."
            supportingText="Textarea inherits typography from Brand A dark."
            tone="info"
            rows={4}
          />
        </div>
      </div>
    </BrandADarkSurface>
  )
};
