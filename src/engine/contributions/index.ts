import type { ReactNode } from 'react';
import type { ContextKind } from '../../contexts/index.js';
import type { CanonicalRegionID } from '../../types/regions.js';
import type { ObjectSpec, RenderContext, TraitAdapter } from '../../types/render-context.js';
import type { ExtensionType, ViewExtension, ViewExtensionMetadata } from '../../types/view-extension.js';

export interface ContributionRenderContext<Data = unknown> {
  readonly context: ContextKind;
  readonly renderContext: RenderContext<Data>;
}

export interface ContributionRegistration<Data = unknown> {
  readonly id: string;
  readonly traitId: string;
  readonly context: ContextKind | readonly ContextKind[];
  readonly region: CanonicalRegionID;
  readonly type?: ExtensionType;
  readonly targetId?: string;
  readonly priority?: number;
  readonly metadata?: ViewExtensionMetadata;
  readonly when?: (input: ContributionRenderContext<Data>) => boolean;
  readonly render: (input: ContributionRenderContext<Data>) => ReactNode;
}

interface RegisteredContribution<Data = unknown>
  extends Omit<ContributionRegistration<Data>, 'context'> {
  readonly contexts: readonly ContextKind[];
}

type ContributionKey = string;
type TraitContributionRegistry = Map<ContributionKey, RegisteredContribution<unknown>>;

const registry = new Map<string, TraitContributionRegistry>();

function toContextArray(
  value: ContextKind | readonly ContextKind[]
): readonly ContextKind[] {
  if (Array.isArray(value)) {
    return value.slice() as readonly ContextKind[];
  }
  return [value] as readonly ContextKind[];
}

function buildContributionKey(traitId: string, contributionId: string): ContributionKey {
  return `${traitId}::${contributionId}`;
}

export function registerContribution<Data = unknown>(
  registration: ContributionRegistration<Data>
): void {
  const { context, ...rest } = registration;
  const contexts = toContextArray(context);
  const entry: RegisteredContribution<Data> = {
    ...rest,
    contexts,
  };

  const traitKey = registration.traitId;
  const traitRegistry = registry.get(traitKey) ?? new Map<ContributionKey, RegisteredContribution<unknown>>();
  traitRegistry.set(
    buildContributionKey(traitKey, registration.id),
    entry as RegisteredContribution<unknown>
  );
  registry.set(traitKey, traitRegistry);
}

export function clearContributions(): void {
  registry.clear();
}

function listTraitAdapters<Data>(
  object: ObjectSpec<Data>,
  explicit?: readonly TraitAdapter<Data>[]
): readonly TraitAdapter<Data>[] {
  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const { traits } = object;
  if (!Array.isArray(traits) || traits.length === 0) {
    return [];
  }

  const adapters: TraitAdapter<Data>[] = [];

  for (const candidate of traits) {
    if (!candidate || typeof candidate === 'string') {
      continue;
    }
    adapters.push(candidate);
  }

  return adapters;
}

function collectTraitContributionEntries<Data>(
  traitId: string
): readonly RegisteredContribution<Data>[] {
  const entries = registry.get(traitId);
  if (!entries || entries.size === 0) {
    return [];
  }

  return Array.from(entries.values()) as RegisteredContribution<Data>[];
}

export interface CollectContributionExtensionsOptions<Data = unknown> {
  readonly object: ObjectSpec<Data>;
  readonly context: ContextKind;
  readonly renderContext: RenderContext<Data>;
  readonly traits?: readonly TraitAdapter<Data>[];
}

export function collectContributionExtensions<Data = unknown>(
  options: CollectContributionExtensionsOptions<Data>
): ViewExtension<Data>[] {
  const { object, context, renderContext, traits } = options;
  const adapters = listTraitAdapters(object, traits);

  if (adapters.length === 0) {
    return [];
  }

  const extensions: ViewExtension<Data>[] = [];

  adapters.forEach((trait) => {
    if (!trait?.id) {
      return;
    }

    const entries = collectTraitContributionEntries<Data>(trait.id);
    if (entries.length === 0) {
      return;
    }

    entries.forEach((entry) => {
      if (!entry.contexts.includes(context)) {
        return;
      }

      const contributionContext: ContributionRenderContext<Data> = {
        context,
        renderContext,
      };

      if (entry.when && !entry.when(contributionContext)) {
        return;
      }

      const existingTags = entry.metadata?.tags ?? [];
      const metadata: ViewExtensionMetadata = {
        ...(entry.metadata ?? {}),
        sourceTrait: entry.metadata?.sourceTrait ?? trait.id,
        tags: Array.from(new Set([...(Array.isArray(existingTags) ? existingTags : []), 'contribution'])),
      };

      const extension: ViewExtension<Data> = {
        id: entry.id,
        region: entry.region,
        type: entry.type ?? 'section',
        priority: entry.priority,
        targetId: entry.targetId,
        render: (ctx) =>
          entry.render({
            context,
            renderContext: ctx as RenderContext<Data>,
          }),
        metadata,
      };

      extensions.push(extension);
    });
  });

  return extensions;
}

export function listRegisteredContributionIds(traitId: string): readonly string[] {
  const entries = registry.get(traitId);
  if (!entries || entries.size === 0) {
    return [];
  }

  return Array.from(entries.values()).map((entry) => entry.id);
}
