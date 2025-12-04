/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SankeyInput } from '../../../src/types/viz/network-flow.js';
import { Sankey } from '../../../src/components/viz/Sankey.js';

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

const energyFlowData: SankeyInput = {
  nodes: [
    { name: 'Coal' },
    { name: 'Natural Gas' },
    { name: 'Electricity' },
    { name: 'Heat' },
    { name: 'Residential' },
    { name: 'Commercial' },
  ],
  links: [
    { source: 'Coal', target: 'Electricity', value: 100 },
    { source: 'Coal', target: 'Heat', value: 50 },
    { source: 'Natural Gas', target: 'Electricity', value: 80 },
    { source: 'Natural Gas', target: 'Heat', value: 40 },
    { source: 'Electricity', target: 'Residential', value: 90 },
    { source: 'Electricity', target: 'Commercial', value: 90 },
    { source: 'Heat', target: 'Residential', value: 60 },
    { source: 'Heat', target: 'Commercial', value: 30 },
  ],
};

const invalidDataMissingValue: SankeyInput = {
  nodes: [{ name: 'A' }, { name: 'B' }],
  links: [{ source: 'A', target: 'B' } as any], // Missing value
};

describe('Sankey', () => {
  describe('rendering', () => {
    it('renders the chart container', async () => {
      render(<Sankey data={energyFlowData} />);

      const chart = screen.getByTestId('sankey-chart');
      expect(chart).toBeInTheDocument();
    });

    it('renders with custom dimensions', async () => {
      render(<Sankey data={energyFlowData} width={1000} height={600} />);

      const chart = screen.getByTestId('sankey-chart');
      expect(chart).toHaveStyle({ width: '100%', maxWidth: '1000px', height: '600px' });
    });

    it('renders with aria-label from name prop', async () => {
      render(<Sankey data={energyFlowData} name="Energy Flow" />);

      const figure = screen.getByRole('figure');
      expect(figure).toHaveAttribute('aria-label', 'Energy Flow');
    });

    it('defaults to 900x500 dimensions', async () => {
      render(<Sankey data={energyFlowData} />);

      const chart = screen.getByTestId('sankey-chart');
      expect(chart).toHaveStyle({ width: '100%', maxWidth: '900px', height: '500px' });
    });
  });

  describe('layout options', () => {
    it('accepts horizontal orientation', async () => {
      render(<Sankey data={energyFlowData} orientation="horizontal" />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('accepts vertical orientation', async () => {
      render(<Sankey data={energyFlowData} orientation="vertical" />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('accepts node alignment options', async () => {
      render(<Sankey data={energyFlowData} nodeAlign="left" />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });

    it('accepts custom node dimensions', async () => {
      render(<Sankey data={energyFlowData} nodeWidth={30} nodeGap={12} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
      });
    });
  });

  describe('validation', () => {
    it('shows error for links without values', async () => {
      render(<Sankey data={invalidDataMissingValue} />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/require.*value/i);
      });
    });
  });

  describe('accessibility fallback', () => {
    it('renders accessible flow tables', async () => {
      render(<Sankey data={energyFlowData} showTable />);

      await waitFor(() => {
        const fallback = screen.getByTestId('sankey-a11y-fallback');
        expect(fallback).toBeInTheDocument();
      });
    });

    it('hides accessible table when showTable is false', async () => {
      render(<Sankey data={energyFlowData} showTable={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('sankey-a11y-fallback')).not.toBeInTheDocument();
      });
    });
  });

  describe('v1.0 renderer constraint', () => {
    it('warns when non-echarts renderer is requested with special Sankey message', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<Sankey data={energyFlowData} renderer={'vega-lite' as 'echarts'} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vega-Lite cannot render Sankey diagrams')
      );

      consoleSpy.mockRestore();
    });
  });
});
