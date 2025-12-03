/**
 * Storybook stories for MapControls component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, useState, type JSX } from 'react';
import { MapControls } from './MapControls.js';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ControlsStoryArgs {
  showZoom: boolean;
  showReset: boolean;
  showLayerToggles: boolean;
  position: Position;
}

const baseLayers = [
  { id: 'regions', label: 'Regions', visible: true },
  { id: 'symbols', label: 'Symbols', visible: true },
  { id: 'routes', label: 'Routes', visible: false },
];

function ControlsDemo({ showZoom, showReset, showLayerToggles, position }: ControlsStoryArgs): JSX.Element {
  const [zoom, setZoom] = useState<number>(1);
  const [layers, setLayers] = useState(baseLayers);

  const zoomHandlers = useMemo(
    () =>
      showZoom
        ? {
            onZoomIn: () => setZoom((value) => value + 0.5),
            onZoomOut: () => setZoom((value) => Math.max(0.5, value - 0.5)),
          }
        : {},
    [showZoom]
  );

  const resetHandlers = useMemo(
    () =>
      showReset
        ? {
            onZoomReset: () => setZoom(1),
          }
        : {},
    [showReset]
  );

  const layerHandlers = useMemo(
    () =>
      showLayerToggles
        ? {
            layers,
            onLayerToggle: (id: string, visible: boolean) =>
              setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, visible } : layer))),
          }
        : {},
    [layers, showLayerToggles]
  );

  return (
    <div style={{ position: 'relative', width: '720px', height: '420px', padding: '16px', background: 'var(--cmp-surface)' }}>
      <p className="text-sm text-[--cmp-text-muted]">
        Zoom level: {zoom.toFixed(1)} | Visible layers:{' '}
        {layers.filter((layer) => layer.visible).map((layer) => layer.label).join(', ') || 'None'}
      </p>
      <MapControls
        {...zoomHandlers}
        {...resetHandlers}
        {...layerHandlers}
        zoomLevel={zoom}
        minZoom={0.5}
        maxZoom={4}
        position={position}
      />
    </div>
  );
}

const meta = {
  title: 'Visualization/Spatial/Map Controls',
  component: ControlsDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Zoom and layer toggles with keyboard-friendly controls.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showZoom: { control: 'boolean' },
    showReset: { control: 'boolean' },
    showLayerToggles: { control: 'boolean' },
    position: { control: 'select', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
  },
} satisfies Meta<ControlsStoryArgs>;

export default meta;
type Story = StoryObj<ControlsStoryArgs>;

export const Default: Story = {
  args: {
    showZoom: true,
    showReset: true,
    showLayerToggles: false,
    position: 'top-right',
  },
  render: (args) => <ControlsDemo {...args} />,
};

export const WithLayers: Story = {
  args: {
    showZoom: true,
    showReset: true,
    showLayerToggles: true,
    position: 'bottom-left',
  },
  render: (args) => <ControlsDemo {...args} />,
};

export const Compact: Story = {
  args: {
    showZoom: true,
    showReset: false,
    showLayerToggles: false,
    position: 'top-left',
  },
  render: (args) => <ControlsDemo {...args} />,
};

export const Keyboard: Story = {
  args: {
    showZoom: true,
    showReset: true,
    showLayerToggles: true,
    position: 'bottom-right',
  },
  render: (args) => (
    <div className="space-y-2">
      <p className="text-sm text-[--cmp-text-muted]">
        Tab through controls, Enter/Space activates zoom, Space toggles layers. Focus order mirrors visual order.
      </p>
      <ControlsDemo {...args} />
    </div>
  ),
};
