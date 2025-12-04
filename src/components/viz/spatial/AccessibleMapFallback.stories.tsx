/**
 * Storybook stories for AccessibleMapFallback component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import type { JSX } from 'react';
import type { Feature, Polygon } from 'geojson';
import { AccessibleMapFallback } from './AccessibleMapFallback.js';

interface FallbackStoryArgs {
  showTable: boolean;
  showNarrative: boolean;
  sortColumn: string;
  sortOrder: 'asc' | 'desc';
  alwaysVisible?: boolean;
  triggerLabel?: string;
}

const features: Feature<Polygon>[] = [
  {
    type: 'Feature',
    id: 'CA',
    properties: { name: 'California' },
    geometry: { type: 'Polygon', coordinates: [[[-124, 42], [-124, 32], [-114, 32], [-114, 42], [-124, 42]]] },
  },
  {
    type: 'Feature',
    id: 'TX',
    properties: { name: 'Texas' },
    geometry: { type: 'Polygon', coordinates: [[[-106, 36], [-106, 26], [-93, 26], [-93, 36], [-106, 36]]] },
  },
  {
    type: 'Feature',
    id: 'NY',
    properties: { name: 'New York' },
    geometry: { type: 'Polygon', coordinates: [[[-80, 45], [-80, 40], [-72, 40], [-72, 45], [-80, 45]]] },
  },
  {
    type: 'Feature',
    id: 'FL',
    properties: { name: 'Florida' },
    geometry: { type: 'Polygon', coordinates: [[[-88, 31], [-88, 24], [-80, 24], [-80, 31], [-88, 31]]] },
  },
];

const data = [
  { id: 'CA', value: 39_538_223, metric: 72, notes: 'West coast leader' },
  { id: 'TX', value: 29_145_505, metric: 55, notes: 'Energy-driven growth' },
  { id: 'NY', value: 20_201_249, metric: 68, notes: 'Finance and media hub' },
  { id: 'FL', value: 21_538_187, metric: 61, notes: 'Hospitality focus' },
];

const joinedData = new Map(data.map((entry) => [entry.id, entry]));
const columns = [
  { field: 'value', label: 'Population', format: (value: unknown) => Number(value).toLocaleString() },
  { field: 'metric', label: 'Access Score' },
  { field: 'notes', label: 'Notes' },
];

const narrative = {
  summary: 'Fallback view highlights table and narrative content for screen readers.',
  keyFindings: ['California leads total population', 'Texas and Florida trend upward in growth-sensitive metrics'],
};

function FallbackDemo({
  showTable,
  showNarrative,
  sortColumn,
  sortOrder,
  alwaysVisible = false,
  triggerLabel = 'Show accessible view',
}: FallbackStoryArgs): JSX.Element {
  return (
    <AccessibleMapFallback
      data={data}
      features={features}
      joinedData={joinedData}
      table={
        showTable
          ? {
              caption: 'Accessibility fallback table',
              columns,
              sortDefault: sortColumn,
              sortOrder,
            }
          : undefined
      }
      narrative={showNarrative ? narrative : undefined}
      alwaysVisible={alwaysVisible}
      triggerLabel={triggerLabel}
    />
  );
}

const meta = {
  title: 'Visualization/Spatial/AccessibleMapFallback',
  component: FallbackDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Accessible alternative to visual maps. Renders a sortable data table and narrative summary for screen reader users.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showTable: { control: 'boolean' },
    showNarrative: { control: 'boolean' },
    sortColumn: { control: 'select', options: ['value', 'metric', 'notes'] },
    sortOrder: { control: 'select', options: ['asc', 'desc'] },
    triggerLabel: { control: 'text' },
    alwaysVisible: { control: 'boolean' },
  },
} satisfies Meta<FallbackStoryArgs>;

export default meta;
type Story = StoryObj<FallbackStoryArgs>;

export const TableView: Story = {
  args: {
    showTable: true,
    showNarrative: false,
    sortColumn: 'value',
    sortOrder: 'desc',
    alwaysVisible: true,
  },
  render: (args) => <FallbackDemo {...args} />,
};

export const Narrative: Story = {
  args: {
    showTable: false,
    showNarrative: true,
    sortColumn: 'metric',
    sortOrder: 'asc',
    alwaysVisible: true,
  },
  render: (args) => <FallbackDemo {...args} />,
};

export const Combined: Story = {
  args: {
    showTable: true,
    showNarrative: true,
    sortColumn: 'metric',
    sortOrder: 'desc',
    alwaysVisible: true,
  },
  render: (args) => <FallbackDemo {...args} />,
};

export const ScreenReader: Story = {
  args: {
    showTable: true,
    showNarrative: true,
    sortColumn: 'value',
    sortOrder: 'desc',
    alwaysVisible: false,
    triggerLabel: 'Open screen reader-friendly data view',
  },
  render: (args) => <FallbackDemo {...args} />,
};
