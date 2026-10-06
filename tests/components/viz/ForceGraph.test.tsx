/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NetworkInput } from '../../../src/types/viz/network-flow.js';
import { ForceGraph } from '../../../src/components/viz/ForceGraph.js';

// Mock echarts
const mockSetOption = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockDispose = vi.fn();
const mockResize = vi.fn();

const mockEChartsInstance = {
  setOption: mockSetOption,
  on: mockOn,
  off: mockOff,
  dispose: mockDispose,
  resize: mockResize,
};

const mockInit = vi.fn(() => mockEChartsInstance);

vi.mock('echarts', () => ({
  __esModule: true,
  init: () => mockInit(),
}));

beforeEach(() => {
  mockSetOption.mockClear();
  mockOn.mockClear();
  mockOff.mockClear();
  mockDispose.mockClear();
  mockResize.mockClear();
  mockInit.mockClear();
});

const networkData: NetworkInput = {
  nodes: [
    { id: 'a', group: 'type1' },
    { id: 'b', group: 'type1' },
    { id: 'c', group: 'type2' },
    { id: 'd', group: 'type2' },
  ],
  links: [
    { source: 'a', target: 'b', value: 10 },
    { source: 'b', target: 'c', value: 5 },
    { source: 'c', target: 'd', value: 8 },
    { source: 'd', target: 'a', value: 3 },
  ],
};

describe('ForceGraph', () => {
  describe('rendering', () => {
    it('renders the chart container', async () => {
      render(<ForceGraph data={networkData} />);

      const chart = screen.getByTestId('force-graph-chart');
      expect(chart).toBeInTheDocument();
    });

    it('renders with custom dimensions', async () => {
      render(<ForceGraph data={networkData} width={1000} height={700} />);

      const chart = screen.getByTestId('force-graph-chart');
      expect(chart).toHaveStyle({ width: '1000px', height: '700px' });
    });

    it('renders with aria-label from name prop', async () => {
      render(<ForceGraph data={networkData} name="Social Network" />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('aria-label', 'Social Network');
    });

    it('defaults to 800x600 dimensions', async () => {
      render(<ForceGraph data={networkData} />);

      const chart = screen.getByTestId('force-graph-chart');
      expect(chart).toHaveStyle({ width: '800px', height: '600px' });
    });
  });

  describe('configuration options', () => {
    it('passes zoom prop to spec', async () => {
      render(<ForceGraph data={networkData} zoom={false} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('passes draggable prop to spec', async () => {
      render(<ForceGraph data={networkData} draggable={false} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('passes custom force parameters', async () => {
      render(
        <ForceGraph
          data={networkData}
          force={{
            repulsion: 200,
            gravity: 0.2,
            edgeLength: 50,
          }}
        />
      );

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility fallback', () => {
    it('renders accessible tables for nodes and edges', async () => {
      render(<ForceGraph data={networkData} showTable />);

      await waitFor(() => {
        const fallback = screen.getByTestId('graph-a11y-fallback');
        expect(fallback).toBeInTheDocument();
      });
    });

    it('hides accessible table when showTable is false', async () => {
      render(<ForceGraph data={networkData} showTable={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('graph-a11y-fallback')).not.toBeInTheDocument();
      });
    });
  });

  describe('v1.0 renderer constraint', () => {
    it('warns when non-echarts renderer is requested', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      render(<ForceGraph data={networkData} renderer={'vega-lite' as 'echarts'} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('renderer="vega-lite" is not supported in v1.0')
      );

      consoleSpy.mockRestore();
    });
  });
});
