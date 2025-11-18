import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { TagInput } from '../../../src/components/classification/TagInput.js';
import type { Tag } from '../../../src/schemas/classification/tag.js';
import type { TagUsageSignal } from '../../../src/hooks/useTagSuggestions.js';

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
];

const signals: TagUsageSignal[] = [
  {
    objectId: 'story-1',
    tags: ['javascript', 'react'],
    similarity: 0.9,
    lastSeenAt: '2025-11-15T18:00:00Z',
  },
  {
    objectId: 'story-2',
    tags: ['python'],
    similarity: 0.7,
    lastSeenAt: '2025-11-12T08:00:00Z',
  },
];

const meta: Meta<typeof TagInput> = {
  title: 'Components/Classification/TagInput',
  component: TagInput,
  args: {
    id: 'storybook-tag-input',
    label: 'Content tags',
    availableTags: TAGS,
    description: 'Autocomplete canonical tags, or create new ones inline.',
    spamContext: { userId: 'storybook', userReputation: 80, recentCreations: [] },
  },
  tags: ['vrt', 'vrt-critical'],
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof TagInput>;

export const Empty: Story = {};

export const WithDefaultTags: Story = {
  args: {
    defaultTags: TAGS.slice(0, 2),
  },
};

export const WithContextualSuggestions: Story = {
  args: {
    contextSignals: signals,
  },
};

export const CreationFlow: Story = {
  args: {
    onCreateTag: async (label: string) => ({
      tag: {
        id: label,
        name: label,
        slug: label.toLowerCase(),
        usageCount: 0,
        state: 'active',
        synonyms: [],
        isCanonical: true,
      },
    }),
  },
};

export const Controlled: Story = {
  render: (storyArgs) => {
    const [value, setValue] = React.useState<Tag[]>([TAGS[0]]);
    return (
      <TagInput
        {...storyArgs}
        selectedTags={value}
        onChange={(next) => setValue(next as Tag[])}
        contextSignals={signals}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultTags: TAGS.slice(0, 1),
  },
};
