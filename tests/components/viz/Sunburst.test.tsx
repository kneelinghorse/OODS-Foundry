/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HierarchyInput } from '../../../src/types/viz/network-flow.js';
import { Sunburst } from '../../../src/components/viz/Sunburst.js';

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
      {
        name: 'Category A',
        value: 60,
        children: [
          { name: 'Sub A1', value: 35 },
          { name: 'Sub A2', value: 25 },
        ],
      },
      { name: 'Category B', value: 40 },
    ],
  },
};

describe('Sunburst', () => {
  describe('rendering', () => {
    it('renders the chart container', async () => {
      render(<Sunburst data={nestedData} />);

      const chart = screen.getByTestId('sunburst-chart');
      expect(chart).toBeInTheDocument();
    });

    it('renders with custom dimensions', async () => {
      render(<Sunburst data={nestedData} width={500} height={500} />);

      const chart = screen.getByTestId('sunburst-chart');
      expect(chart).toHaveStyle({ width: '500px', height: '500px' });
    });

    it('renders with aria-label from name prop', async () => {
      render(<Sunburst data={nestedData} name="Category Distribution" />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('aria-label', 'Category Distribution');
    });

    it('defaults to square aspect ratio', async () => {
      render(<Sunburst data={nestedData} />);

      const chart = screen.getByTestId('sunburst-chart');
      expect(chart).toHaveStyle({ width: '600px', height: '600px' });
    });
  });

  describe('accessibility fallback', () => {
    it('renders accessible table with percentage column', async () => {
      render(<Sunburst data={nestedData} showTable />);

      await waitFor(() => {
        const fallback = screen.getByTestId('sunburst-a11y-fallback');
        expect(fallback).toBeInTheDocument();
      });
    });

    it('hides accessible table when showTable is false', async () => {
      render(<Sunburst data={nestedData} showTable={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('sunburst-a11y-fallback')).not.toBeInTheDocument();
      });
    });
  });

  describe('v1.0 renderer constraint', () => {
    it('warns when non-echarts renderer is requested', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      render(<Sunburst data={nestedData} renderer={'vega-lite' as 'echarts'} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('renderer="vega-lite" is not supported in v1.0')
      );

      consoleSpy.mockRestore();
    });
  });
});
