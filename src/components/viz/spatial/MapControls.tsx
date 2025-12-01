/**
 * MapControls
 *
 * Provides zoom and layer toggle controls for spatial visualizations.
 */

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useOptionalSpatialContext } from './SpatialContext.js';
import { announceLayerChange } from './utils/keyboard-nav-utils.js';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  zoomLevel?: number;
  minZoom?: number;
  maxZoom?: number;
  layers?: Array<{
    id: string;
    label: string;
    visible: boolean;
  }>;
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  position?: Position;
  className?: string;
}

const POSITION_CLASSES: Record<Position, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

function clampZoom(value: number, minZoom?: number, maxZoom?: number): number {
  const min = Number.isFinite(minZoom) ? (minZoom as number) : -Infinity;
  const max = Number.isFinite(maxZoom) ? (maxZoom as number) : Infinity;
  return Math.min(Math.max(value, min), max);
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoomLevel = 1,
  minZoom,
  maxZoom,
  layers,
  onLayerToggle,
  position = 'top-right',
  className = '',
}: MapControlsProps): JSX.Element | null {
  const context = useOptionalSpatialContext();
  const [localZoom, setLocalZoom] = useState<number>(zoomLevel);

  const resolvedLayers =
    layers ??
    context?.layers.map((entry, index) => ({
      id: entry.layer?.type ? `${entry.layer.type}-${index}` : `layer-${index}`,
      label: entry.layer?.type ? `${entry.layer.type} layer` : `Layer ${index + 1}`,
      visible: true,
    }));

  const [layerState, setLayerState] = useState(resolvedLayers ?? []);

  useEffect(() => {
    if (resolvedLayers) {
      setLayerState(resolvedLayers);
    }
  }, [resolvedLayers]);

  if (!onZoomIn && !onZoomOut && !onZoomReset && (!resolvedLayers || resolvedLayers.length === 0)) {
    return null;
  }

  const containerClasses = [
    'absolute',
    POSITION_CLASSES[position],
    'rounded-md',
    'border',
    'border-[--sys-border-subtle]',
    'bg-[--sys-surface]',
    'shadow-sm',
    'p-3',
    'flex',
    'flex-col',
    'gap-3',
    'text-sm',
    'w-[200px]',
    className,
  ]
    .join(' ')
    .trim();

  const displayZoom = useMemo(() => clampZoom(localZoom, minZoom, maxZoom), [localZoom, minZoom, maxZoom]);

  const handleZoomIn = (): void => {
    const next = clampZoom(localZoom + 1, minZoom, maxZoom);
    setLocalZoom(next);
    onZoomIn?.();
  };

  const handleZoomOut = (): void => {
    const next = clampZoom(localZoom - 1, minZoom, maxZoom);
    setLocalZoom(next);
    onZoomOut?.();
  };

  const handleZoomReset = (): void => {
    setLocalZoom(zoomLevel);
    onZoomReset?.();
  };

  const toggleLayer = (id: string, current: boolean): void => {
    setLayerState((prev) => {
      const updated = prev.map((layer) => (layer.id === id ? { ...layer, visible: !current } : layer));
      const layer = updated.find((item) => item.id === id);
      const visibleCount = updated.filter((item) => item.visible).length;
      if (layer) {
        announceLayerChange(layer.label, visibleCount);
      }
      return updated;
    });
    onLayerToggle?.(id, !current);
  };

  return (
    <div className={containerClasses} aria-label="Map controls">
      {(onZoomIn || onZoomOut || onZoomReset) && (
        <div className="flex items-center justify-between gap-2" aria-label="Zoom controls">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-[--sys-border-subtle] bg-[--sys-surface] px-2 py-1 text-base font-semibold hover:border-[--sys-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
              aria-label="Zoom out"
              onClick={handleZoomOut}
            >
              −
            </button>
            <button
              type="button"
              className="rounded border border-[--sys-border-subtle] bg-[--sys-surface] px-2 py-1 text-base font-semibold hover:border-[--sys-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
              aria-label="Zoom in"
              onClick={handleZoomIn}
            >
              +
            </button>
            {onZoomReset && (
              <button
                type="button"
                className="rounded border border-[--sys-border-subtle] bg-[--sys-surface] px-2 py-1 text-xs font-medium hover:border-[--sys-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
                aria-label="Reset zoom"
                onClick={handleZoomReset}
              >
                Reset
              </button>
            )}
          </div>
          <span className="text-xs text-[--sys-text-subtle]" aria-live="polite">
            {displayZoom.toFixed(1)}x
          </span>
        </div>
      )}

      {layerState && layerState.length > 0 && (
        <div className="flex flex-col gap-2" aria-label="Layer toggles">
          <div className="text-xs font-semibold text-[--sys-text-muted]">Layers</div>
          <ul className="flex flex-col gap-2">
            {layerState.map((layer) => (
              <li key={layer.id} className="flex items-center gap-2">
                <input
                  id={`layer-${layer.id}`}
                  type="checkbox"
                  checked={layer.visible}
                  aria-label={`Toggle ${layer.label}`}
                  onChange={() => toggleLayer(layer.id, layer.visible)}
                  className="h-4 w-4 rounded border border-[--sys-border-subtle] text-[--sys-accent-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
                />
                <label className="text-sm" htmlFor={`layer-${layer.id}`}>
                  {layer.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
