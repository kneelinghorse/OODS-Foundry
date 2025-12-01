/**
 * Screen reader utilities for spatial visualizations.
 *
 * Provides shared live region helpers and standardized announcement strings.
 */

import type { Feature } from 'geojson';
import type { DataRecord } from '../../../../viz/adapters/spatial/geo-data-joiner.js';

export type LivePriority = 'polite' | 'assertive';

const liveRegions: Record<LivePriority, HTMLElement | null> = {
  polite: null,
  assertive: null,
};

function ensureDocument(): Document | null {
  return typeof document !== 'undefined' ? document : null;
}

/**
 * Create (or return existing) hidden live region element for announcements.
 *
 * @param priority - aria-live priority level
 * @returns Live region element
 */
export function createLiveRegion(priority: LivePriority = 'polite'): HTMLElement {
  const existing = liveRegions[priority];
  const doc = ensureDocument();
  if (existing && doc) {
    return existing;
  }

  if (!doc) {
    // Fallback stub for non-DOM environments
    const stub = {
      textContent: '',
    } as unknown as HTMLElement;
    liveRegions[priority] = stub;
    return stub;
  }

  const region = doc.createElement('div');
  region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('data-spatial-live-region', priority);
  Object.assign(region.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    border: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  });
  doc.body.appendChild(region);
  liveRegions[priority] = region;
  return region;
}

/**
 * Announce a message to a live region.
 *
 * @param message - Text to announce
 * @param priority - aria-live priority
 */
export function announce(message: string, priority: LivePriority = 'polite'): void {
  if (!message) {
    return;
  }
  const region = createLiveRegion(priority);
  // Clear first to force screen reader update
  region.textContent = '';
  // Small delay helps in certain SR/AT combinations
  setTimeout(() => {
    region.textContent = message;
  }, 1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'No data';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  return String(value);
}

function inferPrimaryValue(datum?: DataRecord): { value?: unknown; unit?: string; rank?: number } {
  if (!datum) {
    return {};
  }
  if ('value' in datum) {
    return {
      value: (datum as Record<string, unknown>).value,
      unit: (datum as Record<string, string>).unit,
      rank: (datum as Record<string, number>).rank,
    };
  }
  if ('population' in datum) {
    return { value: (datum as Record<string, unknown>).population };
  }
  if ('gdp' in datum) {
    return { value: (datum as Record<string, unknown>).gdp };
  }
  const entries = Object.entries(datum).filter(([key, value]) => key !== 'id' && value !== null && value !== undefined);
  if (entries.length > 0) {
    return { value: entries[0][1] };
  }
  return {};
}

/**
 * Generate and emit a screen reader message when a region gains focus.
 *
 * @param feature - GeoJSON feature
 * @param datum - Associated data record
 * @param total - Optional total count for ranking context
 * @returns Message emitted
 */
export function announceRegionFocus(
  feature: Feature,
  datum?: DataRecord,
  total?: number
): string {
  const name =
    (feature.properties && typeof feature.properties.name === 'string' && feature.properties.name) ||
    (feature.id !== undefined ? String(feature.id) : 'Unknown region');
  const { value, unit, rank } = inferPrimaryValue(datum);
  const formatted = value !== undefined ? formatValue(value) : 'No value';
  const rankPart = rank && total ? ` Rank ${rank} of ${total}.` : '';
  const unitPart = unit ? ` ${unit}` : '';
  const message = `${name}: ${formatted}${unitPart}.${rankPart}`.trim();
  announce(message, 'polite');
  return message;
}

/**
 * Generate and emit a screen reader message when the visible layer changes.
 *
 * @param layerName - Layer name
 * @param count - Visible feature count
 * @returns Message emitted
 */
export function announceLayerChange(layerName: string, count: number): string {
  const normalizedCount = Number.isFinite(count) ? count : 0;
  const message = `Now showing ${layerName} layer with ${normalizedCount} features.`;
  announce(message, 'assertive');
  return message;
}
