import { componentContracts } from '@oods/component-contracts';
import { definitionRegistryReport, listObjects, loadObject, objectEntry } from '../objects/object-loader.js';
import { listTraits, loadTrait, traitEntry } from '../objects/trait-loader.js';
import type { ObjectDefinition } from '../objects/types.js';

/** The same identities used by generated components; no timestamped census or cached count. */
export function liveComponentNames(): string[] {
  return Object.keys(componentContracts).sort();
}

/** s222-m03 (#2502 ruling 15): OODS Foundry's own non-business objects are listed only when a caller asks for them. */
export type ObjectListing = { includeInternal?: boolean };
export type ObjectVisibility = 'public' | 'internal';

export function objectVisibility(definition: ObjectDefinition): ObjectVisibility {
  return definition.object.visibility === 'internal' ? 'internal' : 'public';
}

/**
 * The object names a listing shows: business objects first, then the internal ones when asked for, each group in name
 * order, with how many internal ones were left out. listObjects() keeps its name order, which the runtime ledger reads.
 */
export function listedObjects({ includeInternal = false }: ObjectListing = {}): { names: string[]; hiddenInternal: number } {
  const names = listObjects();
  const business = names.filter(name => objectVisibility(loadObject(name)) === 'public');
  const internal = names.filter(name => objectVisibility(loadObject(name)) === 'internal');
  return includeInternal ? { names: [...business, ...internal], hiddenInternal: 0 } : { names: business, hiddenInternal: internal.length };
}

export function liveRegistrySummary(listing: ObjectListing = {}) {
  const { names, hiddenInternal } = listedObjects(listing);
  return { source: 'live-registry' as const, objects: names, hiddenInternal, traits: listTraits(), issues: definitionRegistryReport().issues };
}
export type LiveRegistrySummary = ReturnType<typeof liveRegistrySummary>;

/**
 * Keep labelled historical capability evidence, but project membership and definitions from the live loaders.
 * Explicit version requests still read the archived export unchanged. This projection never writes an export.
 * Internal objects are left out unless the listing includes them, and each trait then names only the objects shown.
 */
export function withLiveRegistry(exported: Record<string, any>, listing: ObjectListing = {}): Record<string, any> {
  const objects = listedObjects(listing).names.map(name => {
    const definition = loadObject(name);
    return { ...definition.object, description: definition.object.description ?? '', visibility: objectVisibility(definition),
      traits: definition.traits.map(({ name: reference, alias, parameters }) => ({ reference, alias: alias ?? null, parameters: parameters ?? {} })),
      fields: Object.keys(definition.schema), semantics: definition.semantics, tokens: definition.tokens,
      metadata: definition.metadata, source: objectEntry(name)!.shown };
  });
  const traits = listTraits().map(name => {
    const definition = loadTrait(name);
    return { ...definition.trait, description: definition.trait.description?.trim() ?? '',
      contexts: Object.keys(definition.view_extensions).filter(context => definition.view_extensions[context].length).sort(),
      viewExtensions: Object.entries(definition.view_extensions).flatMap(([context, entries]) => entries.map(entry => ({
        component: entry.component, context, position: entry.position ?? null, priority: entry.priority ?? null, props: entry.props ?? {},
      }))),
      parameters: definition.parameters, schema: definition.schema, semantics: definition.semantics,
      tokens: definition.tokens, dependencies: definition.dependencies, metadata: definition.metadata,
      objects: objects.filter(object => object.traits.some(trait => trait.reference.split('/').at(-1) === name)).map(object => object.name),
      source: traitEntry(name)!.shown,
      ...(definition.state_machine ? { stateMachine: definition.state_machine } : {}),
      ...(definition.actions ? { actions: definition.actions } : {}),
    };
  });
  const previous = new Map<string, any>((exported.components ?? []).map((entry: any) => [entry.id, entry]));
  const components = liveComponentNames().map(id => {
    const old = previous.get(id) ?? { id, displayName: id, categories: [], tags: [], contexts: [], regions: [], sourceFiles: [] };
    const used = traits.flatMap(trait => trait.viewExtensions.filter(view => view.component === id).map(view => ({ trait, view })));
    const distinct = (values: string[]) => [...new Set(values)].sort();
    // Primitive discovery annotations are authored independently of trait usages in the export.
    // Keep those annotations: Text's form/list contexts do not disappear when its traits use only detail/card.
    const annotations = old.categories?.includes('primitive') ? old : {};
    return { ...old,
      ...(used.length || old.traitUsages?.length ? {
        categories: distinct([...(annotations.categories ?? []), ...used.map(({ trait }) => trait.category)]),
        tags: distinct([...(annotations.tags ?? []), ...used.flatMap(({ trait }) => trait.tags ?? [])]),
        contexts: distinct([...(annotations.contexts ?? []), ...used.map(({ view }) => view.context)]),
        regions: distinct([...(annotations.regions ?? []), ...used.flatMap(({ trait }) => trait.metadata.regionsUsed ?? [])]),
        sourceFiles: distinct([...(annotations.sourceFiles ?? []), ...used.map(({ trait }) => trait.source)]),
      } : {}),
      traitUsages: used.map(({ trait, view }) => ({ trait: trait.name, traitCategory: trait.category,
        context: view.context, position: view.position, priority: view.priority, props: view.props, source: trait.source,
      })).sort((a, b) => a.trait.localeCompare(b.trait) || a.context.localeCompare(b.context)),
    };
  });
  return { ...exported, components, traits, objects, registry: liveRegistrySummary(listing),
    stats: { ...exported.stats, componentCount: components.length, traitCount: traits.length, objectCount: objects.length } };
}
