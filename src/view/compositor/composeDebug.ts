import { REGION_ORDER, type CanonicalRegionId } from '../../types/regions.js';
import type { ViewExtension } from '../../types/view-extension.js';
import type { ComposeExtensionsOptions, ExtensionComposition } from './composeExtensions.js';
import { composeExtensions } from './composeExtensions.js';

export interface RegionMetrics {
  readonly total: number;
  readonly sections: number;
  readonly actions: number;
  readonly modifiers: {
    readonly total: number;
    readonly targeted: Readonly<Record<string, number>>;
    readonly unbound: number;
  };
  readonly wrappers: {
    readonly total: number;
    readonly targeted: Readonly<Record<string, number>>;
    readonly unbound: number;
  };
}

export interface ComposeDebugMetrics {
  readonly inputCount: number;
  readonly normalizedCount: number;
  readonly activeCount: number;
  readonly inactiveCount: number;
  readonly regions: Readonly<Record<CanonicalRegionId, RegionMetrics>>;
}

export interface ComposeDebugResult<Data = unknown> {
  readonly composition: ExtensionComposition<Data>;
  readonly metrics: ComposeDebugMetrics;
}

function buildRegionMetrics<Data>(
  composition: ExtensionComposition<Data>
): Readonly<Record<CanonicalRegionId, RegionMetrics>> {
  const metrics: Record<CanonicalRegionId, RegionMetrics> = Object.create(null);

  for (const region of REGION_ORDER) {
    const plan = composition.regions[region];
    const modifierTargetCounts: Record<string, number> = Object.create(null);
    const wrapperTargetCounts: Record<string, number> = Object.create(null);

    for (const [targetId, list] of Object.entries(plan.modifiers.byTarget)) {
      modifierTargetCounts[targetId] = list.length;
    }

    for (const [targetId, list] of Object.entries(plan.wrappers.byTarget)) {
      wrapperTargetCounts[targetId] = list.length;
    }

    const modifierTotal =
      Object.values(modifierTargetCounts).reduce((total, count) => total + count, 0) +
      plan.modifiers.unbound.length;
    const wrapperTotal =
      Object.values(wrapperTargetCounts).reduce((total, count) => total + count, 0) +
      plan.wrappers.unbound.length;

    const total =
      plan.sections.length + plan.actions.length + modifierTotal + wrapperTotal;

    metrics[region] = Object.freeze({
      total,
      sections: plan.sections.length,
      actions: plan.actions.length,
      modifiers: Object.freeze({
        total: modifierTotal,
        targeted: Object.freeze(modifierTargetCounts),
        unbound: plan.modifiers.unbound.length,
      }),
      wrappers: Object.freeze({
        total: wrapperTotal,
        targeted: Object.freeze(wrapperTargetCounts),
        unbound: plan.wrappers.unbound.length,
      }),
    });
  }

  return Object.freeze(metrics);
}

export function composeDebug<Data>(
  extensions: readonly ViewExtension<Data>[],
  options: ComposeExtensionsOptions<Data> = {}
): ComposeDebugResult<Data> {
  const composition = composeExtensions(extensions, options);

  const metrics: ComposeDebugMetrics = Object.freeze({
    inputCount: extensions.length,
    normalizedCount: composition.normalizedExtensions.length,
    activeCount: composition.activeExtensions.length,
    inactiveCount: composition.inactiveExtensions.length,
    regions: buildRegionMetrics(composition),
  });

  return Object.freeze({
    composition,
    metrics,
  });
}
