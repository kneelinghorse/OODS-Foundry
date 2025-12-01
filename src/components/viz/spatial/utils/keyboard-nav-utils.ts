/**
 * Keyboard Navigation Utilities for Spatial Visualizations
 *
 * Provides reusable helpers for managing keyboard navigation across spatial features
 * and emitting screen reader announcements for focus and layer changes.
 */

import type { RefObject } from 'react';
import type { Feature } from 'geojson';
import type { DataRecord } from '../../../../viz/adapters/spatial/geo-data-joiner.js';
import { announce, announceLayerChange as baseAnnounceLayerChange, announceRegionFocus } from './screen-reader-utils.js';

/**
 * Handlers invoked by keyboard navigation.
 */
export interface KeyboardNavHandlers {
  onFocus?: (featureId: string | null) => void;
  onSelect?: (featureId: string | null) => void;
  onClear?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onPan?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  /**
   * Optional getter for the currently focused feature. Used when the consumer
   * owns the focus state.
   */
  getCurrentFeatureId?: () => string | null;
}

/**
 * Cycle focus based on arrow key presses.
 *
 * @param event - Keyboard event
 * @param currentFeatureId - Currently focused feature id (or null)
 * @param featureIds - Ordered list of feature ids to navigate
 * @returns Next feature id to focus, or null if no features
 */
export function handleArrowKeys(
  event: KeyboardEvent,
  currentFeatureId: string | null,
  featureIds: string[]
): string | null {
  if (featureIds.length === 0) {
    return null;
  }

  const key = event.key;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    return currentFeatureId;
  }

  const delta = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  const currentIndex = currentFeatureId ? featureIds.indexOf(currentFeatureId) : -1;
  const nextIndex = currentIndex === -1 ? 0 : currentIndex + delta;
  const boundedIndex = ((nextIndex % featureIds.length) + featureIds.length) % featureIds.length;
  return featureIds[boundedIndex];
}

/**
 * Attach keyboard navigation listeners to a container element.
 *
 * @param containerRef - Ref to the focusable container element
 * @param featureIds - Ordered list of feature ids to navigate
 * @param handlers - Callback handlers for navigation events
 * @returns Cleanup function to remove listeners
 */
export function setupKeyboardNav(
  containerRef: RefObject<HTMLElement | null>,
  featureIds: string[],
  handlers: KeyboardNavHandlers
): () => void {
  const container = containerRef.current;
  if (!container) {
    return () => {};
  }

  const getCurrentFeatureId = handlers.getCurrentFeatureId ?? (() => null);

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const nextFeature = handleArrowKeys(event, getCurrentFeatureId(), featureIds);
      handlers.onFocus?.(nextFeature);
      const direction =
        event.key === 'ArrowUp'
          ? 'up'
          : event.key === 'ArrowDown'
            ? 'down'
            : event.key === 'ArrowLeft'
              ? 'left'
              : 'right';
      handlers.onPan?.(direction);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onSelect?.(getCurrentFeatureId() ?? featureIds[0] ?? null);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onClear?.();
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      handlers.onZoomIn?.();
      return;
    }

    if (event.key === '-') {
      event.preventDefault();
      handlers.onZoomOut?.();
      return;
    }

    if (event.key === 'w') {
      handlers.onPan?.('up');
    } else if (event.key === 's') {
      handlers.onPan?.('down');
    } else if (event.key === 'a') {
      handlers.onPan?.('left');
    } else if (event.key === 'd') {
      handlers.onPan?.('right');
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Emit a screen reader announcement when a feature receives focus.
 *
 * @param feature - GeoJSON feature
 * @param datum - Joined data for the feature
 * @param total - Optional total feature count for rank context
 * @returns Message that was announced
 */
export function announceFeatureFocus(
  feature: Feature,
  datum?: DataRecord,
  total?: number
): string {
  const message = announceRegionFocus(feature, datum, total);
  announce(message, 'polite');
  return message;
}

/**
 * Emit a screen reader announcement when a layer becomes visible.
 *
 * @param layerName - Name of the layer
 * @param count - Number of visible features/items
 * @returns Message that was announced
 */
export function announceLayerChange(layerName: string, count: number): string {
  const message = baseAnnounceLayerChange(layerName, count);
  announce(message, 'assertive');
  return message;
}
