import { useMemo } from 'react';
import type { InteractionTrait } from '@/viz/spec/normalized-viz-spec.js';

export interface UseTooltipOptions {
  readonly id?: string;
  readonly fields: readonly string[];
  readonly trigger?: string;
}

export function useTooltip(options: UseTooltipOptions): InteractionTrait {
  if (!options.fields || options.fields.length === 0) {
    throw new Error('useTooltip requires at least one field.');
  }

  const { id = 'interaction-tooltip', trigger = 'hover' } = options;
  const fieldsKey = useMemo(() => JSON.stringify(options.fields), [options.fields]);
  const fields = useMemo(
    () => [...options.fields] as [string, ...string[]],
    [fieldsKey]
  );

  return useMemo<InteractionTrait>(
    () => ({
      id,
      select: {
        type: 'point',
        on: trigger,
        fields,
      },
      rule: {
        bindTo: 'tooltip',
        fields,
      },
    }),
    [id, trigger, fields]
  );
}
