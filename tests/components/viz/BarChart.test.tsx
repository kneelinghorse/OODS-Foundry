/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from '../../../src/components/viz/BarChart.js';
import { createBarChartSpec } from './__fixtures__/barChartSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
}));

beforeEach(() => {
  embedSpy.mockClear();
});

describe('BarChart', () => {
  it('renders the chart container with accessible fallbacks', async () => {
    const spec = createBarChartSpec();
    render(<BarChart spec={spec} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const regionHeading = screen.getAllByRole('columnheader', { name: 'Region' })[0];
    expect(regionHeading).toBeInTheDocument();

    const table = screen.getByRole('table', { name: /regional revenue table/i });
    expect(table).toBeInTheDocument();
  });

  it('shows a friendly message when inline values are missing', async () => {
    const spec = createBarChartSpec();
    spec.data = { url: 'https://example.com/revenue.json' };

    render(<BarChart spec={spec} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('No inline data values available to generate a table');
  });
});
