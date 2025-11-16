/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VizFacetGrid } from '../../../src/components/viz/VizFacetGrid.js';
import { createFacetGridSpec } from './__fixtures__/facetGridSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
}));

beforeEach(() => {
  embedSpy.mockClear();
});

describe('VizFacetGrid', () => {
  it('renders the Vega-Lite facet grid and grouped fallback tables', async () => {
    render(<VizFacetGrid spec={createFacetGridSpec()} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const table = screen.getByRole('table', { name: /Region: North • Segment: Enterprise/i });
    expect(table).toBeInTheDocument();
  });

  it('shows a fallback note when facet tables are disabled', async () => {
    const base = createFacetGridSpec();
    const spec = createFacetGridSpec({
      a11y: {
        ...base.a11y,
        tableFallback: { enabled: false, caption: 'Facet table' },
      },
    });
    render(<VizFacetGrid spec={spec} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    expect(screen.getByText(/Table fallback disabled/i)).toBeInTheDocument();
  });
});
