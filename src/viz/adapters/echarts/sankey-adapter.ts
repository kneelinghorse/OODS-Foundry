import type { EChartsOption, SankeySeriesOption } from 'echarts';

import tokensBundle from '@oods/tokens';

import type { SankeyInput, SankeyLink, SankeyNode } from '@/types/viz/network-flow.js';
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

// UI token fallbacks (for labels, borders)
const LABEL_COLOR = '#333333';
const BORDER_COLOR = '#e0e0e0';

// ECharts Sankey defaults (from R33.0 research)
// ECharts uses 32 layout iterations by default (vs D3's 6) - much cleaner layouts
const DEFAULT_LAYOUT_ITERATIONS = 32;
const DEFAULT_NODE_WIDTH = 20;
const DEFAULT_NODE_GAP = 8;
const DEFAULT_NODE_ALIGN = 'justify' as const;
const DEFAULT_CURVENESS = 0.5;
const DEFAULT_LINK_OPACITY = 0.5;

interface SankeySpecExtensions {
  readonly layout?: {
    readonly orientation?: 'horizontal' | 'vertical';
    readonly nodeAlign?: 'justify' | 'left' | 'right';
    readonly nodeWidth?: number;
    readonly nodeGap?: number;
    readonly iterations?: number;
  };
  readonly encoding?: NormalizedVizSpec['encoding'] & {
    readonly link?: {
      readonly color?: 'gradient' | 'source' | 'target' | string;
    };
    readonly label?: {
      readonly show?: boolean;
    };
  };
  readonly interaction?: {
    readonly zoom?: boolean;
    readonly drag?: boolean;
  };
}

type SankeyStorySpec = NormalizedVizSpec & SankeySpecExtensions;

interface EChartsSankeyNode {
  readonly name: string;
  readonly value?: number;
  readonly itemStyle?: { readonly color?: string };
  readonly [key: string]: unknown;
}

interface EChartsSankeyLink {
  readonly source: string;
  readonly target: string;
  readonly value: number;
  readonly [key: string]: unknown;
}

/**
 * Sankey input validation error
 */
export class SankeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SankeyValidationError';
  }
}

/**
 * Adapt a SankeyInput to ECharts SankeySeriesOption
 *
 * ECharts handles all layout computation (node positioning, link routing) client-side.
 * We use ECharts defaults from R33.0 research - notably 32 layout iterations (vs D3's 6)
 * for significantly cleaner layouts with fewer link crossings.
 */
export function adaptSankeyToECharts(spec: NormalizedVizSpec, input: SankeyInput): EChartsOption {
  const sankeySpec = spec as SankeyStorySpec;

  // Validate: Sankey requires values on all links
  validateSankeyInput(input);

  const palette = buildPalette();
  const dimensions = resolveDimensions(sankeySpec);
  const orientation = sankeySpec.layout?.orientation ?? 'horizontal';

  // Transform nodes for ECharts
  const nodes = transformNodes(input.nodes, input.links, palette);

  // Transform links for ECharts
  const links = transformLinks(input.links);

  const series = pruneUndefined({
    type: 'sankey' as const,
    name: sankeySpec.name ?? 'Sankey',
    data: nodes,
    links,

    // Orientation
    orient: orientation,

    // Node configuration (ECharts defaults from R33.0)
    nodeAlign: sankeySpec.layout?.nodeAlign ?? DEFAULT_NODE_ALIGN,
    nodeWidth: sankeySpec.layout?.nodeWidth ?? DEFAULT_NODE_WIDTH,
    nodeGap: sankeySpec.layout?.nodeGap ?? DEFAULT_NODE_GAP,

    // Layout iterations (ECharts default: 32, much higher than D3's 6)
    layoutIterations: sankeySpec.layout?.iterations ?? DEFAULT_LAYOUT_ITERATIONS,

    // Emphasis
    emphasis: {
      focus: 'adjacency' as const, // Highlight connected flows on hover
    },

    // Labels
    label: {
      show: sankeySpec.encoding?.label?.show !== false,
      position: orientation === 'vertical' ? 'top' : 'right',
      color: LABEL_COLOR,
    },

    // Link styling
    lineStyle: {
      color: sankeySpec.encoding?.link?.color ?? 'gradient',
      curveness: DEFAULT_CURVENESS,
      opacity: DEFAULT_LINK_OPACITY,
    },

    // Node styling
    itemStyle: {
      borderWidth: 1,
      borderColor: BORDER_COLOR,
    },

    // Dimensions
    width: dimensions.width,
    height: dimensions.height,
  }) as SankeySeriesOption;

  return pruneUndefined({
    color: palette,
    series: [series],
    tooltip: generateSankeyTooltip(),
    aria: { enabled: true, description: sankeySpec.a11y?.description },
    title: sankeySpec.name ? { text: sankeySpec.name } : undefined,
    usermeta: {
      oods: pruneUndefined({
        specId: sankeySpec.id,
        name: sankeySpec.name,
        theme: sankeySpec.config?.theme,
        tokens: sankeySpec.config?.tokens,
        layout: sankeySpec.config?.layout,
        a11y: sankeySpec.a11y,
      }),
    },
  }) as unknown as EChartsOption;
}

