// Force-graph (network) ECharts adapter (sprint-111 m04 port from
// src/viz/adapters/echarts/graph-adapter.ts). Pure TS, spec+data DECOUPLED: the
// network data (NetworkInput: nodes + links) arrives as the SEPARATE `input` param.
// Consumes the shared token-resolver. Echarts is a TYPE-only import (erased).
//
// Determinism boundary (m04 mission-start audit): the emitted OPTION is a pure,
// deterministic function of (spec, input) — categories come from a SORTED Set
// (extractCategoryNames), the node/link transforms .map() over the input in order,
// and the force params are static config. The iterative force LAYOUT (the rendered
// node x/y) is computed CLIENT-SIDE by ECharts at render time and is OUT of the
// headless determinism scope — we golden the option, not the rendered coordinates.

import type { EChartsOption, GraphSeriesOption } from 'echarts';

import type { NetworkInput, NetworkLink, NetworkNode } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';
import { applyHcEchartsChrome, resolveOodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';
import { getVizScaleTokens } from '../../tokens/scale-token-mapper.js';

import { resolveTokenToColor, type TokenScope } from './token-resolver.js';
import { contrastOnGround } from '../spatial/geo-token-color.js';
import { paintedTitle } from '../../spec/title-placement.js';

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

// Chrome (node label, legend text, background, title) now comes from the shared OODS
// resolver — resolveOodsEchartsChrome (sprint-145 m02). Node labels sit beside the node
// on the canvas → on-canvas text-primary; the category legend text folds into the
// governed secondary-chrome (text-neutral) set. SERIES colours + the source-inherited
// edge colour are untouched (chrome-only guardrail, memo §3).

// Default force layout parameters (from R33.0 research)
// ECharts uses higher repulsion than D3 for better visual spread
const DEFAULT_REPULSION = 100;
const DEFAULT_GRAVITY = 0.1;
const DEFAULT_EDGE_LENGTH = 30;
const DEFAULT_FRICTION = 0.6;
// Title band shared with the sankey adapter: centred 14px/600 (Sprint 201 m06, the placed graph's oversized title from #2060).
const TITLE_TOP = 8;
const TITLE_FONT_SIZE = 14;
const TITLE_FONT_WEIGHT = 600;
// Sparse graphs spread to the canvas: the edge length grows with the room each node has, so
// labels at the researched 30px default no longer collide on a few nodes.
const DEFAULT_CANVAS: { readonly width: number; readonly height: number } = { width: 600, height: 400 };
export function sparseForceDefaults(nodeCount: number, width = DEFAULT_CANVAS.width, height = DEFAULT_CANVAS.height): { repulsion: number; edgeLength: number } {
  const room = Math.min(width, height) / (2 * Math.sqrt(Math.max(1, nodeCount)));
  const edgeLength = Math.max(DEFAULT_EDGE_LENGTH, Math.min(160, Math.round(room)));
  return { edgeLength, repulsion: Math.max(DEFAULT_REPULSION, Math.round(edgeLength * 2.5)) };
}

// Node sizing defaults
const DEFAULT_NODE_SIZE = 10;
const MAX_NODE_SIZE = 50;
const DEFAULT_LINK_WIDTH = 1;
const MAX_LINK_WIDTH = 10;

interface GraphSpecExtensions {
  readonly interaction?: {
    readonly zoom?: boolean;
    readonly drag?: boolean;
  };
  readonly encoding?: NormalizedVizSpec['encoding'] & {
    readonly size?: {
      readonly field?: string;
      readonly base?: number;
      readonly max?: number;
    };
    readonly linkWidth?: {
      readonly field?: string;
      readonly base?: number;
      readonly max?: number;
    };
    readonly label?: {
      readonly show?: boolean;
    };
    readonly edgeLabel?: {
      readonly show?: boolean;
    };
  };
  readonly layout?: {
    readonly force?: {
      readonly repulsion?: number;
      readonly gravity?: number;
      readonly edgeLength?: number;
      readonly friction?: number;
    };
  };
  readonly legend?: {
    readonly show?: boolean;
  };
}

type GraphStorySpec = NormalizedVizSpec & GraphSpecExtensions;

interface EChartsGraphNode {
  readonly id: string;
  readonly name: string;
  readonly value?: number;
  readonly symbolSize: number;
  readonly category?: number;
  readonly fixed?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly itemStyle?: { readonly color?: string };
  readonly [key: string]: unknown;
}

interface EChartsGraphLink {
  readonly source: string;
  readonly target: string;
  readonly value?: number;
  readonly lineStyle: { readonly width: number };
}

interface EChartsGraphCategory {
  readonly name: string;
  readonly itemStyle?: { readonly color?: string };
}

export function adaptGraphToECharts(spec: NormalizedVizSpec, input: NetworkInput, scope: TokenScope = {}): EChartsOption {
  const graphSpec = spec as GraphStorySpec;
  const palette = buildPalette(scope);
  const chrome = resolveOodsEchartsChrome(graphSpec, scope);
  const dimensions = resolveDimensions(graphSpec);

  // Extract unique categories from nodes
  const categoryField = graphSpec.encoding?.color?.field ?? 'group';
  const categoryNames = extractCategoryNames(input.nodes, categoryField);
  const categoryMap = new Map(categoryNames.map((name, index) => [name, index]));

  // Transform nodes
  const nodes = transformNodes(input.nodes, graphSpec, categoryMap);

  // Transform links
  const links = transformLinks(input.links, graphSpec);

  // Build categories for legend
  const categories = buildCategories(categoryNames, palette);

  const sparseForce = sparseForceDefaults(nodes.length, dimensions.width ?? DEFAULT_CANVAS.width, dimensions.height ?? DEFAULT_CANVAS.height);
  const series = pruneUndefined({
    type: 'graph' as const,
    name: graphSpec.name ?? 'Graph',
    layout: 'force',
    data: nodes,
    links,
    categories: categories.length > 0 ? categories : undefined,

    // Interaction
    roam: graphSpec.interaction?.zoom ?? true,
    draggable: graphSpec.interaction?.drag ?? true,

    // Labels
    label: {
      show: graphSpec.encoding?.label?.show ?? true,
      position: 'right' as const,
      formatter: '{b}',
      color: chrome.labelOnCanvas,
    },
    labelLayout: {
      hideOverlap: true,
    },

    // Force layout parameters (ECharts defaults from R33.0)
    force: {
      repulsion: graphSpec.layout?.force?.repulsion ?? sparseForce.repulsion,
      gravity: graphSpec.layout?.force?.gravity ?? DEFAULT_GRAVITY,
      edgeLength: graphSpec.layout?.force?.edgeLength ?? sparseForce.edgeLength,
      friction: graphSpec.layout?.force?.friction ?? DEFAULT_FRICTION,
      layoutAnimation: true,
    },

    // Emphasis
    emphasis: {
      focus: 'adjacency' as const,
      lineStyle: { width: 4, ...(scope.theme === 'hc' ? { color: palette[0] } : {}) },
      ...(scope.theme === 'hc' ? { itemStyle: { color: palette[0], borderColor: chrome.background } } : {}),
    },

    // Edge styling. s222-m02 (#2502 ruling 12): an edge takes its source node's colour at the opacity readableEdgeOpacity
    // picks, so it reaches 3:1 over the canvas (hc keeps its CanvasText edges, which only the user's agent resolves).
    lineStyle: {
      color: 'source' as const,
      curveness: 0.3,
      ...(scope.theme === 'hc' ? {} : { opacity: readableEdgeOpacity(nodes.map((node) => node.itemStyle?.color ?? palette[(node.category ?? 0) % palette.length]!), chrome.background) }),
    },

    // Edge labels (optional)
    edgeLabel: graphSpec.encoding?.edgeLabel?.show
      ? {
          show: true,
          formatter: (params: { data?: { value?: number } }) => String(params.data?.value ?? ''),
        }
      : { show: false },

    // Dimensions
    width: dimensions.width,
    height: dimensions.height,
  }) as GraphSeriesOption;

  return applyHcEchartsChrome(pruneUndefined({
    backgroundColor: chrome.background,
    color: palette,
    series: [series],
    tooltip: generateGraphTooltip(),
    legend: scope.theme !== 'hc' && categories.length > 0 ? generateGraphLegend(categories, graphSpec, chrome.visualMapLabel) : undefined,
    aria: { enabled: true, description: graphSpec.a11y?.description },
    title: paintedTitle(graphSpec) ? { text: paintedTitle(graphSpec), left: 'center', top: TITLE_TOP, textStyle: { color: chrome.title, fontSize: TITLE_FONT_SIZE, fontWeight: TITLE_FONT_WEIGHT } } : undefined,
    usermeta: {
      oods: pruneUndefined({
        specId: graphSpec.id,
        name: graphSpec.name,
        theme: graphSpec.config?.theme,
        tokens: graphSpec.config?.tokens,
        layout: graphSpec.config?.layout,
        a11y: graphSpec.a11y,
      }),
    },
  }), chrome, scope) as unknown as EChartsOption;
}

function transformNodes(
  nodes: readonly NetworkNode[],
  spec: GraphStorySpec,
  categoryMap: Map<string, number>
): EChartsGraphNode[] {
  const categoryField = spec.encoding?.color?.field ?? 'group';

  return nodes.map((node) => {
    const categoryValue = node[categoryField] as string | undefined;
    const categoryIndex = categoryValue !== undefined ? categoryMap.get(categoryValue) : undefined;

    return pruneUndefined({
      id: node.id,
      name: (node.name as string | undefined) ?? node.id,
      value: node.value as number | undefined,
      symbolSize: calculateNodeSize(node, spec),
      category: categoryIndex,
      fixed: node.fixed ?? false,
      x: node.x,
      y: node.y,
      itemStyle: node.color ? { color: node.color as string } : undefined,
      ...preserveExtraFields(node, [
        'id', 'name', 'value', 'group', 'category', 'fixed', 'x', 'y', 'color', 'radius',
      ]),
    }) as EChartsGraphNode;
  });
}

/**
 * s222-m02 (#2502 ruling 12): an edge drawn in its source node's colour at ECharts' default 0.5 opacity fell under WCAG
 * 1.4.11's 3:1 over the canvas (on the dark canvas brand B's edge was barely there, and in light the lifted colour was
 * too pale). As the flow arc does on the land, the edges keep the default where it reads and otherwise move toward the
 * strong end: the lowest opacity from 0.5 up, in 0.05 steps, at which every node colour an edge can take reaches 3:1
 * over the canvas when composited on it; full opacity if none does. A colour no contrast can be measured for is skipped.
 */
function readableEdgeOpacity(colors: readonly string[], canvas: string): number {
  for (let opacity = 0.5; opacity < 1; opacity = Math.round((opacity + 0.05) * 100) / 100) {
    if (colors.every((color) => (contrastOnGround(color, canvas, opacity) ?? 3) >= 3)) return opacity;
  }
  return 1;
}

function transformLinks(links: readonly NetworkLink[], spec: GraphStorySpec): EChartsGraphLink[] {
  return links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.value,
    lineStyle: {
      width: calculateLinkWidth(link, spec),
    },
  }));
}

