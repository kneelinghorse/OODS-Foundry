import type { RegionMap } from '../types/regions.js';
import { renderRegionSlot } from './region-slot.js';

export interface InlineViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function InlineView({ regions, className }: InlineViewProps) {
  const hasHeaderContent =
    regions.pageHeader !== undefined &&
    regions.pageHeader !== null &&
    regions.pageHeader !== false;
  const hasToolbarContent =
    regions.viewToolbar !== undefined &&
    regions.viewToolbar !== null &&
    regions.viewToolbar !== false;

  return (
    <div className={className} data-view-context="inline">
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
