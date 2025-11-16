import type {
  LayoutConcat,
  LayoutDefinition,
  SharedScaleConfig,
} from '@/viz/spec/normalized-viz-spec.js';

const SCALE_CHANNELS = ['x', 'y', 'color', 'size', 'shape', 'detail'] as const;

export type ScaleChannel = (typeof SCALE_CHANNELS)[number];
export type ScaleBinding = 'shared' | 'independent';

export type ScaleResolution = Partial<Record<ScaleChannel, ScaleBinding>>;

export interface EChartsScaleFlags {
  readonly shareX: boolean;
  readonly shareY: boolean;
  readonly shareColor: boolean;
}

export function resolveScaleBindings(layout?: LayoutDefinition): ScaleResolution | undefined {
  if (!layout) {
    return undefined;
  }

  const resolved: ScaleResolution = {};
  const merge = (config?: SharedScaleConfig): void => {
    if (!config) {
      return;
    }

    for (const channel of SCALE_CHANNELS) {
      const binding = config[channel];
      if (binding === 'shared' || binding === 'independent') {
        resolved[channel] = binding;
      }
    }
  };

  merge(layout.sharedScales);

  if (layout.trait === 'LayoutConcat') {
    mergeConcatSections(layout, merge);
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

export function asVegaLiteResolve(scales?: ScaleResolution): { scale: Record<string, ScaleBinding> } | undefined {
  if (!scales) {
    return undefined;
  }

  const entries = Object.entries(scales).filter(([, value]) => value === 'shared' || value === 'independent');

  if (entries.length === 0) {
    return undefined;
  }

  return {
    scale: Object.fromEntries(entries) as Record<string, ScaleBinding>,
  };
}

export function asEChartsScaleFlags(scales?: ScaleResolution): EChartsScaleFlags {
  const isShared = (binding?: ScaleBinding): boolean => binding !== 'independent';

  return {
    shareX: isShared(scales?.x),
    shareY: isShared(scales?.y),
    shareColor: isShared(scales?.color),
  };
}

function mergeConcatSections(layout: LayoutConcat, merge: (config?: SharedScaleConfig) => void): void {
  for (const section of layout.sections ?? []) {
    merge(section.sharedScales);
  }
}