/**
 * Validate Sankey input - values are required on all links
 *
 * Sankey diagrams are fundamentally about flow QUANTITIES. A Sankey without
 * values is meaningless - the link widths convey the magnitude of flow.
 */
function validateSankeyInput(input: SankeyInput): void {
  const linksWithoutValue = input.links.filter(
    (l) => l.value === undefined || l.value === null || !Number.isFinite(l.value)
  );

  if (linksWithoutValue.length > 0) {
    throw new SankeyValidationError(
      `Sankey diagrams require 'value' on all links. ` +
        `Found ${linksWithoutValue.length} links without valid values.`
    );
  }

  // Validate that source and target nodes exist
  const nodeNames = new Set(input.nodes.map((n) => n.name));
  const brokenLinks = input.links.filter(
    (l) => !nodeNames.has(l.source) || !nodeNames.has(l.target)
  );

  if (brokenLinks.length > 0) {
    const firstBroken = brokenLinks[0];
    throw new SankeyValidationError(
      `Sankey link references non-existent node. ` +
        `Link from "${firstBroken.source}" to "${firstBroken.target}" has invalid node reference.`
    );
  }
}

/**
 * Transform nodes for ECharts Sankey format
 */
function transformNodes(
  nodes: readonly SankeyNode[],
  links: readonly SankeyLink[],
  palette: readonly string[]
): EChartsSankeyNode[] {
  return nodes.map((node, index) => {
    const value = calculateNodeValue(node, links);
    const color = (node.color as string | undefined) ?? palette[index % palette.length];

    return pruneUndefined({
      name: node.name,
      value,
      itemStyle: color ? { color } : undefined,
      ...preserveExtraFields(node, ['name', 'value', 'color']),
    }) as EChartsSankeyNode;
  });
}

/**
 * Transform links for ECharts Sankey format
 */
function transformLinks(links: readonly SankeyLink[]): EChartsSankeyLink[] {
  return links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.value,
    ...preserveExtraFields(link, ['source', 'target', 'value']),
  }));
}

/**
 * Calculate node value from incoming/outgoing flows
 *
 * For Sankey diagrams, node value represents the total flow through the node.
 * This is the maximum of incoming or outgoing flow totals.
 */
function calculateNodeValue(node: SankeyNode, links: readonly SankeyLink[]): number {
  // If node has explicit value, use it
  if (typeof node.value === 'number' && Number.isFinite(node.value)) {
    return node.value as number;
  }

  const nodeName = node.name;

  // Sum of incoming flows
  const incoming = links
    .filter((l) => l.target === nodeName)
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  // Sum of outgoing flows
  const outgoing = links
    .filter((l) => l.source === nodeName)
    .reduce((sum, l) => sum + (l.value ?? 0), 0);

  // Use whichever is larger (they're often equal, but not for source/sink nodes)
  return Math.max(incoming, outgoing);
}

/**
 * Generate tooltip configuration for Sankey
 */
function generateSankeyTooltip(): { trigger: string; formatter: (params: unknown) => string } {
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
        };
      };

      // Edge (link) tooltip
      if (payload.dataType === 'edge') {
        const source = payload.data?.source ?? '';
        const target = payload.data?.target ?? '';
        const value = payload.data?.value;
        return `<strong>${escapeHtml(source)} → ${escapeHtml(target)}</strong><br/>Flow: ${formatValue(value ?? 0)}`;
      }

      // Node tooltip
      const name = payload.name ?? 'Node';
      const value = payload.value;
      return `<strong>${escapeHtml(name)}</strong><br/>Total: ${formatValue(value ?? 0)}`;
    },
  };
}

/**
 * Format value for display with K/M suffixes
 */
function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

// ============================================================================
// Utility Functions (shared patterns from graph-adapter.ts)
// ============================================================================

function buildPalette(): readonly string[] {
  const tokens = getVizScaleTokens('categorical', { count: 9 });
  const resolved = tokens.map(resolveTokenToColor);

  // If no tokens resolved, use fallback palette
  if (resolved.every((c) => c === undefined)) {
    return FALLBACK_PALETTE;
  }

  return resolved.map((color, i) => color ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]);
}

function resolveDimensions(spec: SankeyStorySpec): { width?: number; height?: number } {
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
