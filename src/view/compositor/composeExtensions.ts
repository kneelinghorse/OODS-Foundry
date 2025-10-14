import { REGION_ORDER, type CanonicalRegionId } from '../../types/regions.js';
import type { RenderContext } from '../context.js';
import { ViewExtensionError, normalizeViewExtensions } from '../extensions.js';
import type { Condition, ViewExtension } from '../../types/view-extension.js';

export interface ComposeExtensionsOptions<Data = unknown> {
  readonly context?: RenderContext<Data>;
  readonly evaluateCondition?: (
    condition: Condition,
    context: RenderContext<Data>
  ) => boolean;
}

export type ExtensionExclusionReason = 'condition_failed' | 'condition_error';

export interface InactiveExtension<Data = unknown> {
  readonly extension: ViewExtension<Data>;
  readonly reason: ExtensionExclusionReason;
  readonly failedConditions: readonly Condition[];
  readonly error?: Error;
}

export interface TargetedExtensionSet<Data = unknown> {
  readonly byTarget: Readonly<Record<string, readonly ViewExtension<Data>[]>>;
  readonly unbound: readonly ViewExtension<Data>[];
}

export interface RegionPlan<Data = unknown> {
  readonly region: CanonicalRegionId;
  readonly sections: readonly ViewExtension<Data>[];
  readonly actions: readonly ViewExtension<Data>[];
  readonly modifiers: TargetedExtensionSet<Data>;
  readonly wrappers: TargetedExtensionSet<Data>;
}

export interface ExtensionComposition<Data = unknown> {
  readonly normalizedExtensions: readonly ViewExtension<Data>[];
  readonly activeExtensions: readonly ViewExtension<Data>[];
  readonly inactiveExtensions: readonly InactiveExtension<Data>[];
  readonly regions: Readonly<Record<CanonicalRegionId, RegionPlan<Data>>>;
}

type RegionAccumulator<Data> = {
  sections: ViewExtension<Data>[];
  actions: ViewExtension<Data>[];
  modifiersByTarget: Map<string, ViewExtension<Data>[]>;
  modifiersUnbound: ViewExtension<Data>[];
  wrappersByTarget: Map<string, ViewExtension<Data>[]>;
  wrappersUnbound: ViewExtension<Data>[];
};

function createAccumulator<Data>(): RegionAccumulator<Data> {
  return {
    sections: [],
    actions: [],
    modifiersByTarget: new Map(),
    modifiersUnbound: [],
    wrappersByTarget: new Map(),
    wrappersUnbound: [],
  };
}

function freezeTargetedSet<Data>(
  byTarget: Map<string, ViewExtension<Data>[]>,
  unbound: ViewExtension<Data>[]
): TargetedExtensionSet<Data> {
  const record: Record<string, readonly ViewExtension<Data>[]> = Object.create(null);

  for (const [targetId, list] of byTarget.entries()) {
    record[targetId] = Object.freeze(list.slice());
  }

  return Object.freeze({
    byTarget: Object.freeze(record),
    unbound: Object.freeze(unbound.slice()),
  });
}

function defaultEvaluateCondition<Data>(
  condition: Condition,
  context: RenderContext<Data>
): boolean {
  const expression = condition.expression?.trim();
  if (!expression) {
    return true;
  }

  // eslint-disable-next-line no-new-func
  const evaluator = new Function('context', `return (${expression});`);
  const result = evaluator(context);
  return Boolean(result);
}

function evaluateConditions<Data>(
  extension: ViewExtension<Data>,
  options: ComposeExtensionsOptions<Data>,
  inactive: InactiveExtension<Data>[]
): boolean {
  const { conditions } = extension;
  if (!conditions || conditions.length === 0) {
    return true;
  }

  const context = options.context;
  if (!context) {
    throw new ViewExtensionError(
      `Extension "${extension.id}" defines conditions but no RenderContext was provided.`,
      extension.id
    );
  }

  const evaluate = options.evaluateCondition ?? defaultEvaluateCondition<Data>;
  const failed: Condition[] = [];
  let error: Error | undefined;

  for (const condition of conditions) {
    try {
      if (!evaluate(condition, context)) {
        failed.push(condition);
      }
    } catch (err) {
      failed.push(condition);
      error = err instanceof Error ? err : new Error(String(err));
      break;
    }
  }

  if (failed.length > 0) {
    inactive.push(
      Object.freeze({
        extension,
        reason: error ? 'condition_error' : 'condition_failed',
        failedConditions: Object.freeze(failed.slice()),
        error,
      })
    );
    return false;
  }

  return true;
}

export function composeExtensions<Data>(
  extensions: readonly ViewExtension<Data>[],
  options: ComposeExtensionsOptions<Data> = {}
): ExtensionComposition<Data> {
  const normalized = normalizeViewExtensions(extensions as readonly ViewExtension<Data>[]);
  const active: ViewExtension<Data>[] = [];
  const inactive: InactiveExtension<Data>[] = [];
  const regions = new Map<CanonicalRegionId, RegionAccumulator<Data>>();

  for (const extension of normalized) {
    const include = evaluateConditions(extension, options, inactive);
    if (!include) {
      continue;
    }

    active.push(extension);
    const region = extension.region;
    let accumulator = regions.get(region);
    if (!accumulator) {
      accumulator = createAccumulator<Data>();
      regions.set(region, accumulator);
    }

    switch (extension.type) {
      case 'section':
        accumulator.sections.push(extension);
        break;
      case 'action':
        accumulator.actions.push(extension);
        break;
      case 'modifier':
        if (extension.targetId) {
          const list = accumulator.modifiersByTarget.get(extension.targetId) ?? [];
          list.push(extension);
          accumulator.modifiersByTarget.set(extension.targetId, list);
        } else {
          accumulator.modifiersUnbound.push(extension);
        }
        break;
      case 'wrapper':
        if (extension.targetId) {
          const list = accumulator.wrappersByTarget.get(extension.targetId) ?? [];
          list.push(extension);
          accumulator.wrappersByTarget.set(extension.targetId, list);
        } else {
          accumulator.wrappersUnbound.push(extension);
        }
        break;
      default:
        break;
    }
  }

  const regionPlans: Record<CanonicalRegionId, RegionPlan<Data>> = Object.create(null);

  for (const region of REGION_ORDER) {
    const accumulator = regions.get(region) ?? createAccumulator<Data>();

    regionPlans[region] = Object.freeze({
      region,
      sections: Object.freeze(accumulator.sections.slice()),
      actions: Object.freeze(accumulator.actions.slice()),
      modifiers: freezeTargetedSet(accumulator.modifiersByTarget, accumulator.modifiersUnbound),
      wrappers: freezeTargetedSet(accumulator.wrappersByTarget, accumulator.wrappersUnbound),
    });
  }

  return Object.freeze({
    normalizedExtensions: normalized,
    activeExtensions: Object.freeze(active.slice()),
    inactiveExtensions: Object.freeze(inactive.slice()),
    regions: Object.freeze(regionPlans),
  });
}

export type { ViewExtension } from '../../types/view-extension.js';
