import { REGION_ORDER, type CanonicalRegionID } from '../types/regions.js';
import type { RenderContext } from '../types/render-context.js';
import type { ViewExtension } from '../types/view-extension.js';
import { prepareExtensions } from './composeExtensions.js';

export function composeDebug<Data>(
  extensions: readonly ViewExtension<Data>[],
  context: RenderContext<Data>
): Record<CanonicalRegionID, readonly string[]> {
  const prepared = prepareExtensions(extensions, context);

  const byRegion = REGION_ORDER.reduce<Record<CanonicalRegionID, string[]>>(
    (acc, region) => {
      acc[region] = [];
      return acc;
    },
    Object.create(null)
  );

  for (const extension of prepared) {
    byRegion[extension.region].push(extension.id);
  }

  return byRegion;
}
