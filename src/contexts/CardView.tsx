import type { RegionMap } from '../types/regions.js';
import { Card } from '../components/base/Card.js';
import { renderRegionSlot } from './region-slot.js';

export interface CardViewProps {
  readonly regions: RegionMap;
  readonly className?: string;
}

export function CardView({ regions, className }: CardViewProps) {
  const rootClassName = ['flex flex-col gap-4', className].filter(Boolean).join(' ');

  return (
    <Card className={rootClassName} data-view-context="card" elevated>
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
