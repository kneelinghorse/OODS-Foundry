import type { RegionMap } from '../types/regions.js';
import { renderRegionSlot } from './region-slot.js';

export interface FormViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function FormView({ regions, className }: FormViewProps) {
  return (
    <div className={className} data-view-context="form">
      {renderRegionSlot('globalNavigation', regions.globalNavigation, {
        as: 'nav',
        props: {
          'aria-label': 'Global navigation',
        },
      })}

      <div data-region-group="form-body">
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

        <div data-region-group="form-content">
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
