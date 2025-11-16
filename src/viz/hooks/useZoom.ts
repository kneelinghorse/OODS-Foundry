import { useMemo } from 'react';
import type { InteractionTrait } from '@/viz/spec/normalized-viz-spec.js';

export interface UseZoomOptions {
  readonly id?: string;
  readonly event?: string;
  readonly encodings?: readonly IntervalChannel[];
}

type IntervalChannel = 'x' | 'y';

const DEFAULT_ZOOM_ID = 'interaction-zoom';
const DEFAULT_ZOOM_EVENT = 'wheel';
const DEFAULT_ZOOM_ENCODINGS: readonly IntervalChannel[] = ['x', 'y'];

export function useZoom(options: UseZoomOptions = {}): InteractionTrait {
  const { id = DEFAULT_ZOOM_ID, event = DEFAULT_ZOOM_EVENT, encodings = DEFAULT_ZOOM_ENCODINGS } = options;
  const encKey = encodings.join('|');
  const normalizedEncodings = useMemo(
    () => toEncodingTuple(encodings, 'useZoom requires at least one encoding channel.'),
    [encKey]
  );

  return useMemo<InteractionTrait>(
    () => ({
      id,
      select: {
        type: 'interval',
        on: event,
        encodings: normalizedEncodings,
        bind: 'scales',
      },
      rule: {
        bindTo: 'zoom',
      },
    }),
    [id, event, normalizedEncodings]
  );
}

function toEncodingTuple(
  encodings: readonly IntervalChannel[],
  errorMessage: string
): [IntervalChannel, ...IntervalChannel[]] {
  const deduped: IntervalChannel[] = [];
  for (const encoding of encodings) {
    if ((encoding === 'x' || encoding === 'y') && !deduped.includes(encoding)) {
      deduped.push(encoding);
    }
  }
  if (deduped.length === 0) {
    throw new Error(errorMessage);
  }
  return deduped as [IntervalChannel, ...IntervalChannel[]];
}

