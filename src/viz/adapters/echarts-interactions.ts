import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import {
  createInteractionPropagationPlan,
  shouldPropagateInteractions,
} from './interaction-propagator.js';

export interface EChartsEventParams {
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
}

export interface EChartsDispatchAction {
  readonly type: string;
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
  readonly [key: string]: unknown;
}

export interface EChartsRuntime {
  on(event: string, handler: (params: EChartsEventParams) => void): void;
  off?(event: string, handler: (params: EChartsEventParams) => void): void;
  dispatchAction(action: EChartsDispatchAction): void;
}

export type InteractionCleanup = () => void;

export function bindEChartsInteractions(instance: EChartsRuntime, spec: NormalizedVizSpec): InteractionCleanup {
  const interactions = spec.interactions ?? [];
  const handlers: Array<{ event: string; handler: (params: EChartsEventParams) => void }> = [];
  const propagationPlan = createInteractionPropagationPlan(spec);

  for (const interaction of interactions) {
    if (interaction.rule.bindTo !== 'visual' || interaction.select.type !== 'point') {
      continue;
    }

    const eventName = mapEventName(interaction.select.on);
    const highlightHandler = createHighlightHandler(instance, propagationPlan);
    instance.on(eventName, highlightHandler);
    handlers.push({ event: eventName, handler: highlightHandler });

    const clearHandler = () => instance.dispatchAction({ type: 'downplay' });
    instance.on('globalout', clearHandler);
    handlers.push({ event: 'globalout', handler: clearHandler });
  }

  return () => {
    if (typeof instance.off !== 'function') {
      return;
    }

    for (const binding of handlers) {
      instance.off(binding.event, binding.handler);
    }
  };
}

function createHighlightHandler(instance: EChartsRuntime, plan: ReturnType<typeof createInteractionPropagationPlan>) {
  return (params: EChartsEventParams): void => {
    if (!isValidDataPoint(params)) {
      return;
    }

    instance.dispatchAction({ type: 'downplay' });

    if (shouldPropagateInteractions(plan)) {
      const seriesSpan = Math.max(plan.baseSeriesCount, 1);
      const baseIndex = params.seriesIndex % seriesSpan;

      for (let panelIndex = 0; panelIndex < plan.panelCount; panelIndex += 1) {
        const seriesIndex = panelIndex * seriesSpan + baseIndex;
        instance.dispatchAction({
          type: 'highlight',
          seriesIndex,
          dataIndex: params.dataIndex,
        });
      }

      return;
    }

    instance.dispatchAction({
      type: 'highlight',
      seriesIndex: params.seriesIndex,
      dataIndex: params.dataIndex,
    });
  };
}

function isValidDataPoint(params: EChartsEventParams): params is Required<EChartsEventParams> {
  return typeof params.seriesIndex === 'number' && typeof params.dataIndex === 'number';
}

function mapEventName(event: string): string {
  if (event === 'hover') {
    return 'mouseover';
  }

  if (event === 'focus') {
    return 'focus';
  }

  return event;
}
