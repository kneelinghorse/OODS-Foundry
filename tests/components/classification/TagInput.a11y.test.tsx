/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { TagInput } from '../../../src/components/classification/TagInput.js';
import type { Tag } from '../../../src/schemas/classification/tag.js';

const SAMPLE_TAGS: Tag[] = [
  {
    id: 'java',
    name: 'Java',
    slug: 'java',
    usageCount: 14500,
    state: 'active',
    synonyms: [],
    isCanonical: true,
  },
  {
    id: 'go',
    name: 'Go',
    slug: 'go',
    usageCount: 5400,
    state: 'active',
    synonyms: ['golang'],
    isCanonical: true,
  },
];

describe('TagInput accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <TagInput
        id="a11y-tags"
        label="Content tags"
        availableTags={SAMPLE_TAGS}
        defaultTags={[SAMPLE_TAGS[0]]}
        description="Add tags to classify the record."
        spamContext={{ userId: 'a11y', userReputation: 100, recentCreations: [] }}
        onCreateTag={async (label) => ({
          tag: {
            id: label,
            name: label,
            slug: label.toLowerCase(),
            usageCount: 0,
            state: 'active',
            synonyms: [],
            isCanonical: true,
          },
        })}
      />
    );
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations ?? []).toHaveLength(0);
  });
});
