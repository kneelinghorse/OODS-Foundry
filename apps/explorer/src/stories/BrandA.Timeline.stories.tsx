import type { Meta, StoryObj } from '@storybook/react';
import '../styles/index.css';
import '../styles/brand.css';
import { BrandADarkSurface } from './BrandACommon';
import TimelinePage from '../pages/TimelinePage';

const meta = {
  title: 'BrandA/Timeline',
  parameters: {
    layout: 'fullscreen',
    docs: { source: { state: 'hidden' } },
    chromatic: {
      disableSnapshot: false,
      modes: {
        dark: { globals: { theme: 'dark' } },
      },
    },
  },
  tags: ['vrt-critical']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  name: 'Dark',
  parameters: {
    vrt: { tags: ['brand-a-dark', 'composite'] }
  },
  render: () => (
    <BrandADarkSurface style={{ justifyContent: 'stretch', padding: '3rem 2rem' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 'min(1024px, 100%)' }}>
          <TimelinePage />
        </div>
      </div>
    </BrandADarkSurface>
  )
};
