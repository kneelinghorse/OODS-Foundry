import type { RegionMap } from '../types/regions.js';
import { renderRegionSlot } from './region-slot.js';

export interface ListViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function ListView({ regions, className }: ListViewProps) {
  return (
    <div className={className} data-view-context="list">
      {renderRegionSlot('globalNavigation', regions.globalNavigation, {
        as: 'nav',
        props: {
          'aria-label': 'Global navigation',
        },
      })}

      <div data-region-group="list-body">
        <div data-region-group="list-chrome">
          {renderRegionSlot('breadcrumbs', regions.breadcrumbs, {
            as: 'nav',
            props: {
              'aria-label': 'Breadcrumbs',
            },
          })}

          {renderRegionSlot('pageHeader', regions.pageHeader, {
            as: 'header',
            required: true,
          })}

          {renderRegionSlot('viewToolbar', regions.viewToolbar, {
            as: 'div',
            required: true,
            props: {
              role: 'toolbar',
            },
          })}
        </div>

        <div data-region-group="list-content">
          {renderRegionSlot('main', regions.main, {
            as: 'main',
            required: true,
          })}

          {renderRegionSlot('contextPanel', regions.contextPanel, {
            as: 'aside',
            props: {
              'aria-label': 'Context panel',
            },
          })}
        </div>
      </div>
    </div>
  );
}
