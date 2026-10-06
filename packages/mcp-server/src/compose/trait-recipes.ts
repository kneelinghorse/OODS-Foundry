import recipeParameters from './trait-recipes.json' with { type: 'json' };
import type { ResolvedTrait } from '../objects/trait-composer.js';
import type { ViewExtension } from '../objects/types.js';
import { isVizIntentFragment } from '@oods/component-contracts';

/** These recipes require trait field mappings, not generic single-field selection. */
export const TRAIT_RECIPE_PARAMETERS: Readonly<Record<string, Readonly<Record<string, string>>>> = recipeParameters;

export function isTraitRecipe(component: string): boolean {
  return Object.hasOwn(TRAIT_RECIPE_PARAMETERS, component);
}

/** Keep authored references and runtime values; resolve only declared directives. */
export function resolveTraitRecipeProps(resolved: ResolvedTrait, extension: ViewExtension): Record<string, unknown> {
  const props = { ...extension.props };
  const directives = isTraitRecipe(extension.component) ? TRAIT_RECIPE_PARAMETERS[extension.component] : {};
  for (const [directive, runtimeProp] of Object.entries(directives)) {
    const name = props[directive];
    if (typeof name !== 'string' || props[runtimeProp] !== undefined) continue;
    const value = resolved.ref.parameters?.[name]
      ?? resolved.definition.parameters.find((parameter) => parameter.name === name)?.default;
    if (directive === 'intentParameter' && value !== undefined) {
      // Trait parameters currently support scalars, so the authored JSON string
      // crosses into a typed component value here, once, before generation.
      if (typeof value !== 'string') throw new Error(`${extension.component}.${name} must be a JSON-encoded viz.render input fragment.`);
      const fragment: unknown = JSON.parse(value);
      if (!isVizIntentFragment(fragment)) throw new Error(`${extension.component}.${name} is not a supported Cartesian viz.render input fragment.`);
      props[runtimeProp] = fragment;
    } else if (value !== undefined) props[runtimeProp] = structuredClone(value);
  }
  return props;
}
