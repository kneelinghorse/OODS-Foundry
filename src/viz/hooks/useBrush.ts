import { useMemo } from 'react';
import type { InteractionTrait } from '@/viz/spec/normalized-viz-spec.js';

export interface UseBrushOptions {
  readonly id?: string;
  readonly event?: string;
  readonly encodings?: readonly IntervalChannel[];
}

type IntervalChannel = 'x' | 'y';

const DEFAULT_BRUSH_ID = 'interaction-brush';
const DEFAULT_BRUSH_EVENT = 'drag';
const DEFAULT_BRUSH_ENCODINGS: readonly IntervalChannel[] = ['x', 'y'];

export function useBrush(options: UseBrushOptions = {}): InteractionTrait {
  const { id = DEFAULT_BRUSH_ID, event = DEFAULT_BRUSH_EVENT, encodings = DEFAULT_BRUSH_ENCODINGS } = options;

  const encKey = encodings.join('|');
  const normalizedEncodings = useMemo(
    () => toEncodingTuple(encodings, 'useBrush requires at least one encoding channel.'),
    [encKey]
  );

  return useMemo<InteractionTrait>(
    () => ({
      id,
      select: {
        type: 'interval',
        on: event,
        encodings: normalizedEncodings,
      },
      rule: {
        bindTo: 'filter',
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

