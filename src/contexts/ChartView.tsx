import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { renderRegionSlot } from './region-slot.js';

export interface ChartViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

export function ChartView({ regions, className, containerProps }: ChartViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('chart', regions);
  const { className: containerClassName, ...restContainerProps } = effectiveContainerProps;
  const rootClassName = [containerClassName, className].filter(Boolean).join(' ') || undefined;

  return (
    <div {...restContainerProps} className={rootClassName}>
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

      <div data-region-group="chart-body">
        {renderRegionSlot('pageHeader', regions.pageHeader, {
          as: 'header',
          required: true,
        })}

        {renderRegionSlot('viewToolbar', regions.viewToolbar, {
          as: 'div',
          props: {
            role: 'toolbar',
            'aria-label': 'Chart controls',
          },
        })}

        <div data-region-group="chart-content">
          {renderRegionSlot('main', regions.main, {
            as: 'main',
            required: true,
          })}

          {renderRegionSlot('contextPanel', regions.contextPanel, {
            as: 'aside',
            props: {
              'aria-label': 'Chart insights',
            },
          })}
        </div>
      </div>
    </div>
  );
}
