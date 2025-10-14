import { cloneElement, createElement, Fragment, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { REGION_ORDER, type CanonicalRegionID } from '../types/regions.js';
import type { RenderContext } from '../types/render-context.js';
import type { Condition, ViewExtension } from '../types/view-extension.js';
import { normalizeViewExtensions, ViewExtensionError } from '../view/extensions.js';

type TargetBuckets<Data> = Map<string, ViewExtension<Data>[]>;

interface RegionAccumulator<Data> {
  readonly sections: ViewExtension<Data>[];
  readonly actions: ViewExtension<Data>[];
  readonly modifiersByTarget: TargetBuckets<Data>;
  readonly modifiersUnbound: ViewExtension<Data>[];
  readonly wrappersByTarget: TargetBuckets<Data>;
  readonly wrappersUnbound: ViewExtension<Data>[];
}

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

function normalizeNode(node: unknown): ReactNode {
  if (node === undefined) {
    return null;
  }
  return node as ReactNode;
}

function evaluateCondition<Data>(condition: Condition, context: RenderContext<Data>): boolean {
  const expression = condition.expression?.trim();
  if (!expression) {
    return true;
  }

  // eslint-disable-next-line no-new-func
  const executor = new Function('context', `return (${expression});`);
  const result = executor(context);
  return Boolean(result);
}

function evaluateExtensionConditions<Data>(
  extension: ViewExtension<Data>,
  context: RenderContext<Data>
): boolean {
  const { conditions } = extension;
  if (!conditions || conditions.length === 0) {
    return true;
  }

  for (const condition of conditions) {
    try {
      if (!evaluateCondition(condition, context)) {
        return false;
      }
    } catch (error) {
      const err = error as Error;
      throw new ViewExtensionError(
        `Failed to evaluate condition "${condition.id}" on extension "${extension.id}": ${err.message}`,
        extension.id
      );
    }
  }

  return true;
}

function invokeWrapper(result: unknown, child: ReactNode): ReactNode {
  if (typeof result === 'function') {
    return (result as (children: ReactNode) => ReactNode)(child);
  }

  if (isValidElement(result)) {
    const element = result as ReactElement;
    return cloneElement(element, undefined, child);
  }

  if (result && typeof result === 'object') {
    const maybeWrapper = result as { wrap?: (children: ReactNode) => ReactNode };
    if (typeof maybeWrapper.wrap === 'function') {
      return maybeWrapper.wrap(child);
    }
  }

  return child;
}

function invokeModifier(result: unknown, node: ReactNode): ReactNode {
  if (typeof result === 'function') {
    return (result as (current: ReactNode) => ReactNode)(node);
  }

  if (result && typeof result === 'object') {
    const maybeModifier = result as {
      wrap?: (current: ReactNode) => ReactNode;
      props?: Record<string, unknown>;
    };

    if (typeof maybeModifier.wrap === 'function') {
      return maybeModifier.wrap(node);
    }

    if (isValidElement(node) && maybeModifier.props) {
      const element = node as ReactElement;
      return cloneElement(element, maybeModifier.props);
    }
  }

  return node;
}

function applyWrapperChain<Data>(
  node: ReactNode,
  wrappers: readonly ViewExtension<Data>[],
  context: RenderContext<Data>
): ReactNode {
  return wrappers.reduceRight<ReactNode>((child, wrapper) => {
    const result = wrapper.render(context);
    return invokeWrapper(result, child);
  }, node);
}

function applyModifierChain<Data>(
  node: ReactNode,
  modifiers: readonly ViewExtension<Data>[],
  context: RenderContext<Data>
): ReactNode {
  return modifiers.reduce<ReactNode>((current, modifier) => {
    const result = modifier.render(context);
    return invokeModifier(result, current);
  }, node);
}

function withBoundary<Data>(extension: ViewExtension<Data>, content: ReactNode): ReactNode {
  return createElement(
    'div',
    {
      key: extension.id,
      'data-extension-id': extension.id,
      'data-extension-type': extension.type,
      'data-extension-region': extension.region,
      'data-extension-trait': extension.metadata?.sourceTrait,
      style: { display: 'contents' },
    },
    content
  );
}

function renderRegion<Data>(
  accumulator: RegionAccumulator<Data>,
  context: RenderContext<Data>
): ReactNode | null {
  const nodes: ReactNode[] = [];

  for (const section of accumulator.sections) {
    const modifiers = accumulator.modifiersByTarget.get(section.id) ?? [];
    const wrappers = accumulator.wrappersByTarget.get(section.id) ?? [];

    let node = normalizeNode(section.render(context));
    node = applyModifierChain(node, modifiers, context);
    node = withBoundary(section, node);
    node = applyWrapperChain(node, wrappers, context);
    nodes.push(node);
  }

  for (const action of accumulator.actions) {
    const modifiers = accumulator.modifiersByTarget.get(action.id) ?? [];
    const wrappers = accumulator.wrappersByTarget.get(action.id) ?? [];

    let node = normalizeNode(action.render(context));
    node = applyModifierChain(node, modifiers, context);
    node = withBoundary(action, node);
    node = applyWrapperChain(node, wrappers, context);
    nodes.push(node);
  }

  let combined: ReactNode | null;

  if (nodes.length === 0) {
    combined = null;
  } else if (nodes.length === 1) {
    combined = nodes[0]!;
  } else {
    combined = createElement(Fragment, null, ...nodes);
  }

  combined = applyModifierChain(combined, accumulator.modifiersUnbound, context);
  combined = applyWrapperChain(combined, accumulator.wrappersUnbound, context);

  return combined;
}

export function prepareExtensions<Data>(
  extensions: readonly ViewExtension<Data>[],
  context: RenderContext<Data>
): readonly ViewExtension<Data>[] {
  const normalized = normalizeViewExtensions<Data>(extensions);
  return normalized.filter((extension) => evaluateExtensionConditions(extension, context));
}

export function composeExtensions<Data>(
  extensions: readonly ViewExtension<Data>[],
  context: RenderContext<Data>
): Record<CanonicalRegionID, ReactNode> {
  if (!context) {
    throw new ViewExtensionError('composeExtensions requires a RenderContext to operate.');
  }

  const prepared = prepareExtensions(extensions, context);
  const regions = new Map<CanonicalRegionID, RegionAccumulator<Data>>();

  for (const extension of prepared) {
    let accumulator = regions.get(extension.region);
    if (!accumulator) {
      accumulator = createAccumulator<Data>();
      regions.set(extension.region, accumulator);
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

  return REGION_ORDER.reduce<Record<CanonicalRegionID, ReactNode>>((result, region) => {
    const accumulator = regions.get(region) ?? createAccumulator<Data>();
    result[region] = renderRegion(accumulator, context);
    return result;
  }, Object.create(null));
}
