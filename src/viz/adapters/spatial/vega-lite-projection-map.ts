import type { ProjectionConfig } from '@/types/viz/spatial.js';

interface VegaLiteProjection {
  type?: string;
  center?: [number, number];
  scale?: number;
  rotate?: [number, number] | [number, number, number];
  parallels?: [number, number];
  clipAngle?: number;
  clipExtent?: [[number, number], [number, number]];
  precision?: number;
}

export interface ProjectionMappingOptions {
  readonly fitToData?: boolean;
  readonly dimensions?: { readonly width: number; readonly height: number };
}

const DEFAULT_PROJECTION = 'mercator';

function pruneUndefined<T extends object>(input: T): T {
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

export function mapProjectionType(type?: ProjectionConfig['type']): VegaLiteProjection['type'] {
  return type ?? DEFAULT_PROJECTION;
}

export function mapProjectionConfig(
  config: ProjectionConfig,
  _options: ProjectionMappingOptions = {}
): VegaLiteProjection {
  const projection: VegaLiteProjection = {
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
