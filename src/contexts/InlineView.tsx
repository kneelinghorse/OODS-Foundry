import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { renderRegionSlot } from './region-slot.js';

export interface InlineViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

export function InlineView({ regions, className, containerProps }: InlineViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('inline', regions);
  const { className: containerClassName, ...restContainerProps } = effectiveContainerProps;
  const rootClassName = [containerClassName, className].filter(Boolean).join(' ') || undefined;

  const hasHeaderContent =
    regions.pageHeader !== undefined &&
    regions.pageHeader !== null &&
    regions.pageHeader !== false;
  const hasToolbarContent =
    regions.viewToolbar !== undefined &&
    regions.viewToolbar !== null &&
    regions.viewToolbar !== false;

  return (
    <div {...restContainerProps} className={rootClassName}>
      {(hasHeaderContent || hasToolbarContent) && (
        <div data-region-group="inline-header-row">
          {renderRegionSlot('pageHeader', regions.pageHeader, {
            as: 'header',
          })}

          {renderRegionSlot('viewToolbar', regions.viewToolbar, {
            as: 'div',
            props: {
              role: 'toolbar',
            },
          })}
        </div>
      )}

      {renderRegionSlot('main', regions.main, {
        as: 'main',
        required: true,
      })}
    </div>
  );
}
