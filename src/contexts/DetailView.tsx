import type { RegionMap } from '../types/regions.js';
import { renderRegionSlot } from './region-slot.js';

export interface DetailViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function DetailView({ regions, className }: DetailViewProps) {
  return (
    <div className={className} data-view-context="detail">
      {renderRegionSlot('globalNavigation', regions.globalNavigation, {
        as: 'nav',
        props: {
          'aria-label': 'Global navigation',
        },
      })}

      <div data-region-group="detail-body">
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
          props: {
            role: 'toolbar',
          },
        })}

        <div data-region-group="detail-content">
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
