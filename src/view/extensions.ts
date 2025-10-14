import { resolveCanonicalRegionId } from '../types/regions.js';
import type { CanonicalRegionID } from '../types/regions.js';
import type { Condition, ViewExtension } from '../types/view-extension.js';

export class ViewExtensionError extends Error {
  constructor(message: string, readonly extensionId?: string) {
    super(message);
    this.name = 'ViewExtensionError';
  }
}

export const DEFAULT_VIEW_EXTENSION_PRIORITY = 50;

export function assertCanonicalRegionId(region: string): CanonicalRegionID {
  const canonical = resolveCanonicalRegionId(region);
  if (!canonical) {
    throw new ViewExtensionError(`Unknown canonical region "${region}".`);
  }

  return canonical;
}

export function compareViewExtensions<Data>(
  a: ViewExtension<Data>,
  b: ViewExtension<Data>,
  fallbackOrder: Map<string, number>
): number {
  const priorityA = a.priority ?? DEFAULT_VIEW_EXTENSION_PRIORITY;
  const priorityB = b.priority ?? DEFAULT_VIEW_EXTENSION_PRIORITY;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const orderA = fallbackOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const orderB = fallbackOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a.id.localeCompare(b.id);
}

function normalizeConditions(conditions?: readonly Condition[]): readonly Condition[] | undefined {
  if (!conditions || conditions.length === 0) {
    return undefined;
  }

  return Object.freeze(
    conditions.map((condition) => Object.freeze({ ...condition })) as readonly Condition[]
  );
}

export function normalizeViewExtensions<Data>(
  extensions: readonly ViewExtension<Data>[],
): readonly ViewExtension<Data>[] {
  const order = new Map<string, number>();
  const deduped = new Map<string, ViewExtension<Data>>();

  extensions.forEach((extension, index) => {
    const canonicalRegion = assertCanonicalRegionId(String(extension.region));
    const normalizedConditions = normalizeConditions(extension.conditions);

    const normalized = Object.freeze({
      ...extension,
      region: canonicalRegion,
      conditions: normalizedConditions,
    }) as ViewExtension<Data>;

    order.set(extension.id, index);
    deduped.set(extension.id, normalized);
  });

  const sorted = Array.from(deduped.values()).sort((a, b) => compareViewExtensions(a, b, order));

  return Object.freeze(sorted);
}
