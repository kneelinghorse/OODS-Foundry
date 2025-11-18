/* @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'vitest-axe';
import { CategoryTree } from '../../../src/components/classification/CategoryTree.js';
import type { CategoryNode } from '../../../src/schemas/classification/category-node.ts';

expect.extend({ toHaveNoViolations });

const A11Y_FIXTURES: CategoryNode[] = [
  {
    id: 'root',
    slug: 'root',
    name: 'Root',
    parentId: null,
    ltreePath: 'root',
    depth: 0,
    ancestors: [],
    childCount: 1,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
  {
    id: 'child',
    slug: 'child',
    name: 'Child',
    parentId: 'root',
    ltreePath: 'root.child',
    depth: 1,
    ancestors: ['root'],
    childCount: 0,
    isSelectable: true,
    synonyms: [],
    mode: 'taxonomy',
  },
];

let originalCanvasContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({
      fillRect: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      canvas: document.createElement('canvas'),
    })),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasContext,
  });
});

describe('CategoryTree accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <CategoryTree nodes={A11Y_FIXTURES} showBreadcrumbs aria-label="Taxonomy tree" />
    );
    const report = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    const violations = report?.violations ?? [];
    expect(violations).toHaveLength(0);
  });
});
