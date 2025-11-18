import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { TagList } from '../../../src/components/classification/TagList.js';
import type { Tag } from '../../../src/schemas/classification/tag.js';

const TAGS: Tag[] = [
  {
    id: 'javascript',
    name: 'JavaScript',
    slug: 'javascript',
    usageCount: 18234,
    state: 'active',
    synonyms: ['js'],
    isCanonical: true,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    slug: 'typescript',
    usageCount: 8234,
    state: 'active',
    synonyms: ['ts'],
    isCanonical: true,
  },
  {
    id: 'python',
    name: 'Python',
    slug: 'python',
    usageCount: 20000,
    state: 'active',
    synonyms: [],
    isCanonical: true,
  },
  {
    id: 'react',
    name: 'React',
    slug: 'react',
    usageCount: 15000,
    state: 'active',
    synonyms: [],
    isCanonical: true,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    slug: 'graphql',
    usageCount: 6400,
    state: 'active',
    synonyms: [],
    isCanonical: true,
  },
  {
    id: 'design-systems',
    name: 'Design systems',
    slug: 'design-systems',
    usageCount: 4200,
    state: 'active',
    synonyms: [],
    isCanonical: true,
  },
];

const meta: Meta<typeof TagList> = {
  title: 'Components/Classification/TagList',
  component: TagList,
  args: {
    tags: TAGS,
    ariaLabel: 'Trending tags',
  },
  tags: ['vrt'],
} satisfies Meta<typeof TagList>;

export default meta;
type Story = StoryObj<typeof TagList>;

export const Default: Story = {
  args: {
    showUsage: true,
    maxVisible: 4,
  },
};

export const Interactive: Story = {
  render: (storyArgs) => {
    const [filters, setFilters] = React.useState<string[]>([]);
    return (
      <TagList
        {...storyArgs}
        interactive
        tags={TAGS}
        onTagClick={(tag) =>
          setFilters((current) =>
            current.includes(tag.id)
              ? current.filter((id) => id !== tag.id)
              : [...current, tag.id]
          )
        }
      />
    );
  },
};

export const Compact: Story = {
  args: {
    density: 'compact',
    showUsage: false,
  },
};

export const Removable: Story = {
  args: {
    onRemoveTag: (tag) => console.log('remove', tag.slug),
    maxVisible: 5,
  },
};
