/// <reference path="./vega-textmetrics.d.ts" />
// Deterministic Vega-Lite -> SVG emitter (sprint-115 m02).
//
// Compiles a Vega-Lite spec to a Vega spec, instantiates a HEADLESS Vega view
// (renderer 'none' -> no DOM, no canvas, no jsdom), and returns the rendered SVG
// string. The string is BYTE-STABLE run-to-run and machine-to-machine (the m01
// determinism contract, seam (d)):
//   - text-metric measurement is pinned to Vega's arithmetic estimator
//     (`textMetrics.canvas(false)`), so glyph advance widths never depend on a
//     platform font or a native `canvas` module being present;
//   - Vega's auto-generated element ids (clip-path / gradient ids use a
//     PROCESS-GLOBAL counter -> `clip1`, `clip2`, ...) are normalized to stable,
//     first-appearance-ordered tokens so two renders of the same spec are identical
//     regardless of how many views were rendered before them in the process;
//   - hover + animation are inert under a one-shot headless `runAsync()` + `toSVG()`.
//
// This module deliberately holds NO dashboard knowledge. It renders one VL spec to
// one SVG. Dashboard documents are composed elsewhere. Resolved tokens affect chrome only, never series encodings.

import { compile } from 'vega-lite';
import type { TopLevelSpec } from 'vega-lite';
import { parse, View, textMetrics, type Spec } from 'vega';
import { createFirstAppearanceRemap } from './first-appearance-remap.js';
import { accessibleSvg } from './svg-accessibility.js';

/** A compiled/authored Vega-Lite top-level spec (what `dashboard.render` carries on a panel's `spec`). */
export type VegaLiteSpec = TopLevelSpec;

