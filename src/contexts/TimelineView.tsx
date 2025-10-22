import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { renderRegionSlot } from './region-slot.js';

export interface TimelineViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

export function TimelineView({ regions, className, containerProps }: TimelineViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('timeline', regions);
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
