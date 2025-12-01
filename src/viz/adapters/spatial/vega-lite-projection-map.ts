import type { Projection } from 'vega-lite/build/src/projection';
import type { ProjectionConfig } from '@/types/viz/spatial.js';

export interface ProjectionMappingOptions {
  readonly fitToData?: boolean;
  readonly dimensions?: { readonly width: number; readonly height: number };
}

const DEFAULT_PROJECTION: Projection['type'] = 'mercator';

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

export function mapProjectionType(type?: ProjectionConfig['type']): Projection['type'] {
  return type ?? DEFAULT_PROJECTION;
}

export function mapProjectionConfig(
  config: ProjectionConfig,
  _options: ProjectionMappingOptions = {}
): Projection {
  const projection: Projection = {
    type: mapProjectionType(config.type),
    center: config.center,
    scale: config.scale,
    rotate: config.rotate,
    parallels: config.parallels,
    clipAngle: config.clipAngle,
    clipExtent: config.clipExtent,
    precision: config.precision,
  };

  return pruneUndefined(projection);
}