function calculateNodeSize(node: NetworkNode, spec: GraphStorySpec): number {
  const baseSize = spec.encoding?.size?.base ?? DEFAULT_NODE_SIZE;
  const maxSize = spec.encoding?.size?.max ?? MAX_NODE_SIZE;

  if (node.radius !== undefined) {
    return node.radius * 2;
  }

  const value = node.value as number | undefined;
  if (value !== undefined && spec.encoding?.size?.field === 'value') {
    return Math.max(baseSize, Math.min(maxSize, Math.sqrt(value) * 2));
  }

  return baseSize;
}

function calculateLinkWidth(link: NetworkLink, spec: GraphStorySpec): number {
  const baseWidth = spec.encoding?.linkWidth?.base ?? DEFAULT_LINK_WIDTH;
  const maxWidth = spec.encoding?.linkWidth?.max ?? MAX_LINK_WIDTH;

  if (link.value !== undefined && spec.encoding?.linkWidth?.field === 'value') {
    return Math.max(baseWidth, Math.min(maxWidth, Math.sqrt(link.value)));
  }

  return baseWidth;
}

function extractCategoryNames(nodes: readonly NetworkNode[], categoryField: string): string[] {
  const uniqueCategories = new Set<string>();

  for (const node of nodes) {
    const categoryValue = node[categoryField];
    if (typeof categoryValue === 'string' && categoryValue.length > 0) {
      uniqueCategories.add(categoryValue);
    }
  }

  return Array.from(uniqueCategories).sort();
}

