import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { ContextKind } from '../../contexts/index.js';
import type { RegionMap, CanonicalRegionID } from '../../types/regions.js';

const REGION_DATA_PREFIX = 'data-view-has-';
type LowercaseRegionID = Lowercase<CanonicalRegionID>;
type RegionFlagAttribute = `${typeof REGION_DATA_PREFIX}${LowercaseRegionID}`;

const NEGATIVE_VALUES = new Set<ReactNode>([null, undefined, false]);

function hasRenderableContent(node: ReactNode): boolean {
  if (NEGATIVE_VALUES.has(node)) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((entry) => hasRenderableContent(entry));
  }

  return true;
}

export type ViewContainerAttributes = Readonly<
  {
    readonly 'data-view': ContextKind;
    readonly 'data-view-profile': ContextKind;
    readonly 'data-view-context': ContextKind;
    readonly className?: string;
  } & Record<RegionFlagAttribute, 'true' | 'false'>
>;

export interface ViewContainerProps {
  readonly context: ContextKind;
  readonly regions: RegionMap;
  readonly className?: string;
  readonly children: (attributes: ViewContainerAttributes) => ReactElement;
}

export function buildViewContainerAttributes(
  context: ContextKind,
  regions: RegionMap,
  className?: string
): ViewContainerAttributes {
  const entries = Object.entries(regions) as [CanonicalRegionID, ReactNode][];

  const regionFlags = entries.reduce<Record<RegionFlagAttribute, 'true' | 'false'>>(
    (flags, [regionId, content]) => {
      const normalizedRegion = regionId.toLowerCase() as LowercaseRegionID;
      const key = `${REGION_DATA_PREFIX}${normalizedRegion}` as RegionFlagAttribute;
      flags[key] = hasRenderableContent(content) ? 'true' : 'false';
      return flags;
    },
    {} as Record<RegionFlagAttribute, 'true' | 'false'>
  );

  return Object.freeze({
    'data-view': context,
    'data-view-profile': context,
    'data-view-context': context,
    className: className?.trim() || undefined,
    ...regionFlags,
  }) as ViewContainerAttributes;
}

export function ViewContainer({
  context,
  regions,
  className,
  children,
}: ViewContainerProps): ReactElement {
  const containerAttributes = useMemo<ViewContainerAttributes>(() => {
    return buildViewContainerAttributes(context, regions, className);
  }, [className, context, regions]);

  return children(containerAttributes);
}
