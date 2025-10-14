import type { Meta, StoryObj } from '@storybook/react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Tabs, type Tab } from '../components/Tabs';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  background: 'var(--cmp-surface-panel, rgba(15,23,42,0.6))',
  borderRadius: '1rem',
  border: '1px solid color-mix(in srgb, var(--cmp-border-default, rgba(148,163,184,0.45)) 65%, transparent)'
};

const meta: Meta<typeof Tabs> = {
  title: 'BrandA/Tabs',
  component: Tabs,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Tabs>;

const TABS: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    panel: (
      <div style={panelStyle}>
        <h3 style={{ margin: 0 }}>Contract overview</h3>
        <p style={{ margin: 0, color: 'var(--cmp-text-muted, #94a3b8)' }}>
          Brand tokens handle headings, paragraphs, and border ramps with zero component conditionals.
        </p>
      </div>
    )
  },
  {
    id: 'metrics',
    label: 'Metrics',
    panel: (
      <div style={panelStyle}>
        <h3 style={{ margin: 0 }}>Expansion metrics</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
          <li>Trial to paid conversion · 36%</li>
          <li>Support satisfaction · 4.7 / 5</li>
          <li>ARR uplift · +48%</li>
        </ul>
      </div>
    )
  },
  {
    id: 'history',
    label: 'History',
    panel: (
      <div style={panelStyle}>
        <h3 style={{ margin: 0 }}>Activity history</h3>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
          <li>2025-10-10 · Contract created</li>
          <li>2025-10-11 · Legal review complete</li>
          <li>2025-10-13 · Finance approved</li>
        </ol>
      </div>
    )
  },
  {
    id: 'disabled',
    label: 'Launch plan',
    disabled: true,
    panel: null
  }
] as const;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'component'] }
  },
  render: () => {
    const [value, setValue] = useState<string>('overview');
    return (
      <BrandADarkSurface>
        <div style={{ ...contentCardStyle, gap: '1.75rem' }}>
          <header style={{ display: 'grid', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Tabs · Brand A Dark</h1>
            <p style={{ margin: 0, color: 'var(--cmp-text-muted, #94a3b8)', lineHeight: 1.6 }}>
              Selection halo + panel surfaces use brand tokens; keyboard contract remains unchanged.
            </p>
          </header>
          <Tabs tabs={TABS as unknown as typeof TABS} value={value} onChange={setValue} ariaLabel="Brand metrics tabs" />
        </div>
      </BrandADarkSurface>
    );
  }
};
