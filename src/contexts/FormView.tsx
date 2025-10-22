import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { renderRegionSlot } from './region-slot.js';

export interface FormViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

export function FormView({ regions, className, containerProps }: FormViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('form', regions);
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
