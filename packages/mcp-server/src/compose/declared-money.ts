import type { FieldDefinition, SemanticMapping } from '../objects/types.js';
import type { ResolvedTrait } from '../objects/trait-composer.js';
import type { FieldSchemaEntry } from '../schemas/generated.js';

/**
 * s213-m03 (Sprint 212 review finding 7): a field is money only when its semantics say so, with
 * `ui_hints.component: CurrencyAmount` and the record field holding its currency (`currencyField`). It is stored in
 * minor units only when the declaration gives the factor, as `minorUnits` or as `minorUnitsParameter` naming the trait
 * parameter that holds it; otherwise the amount is in major units. Nothing is inferred from a field's name: a team's
 * `amount` of 19.99 is 19.99, never 0.1999.
 */
export function declaredMoney(
  fieldName: string,
  fieldSchema: Record<string, FieldDefinition>,
  semantics: Record<string, SemanticMapping> | undefined,
  traits: ResolvedTrait[],
  owner: ResolvedTrait | undefined,
): FieldSchemaEntry['money'] | undefined {
  const hints = semantics?.[fieldName]?.ui_hints;
  if (hints?.component !== 'CurrencyAmount') return undefined;
  const money: NonNullable<FieldSchemaEntry['money']> = {};
  // A trait names the currency field its objects usually carry; an object without it shows the amount as a number
  // (object validate says so).
  if (typeof hints.currencyField === 'string' && Object.hasOwn(fieldSchema, hints.currencyField)) money.currencyField = hints.currencyField;
  const parameter = hints.minorUnitsParameter;
  const declaring = typeof parameter === 'string'
    ? [owner, ...traits].find(trait => trait?.definition.parameters.some(entry => entry.name === parameter))
    : undefined;
  const factor = typeof hints.minorUnits === 'number' ? hints.minorUnits
    : declaring ? declaring.ref.parameters?.[parameter as string] ?? declaring.definition.parameters.find(entry => entry.name === parameter)?.default
      : undefined;
  if (typeof parameter === 'string' && factor === undefined) throw new Error(`Minor units for ${fieldName} name the parameter "${parameter}", which none of the object's traits declares.`);
  if (factor !== undefined) {
    if (!Number.isSafeInteger(factor) || (factor as number) < 1) throw new Error(`Minor units for ${fieldName} must be a positive whole number, not ${JSON.stringify(factor)}.`);
    money.minorUnits = factor as number;
  }
  return money;
}
