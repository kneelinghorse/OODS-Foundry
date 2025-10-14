import type { RegionMap } from '../types/regions.js';
import { renderRegionSlot } from './region-slot.js';

export interface TimelineViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function TimelineView({ regions, className }: TimelineViewProps) {
  return (
    <div className={className} data-view-context="timeline">
      {renderRegionSlot('globalNavigation', regions.globalNavigation, {
        as: 'nav',
        props: {
          'aria-label': 'Global navigation',
        },
      })}

      {renderRegionSlot('breadcrumbs', regions.breadcrumbs, {
        as: 'nav',
        props: {
          'aria-label': 'Breadcrumbs',
        },
      })}

      <div data-region-group="timeline-body">
        {renderRegionSlot(
          'main',
          <>
            <div data-region-group="timeline-meta">
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

            <div data-region-group="timeline-stream">{regions.main ?? null}</div>
          </>,
          {
            as: 'main',
            required: true,
          }
        )}

        {renderRegionSlot('contextPanel', regions.contextPanel, {
          as: 'aside',
          props: {
            'aria-label': 'Context panel',
          },
        })}
      </div>
    </div>
  );
}
