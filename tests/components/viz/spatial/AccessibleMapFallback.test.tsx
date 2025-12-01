/**
 * Tests for AccessibleMapFallback component.
 */

import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Feature, Polygon } from 'geojson';
import { AccessibleMapFallback } from '../../../../src/components/viz/spatial/AccessibleMapFallback.js';

const features: Feature<Polygon>[] = [
  {
    type: 'Feature',
    id: 'A',
    properties: { name: 'Alpha' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0]]],
    },
  },
  {
    type: 'Feature',
    id: 'B',
    properties: { name: 'Beta' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[1, 1]]],
    },
  },
];

const data = [
  { id: 'A', value: 10, total: 100 },
  { id: 'B', value: 20, total: 200 },
];

const table = {
  caption: 'Test Table',
  columns: [
    { field: 'value', label: 'Value' },
    { field: 'total', label: 'Total' },
  ],
  sortDefault: 'value',
  sortOrder: 'asc' as const,
};

describe('AccessibleMapFallback', () => {
  it('renders table with data and caption', () => {
    render(
      <AccessibleMapFallback
        data={data}
        features={features}
        joinedData={new Map(data.map((item) => [item.id, item]))}
        table={table}
        alwaysVisible
      />
    );

    expect(screen.getByText('Test Table')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 rows
  });

  it('sorts when clicking column header', () => {
    render(
      <AccessibleMapFallback
        data={data}
        features={features}
        joinedData={new Map(data.map((item) => [item.id, item]))}
        table={table}
        alwaysVisible
      />
    );

    const valueHeader = screen.getByText('Value');
    fireEvent.click(valueHeader); // toggle to desc
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Beta'); // highest value first
  });

  it('shows narrative and toggle button', () => {
    render(
      <AccessibleMapFallback
        data={data}
        features={features}
        joinedData={new Map(data.map((item) => [item.id, item]))}
        table={table}
        narrative={{
          summary: 'Alpha leads',
          keyFindings: ['Alpha > Beta'],
        }}
        triggerLabel="Show accessible table"
      />
    );

    const toggle = screen.getByRole('button', { name: /accessible table/i });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText('Alpha leads')).toBeInTheDocument();
    expect(screen.getByText('Alpha > Beta')).toBeInTheDocument();
  });
});
