/**
 * Storybook stories for MapLegend component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import type { JSX } from 'react';
import { MapLegend } from './MapLegend.js';
import { createLinearScale, createQuantizeScale } from './utils/color-scale-utils.js';
import { createLinearSizeScale } from './utils/size-scale-utils.js';

type LegendType = 'sequential' | 'categorical' | 'size' | 'combined';

interface LegendStoryArgs {
  legendType: LegendType;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  title: string;
}

const COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-04)',
  'var(--oods-viz-scale-sequential-07)',
  'var(--oods-viz-scale-sequential-09)',
];
const CATEGORY_COLORS = [
  'var(--sys-status-info-fg)',
  'var(--sys-status-success-fg)',
  'var(--sys-status-warning-fg)',
  'var(--sys-status-danger-fg)',
];

const sequentialScale = createLinearScale([0, 100], COLOR_RANGE);
const categoricalScale = createQuantizeScale([0, 100], CATEGORY_COLORS);
const sizeScale = createLinearSizeScale([1_000, 120_000], [6, 32]);

function LegendDemo({ legendType, position, title }: LegendStoryArgs): JSX.Element {
  const colorScale =
    legendType === 'sequential'
      ? {
          type: 'continuous' as const,
          scale: sequentialScale,
          label: title || 'Sequential scale',
          format: (v: number) => `${v.toFixed(0)}%`,
        }
      : legendType === 'categorical'
        ? { type: 'categorical' as const, scale: categoricalScale, label: title || 'Categories' }
        : undefined;

  const sizeLegend =
    legendType === 'size' || legendType === 'combined'
      ? { scale: sizeScale, label: title || 'Size legend', format: (v: number) => `${Math.round(v / 1000)}k` }
      : undefined;

  const activeColorScale =
    legendType === 'combined'
      ? {
          type: 'continuous' as const,
          scale: sequentialScale,
          label: title || 'Combined metric',
          format: (v: number) => `${v.toFixed(0)}%`,
        }
      : colorScale;

  return (
    <div style={{ position: 'relative', width: '760px', height: '360px', padding: '16px', background: 'var(--cmp-surface)' }}>
      <MapLegend
        colorScale={activeColorScale}
        sizeScale={legendType === 'combined' ? sizeLegend : legendType === 'size' ? sizeLegend : undefined}
        position={position}
        orientation={legendType === 'combined' ? 'vertical' : 'horizontal'}
      />
    </div>
  );
}

const meta = {
  title: 'Visualization/Spatial/Map Legend',
  component: LegendDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Legend component for spatial visualizations with sequential, categorical, size-only, and combined variants.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    legendType: { control: 'select', options: ['sequential', 'categorical', 'size', 'combined'] },
    position: { control: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    title: { control: 'text' },
  },
} satisfies Meta<LegendStoryArgs>;

export default meta;
type Story = StoryObj<LegendStoryArgs>;

export const Sequential: Story = {
  args: {
    legendType: 'sequential',
    position: 'bottom-right',
    title: 'Vaccination rate',
  },
  render: (args) => <LegendDemo {...args} />,
};

export const Categorical: Story = {
  args: {
    legendType: 'categorical',
    position: 'top-right',
    title: 'Service tier',
  },
  render: (args) => <LegendDemo {...args} />,
};

export const Size: Story = {
  args: {
    legendType: 'size',
    position: 'bottom-left',
    title: 'Orders fulfilled',
  },
  render: (args) => <LegendDemo {...args} />,
};

export const Combined: Story = {
  args: {
    legendType: 'combined',
    position: 'top-left',
    title: 'Severity + volume',
  },
  render: (args) => <LegendDemo {...args} />,
};

export const Positions: Story = {
  render: () => (
    <div style={{ position: 'relative', width: '900px', height: '500px', background: 'var(--cmp-surface)' }}>
      <MapLegend
        colorScale={{ type: 'continuous', scale: sequentialScale, label: 'Top Left' }}
        position="top-left"
        orientation="horizontal"
      />
      <MapLegend
        colorScale={{ type: 'categorical', scale: categoricalScale, label: 'Top Right' }}
        position="top-right"
        orientation="vertical"
      />
      <MapLegend
        sizeScale={{ scale: sizeScale, label: 'Bottom Left', format: (v) => `${Math.round(v / 1000)}k` }}
        position="bottom-left"
        orientation="vertical"
      />
      <MapLegend
        colorScale={{ type: 'continuous', scale: sequentialScale, label: 'Bottom Right' }}
        sizeScale={{ scale: sizeScale, label: 'Bubble Size', format: (v) => `${Math.round(v / 1000)}k` }}
        position="bottom-right"
        orientation="horizontal"
      />
    </div>
  ),
  parameters: {
    controls: { disable: true },
  },
};
