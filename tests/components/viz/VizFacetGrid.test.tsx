/* @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VizFacetGrid } from '../../../src/components/viz/VizFacetGrid.js';
import { createFacetGridSpec } from './__fixtures__/facetGridSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('../../../src/viz/runtime/vega-embed-loader.js', () => ({
  loadVegaEmbed: () => Promise.resolve(embedSpy),
  preloadVegaEmbed: () => Promise.resolve(embedSpy),
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

  it('lazy-renders fallback tables when there are many panels', async () => {
    const spec = createFacetGridSpec({
      data: {
        values: buildLargeFacetValues(),
      },
    });
    render(<VizFacetGrid spec={spec} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const fallback = screen.getByTestId('facet-table-fallback');
    const initialTables = within(fallback).getAllByRole('table');
    expect(initialTables.length).toBeLessThan(10);

    const toggleButton = screen.getByRole('button', { name: /Show table for panel 9/i });
    await userEvent.click(toggleButton);

    await waitFor(() => {
      const updatedTables = within(fallback).getAllByRole('table');
      expect(updatedTables.length).toBeGreaterThan(initialTables.length);
    });
  });
});

function buildLargeFacetValues(): Array<Record<string, string | number>> {
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const segments = ['Enterprise', 'Growth', 'Midmarket'];
  const metrics = ['MRR', 'Pipeline'];

  const values: Array<Record<string, string | number>> = [];
  for (const region of regions) {
    for (const segment of segments) {
      for (const metric of metrics) {
        values.push({
          region,
          segment,
          metric,
          value: (regions.indexOf(region) + 1) * 100 + segments.indexOf(segment) * 10 + metrics.indexOf(metric),
        });
      }
    }
  }
  return values;
}
