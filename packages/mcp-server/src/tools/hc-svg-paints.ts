import tokens from '@oods/tokens';
import type { TokenScope } from '@oods/viz-core';
import { DEFAULT_BRAND } from '../lib/brand-registry.js';

/** A successful HC render must retain declared paints, not a renderer fallback palette. */
export function assertHcSvgPaints(svg: string, scope: TokenScope): string {
  if (scope.theme !== 'hc') return svg;
  const declared = new Set(Object.values(tokens.cssVariablesByScope[scope.brand ?? DEFAULT_BRAND].hc).map(value => value.trim()));
  const paints = [...svg.matchAll(/\b(?:fill|stroke|stop-color)="([^"]+)"/g)].map(match => match[1]!);
  const styles = [...svg.matchAll(/\bstyle="([^"]*)"/g), ...svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  for (const style of styles) {
    paints.push(...[...style[1]!.matchAll(/(?:^|[;{\s])(?:fill|stroke|stop-color)\s*:\s*([^;}]+)/g)].map(match => match[1]!.trim()));
  }
  const rejected = [...new Set(paints.filter(paint => !declared.has(paint) && !/^(?:none|transparent|url\(#[^)]+\))$/.test(paint)))];
  if (rejected.length) throw new Error(`HC renderer emitted paints outside the declared ${scope.brand ?? DEFAULT_BRAND}/hc token scope: ${rejected.join(', ')}. Forced-colors rendering is deferred; no replacement palette was invented.`);
  return svg;
}
