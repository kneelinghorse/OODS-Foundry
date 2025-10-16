/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiffViewer } from '../../apps/explorer/addons/storybook-addon-agent/components/DiffViewer.js';
import type { PlanDiff } from '../../apps/explorer/addons/storybook-addon-agent/types.js';

const makeContextChanges = (count: number): PlanDiff['hunks'][number]['changes'] =>
  Array.from({ length: count }, (_, index) => ({
    type: 'context' as const,
    value: `unchanged line ${index + 1}`,
  }));

const sampleDiff: PlanDiff = {
  path: 'src/example.ts',
  status: 'modified',
  summary: { additions: 1, deletions: 1 },
  hunks: [
    {
      header: '@@ -1,7 +1,7 @@',
      changes: [
        ...makeContextChanges(7),
        { type: 'remove', value: 'console.log("old");' },
        { type: 'add', value: 'console.log("new");' },
      ],
    },
  ],
};

const jsonDiff: PlanDiff = {
  path: 'config/state.json',
  status: 'modified',
  hunks: [],
  structured: {
    type: 'json',
    before: {
      feature: {
        enabled: false,
        limit: 5,
      },
    },
    after: {
      feature: {
        enabled: true,
        limit: 5,
      },
    },
  },
};

describe('DiffViewer component', () => {
  it('collapses unchanged context by default and expands on request', () => {
    render(<DiffViewer diffs={[sampleDiff]} />);

    const foldToggle = screen.getByRole('button', { name: /show 7 unchanged lines/i });
    expect(foldToggle).toBeTruthy();
    expect(foldToggle?.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(foldToggle);
    screen.getByText(/unchanged line 1/);
    expect(foldToggle?.getAttribute('aria-expanded')).toBe('true');
  });

  it('switches between unified and split modes', () => {
    render(<DiffViewer diffs={[sampleDiff]} />);

    const splitToggle = screen.getByRole('button', { name: /split/i });
    fireEvent.click(splitToggle);

    expect(splitToggle?.getAttribute('aria-pressed')).toBe('true');
    screen.getByText(/Original/i);
    screen.getByText(/\+ console\.log\("new"\);/i);
  });

  it('enables semantic JSON mode when structured diff data is provided', () => {
    render(<DiffViewer diffs={[jsonDiff]} />);

    const jsonToggle = screen.getByRole('button', { name: /json/i });
    expect(jsonToggle.hasAttribute('disabled')).toBe(false);
    fireEvent.click(jsonToggle);

    screen.getByText(/\(root\)/);
    screen.getByText(/feature/);
    screen.getByText(/false → true/);
  });
});
