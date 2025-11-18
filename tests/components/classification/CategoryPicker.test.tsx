/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryPicker } from '../../../src/components/classification/CategoryPicker.js';
import type { CategoryNode } from '../../../src/schemas/classification/category-node.ts';

const PICKER_FIXTURES: CategoryNode[] = [
  {
    id: 'electronics',
    slug: 'electronics',
    name: 'Electronics',
    parentId: null,
    ltreePath: 'electronics',
    depth: 0,
    ancestors: [],
    childCount: 2,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'mobile',
    slug: 'mobile',
    name: 'Mobile',
    parentId: 'electronics',
    ltreePath: 'electronics.mobile',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 1,
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
    id: 'audio',
    slug: 'audio',
    name: 'Audio',
    parentId: 'electronics',
    ltreePath: 'electronics.audio',
    depth: 1,
    ancestors: ['electronics'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
];

describe('CategoryPicker', () => {
  it('renders label, search, and tree', () => {
    render(
      <CategoryPicker
        id="picker"
        label="Categories"
        nodes={PICKER_FIXTURES}
        recentlyUsedIds={['android']}
      />
    );

    const input = screen.getByPlaceholderText(/search categories/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: /Categories hierarchy/ })).toBeInTheDocument();
  });

  it('filters tree nodes via typeahead search', async () => {
    const user = userEvent.setup();
    render(<CategoryPicker id="picker-filters" label="Categories" nodes={PICKER_FIXTURES} />);
    const input = screen.getByPlaceholderText(/search categories/i);

    await user.type(input, 'audio');
    expect(screen.getByRole('treeitem', { name: /Audio/ })).toBeInTheDocument();
  });

  it('exposes hidden inputs for form integration', async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker id="picker-hidden" label="Categories" name="categories[]" nodes={PICKER_FIXTURES} />
    );

    await user.tab(); // focus search
    await user.keyboard('{Tab}');
    const treeitem = screen.getByRole('treeitem', { name: /Electronics/ });
    expect(treeitem).toHaveAttribute('tabindex', '0');
    await user.click(screen.getByRole('button', { name: /View Mobile/ }));

    const hiddenInput = document.querySelector<HTMLInputElement>('input[type="hidden"][value="mobile"]');
    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput).toHaveAttribute('name', 'categories[]');
  });

  it('toggles selection via recently used chips', async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker
        id="picker-recent"
        label="Categories"
        name="categories[]"
        nodes={PICKER_FIXTURES}
        recentlyUsedIds={['android']}
      />
    );

    const chip = screen.getByRole('button', { name: /^Android$/ });
    await user.click(chip);
    const hidden = document.querySelector('input[type="hidden"][value="android"]');
    expect(hidden).not.toBeNull();
  });
});
