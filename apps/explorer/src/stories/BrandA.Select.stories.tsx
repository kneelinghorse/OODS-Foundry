import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select, type SelectOption } from '../components/Select';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface, contentCardStyle } from './BrandACommon';

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1.5rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem'
};

const selectOptions: SelectOption[] = [
  { value: 'scale', label: 'Scale • Annual' },
  { value: 'plus', label: 'Plus • Quarterly' },
  { value: 'starter', label: 'Starter • Monthly' },
  { value: 'legacy', label: 'Legacy Pilot', disabled: true }
];

const meta: Meta<typeof Select> = {
  title: 'BrandA/Select',
  component: Select,
  tags: ['vrt-critical'],
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: { disableSnapshot: false }
  }
};

export default meta;

type Story = StoryObj<typeof Select>;

const SelectField = ({ label, initial }: { label: string; initial?: string }) => {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <label style={labelStyle}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <Select options={selectOptions} value={value} onChange={setValue} placeholder="Choose an option" />
      <span style={{ color: 'var(--cmp-text-muted, #94a3b8)', fontSize: '0.875rem' }}>
        Brand tokens feed the button + listbox surfaces, ensuring high-contrast legibility.
      </span>
    </label>
  );
};

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'component'] }
  },
  render: () => (
    <BrandADarkSurface>
      <div style={{ ...contentCardStyle, gap: '1.75rem' }}>
        <header style={{ display: 'grid', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Select Pattern · Brand A Dark</h1>
          <p style={{ margin: 0, color: 'var(--cmp-text-muted, #94a3b8)', lineHeight: 1.6 }}>
            Menu tokens inherit brand hues while the button stays component-pure. Disabled options lean on `data-brand`.
          </p>
        </header>
        <div style={gridStyle}>
          <SelectField label="Plan selection" initial="scale" />
          <SelectField label="Billing cadence" initial="plus" />
          <label style={labelStyle}>
            <span style={{ fontWeight: 600 }}>Legacy plan (disabled)</span>
            <Select options={selectOptions} defaultValue="legacy" disabled />
            <span style={{ color: 'var(--cmp-text-muted, #94a3b8)', fontSize: '0.875rem' }}>
              Disabled state keeps 4.5:1 contrast for outline + text via shared tokens.
            </span>
          </label>
        </div>
      </div>
    </BrandADarkSurface>
  )
};
