import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CategoryPicker } from '../../../src/components/classification/CategoryPicker.js';
import type { CategoryNode } from '../../../src/schemas/classification/category-node.ts';

const PICKER_CATEGORIES: CategoryNode[] = [
  {
    id: 'electronics',
    slug: 'electronics',
    name: 'Electronics',
    parentId: null,
    ltreePath: 'electronics',
    depth: 0,
    ancestors: [],
    childCount: 3,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
    metadata: { sortKey: 1 },
  },
  {
    id: 'mobile',
    slug: 'mobile',
    name: 'Mobile',
    parentId: 'electronics',
    ltreePath: 'electronics.mobile',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 2,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'android',
    slug: 'android',
    name: 'Android',
    parentId: 'mobile',
    ltreePath: 'electronics.mobile.android',
    depth: 2,
    ancestors: ['electronics', 'mobile'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'ios',
    slug: 'ios',
    name: 'iOS',
    parentId: 'mobile',
    ltreePath: 'electronics.mobile.ios',
    depth: 2,
    ancestors: ['electronics', 'mobile'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'audio',
    slug: 'audio',
    name: 'Audio',
    parentId: 'electronics',
    ltreePath: 'electronics.audio',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 1,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'wireless-audio',
    slug: 'wireless-audio',
    name: 'Wireless Audio',
    parentId: 'audio',
    ltreePath: 'electronics.audio.wireless',
    depth: 2,
    ancestors: ['electronics', 'audio'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
];

const meta: Meta<typeof CategoryPicker> = {
  title: 'Components/Classification/CategoryPicker',
  component: CategoryPicker,
  args: {
    id: 'stories-category-picker',
    nodes: PICKER_CATEGORIES,
    label: 'Categories',
    description: 'Select all relevant taxonomy nodes.',
    recentlyUsedIds: ['mobile', 'audio'],
  },
  parameters: {
    layout: 'centered',
    viewport: { defaultViewport: 'responsive' },
  },
  tags: ['vrt', 'vrt-critical'],
};

export default meta;

type Story = StoryObj<typeof CategoryPicker>;

export const Default: Story = {};

export const WithValidation: Story = {
  args: {
    validation: {
      state: 'error',
      message: 'At least one category is required.',
    },
    required: true,
  },
};

export const WithControlledSelection: Story = {
  render: (args) => {
    const [selection, setSelection] = React.useState<string[]>(['android', 'audio']);
    return (
      <CategoryPicker
        {...args}
        selectedIds={selection}
        onSelectionChange={({ ids }) => setSelection(ids)}
      />
    );
  },
};

export const WithReorder: Story = {
  args: {
    enableReorder: true,
  },
};

export const DenseLayout: Story = {
  args: {
    density: 'compact',
    summaryLabel: 'Chosen taxonomy nodes',
  },
};

export const DisabledState: Story = {
  args: {
    disabled: true,
  },
};
