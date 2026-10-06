// Shared hierarchy helpers for the treemap + sunburst ECharts adapters
// (sprint-111 m01 port from src/viz/adapters/echarts/hierarchy-utils.ts). Pure
// TS: converts a HierarchyInput (adjacency_list | nested) into the ECharts tree
// data shape and builds the shared hierarchy tooltip. Echarts is a TYPE-only
// import (erased at build) — no runtime/DOM coupling.

import type { TooltipComponentOption } from 'echarts';

import type {
  HierarchyAdjacencyInput,
  HierarchyAdjacencyNode,
  HierarchyInput,
  HierarchyNestedInput,
} from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';

interface HierarchyTooltipParams {
  readonly name?: string;
  readonly value?: unknown;
  readonly treePathInfo?: readonly { readonly name?: string }[];
}

export function isAdjacencyList(input: HierarchyInput): input is HierarchyAdjacencyInput {
  return input.type === 'adjacency_list';
}

export function convertToEChartsTreeData(input: HierarchyInput): Record<string, unknown>[] {
  if (isAdjacencyList(input)) {
    return buildTreeFromAdjacency(input.data);
  }

  return normalizeNestedData(input.data);
}

// Determinism (sprint-111 m05): the output order is the INPUT node order. nodeMap
// is lookup-only (never iterated for output), and roots/children are pushed during a
// single forEach over `nodes` in their given order — so for a fixed input the tree
// (and thus the ECharts option) is byte-stable across runs. We rely on this input/
// insertion-order guarantee rather than sorting (sorting would change the emitted
// sibling order and is unnecessary for determinism). The option goldens enforce it.
function buildTreeFromAdjacency(nodes: readonly HierarchyAdjacencyNode[]): Record<string, unknown>[] {
  const nodeMap = new Map<string, Record<string, unknown>>();
  const roots: Record<string, unknown>[] = [];

  nodes.forEach((node) => {
    nodeMap.set(node.id, {
      name: node.name ?? node.id,
      value: node.value,
      children: [],
      ...preserveExtraFields(node, ['id', 'parentId', 'name', 'value']),
    });
  });

  nodes.forEach((node) => {
    const current = nodeMap.get(node.id);
    if (!current) {
      return;
    }

    if (node.parentId === null || node.parentId === undefined) {
      roots.push(current);
      return;
    }

    const parent = nodeMap.get(node.parentId);
    if (!parent) {
      roots.push(current);
      return;
    }

    const children = (parent.children as Record<string, unknown>[] | undefined) ?? [];
    children.push(current);
    parent.children = children;
  });

  return roots;
}

function normalizeNestedData(data: HierarchyNestedInput['data']): Record<string, unknown>[] {
  const normalize = (node: HierarchyNestedInput['data']): Record<string, unknown> => ({
    name: node.name ?? (node as { id?: string }).id ?? 'node',
    value: node.value,
    children: Array.isArray(node.children) ? node.children.map(normalize) : [],
    ...preserveExtraFields(node as Record<string, unknown>, ['name', 'id', 'value', 'children']),
  });

  return Array.isArray(data) ? data.map(normalize) : [normalize(data)];
}

function preserveExtraFields(data: Record<string, unknown>, exclude: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!exclude.includes(key)) {
      result[key] = value;
    }
  });
  return result;
}

export function generateHierarchyTooltip(
  spec: NormalizedVizSpec,
  chartType: 'treemap' | 'sunburst'
): TooltipComponentOption {
  const label = spec.name ? `${spec.name} ${chartType}` : chartType;
  return {
    trigger: 'item',
    triggerOn: 'mousemove',
    formatter: (params: unknown) => {
      const payload = params as HierarchyTooltipParams;
      const name = payload.name ?? label;
      const value = formatValue(payload.value);
      const path = formatPath(payload.treePathInfo, name);
      return `<strong>${escapeHtml(name)}</strong><br/>Value: ${escapeHtml(value)}${path ? `<br/>Path: ${escapeHtml(path)}` : ''}`;
    },
  };
}

function formatPath(treePathInfo: HierarchyTooltipParams['treePathInfo'], fallback: string): string {
  if (!treePathInfo || treePathInfo.length === 0) {
    return fallback;
  }
  const parts = treePathInfo.map((item) => item?.name).filter(Boolean) as string[];
  if (parts.length === 0) {
    return fallback;
  }
  return parts.join(' > ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-US');
  }
  if (value === null || value === undefined) {
    return 'n/a';
  }
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
