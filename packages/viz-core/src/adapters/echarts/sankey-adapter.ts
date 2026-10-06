// Sankey ECharts adapter (sprint-111 m03 port from
// src/viz/adapters/echarts/sankey-adapter.ts). Pure TS, spec+data DECOUPLED: the
// flow data (SankeyInput: nodes + value-weighted links) arrives as the SEPARATE
// `input` param. The data-shaping half (validation + node/link transforms) lives
// in ./sankey-utils; this file owns the ECharts option assembly, palette, and
// tooltip. Echarts is a TYPE-only import (erased at build).

import type { EChartsOption, SankeySeriesOption } from 'echarts';

import type { SankeyInput } from '../../spec/network-flow.js';
import type { NormalizedVizSpec } from '../../spec/normalized-viz-spec.js';
import { getVizScaleTokens } from '../../tokens/scale-token-mapper.js';

import { applyHcEchartsChrome, resolveOodsEchartsChrome } from '../../tokens/oods-echarts-chrome.js';

import { resolveTokenToColor, type TokenScope } from './token-resolver.js';
import { transformLinks, transformNodes, validateSankeyInput } from './sankey-utils.js';
import { paintedTitle } from '../../spec/title-placement.js';

// Fallback colors if tokens aren't available (matches categorical scale)
const FALLBACK_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

// Chrome (node label, node border, background, title) now comes from the shared OODS
// resolver — resolveOodsEchartsChrome (sprint-145 m02). Node labels sit BESIDE the node
// on the canvas → on-canvas text-primary. SERIES colours + link gradient are untouched
// (chrome-only guardrail, memo §3).

// ECharts Sankey defaults (from R33.0 research)
// ECharts uses 32 layout iterations by default (vs D3's 6) - much cleaner layouts
const DEFAULT_LAYOUT_ITERATIONS = 32;
const DEFAULT_NODE_WIDTH = 20;
const DEFAULT_NODE_GAP = 8;
const DEFAULT_NODE_ALIGN = 'justify' as const;
const DEFAULT_CURVENESS = 0.5;
const DEFAULT_LINK_OPACITY = 0.5;
// Title band: a centred 14px/600 title with the flow inset below it (Sprint 201 m06, the sankey title overlap from #2060).
const TITLE_TOP = 8;
const TITLE_FONT_SIZE = 14;
const TITLE_FONT_WEIGHT = 600;
const TITLED_SERIES_TOP = 40;

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

/**
 * Adapt a SankeyInput to ECharts SankeySeriesOption
 *
 * ECharts handles all layout computation (node positioning, link routing) client-side.
 * We use ECharts defaults from R33.0 research - notably 32 layout iterations (vs D3's 6)
 * for significantly cleaner layouts with fewer link crossings.
 */
export function adaptSankeyToECharts(spec: NormalizedVizSpec, input: SankeyInput, scope: TokenScope = {}): EChartsOption {
  const sankeySpec = spec as SankeyStorySpec;

  // Validate: Sankey requires values on all links
  validateSankeyInput(input);

  const palette = buildPalette(scope);
  const chrome = resolveOodsEchartsChrome(sankeySpec, scope);
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
    // Every node is explicitly colored; suppress the unused native gradient parser in HC.
    ...(scope.theme === 'hc' ? { color: [] } : {}),

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
      lineStyle: { color: 'source' as const },
    },

    // Labels
    label: {
      show: sankeySpec.encoding?.label?.show !== false,
      position: orientation === 'vertical' ? 'top' : 'right',
      color: chrome.labelOnCanvas,
    },

    // Link styling
    lineStyle: {
      color: scope.theme === 'hc' ? 'source' : sankeySpec.encoding?.link?.color ?? 'gradient',
      curveness: DEFAULT_CURVENESS,
      opacity: DEFAULT_LINK_OPACITY,
    },

    // Node styling
    itemStyle: {
      borderWidth: 1,
      borderColor: chrome.tileBorder,
    },

    // A titled chart insets the flow below its title band so the title never covers the first node column.
    top: sankeySpec.name ? TITLED_SERIES_TOP : undefined,

    // Dimensions
    width: dimensions.width,
    height: dimensions.height,
  }) as SankeySeriesOption;

  return applyHcEchartsChrome(pruneUndefined({
    backgroundColor: chrome.background,
    color: palette,
    series: [series],
    tooltip: generateSankeyTooltip(),
    aria: { enabled: true, description: sankeySpec.a11y?.description },
    title: paintedTitle(sankeySpec) ? { text: paintedTitle(sankeySpec), left: 'center', top: TITLE_TOP, textStyle: { color: chrome.title, fontSize: TITLE_FONT_SIZE, fontWeight: TITLE_FONT_WEIGHT } } : undefined,
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
  }), chrome, scope) as unknown as EChartsOption;
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
  return value.toLocaleString('en-US');
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
