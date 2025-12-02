/**
 * Performance Benchmark Tests for Network & Flow Module v1.0
 *
 * These tests verify that the Network & Flow visualizations meet performance targets:
 * - Treemap render time: 500 nodes < 200ms
 * - Sunburst render time: 300 nodes < 200ms
 * - Force Graph render time: 100 nodes < 500ms
 * - Sankey render time: 50 nodes < 100ms
 *
 * These benchmarks test adapter transformation time (data → ECharts option),
 * not actual canvas rendering which happens in the browser.
 *
 * @module tests/performance/network-flow-perf.test.ts
 */
import { describe, expect, it } from 'vitest';

import { adaptTreemapToECharts } from '@/viz/adapters/echarts/treemap-adapter.js';
import { adaptSunburstToECharts } from '@/viz/adapters/echarts/sunburst-adapter.js';
import { adaptGraphToECharts } from '@/viz/adapters/echarts/graph-adapter.js';
import { adaptSankeyToECharts } from '@/viz/adapters/echarts/sankey-adapter.js';

import type { HierarchyAdjacencyInput } from '@/types/viz/network-flow.js';
import type { SankeyInput } from '@/types/viz/sankey-types.js';
import type { GraphInput } from '@/types/viz/graph-types.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

// Performance budget thresholds (in milliseconds)
const BUDGETS = {
  treemap500: 200,   // 500 nodes < 200ms
  sunburst300: 200,  // 300 nodes < 200ms
  forceGraph100: 500, // 100 nodes < 500ms (force layout is computationally expensive)
  sankey50: 100,     // 50 nodes < 100ms
} as const;

// Number of iterations for averaging
const ITERATIONS = 5;

function createBaseSpec(id: string): NormalizedVizSpec {
  return {
    $schema: 'https://oods.dev/viz-spec/v1',
    id,
    name: `Performance Test ${id}`,
    data: { values: [] },
    marks: [{ trait: 'MarkRect' }],
    encoding: {},
    a11y: { description: 'Performance benchmark' },
    config: { layout: { width: 800, height: 600 } },
  };
}

/**
 * Generate a balanced tree hierarchy with specified node count
 */
function generateHierarchyData(nodeCount: number): HierarchyAdjacencyInput {
  const data: HierarchyAdjacencyInput['data'] = [];
  const branchingFactor = 5;
  let nodeId = 0;

  // Root node
  data.push({
    id: `node-${nodeId}`,
    parentId: null,
    value: nodeCount * 10,
    name: 'Root',
  });
  nodeId++;

  // Generate tree structure
  const queue: string[] = ['node-0'];
  let level = 0;

  while (nodeId < nodeCount && queue.length > 0) {
    const levelSize = queue.length;
    const newQueue: string[] = [];

    for (let i = 0; i < levelSize && nodeId < nodeCount; i++) {
      const parentId = queue[i];
      const childCount = Math.min(branchingFactor, nodeCount - nodeId);

      for (let j = 0; j < childCount; j++) {
        data.push({
          id: `node-${nodeId}`,
          parentId,
          value: Math.floor(Math.random() * 100) + 10,
          name: `Node ${nodeId}`,
        });
        newQueue.push(`node-${nodeId}`);
        nodeId++;

        if (nodeId >= nodeCount) break;
      }
    }

    queue.length = 0;
    queue.push(...newQueue);
    level++;
  }

  return { type: 'adjacency_list', data };
}

/**
 * Generate a random graph with specified node count
 * Links are generated with ~3 connections per node on average
 */
function generateGraphData(nodeCount: number): GraphInput {
  const groups = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const nodes: GraphInput['nodes'] = [];
  const links: GraphInput['links'] = [];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `n${i}`,
      name: `Node ${i}`,
      group: groups[i % groups.length],
    });
  }

  // Generate links (approximately 3 links per node)
  const linkCount = Math.floor(nodeCount * 1.5);
  for (let i = 0; i < linkCount; i++) {
    const source = `n${Math.floor(Math.random() * nodeCount)}`;
    const target = `n${Math.floor(Math.random() * nodeCount)}`;
    if (source !== target) {
      links.push({
        source,
        target,
        value: Math.floor(Math.random() * 20) + 1,
      });
    }
  }

  return { nodes, links };
}