function buildCategories(
  categoryNames: readonly string[],
  palette: readonly string[]
): EChartsGraphCategory[] {
  return categoryNames.map((name, index) => ({
    name,
    itemStyle: { color: palette[index % palette.length] },
  }));
}

function generateGraphTooltip(): { trigger: string; formatter: (params: unknown) => string } {
  return {
    trigger: 'item',
    formatter: (params: unknown) => {
      const payload = params as {
        dataType?: string;
        name?: string;
        value?: number;
        data?: {
          source?: string;
          target?: string;
          value?: number;
          category?: number;
        };
      };

      if (payload.dataType === 'edge') {
        const edgeValue = payload.data?.value;
        return escapeHtml(`${payload.data?.source ?? ''} → ${payload.data?.target ?? ''}`) +
          (edgeValue !== undefined ? `: ${escapeHtml(String(edgeValue))}` : '');
      }

      const name = payload.name ?? 'Node';
      const value = payload.value;
      const category = payload.data?.category;

      let tooltip = `<strong>${escapeHtml(name)}</strong>`;
      if (value !== undefined) {
        tooltip += `<br/>Value: ${escapeHtml(String(value))}`;
      }
      if (category !== undefined) {
        tooltip += `<br/>Category: ${escapeHtml(String(category))}`;
      }

      return tooltip;
    },
  };
}

function generateGraphLegend(
  categories: readonly EChartsGraphCategory[],
  spec: GraphStorySpec,
  textColor: string
): { show: boolean; data: string[]; textStyle: { color: string } } {
  return {
    show: spec.legend?.show ?? true,
    data: categories.map((c) => c.name),
    // Legend category text is governed chrome (text-neutral, 8.13:1 on the baked canvas).
    textStyle: { color: textColor },
  };
}

function buildPalette(scope: TokenScope): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 9 });
  const resolved = tokens.map((token) => resolveTokenToColor(token, scope));

  // If no tokens resolved, use fallback palette
  if (resolved.every((c) => c === undefined)) {
    return FALLBACK_PALETTE;
  }

  return resolved.map((color, i) => color ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]);
}

function resolveDimensions(spec: GraphStorySpec): { width?: number; height?: number } {
  const layout = spec.config?.layout;
  return {
    width: typeof layout?.width === 'number' ? layout.width : undefined,
    height: typeof layout?.height === 'number' ? layout.height : undefined,
  };
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function preserveExtraFields(
  data: Record<string, unknown>,
  exclude: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!exclude.includes(key)) {
      result[key] = value;
    }
  });
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
