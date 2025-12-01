import type { EChartsOption, GraphSeriesOption } from 'echarts';

import tokensBundle from '@oods/tokens';

import type { NetworkInput, NetworkLink, NetworkNode } from '@/types/viz/network-flow.js';
import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import { getVizScaleTokens } from '@/viz/tokens/scale-token-mapper.js';

// ECharts needs resolved colors, not CSS variables (canvas renderer can't use CSS cascade)
// Token resolution map from @oods/tokens bundle
const CSS_VARIABLE_MAP: Record<string, string> =
  (tokensBundle?.cssVariables as Record<string, string>) ?? {};

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

// UI token fallbacks (for edges, labels)
const LABEL_COLOR = '#333333';

// Default force layout parameters (from R33.0 research)
// ECharts uses higher repulsion than D3 for better visual spread
const DEFAULT_REPULSION = 100;
const DEFAULT_GRAVITY = 0.1;
const DEFAULT_EDGE_LENGTH = 30;
const DEFAULT_FRICTION = 0.6;

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

export function adaptGraphToECharts(spec: NormalizedVizSpec, input: NetworkInput): EChartsOption {
  const graphSpec = spec as GraphStorySpec;
  const palette = buildPalette();
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
      color: LABEL_COLOR,
    },
    labelLayout: {
      hideOverlap: true,
    },

    // Force layout parameters (ECharts defaults from R33.0)
    force: {
      repulsion: graphSpec.layout?.force?.repulsion ?? DEFAULT_REPULSION,
      gravity: graphSpec.layout?.force?.gravity ?? DEFAULT_GRAVITY,
      edgeLength: graphSpec.layout?.force?.edgeLength ?? DEFAULT_EDGE_LENGTH,
      friction: graphSpec.layout?.force?.friction ?? DEFAULT_FRICTION,
      layoutAnimation: true,
    },

    // Emphasis
    emphasis: {
      focus: 'adjacency' as const,
      lineStyle: { width: 4 },
    },

    // Edge styling
    lineStyle: {
      color: 'source' as const,
      curveness: 0.3,
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

  return pruneUndefined({
    color: palette,
    series: [series],
    tooltip: generateGraphTooltip(),
    legend: categories.length > 0 ? generateGraphLegend(categories, graphSpec) : undefined,
    aria: { enabled: true, description: graphSpec.a11y?.description },
    title: graphSpec.name ? { text: graphSpec.name } : undefined,
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
  }) as unknown as EChartsOption;
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
  spec: GraphStorySpec
): { show: boolean; data: string[] } {
  return {
    show: spec.legend?.show ?? true,
    data: categories.map((c) => c.name),
  };
}

function buildPalette(): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 9 });
  const resolved = tokens.map(resolveTokenToColor);

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

// ============================================================================
// Token Resolution Utilities (ECharts canvas needs actual colors, not CSS vars)
// ============================================================================

function resolveTokenToColor(token: string): string | undefined {
  const normalized = normalizeTokenName(token);
  const value = lookupTokenValue(normalized);
  if (value) {
    return formatColorValue(value);
  }
  // Try with --oods- prefix fallback
  const prefixed = normalized.startsWith('--oods-') ? undefined : `--oods-${normalized.slice(2)}`;
  if (!prefixed) {
    return undefined;
  }
  const fallback = lookupTokenValue(prefixed);
  return fallback ? formatColorValue(fallback) : undefined;
}

function normalizeTokenName(name: string): string {
  return name.startsWith('--') ? name : `--${name}`;
}

function lookupTokenValue(name: string): string | undefined {
  return CSS_VARIABLE_MAP[name];
}

function formatColorValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(trimmed) ?? trimmed;
  }
  return trimmed;
}

function convertOklchToRgb(input: string): string | undefined {
  const match = input
    .replace(/deg/gi, '')
    .replace(/\s+/g, ' ')
    .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);

  if (!match) return undefined;

  const [, lRaw, cRaw, hRaw] = match;
  const l = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const c = parseFloat(cRaw);
  const h = parseFloat(hRaw);

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
    return undefined;
  }

  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;

  const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
  const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
  const s1 = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l1 ** 3;
  const m3 = m1 ** 3;
  const s3 = s1 ** 3;

  const linearToSrgb = (v: number): number => {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };

  const clamp = (ch: number): number => Math.round(Math.min(255, Math.max(0, ch * 255)));

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return `rgb(${clamp(linearToSrgb(rLinear))}, ${clamp(linearToSrgb(gLinear))}, ${clamp(linearToSrgb(bLinear))})`;
}
