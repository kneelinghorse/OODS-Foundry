import type { ObjectSpec, RenderContext, TraitAdapter } from '../types/render-context.js';
import type { ViewExtension } from '../types/view-extension.js';

function ensureTraitAdapter<Data>(
  trait: TraitAdapter<Data> | string | null | undefined
): TraitAdapter<Data> | null {
  if (!trait || typeof trait === 'string') {
    return null;
  }
  return trait;
}

function withSourceTrait<Data>(
  extension: ViewExtension<Data>,
  trait: TraitAdapter<Data>
): ViewExtension<Data> {
  const metadata = extension.metadata ?? {};

  return {
    ...extension,
    metadata: {
      ...metadata,
      sourceTrait: metadata.sourceTrait ?? trait.id,
    },
  };
}

export interface TraitViewErrorDetails<Data = unknown> {
  readonly trait: TraitAdapter<Data>;
  readonly error: unknown;
  readonly context: RenderContext<Data>;
}

export interface ResolveTraitExtensionsOptions<Data = unknown> {
  readonly onTraitViewError?: (details: TraitViewErrorDetails<Data>) => void;
}

export function resolveTraitExtensions<Data>(
  object: ObjectSpec<Data>,
  ctx: RenderContext<Data>,
  options: ResolveTraitExtensionsOptions<Data> = {}
): ViewExtension<Data>[] {
  if (!object?.traits || object.traits.length === 0) {
    return [];
  }

  const resolved: ViewExtension<Data>[] = [];

  for (const traitEntry of object.traits) {
    const trait = ensureTraitAdapter(traitEntry);
    if (!trait) {
      continue;
    }

    const staticExtensions = Array.isArray(trait.extensions) ? trait.extensions : [];
    for (const extension of staticExtensions) {
      resolved.push(withSourceTrait(extension, trait));
    }

    if (typeof trait.view !== 'function') {
      continue;
    }

    let dynamicExtensions: readonly ViewExtension<Data>[] | null = null;

    try {
      const resolved = trait.view(ctx);
      if (Array.isArray(resolved)) {
        dynamicExtensions = resolved;
      } else if (resolved == null) {
        dynamicExtensions = [];
      }
    } catch (error) {
      options.onTraitViewError?.({
        trait,
        error,
        context: ctx,
      });
      continue;
    }

    if (!dynamicExtensions) {
      continue;
    }

    for (const extension of dynamicExtensions) {
      resolved.push(withSourceTrait(extension, trait));
    }
  }

  return resolved;
}
