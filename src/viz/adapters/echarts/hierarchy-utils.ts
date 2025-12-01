import type { TooltipComponentOption } from 'echarts';

import type {
  HierarchyAdjacencyInput,
  HierarchyAdjacencyNode,
  HierarchyInput,
  HierarchyNestedInput,
} from '@/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';

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
    return value.toLocaleString();
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