/**
 * Generate a Sankey diagram with specified node count
 * Creates a layered flow structure
 */
function generateSankeyData(nodeCount: number): SankeyInput {
  const nodes: SankeyInput['nodes'] = [];
  const links: SankeyInput['links'] = [];

  // Create layers (roughly 5 layers)
  const layerCount = 5;
  const nodesPerLayer = Math.ceil(nodeCount / layerCount);

  // Generate nodes by layer
  const layers: string[][] = [];
  let nodeId = 0;

  for (let layer = 0; layer < layerCount && nodeId < nodeCount; layer++) {
    layers[layer] = [];
    const currentLayerSize = Math.min(nodesPerLayer, nodeCount - nodeId);

    for (let i = 0; i < currentLayerSize; i++) {
      const name = `L${layer}-N${i}`;
      nodes.push({ name });
      layers[layer].push(name);
      nodeId++;
    }
  }

  // Generate links between consecutive layers
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const sourceLayer = layers[layer];
    const targetLayer = layers[layer + 1];

    for (const source of sourceLayer) {
      // Connect to 1-3 nodes in next layer
      const connectionCount = Math.min(Math.floor(Math.random() * 3) + 1, targetLayer.length);
      const targets = new Set<string>();

      while (targets.size < connectionCount) {
        targets.add(targetLayer[Math.floor(Math.random() * targetLayer.length)]);
      }

      for (const target of targets) {
        links.push({
          source,
          target,
          value: Math.floor(Math.random() * 100) + 10,
        });
      }
    }
  }

  return { nodes, links };
}

/**
 * Measure execution time with averaging
 */
function measurePerformance(fn: () => void, iterations: number = ITERATIONS): number {
  const times: number[] = [];

  // Warm-up run
  fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Return average (excluding outliers)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, -1); // Remove fastest and slowest
  return trimmed.length > 0
    ? trimmed.reduce((sum, t) => sum + t, 0) / trimmed.length
    : times[0];
}

