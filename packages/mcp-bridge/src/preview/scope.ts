import type { CompositionVersion, PreviewArtifact, PreviewBrand, PreviewFramework, PreviewTheme } from './store.js';

// Which artifact a brand and theme mount. Shared by the preview host and the preview app inside the conversation
// (Sprint 202 m03), so this module stays browser-safe: no Node imports.

export const scopeKey = (brand: PreviewBrand, theme: PreviewTheme): string => `${brand}/${theme}`;

/** Whether the version places a chart: its SVG is rendered for one brand and theme, so another scope needs its own generation. */
export function hasPlacedChart(schema: unknown): boolean {
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    const element = node as { chart?: unknown; children?: unknown[] };
    return element.chart !== undefined || (Array.isArray(element.children) && element.children.some(walk));
  };
  const screens = (schema as { screens?: unknown[] } | null)?.screens;
  return Array.isArray(screens) && screens.some(walk);
}

/** The artifact the host serves for a scope: the scoped generation when the version carries one, else the version's own. */
export function servedArtifact(record: CompositionVersion, framework: PreviewFramework, brand: PreviewBrand, theme: PreviewTheme): { entry: { artifact: PreviewArtifact; generatedAt: string; tokenBuildHash?: string }; generatedFor: { brand: PreviewBrand; theme: PreviewTheme } } | undefined {
  const scoped = hasPlacedChart(record.schema) ? record.scopes?.[scopeKey(brand, theme)]?.artifacts[framework] : undefined;
  if (scoped) return { entry: scoped, generatedFor: { brand, theme } };
  const own = record.artifacts[framework];
  if (!own) return undefined;
  // Without a placed chart every scope mounts the same artifact; the scope it was generated for is the one requested.
  return { entry: own, generatedFor: hasPlacedChart(record.schema) ? { brand: record.brand, theme: record.theme } : { brand, theme } };
}
