import { REGION_ORDER, type CanonicalRegionID, type RegionMap } from '../types/regions.js';
import type { ObjectSpec } from '../types/render-context.js';
import type { ViewExtension } from '../types/view-extension.js';
import type { ContextKind } from '../contexts/index.js';

export interface RenderReportRegionSummary {
  readonly region: CanonicalRegionID;
  readonly hasContent: boolean;
  readonly extensionIds: readonly string[];
}

export interface RenderReportTraitSummary {
  readonly id: string;
  readonly extensionIds: readonly string[];
}

export interface RenderReportPayload {
  readonly object: {
    readonly id: string;
    readonly name?: string;
    readonly version?: string;
  };
  readonly context: ContextKind;
  readonly regions: readonly RenderReportRegionSummary[];
  readonly traits: readonly RenderReportTraitSummary[];
  readonly totalExtensions: number;
}

function listExtensionsByRegion<Data>(
  extensions: readonly ViewExtension<Data>[]
): Map<CanonicalRegionID, string[]> {
  const map = new Map<CanonicalRegionID, string[]>();

  for (const extension of extensions) {
    const list = map.get(extension.region);
    if (list) {
      list.push(extension.id);
    } else {
      map.set(extension.region, [extension.id]);
    }
  }

  return map;
}

function listExtensionsByTrait<Data>(
  extensions: readonly ViewExtension<Data>[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const extension of extensions) {
    const traitName = extension.metadata?.sourceTrait ?? 'unknown';
    const list = map.get(traitName);
    if (list) {
      list.push(extension.id);
    } else {
      map.set(traitName, [extension.id]);
    }
  }

  return map;
}

export function renderReport<Data>(
  object: ObjectSpec<Data>,
  context: ContextKind,
  regions: RegionMap,
  extensions: readonly ViewExtension<Data>[]
): RenderReportPayload {
  const byRegion = listExtensionsByRegion(extensions);
  const byTrait = listExtensionsByTrait(extensions);

  const regionSummaries: RenderReportRegionSummary[] = REGION_ORDER.map((regionId) => {
    const extensionIds = byRegion.get(regionId) ?? [];
    return {
      region: regionId,
      hasContent: Boolean(regions[regionId]),
      extensionIds: Object.freeze(extensionIds.slice()),
    };
  });

  const traitSummaries: RenderReportTraitSummary[] = Array.from(byTrait.keys())
    .sort()
    .map((trait) => ({
      id: trait,
      extensionIds: Object.freeze((byTrait.get(trait) ?? []).slice()),
    }));

  return Object.freeze({
    object: {
      id: object.id,
      name: object.name,
      version: object.version,
    },
    context,
    regions: Object.freeze(regionSummaries.map((entry) => Object.freeze(entry))),
    traits: Object.freeze(traitSummaries.map((entry) => Object.freeze(entry))),
    totalExtensions: extensions.length,
  });
}
