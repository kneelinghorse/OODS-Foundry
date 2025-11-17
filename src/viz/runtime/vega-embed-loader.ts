import type { EmbedOptions, Result as EmbedResult, VisualizationSpec } from 'vega-embed';

export type VegaEmbed = (target: Element, spec: VisualizationSpec, options?: EmbedOptions) => Promise<EmbedResult>;

let cachedLoader: Promise<VegaEmbed> | undefined;

function normalizeEmbed(candidate: unknown): VegaEmbed {
  if (typeof candidate === 'function') {
    return candidate as VegaEmbed;
  }

  if (candidate && typeof candidate === 'object') {
    const maybeDefault = (candidate as { readonly default?: unknown }).default;
    if (typeof maybeDefault === 'function') {
      return maybeDefault as VegaEmbed;
    }
  }

  throw new Error('vega-embed entry point did not resolve to a function export.');
}

export async function loadVegaEmbed(): Promise<VegaEmbed> {
  if (!cachedLoader) {
    cachedLoader = import('vega-embed').then(normalizeEmbed).catch((error) => {
      cachedLoader = undefined;
      throw error;
    });
  }
  return cachedLoader;
}

export function preloadVegaEmbed(): Promise<VegaEmbed> {
  return loadVegaEmbed();
}

export type { EmbedOptions, Result as EmbedResult, VisualizationSpec } from 'vega-embed';
