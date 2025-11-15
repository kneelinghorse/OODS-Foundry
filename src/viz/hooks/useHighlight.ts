import { useMemo } from 'react';
import type { InteractionTrait } from '@/viz/spec/normalized-viz-spec.js';

export interface UseHighlightOptions {
  readonly id?: string;
  readonly fields: readonly string[];
  readonly event?: string;
  readonly property?: string;
  readonly activeValue?: string | number | boolean;
  readonly inactiveValue?: string | number | boolean;
}

export function useHighlight(options: UseHighlightOptions): InteractionTrait {
  if (!options.fields || options.fields.length === 0) {
    throw new Error('useHighlight requires at least one field.');
  }

  const {
    id = 'interaction-highlight',
    event = 'hover',
    property = 'fillOpacity',
    activeValue = 1,
    inactiveValue = 0.35,
  } = options;

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
        on: event,
        fields,
      },
      rule: {
        bindTo: 'visual',
        property,
        condition: { value: activeValue },
        else: { value: inactiveValue },
      },
    }),
    [id, event, property, activeValue, inactiveValue, fields]
  );
}