export interface RenderVegaLiteToSvgOptions {
  /**
   * Resolved brand tokens (CSS custom-property name -> value) the export should be
   * rendered on-brand with. Canonical --oods-* colors must already be resolved
   * to concrete RGB/hex values. Only chrome is changed; series colors are preserved.
   */
  readonly tokens?: Readonly<Record<string, string>>;
  /**
   * s149 F6a (Approach B): override the compiled SVG's width/height so a caller (the
   * dashboard export) can size a chart panel to its grid span instead of keeping
   * Vega's intrinsic step-based (narrow, tall) size. Applied with `autosize:'fit'`
   * on an emitter-side clone — the passed spec is never mutated. BOTH undefined =
   * identity: every non-dashboard caller renders byte-for-byte as before.
   */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Render a Vega-Lite spec to a deterministic, headless SVG string.
 *
 * @throws if the spec fails to compile or parse (the caller decides the fallback;
 *   `dashboard.render` emits an a11y-described error placeholder per seam (b)).
 */
export async function renderVegaLiteToSvg(
  spec: VegaLiteSpec,
  options: RenderVegaLiteToSvgOptions = {},
): Promise<string> {
  return (await renderVegaLiteWithSpec(spec, options)).svg;
}

export interface RenderVegaLiteResult {
  readonly svg: string;
  /** The exact compiled object parsed by the renderer, including legend and sizing adjustments. */
  readonly vegaSpec: Spec;
}

/** Render once and retain the compiled Vega spec so a client can reproduce the same chart. */
export async function renderVegaLiteWithSpec(
  spec: VegaLiteSpec,
  options: RenderVegaLiteToSvgOptions = {},
): Promise<RenderVegaLiteResult> {
  pinDeterministicTextMetrics();

  const branded = prepareSpecForBrand(spec, options);
  const compiled = compile(branded);
  preserveQuantizedSymbolLegends(branded, compiled.spec);
  const view = new View(parse(compiled.spec), { renderer: 'none' });
  // Silence Vega's logger so warnings never leak to stdout/stderr (and so output
  // is purely the SVG string). None = 0.
  view.logLevel(0);

  try {
    await view.runAsync();
    const svg = await view.toSVG();
    const title = typeof spec.title === 'object' && !Array.isArray(spec.title) ? spec.title?.text : spec.title;
    return { svg: accessibleSvg(normalizeAutoIds(svg), title, spec.description), vegaSpec: compiled.spec };
  } finally {
    // Release the dataflow + any pending timers so repeated renders don't leak.
    view.finalize();
  }
}

/**
 * Pin Vega's text measurement to the arithmetic estimator (never the native
 * `canvas` path). Idempotent; cheap. Called per render so a determinism guarantee
 * holds even if something else in the process flipped the flag back on.
 */
function pinDeterministicTextMetrics(): void {
  textMetrics.canvas(false);
}

/** Apply resolved chrome tokens and dimensions on a clone; never mutate the caller. */
function prepareSpecForBrand(
  spec: VegaLiteSpec,
  options: RenderVegaLiteToSvgOptions,
): VegaLiteSpec {
  const { width, height, tokens } = options;
  if (!tokens && width === undefined && height === undefined) return spec;
  const config = { ...spec.config };
  if (tokens) {
    const canvas = tokens['--oods-sys-surface-canvas'];
    const primary = tokens['--oods-sys-text-primary'];
    const neutral = tokens['--oods-sys-text-neutral'];
    const grid = tokens['--oods-sys-border-subtle'];
    const border = tokens['--oods-sys-border-neutral'];
    const font = tokens['--oods-ref-typography-families-sans']?.replace(/'"([^"]*)"'/g, "'$1'").trim();
    const size = tokens['--oods-sys-text-scale-heading-lg-font-size'];
    const weight = tokens['--oods-sys-text-scale-heading-lg-font-weight'];
    const labelSize = tokens['--oods-sys-text-scale-body-sm-font-size'];
    const numeric = (value: string): number => {
      const number = Number(value.replace(/px$/i, '').trim());
      if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid numeric chrome token: ${value}`);
      return number;
    };
    if (canvas !== undefined) config.background = canvas;
    if (font !== undefined) config.font = font;
    config.title = {
      ...config.title,
      ...(primary !== undefined ? { color: primary } : {}),
      ...(font !== undefined ? { font } : {}),
      ...(size !== undefined ? { fontSize: numeric(size) } : {}),
      ...(weight !== undefined ? { fontWeight: numeric(weight) as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 } : {}),
    };
    const labels = {
      ...(primary !== undefined ? { titleColor: primary } : {}),
      ...(neutral !== undefined ? { labelColor: neutral } : {}),
      ...(font !== undefined ? { titleFont: font, labelFont: font } : {}),
      ...(labelSize !== undefined ? { labelFontSize: numeric(labelSize) } : {}),
    };
    config.axis = {
      ...config.axis, ...labels,
      ...(grid !== undefined ? { gridColor: grid } : {}),
      ...(border !== undefined ? { domainColor: border, tickColor: border } : {}),
    };
    config.legend = { ...config.legend, ...labels };
    config.text = {
      ...config.text,
      ...(primary !== undefined ? { color: primary } : {}),
      ...(font !== undefined ? { font } : {}),
    };
  }
  return {
    ...spec,
    config,
    ...(tokens?.['--oods-sys-surface-canvas'] !== undefined ? { background: tokens['--oods-sys-surface-canvas'] } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(width !== undefined || height !== undefined ? { autosize: 'fit' } : {}),
  } as VegaLiteSpec;
}

/**
 * Normalize Vega's auto-generated element ids to stable, first-appearance-ordered
 * tokens. Vega assigns clip-path / gradient ids from a PROCESS-GLOBAL counter, so
 * the raw SVG for the same spec differs by how many views were rendered earlier in
 * the process (`clip1` vs `clip2`). Remapping every `id="..."` / `url(#...)` /
 * `clip-path="url(#...)"` reference by document order makes the output independent
 * of that counter while preserving the def<->ref linkage.
 *
 * Vega's SVG output emits `id` attributes ONLY for these auto-generated defs, so
 * normalizing all of them is safe (there are no author-meaningful ids to clobber).
 */
function normalizeAutoIds(svg: string): string {
  // Single document-order pass over both definitions (`id="X"`) and references
  // (`url(#X)`), so a reference that precedes its definition still maps stably.
  const replacements = createFirstAppearanceRemap(
    [...svg.matchAll(/(?:\bid="|url\(#)([^")]+)/g)].map((match) => match[1]),
    (index) => `oods-id-${index}`,
  );

  let out = svg;
  replacements.forEach((stable, id) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`id="${escaped}"`, 'g'), `id="${stable}"`);
    out = out.replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${stable})`);
  });
  return out;
}

/** Vega-Lite 6 omits symbol type for quantize, but Vega 6 infers a gradient.
 * Restore only an explicitly authored quantized symbol legend. */
export function preserveQuantizedSymbolLegends(source: unknown, compiled: unknown): void {
  const requested = new Set<string>();
  const visit = (value: unknown, action: (entry: Record<string, any>) => void): void => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) action(value as Record<string, any>);
    for (const child of Object.values(value)) visit(child, action);
  };
  visit(source, entry => {
    for (const binding of Object.values(entry.encoding ?? {}) as any[]) {
      if (binding?.scale?.type === 'quantize' && binding?.legend?.type === 'symbol' && typeof binding.field === 'string') requested.add(binding.field);
    }
  });
  if (!requested.size) return;
  const scales = new Set<string>();
  visit(compiled, entry => {
    for (const scale of entry.scales ?? []) {
      if (scale.type === 'quantize' && requested.has(scale.domain?.field)) scales.add(scale.name);
    }
  });
  visit(compiled, entry => {
    for (const legend of entry.legends ?? []) {
      if (scales.has(legend.fill) || scales.has(legend.stroke)) legend.type = 'symbol';
    }
  });
}
