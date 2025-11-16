/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VizLayeredView } from '../../../src/components/viz/VizLayeredView.js';
import { createLayeredViewSpec } from './__fixtures__/layeredViewSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
}));

beforeEach(() => {
  embedSpy.mockClear();
});

describe('VizLayeredView', () => {
  it('renders the layered chart and layer summaries', async () => {
    render(<VizLayeredView spec={createLayeredViewSpec()} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    expect(screen.getByText(/Layer details/i)).toBeInTheDocument();
    expect(screen.getByText(/Forecast band/i)).toBeInTheDocument();
  });

  it('shows a warning when LayoutLayer metadata is missing', async () => {
    const spec = createLayeredViewSpec({
      layout: undefined,
    });
    render(<VizLayeredView spec={spec} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    expect(screen.getByText(/does not declare LayoutLayer/i)).toBeInTheDocument();
  });
});
