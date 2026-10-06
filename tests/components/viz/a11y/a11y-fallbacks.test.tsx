/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TreemapA11yFallback } from '@/components/viz/a11y/TreemapA11yFallback.js';
import { SunburstA11yFallback } from '@/components/viz/a11y/SunburstA11yFallback.js';
import { SankeyA11yFallback } from '@/components/viz/a11y/SankeyA11yFallback.js';
import { GraphA11yFallback } from '@/components/viz/a11y/GraphA11yFallback.js';
import { formatCompactValue } from '@/components/viz/a11y/format-compact.js';
import type { HierarchyInput, SankeyInput, NetworkInput } from '@/types/viz/network-flow.js';

// Sprint-128 m03: backfill the previously zero-coverage non-cartesian a11y
// fallback tables (the React screen-reader alternative to the visual charts).

const HIERARCHY: HierarchyInput = {
  type: 'adjacency_list',
  data: [
    { id: 'root', parentId: null, value: 0, name: 'Total' },
    { id: 'a', parentId: 'root', value: 1_500_000, name: 'Alpha' },
    { id: 'b', parentId: 'root', value: 2_500, name: 'Beta' },
  ],
};

const SANKEY: SankeyInput = {
  nodes: [{ name: 'Coal' }, { name: 'Grid' }, { name: 'Homes' }],
  links: [
    { source: 'Coal', target: 'Grid', value: 40 },
    { source: 'Grid', target: 'Homes', value: 30 },
  ],
};

const NETWORK: NetworkInput = {
  nodes: [{ id: 'n1', group: 'core' }, { id: 'n2', group: 'edge' }, { id: 'n3' }],
  links: [
    { source: 'n1', target: 'n2', value: 5 },
    { source: 'n1', target: 'n3' },
  ],
};

describe('formatCompactValue (shared compact formatter)', () => {
  it('suffixes magnitudes and leaves small values plain', () => {
    expect(formatCompactValue(2_500_000)).toBe('2.5M');
    expect(formatCompactValue(2_500)).toBe('2.5K');
    expect(formatCompactValue(950)).toBe('950');
  });
});

describe('TreemapA11yFallback', () => {
  it('renders the full hierarchy (every node) with compact-formatted values', () => {
    const { getByTestId } = render(<TreemapA11yFallback data={HIERARCHY} name="Org" />);
    const table = within(getByTestId('treemap-a11y-fallback')).getByRole('table');
    // root + 2 children → header row + 3 body rows.
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('Alpha')).toBeInTheDocument();
    expect(within(table).getByText('1.5M')).toBeInTheDocument();
    expect(within(table).getByText('2.5K')).toBeInTheDocument();
  });
});

describe('SunburstA11yFallback', () => {
  it('renders an accessible hierarchy table', () => {
    const { getByTestId } = render(<SunburstA11yFallback data={HIERARCHY} name="Budget" />);
    const region = getByTestId('sunburst-a11y-fallback');
    expect(within(region).getByText('Alpha')).toBeInTheDocument();
    expect(within(region).getByText('1.5M')).toBeInTheDocument();
  });
});

describe('SankeyA11yFallback', () => {
  it('renders node-summary and flow tables with the total volume', () => {
    const { getByTestId } = render(<SankeyA11yFallback data={SANKEY} name="Energy" />);
    const region = getByTestId('sankey-a11y-fallback');
    // node summary + flow detail tables.
    expect(within(region).getAllByRole('table')).toHaveLength(2);
    expect(within(region).getByText('Total Volume:')).toBeInTheDocument();
    // 'Coal' appears in both the node-summary and flow tables.
    expect(within(region).getAllByText('Coal').length).toBeGreaterThan(0);
    expect(within(region).getAllByText('Homes').length).toBeGreaterThan(0);
  });
});

describe('GraphA11yFallback', () => {
  it('renders node and edge tables and surfaces an em-dash for absent edge values', () => {
    const { getByTestId } = render(<GraphA11yFallback data={NETWORK} name="Service map" />);
    const region = getByTestId('graph-a11y-fallback');
    // node id appears in the node table and (as source/target) the edge table.
    expect(within(region).getAllByText('n1').length).toBeGreaterThan(0);
    expect(within(region).getAllByText('n3').length).toBeGreaterThan(0);
    // the n1→n3 link has no value → em-dash via the shared formatter guard.
    expect(within(region).getAllByText('—').length).toBeGreaterThan(0);
  });
});
