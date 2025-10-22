import type { RegionMap } from '../types/regions.js';
import type { ViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { buildViewContainerAttributes } from '../engine/render/ViewContainer.js';
import { Card } from '../components/base/Card.js';
import { renderRegionSlot } from './region-slot.js';

export interface CardViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
  readonly containerProps?: ViewContainerAttributes;
}

export function CardView({ regions, className, containerProps }: CardViewProps) {
  const effectiveContainerProps =
    containerProps ?? buildViewContainerAttributes('card', regions);
  const { className: containerClassName, ...restContainerProps } = effectiveContainerProps;
  const rootClassName = [containerClassName, 'flex flex-col gap-4', className]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <Card {...restContainerProps} className={rootClassName} elevated>
      {renderRegionSlot('pageHeader', regions.pageHeader, {
        as: 'header',
      })}

      {renderRegionSlot('main', regions.main, {
        as: 'main',
        required: true,
      })}

      {renderRegionSlot('contextPanel', regions.contextPanel, {
        as: 'aside',
        props: {
          'aria-label': 'Supporting context',
        },
      })}
    </Card>
  );
}
