/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScatterChart } from '../../../src/components/viz/ScatterChart.js';
import { createDenseScatterSpec, createScatterChartSpec } from './__fixtures__/scatterChartSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('../../../src/viz/runtime/vega-embed-loader.js', () => ({
  loadVegaEmbed: () => Promise.resolve(embedSpy),
  preloadVegaEmbed: () => Promise.resolve(embedSpy),
}));

const disposeMock = vi.fn();
const setOptionMock = vi.fn();
const resizeMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();
const dispatchActionMock = vi.fn();

const echartsInstance = {
  dispose: disposeMock,
  setOption: setOptionMock,
  resize: resizeMock,
  on: onMock,
  off: offMock,
  dispatchAction: dispatchActionMock,
};

const initSpy = vi.hoisted(() => vi.fn(() => echartsInstance));

vi.mock('echarts', () => ({
  __esModule: true,
  init: initSpy,
}));

describe('ScatterChart', () => {
  beforeEach(() => {
    embedSpy.mockClear();
    initSpy.mockClear();
    setOptionMock.mockClear();
    onMock.mockClear();
    dispatchActionMock.mockClear();
  });

  it('renders the scatter chart with accessible table and keyboard navigation', async () => {
    render(<ScatterChart spec={createScatterChartSpec()} />);

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const renderer = screen.getByTestId('scatter-chart-renderer');
    expect(renderer).toHaveAttribute('data-renderer', 'vega-lite');

    const table = screen.getByRole('table', { name: /opportunities by lead time/i });
    expect(table).toBeInTheDocument();

    const rows = screen.getAllByRole('row').filter((row) => row.tabIndex === 0);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveAttribute('aria-label');
  });

  it(
    'selects the ECharts renderer for dense datasets and wires interactions',
    { timeout: 15000 },
    async () => {
      render(<ScatterChart spec={createDenseScatterSpec(720)} />);

      await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
      expect(embedSpy).not.toHaveBeenCalled();

    const renderer = screen.getByTestId('scatter-chart-renderer');
    expect(renderer).toHaveAttribute('data-renderer', 'echarts');

    const option = setOptionMock.mock.calls[0]?.[0] as { dataset?: Array<{ source?: unknown[] }> } | undefined;
      expect(option?.dataset?.[0]?.source?.length).toBe(720);
      expect(onMock).toHaveBeenCalledWith('mouseover', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('globalout', expect.any(Function));
    }
  );
});
