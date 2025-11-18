/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagInput } from '../../../src/components/classification/TagInput.js';
import type { Tag } from '../../../src/schemas/classification/tag.js';

const TAG_FIXTURES: Tag[] = [
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
];

describe('TagInput component', () => {
  it('renders default tags as pills', () => {
    render(
      <TagInput
        id="tag-test"
        label="Tags"
        availableTags={TAG_FIXTURES}
        defaultTags={[TAG_FIXTURES[1]]}
      />
    );

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /tags/i })).toBeInTheDocument();
  });

  it('adds canonical tag via keyboard commit', async () => {
    const user = userEvent.setup();
    render(<TagInput id="tag-control" label="Tags" availableTags={TAG_FIXTURES} />);

    const input = screen.getByRole('textbox', { name: /tags/i });
    await user.click(input);
    await user.type(input, 'Python');
    await user.keyboard('{Enter}');

    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('invokes onCreateTag for novel entries when spam checks pass', async () => {
    const user = userEvent.setup();
    const onCreateTag = vi.fn().mockResolvedValue({
      tag: {
        id: 'graphql',
        name: 'GraphQL',
        slug: 'graphql',
        usageCount: 0,
        state: 'active',
        synonyms: [],
        isCanonical: true,
      },
    } satisfies Tag);

    render(
      <TagInput
        id="create-test"
        label="Tags"
        availableTags={TAG_FIXTURES}
        onCreateTag={onCreateTag}
        spamContext={{ userId: 'tester', userReputation: 90, recentCreations: [] }}
      />
    );

    const input = screen.getByRole('textbox', { name: /tags/i });
    await user.type(input, 'GraphQL');
    await user.keyboard('{Enter}');

    expect(onCreateTag).toHaveBeenCalledWith('GraphQL');
    expect(await screen.findByText('GraphQL')).toBeInTheDocument();
  });

  it('removes tags with backspace when query is empty', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        id="remove-test"
        label="Tags"
        availableTags={TAG_FIXTURES}
        defaultTags={[TAG_FIXTURES[0], TAG_FIXTURES[1]]}
      />
    );

    const input = screen.getByRole('textbox', { name: /tags/i });
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
  });
});
