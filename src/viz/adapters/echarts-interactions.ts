import type { NormalizedVizSpec } from '@/viz/spec/normalized-viz-spec.js';
import {
  createInteractionPropagationPlan,
  shouldPropagateInteractions,
} from './interaction-propagator.js';

export interface EChartsEventParams {
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
}

interface BrushSelectionDetail {
  readonly seriesIndex?: number;
  readonly dataIndex?: readonly number[];
}

interface BrushSelectionBatch {
  readonly selected?: readonly BrushSelectionDetail[];
}

interface BrushSelectionEvent {
  readonly batch?: readonly BrushSelectionBatch[];
}

export interface EChartsDispatchAction {
  readonly type: string;
  readonly seriesIndex?: number;
  readonly dataIndex?: number;
  readonly [key: string]: unknown;
}

export interface EChartsRuntime {
  on(event: string, handler: (params: unknown) => void): void;
  off?(event: string, handler: (params: unknown) => void): void;
  dispatchAction(action: EChartsDispatchAction): void;
}

export type InteractionCleanup = () => void;

export function bindEChartsInteractions(instance: EChartsRuntime, spec: NormalizedVizSpec): InteractionCleanup {
  const interactions = spec.interactions ?? [];
  const handlers: Array<{ event: string; handler: (payload: unknown) => void }> = [];
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

  const hasRangeInteractions = interactions.some(
    (interaction) =>
      interaction.select.type === 'interval' &&
      (interaction.rule.bindTo === 'filter' || interaction.rule.bindTo === 'zoom')
  );

  if (hasRangeInteractions) {
    const dataZoomHandler = () => {
      instance.dispatchAction({ type: 'downplay' });
    };
    instance.on('datazoom', dataZoomHandler);
    handlers.push({ event: 'datazoom', handler: dataZoomHandler });
  }

  const hasBrushInteraction = interactions.some(
    (interaction) =>
      interaction.rule.bindTo === 'filter' && interaction.select.type === 'interval' && interaction.select.encodings.length > 1
  );

  if (hasBrushInteraction) {
    const brushHandler = createBrushSelectionHandler(instance);
    instance.on('brushselected', brushHandler);
    handlers.push({ event: 'brushselected', handler: brushHandler });
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
  return (payload: unknown): void => {
    if (!isValidDataPoint(payload)) {
      return;
    }

    const params = payload as Required<EChartsEventParams>;

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

function createBrushSelectionHandler(instance: EChartsRuntime) {
  return (event: unknown): void => {
    instance.dispatchAction({ type: 'downplay' });

    const batches = extractBrushBatches(event);
    if (!batches) {
      return;
    }

    for (const batch of batches) {
      for (const selection of batch.selected ?? []) {
        if (!Array.isArray(selection.dataIndex) || typeof selection.seriesIndex !== 'number') {
          continue;
        }

        for (const index of selection.dataIndex) {
          if (typeof index !== 'number') {
            continue;
          }
          instance.dispatchAction({
            type: 'highlight',
            seriesIndex: selection.seriesIndex,
            dataIndex: index,
          });
        }
      }
    }
  };
}

function isValidDataPoint(params: unknown): params is Required<EChartsEventParams> {
  if (!params || typeof params !== 'object') {
    return false;
  }

  const candidate = params as EChartsEventParams;
  return typeof candidate.seriesIndex === 'number' && typeof candidate.dataIndex === 'number';
}

function extractBrushBatches(event: unknown): readonly BrushSelectionBatch[] | undefined {
  if (!event || typeof event !== 'object') {
    return undefined;
  }

  const { batch } = event as BrushSelectionEvent;
  if (!Array.isArray(batch)) {
    return undefined;
  }

  return batch;
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
