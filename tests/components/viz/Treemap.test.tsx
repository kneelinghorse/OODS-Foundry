/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HierarchyInput } from '../../../src/types/viz/network-flow.js';
import { Treemap } from '../../../src/components/viz/Treemap.js';

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

const nestedData: HierarchyInput = {
  type: 'nested',
  data: {
    name: 'Total',
    value: 100,
    children: [
      { name: 'Category A', value: 60 },
      { name: 'Category B', value: 40 },
    ],
  },
};

const adjacencyData: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 100, name: 'Root' },
    { id: 'a', parentId: 'root', value: 60, name: 'A' },
    { id: 'b', parentId: 'root', value: 40, name: 'B' },
  ],
};

describe('Treemap', () => {
  describe('rendering', () => {
    it('renders the chart container', async () => {
      render(<Treemap data={nestedData} />);

      const chart = screen.getByTestId('treemap-chart');
      expect(chart).toBeInTheDocument();
    });

    it('renders with custom dimensions', async () => {
      render(<Treemap data={nestedData} width={800} height={500} />);

      const chart = screen.getByTestId('treemap-chart');
      expect(chart).toHaveStyle({ width: '100%', maxWidth: '800px', height: '500px' });
    });

    it('renders with aria-label', async () => {
      render(<Treemap data={nestedData} name="Revenue Breakdown" />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('aria-label', 'Revenue Breakdown');
    });

    it('renders with custom aria-label override', async () => {
      render(<Treemap data={nestedData} name="Revenue" aria-label="Custom label" />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('aria-label', 'Custom label');
    });
  });

  describe('data formats', () => {
    it('accepts nested hierarchy data', async () => {
      render(<Treemap data={nestedData} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('accepts adjacency list data', async () => {
      render(<Treemap data={adjacencyData} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility fallback', () => {
    it('renders accessible table when showTable is true', async () => {
      render(<Treemap data={nestedData} showTable />);

      await waitFor(() => {
        const fallback = screen.getByTestId('treemap-a11y-fallback');
        expect(fallback).toBeInTheDocument();
      });
    });

    it('hides accessible table when showTable is false', async () => {
      render(<Treemap data={nestedData} showTable={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('treemap-a11y-fallback')).not.toBeInTheDocument();
      });
    });
  });

  describe('v1.0 renderer constraint', () => {
    it('warns when non-echarts renderer is requested', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<Treemap data={nestedData} renderer={'vega-lite' as 'echarts'} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('renderer="vega-lite" is not supported in v1.0')
      );

      consoleSpy.mockRestore();
    });
  });
});
