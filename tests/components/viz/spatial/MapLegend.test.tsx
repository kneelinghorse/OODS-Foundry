/**
 * Tests for MapLegend component.
 */

import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLegend } from '../../../../src/components/viz/spatial/MapLegend.js';
import { createLinearScale, createQuantizeScale } from '../../../../src/components/viz/spatial/utils/color-scale-utils.js';
import { createLinearSizeScale } from '../../../../src/components/viz/spatial/utils/size-scale-utils.js';

const COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
];

describe('MapLegend', () => {
  it('renders continuous gradient with labels', () => {
    const scale = createLinearScale([0, 100], COLOR_RANGE);

    render(
      <MapLegend
        colorScale={{
          type: 'continuous',
          scale,
          label: 'Population',
          format: (value) => `${value.toFixed(0)}`,
        }}
        position="top-right"
        orientation="horizontal"
      />
    );

    const legend = screen.getByLabelText('Map legend');
    expect(legend).toBeInTheDocument();
    expect(legend.className).toContain('top-4 right-4');

    const gradient = screen.getByLabelText('Color scale');
    expect(gradient).toBeInTheDocument();
    expect(gradient.getAttribute('style')).toContain('linear-gradient');
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders categorical swatches', () => {
    const scale = createQuantizeScale([0, 100], COLOR_RANGE);

    render(
      <MapLegend
        colorScale={{
          type: 'categorical',
          scale,
          label: 'Sales',
        }}
        position="bottom-left"
        orientation="vertical"
      />
    );

    expect(screen.getByText('Sales')).toBeInTheDocument();
    const categories = screen.getAllByRole('listitem');
    expect(categories.length).toBe(scale.range.length);
  });

  it('renders size legend', () => {
    const sizeScale = createLinearSizeScale([1000, 100000], [6, 30]);

    render(
      <MapLegend
        sizeScale={{
          scale: sizeScale,
          label: 'Population',
          format: (value) => `${value.toLocaleString()}`,
        }}
        position="bottom-right"
      />
    );

    expect(screen.getByText('Population')).toBeInTheDocument();
    const sizeSection = screen.getByLabelText('Size scale');
    expect(sizeSection.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/,/).length).toBeGreaterThan(0); // formatted numbers
  });
});
