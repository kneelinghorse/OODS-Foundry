import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { renderRegionSlot } from './region-slot.js';

export interface DashboardViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

function wrapDashboardMain(content: RegionMap['main']) {
  if (content === undefined || content === null || content === false) {
    return content;
  }

  return <div data-region-group="dashboard-grid">{content}</div>;
}

export function DashboardView({ regions, className, containerProps }: DashboardViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('dashboard', regions);
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

      <div data-region-group="dashboard-body">
        <div data-region-group="dashboard-chrome">
          {renderRegionSlot('pageHeader', regions.pageHeader, {
            as: 'header',
            required: true,
          })}

          {renderRegionSlot('viewToolbar', regions.viewToolbar, {
            as: 'div',
            props: {
              role: 'toolbar',
              'aria-label': 'Dashboard controls',
            },
          })}
        </div>

        <div data-region-group="dashboard-content">
          {renderRegionSlot('main', wrapDashboardMain(regions.main), {
            as: 'main',
            required: true,
          })}

          {renderRegionSlot('contextPanel', regions.contextPanel, {
            as: 'aside',
            props: {
              'aria-label': 'Dashboard insights',
            },
          })}
        </div>
      </div>
    </div>
  );
}