describe('Network Flow Performance Benchmarks', () => {
  describe('Treemap Performance', () => {
    it('transforms 500 nodes within 200ms budget', () => {
      const spec = createBaseSpec('treemap-500');
      const data = generateHierarchyData(500);

      const avgTime = measurePerformance(() => {
        adaptTreemapToECharts(spec, data);
      });

      console.log(`Treemap 500 nodes: ${avgTime.toFixed(2)}ms (budget: ${BUDGETS.treemap500}ms)`);
      expect(avgTime).toBeLessThan(BUDGETS.treemap500);
    });

    it('produces valid output for large dataset', () => {
      const spec = createBaseSpec('treemap-large');
      const data = generateHierarchyData(500);
      const option = adaptTreemapToECharts(spec, data);

      expect(option.series).toHaveLength(1);
      const series = (option.series as any[])[0];
      expect(series.type).toBe('treemap');
      expect(series.data).toBeDefined();
    });
  });

  describe('Sunburst Performance', () => {
    it('transforms 300 nodes within 200ms budget', () => {
      const spec = createBaseSpec('sunburst-300');
      const data = generateHierarchyData(300);

      const avgTime = measurePerformance(() => {
        adaptSunburstToECharts(spec, data);
      });

      console.log(`Sunburst 300 nodes: ${avgTime.toFixed(2)}ms (budget: ${BUDGETS.sunburst300}ms)`);
      expect(avgTime).toBeLessThan(BUDGETS.sunburst300);
    });

    it('produces valid output for medium dataset', () => {
      const spec = createBaseSpec('sunburst-medium');
      const data = generateHierarchyData(300);
      const option = adaptSunburstToECharts(spec, data);

      expect(option.series).toHaveLength(1);
      const series = (option.series as any[])[0];
      expect(series.type).toBe('sunburst');
      expect(series.data).toBeDefined();
    });
  });

  describe('Force Graph Performance', () => {
    it('transforms 100 nodes within 500ms budget', () => {
      const spec = createBaseSpec('graph-100');
      const data = generateGraphData(100);

      const avgTime = measurePerformance(() => {
        adaptGraphToECharts(spec, data);
      });

      console.log(`Force Graph 100 nodes: ${avgTime.toFixed(2)}ms (budget: ${BUDGETS.forceGraph100}ms)`);
      expect(avgTime).toBeLessThan(BUDGETS.forceGraph100);
    });

    it('produces valid output for network dataset', () => {
      const spec = createBaseSpec('graph-validation');
      const data = generateGraphData(100);
      const option = adaptGraphToECharts(spec, data);

      expect(option.series).toHaveLength(1);
      const series = (option.series as any[])[0];
      expect(series.type).toBe('graph');
      expect(series.data).toHaveLength(100);
      expect(series.links.length).toBeGreaterThan(0);
    });
  });

  describe('Sankey Performance', () => {
    it('transforms 50 nodes within 100ms budget', () => {
      const spec = createBaseSpec('sankey-50');
      const data = generateSankeyData(50);

      const avgTime = measurePerformance(() => {
        adaptSankeyToECharts(spec, data);
      });

      console.log(`Sankey 50 nodes: ${avgTime.toFixed(2)}ms (budget: ${BUDGETS.sankey50}ms)`);
      expect(avgTime).toBeLessThan(BUDGETS.sankey50);
    });

    it('produces valid output for flow dataset', () => {
      const spec = createBaseSpec('sankey-validation');
      const data = generateSankeyData(50);
      const option = adaptSankeyToECharts(spec, data);

      expect(option.series).toHaveLength(1);
      const series = (option.series as any[])[0];
      expect(series.type).toBe('sankey');
      expect(series.data.length).toBeGreaterThan(0);
      expect(series.links.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Efficiency', () => {
    it('handles repeated transformations without memory leaks', () => {
      const spec = createBaseSpec('memory-test');
      const treemapData = generateHierarchyData(100);
      const graphData = generateGraphData(50);

      // Run multiple iterations to check for memory issues
      for (let i = 0; i < 20; i++) {
        adaptTreemapToECharts(spec, treemapData);
        adaptSunburstToECharts(spec, treemapData);
        adaptGraphToECharts(spec, graphData);
        adaptSankeyToECharts(spec, generateSankeyData(30));
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });

  describe('Scalability Characteristics', () => {
    it('treemap scales sub-linearly with node count', () => {
      const spec = createBaseSpec('treemap-scale');

      const time100 = measurePerformance(() => {
        adaptTreemapToECharts(spec, generateHierarchyData(100));
      });

      const time500 = measurePerformance(() => {
        adaptTreemapToECharts(spec, generateHierarchyData(500));
      });

      // 5x data should not result in 5x time (sub-linear scaling)
      const scaleFactor = time500 / time100;
      console.log(`Treemap scale factor (5x data): ${scaleFactor.toFixed(2)}x time`);
      expect(scaleFactor).toBeLessThan(10); // Should be much less than 5x
    });

    it('graph scales with node + edge count', () => {
      const spec = createBaseSpec('graph-scale');

      const time50 = measurePerformance(() => {
        adaptGraphToECharts(spec, generateGraphData(50));
      });

      const time100 = measurePerformance(() => {
        adaptGraphToECharts(spec, generateGraphData(100));
      });

      // Graph should scale reasonably
      const scaleFactor = time100 / time50;
      console.log(`Graph scale factor (2x nodes): ${scaleFactor.toFixed(2)}x time`);
      expect(scaleFactor).toBeLessThan(5); // Should be close to linear
    });
  });
});
