import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CategoryTree, CategoryTreeView } from '../../../src/components/classification/CategoryTree.js';
import { CategoryBreadcrumb } from '../../../src/components/classification/CategoryBreadcrumb.js';
import { useCategoryTree } from '../../../src/hooks/useCategoryTree.js';
import type { CategoryNode } from '../../../src/schemas/classification/category-node.ts';

const SAMPLE_CATEGORIES: CategoryNode[] = [
  {
    id: 'electronics',
    slug: 'electronics',
    name: 'Electronics',
    description: 'Primary taxonomy for smart devices.',
    parentId: null,
    ltreePath: 'electronics',
    depth: 0,
    ancestors: [],
    childCount: 4,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
    metadata: { source: 'ltree', sortKey: 1 },
  },
  {
    id: 'mobile-phones',
    slug: 'mobile-phones',
    name: 'Mobile Phones',
    parentId: 'electronics',
    ltreePath: 'electronics.mobile_phones',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 2,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
    metadata: { source: 'ltree', sortKey: 2 },
  },
  {
    id: 'android',
    slug: 'android',
    name: 'Android Phones',
    parentId: 'mobile-phones',
    ltreePath: 'electronics.mobile_phones.android',
    depth: 2,
    ancestors: ['electronics', 'mobile-phones'],
    childCount: 0,
    isSelectable: true,
    synonyms: ['google-os'],
    mode: 'taxonomy',
  },
  {
    id: 'ios',
    slug: 'ios',
    name: 'iOS Phones',
    parentId: 'mobile-phones',
    ltreePath: 'electronics.mobile_phones.ios',
    depth: 2,
    ancestors: ['electronics', 'mobile-phones'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'audio',
    slug: 'audio',
    name: 'Audio & Headphones',
    parentId: 'electronics',
    ltreePath: 'electronics.audio',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 2,
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
  {
    id: 'wired-audio',
    slug: 'wired-audio',
    name: 'Wired Audio',
    parentId: 'audio',
    ltreePath: 'electronics.audio.wired',
    depth: 2,
    ancestors: ['electronics', 'audio'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'home-office',
    slug: 'home-office',
    name: 'Home Office',
    parentId: 'electronics',
    ltreePath: 'electronics.home_office',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 1,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'chairs',
    slug: 'chairs',
    name: 'Chairs',
    parentId: 'home-office',
    ltreePath: 'electronics.home_office.chairs',
    depth: 2,
    ancestors: ['electronics', 'home-office'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
];

const meta: Meta<typeof CategoryTree> = {
  title: 'Components/Classification/CategoryTree',
  component: CategoryTree,
  args: {
    nodes: SAMPLE_CATEGORIES,
    defaultExpandedDepth: 2,
  },
  tags: ['vrt', 'vrt-critical'],
};

export default meta;

type Story = StoryObj<typeof CategoryTree>;

export const SmallTree: Story = {
  name: 'Small hierarchy',
  args: {
    nodes: SAMPLE_CATEGORIES.slice(0, 4),
  },
};

export const DeepTree: Story = {
  name: 'Deep hierarchy (auto expand)',
  args: {
    defaultExpandedDepth: 3,
  },
};

export const WithBreadcrumbs: Story = {
  name: 'Breadcrumb trail',
  render: (args) => (
    <CategoryTree
      {...args}
      showBreadcrumbs
      renderNodeBadge={(node) =>
        node.childCount > 0 ? `${node.childCount} items` : node.metadata?.source
      }
    />
  ),
};

export const DragAndDrop: Story = {
  name: 'Drag & drop reorder',
  args: {
    enableDragAndDrop: true,
  },
};

export const MultiSelectControlled: Story = {
  name: 'Controlled selection',
  render: (args) => {
    const [selected, setSelected] = React.useState<string[]>(['android', 'ios']);
    return (
      <CategoryTree
        {...args}
        multiSelect
        selectedIds={selected}
        onSelectionChange={({ ids }) => setSelected(ids)}
      />
    );
  },
};

export const CustomView: StoryObj = {
  name: 'Custom view (hook + breadcrumb)',
  render: () => {
    const state = useCategoryTree(SAMPLE_CATEGORIES, {
      multiSelect: true,
      defaultExpandedDepth: 2,
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <CategoryBreadcrumb nodes={state.getPathForNode(state.focusId ?? 'electronics')} />
        <CategoryTreeView
          state={state}
          selectionStyle="highlight"
          renderNodeBadge={(node) => (node.metadata?.sortKey ? `#${node.metadata.sortKey}` : undefined)}
        />
      </div>
    );
  },
};
