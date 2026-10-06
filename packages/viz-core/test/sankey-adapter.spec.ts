import { describe, expect, it } from 'vitest';
import {
  adaptSankeyToECharts,
  SankeyValidationError,
  transformNodes,
  validateSankeyInput,
  type NormalizedVizSpec,
  type SankeyInput,
} from '@oods/viz-core';

// sprint-111 m03 — sankey beachhead. The data-shaping half (validation + node/link
// transforms) was extracted into sankey-utils; these tests pin its WHY: a sankey
// without link values is meaningless (the width IS the flow), node throughput is
// max(incoming, outgoing), and the ECharts series is built from the SEPARATE
// nodes+links input — decoupled from the IR — and is deterministic.

function sankeySpec(overrides: Partial<NormalizedVizSpec> = {}): NormalizedVizSpec {
  return {
    $schema: 'https://oods-foundry.com/viz-spec/v1',
    id: 'viz:sankey-test',
    name: 'Energy Flow',
    data: { values: [] },
    marks: [{ trait: 'MarkSankey' }],
    encoding: {},
    a11y: { description: 'Sankey of energy flow from sources to end uses.' },
    ...overrides,
  } as NormalizedVizSpec;
}

const FLOW: SankeyInput = {
  nodes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  links: [
    { source: 'A', target: 'B', value: 10 },
    { source: 'B', target: 'C', value: 6 },
    { source: 'A', target: 'C', value: 4 },
  ],
};

describe('validateSankeyInput — flow quantities are mandatory', () => {
  it('accepts a well-formed flow', () => {
    expect(() => validateSankeyInput(FLOW)).not.toThrow();
  });

  it('rejects a link without a finite value (the width encodes the flow — it cannot be absent)', () => {
    const bad: SankeyInput = { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: Number.NaN }] };
    expect(() => validateSankeyInput(bad)).toThrow(SankeyValidationError);
  });

  it('rejects a link referencing a non-existent node (no dangling edges)', () => {
    const bad: SankeyInput = { nodes: [{ name: 'A' }], links: [{ source: 'A', target: 'ghost', value: 1 }] };
    expect(() => validateSankeyInput(bad)).toThrow(SankeyValidationError);
  });
});

describe('transformNodes — node value is total throughput = max(incoming, outgoing)', () => {
  it('computes throughput from the surrounding links', () => {
    const nodes = transformNodes(FLOW.nodes, FLOW.links, ['#111111']);
    const valueByName = Object.fromEntries(nodes.map((n) => [n.name, n.value]));
    expect(valueByName.A).toBe(14); // pure source: outgoing 10 + 4
    expect(valueByName.B).toBe(10); // max(incoming 10, outgoing 6)
    expect(valueByName.C).toBe(10); // pure sink: incoming 6 + 4
  });

  it('honours an explicit node value over the computed throughput', () => {
    const nodes = transformNodes([{ name: 'A', value: 99 }], [], ['#111111']);
    expect(nodes[0].value).toBe(99);
  });

  it('assigns a palette colour to each node', () => {
    const nodes = transformNodes(FLOW.nodes, FLOW.links, ['#5470c6', '#91cc75']);
    for (const node of nodes) {
      expect(node.itemStyle?.color).toMatch(/^(#|rgb\()/);
    }
  });
});

describe('adaptSankeyToECharts', () => {
  it('builds a sankey series from the nodes+links input (decoupled from the IR)', () => {
    const option = adaptSankeyToECharts(sankeySpec(), FLOW);
    const series = (option.series as Record<string, unknown>[])[0];

    expect(series.type).toBe('sankey');
    expect((series.data as unknown[]).length).toBe(3);
    expect((series.links as unknown[]).length).toBe(3);
  });

  it('emits RESOLVED palette colours (rgb/hex), never `var(--token)`', () => {
    const option = adaptSankeyToECharts(sankeySpec(), FLOW);
    const palette = option.color as string[];
    expect(palette.length).toBeGreaterThan(0);
    for (const colour of palette) {
      expect(colour).toMatch(/^(#|rgb\()/);
      expect(colour).not.toContain('var(');
    }
  });

  it('propagates SankeyValidationError for invalid input (the handler maps it to an error code)', () => {
    const bad: SankeyInput = { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: Number.NaN }] };
    expect(() => adaptSankeyToECharts(sankeySpec(), bad)).toThrow(SankeyValidationError);
  });

  it('flows a11y into aria + carries usermeta provenance', () => {
    const option = adaptSankeyToECharts(sankeySpec(), FLOW);
    expect((option.aria as { enabled?: boolean }).enabled).toBe(true);
    expect((option.aria as { description?: string }).description).toBe(
      'Sankey of energy flow from sources to end uses.',
    );
    expect((option.usermeta as { oods?: Record<string, unknown> }).oods!.specId).toBe('viz:sankey-test');
  });

  it('is DETERMINISTIC — identical (spec, input) yields a byte-identical serialized option', () => {
    const a = JSON.stringify(adaptSankeyToECharts(sankeySpec(), FLOW));
    const b = JSON.stringify(adaptSankeyToECharts(sankeySpec(), FLOW));
    expect(a).toBe(b);
  });
});
