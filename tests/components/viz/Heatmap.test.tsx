/* @vitest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Heatmap } from '../../../src/components/viz/Heatmap.js';
import { createHeatmapSpec } from './__fixtures__/heatmapSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
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

describe('Heatmap', () => {
  beforeEach(() => {
    embedSpy.mockClear();
    initSpy.mockClear();
    setOptionMock.mockClear();
    onMock.mockClear();
    dispatchActionMock.mockClear();
  });

  it('renders Vega-Lite heatmap with legend and matrix fallback', async () => {
    render(<Heatmap spec={createHeatmapSpec()} renderer="vega-lite" />);
    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const legendBar = screen.getByTestId('heatmap-legend-bar');
    expect(legendBar).toHaveStyle({ backgroundImage: expect.stringContaining('--viz-scale-sequential-') });

    const table = screen.getByRole('table', { name: /ticket volume by day of week/i });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent(/Day of week/i);

    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders.length).toBeGreaterThan(0);
    expect(rowHeaders[0]).toHaveTextContent(/Monday/i);

    const cells = within(table).getAllByRole('cell');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0]).toHaveAttribute('data-value', '12');
  });

  it('falls back to AccessibleTable when matrix derivation is unavailable', async () => {
    const spec = createHeatmapSpec({
      data: { values: [] },
    });
    render(<Heatmap spec={spec} renderer="vega-lite" />);
    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/No inline data values available/i);
  });

  it('uses the ECharts renderer when requested and wires interactions', async () => {
    render(<Heatmap spec={createHeatmapSpec()} renderer="echarts" />);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
    expect(embedSpy).not.toHaveBeenCalled();

    const option = setOptionMock.mock.calls[0]?.[0] as { visualMap?: { inRange?: { color?: string[] } } } | undefined;
    expect(option?.visualMap?.inRange?.color?.length).toBeGreaterThan(0);

    expect(onMock).toHaveBeenCalledWith('mouseover', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('globalout', expect.any(Function));
  });
});
