/**
 * object.validate — check a team's object or trait definition before it is registered (s213-m03).
 *
 * Parse the YAML, check its header and fields, resolve its traits, check its contexts and, for an object, compose it
 * with its traits exactly as design.compose does (composeObject), returning the composer's warnings. A trait's views may
 * place only components Forge ships: a team's own components come in Sprint 214 (substitution). Nothing is written.
 */

import { load as parseYaml } from 'js-yaml';
import { parseProblem } from '../objects/definition-folders.js';
import { listObjects, normalizeObjectDocument, objectEntry, objectRefusal, userObjectsFolder } from '../objects/object-loader.js';
import { hasTrait, listTraits, loadTrait, traitEntry, traitRefusal, userTraitsFolder } from '../objects/trait-loader.js';
import { relationshipProblems, type RelationshipProblem } from '../objects/relationships.js';
import { parameterProblems } from '../objects/parameter-validation.js';
import { composeObject } from '../objects/trait-composer.js';
import { supportsContext } from '../objects/supported-contexts.js';
import { populateObjectSchema } from '../compose/object-slot-filler.js';
import type { UiSchema } from '../schemas/generated.js';
import { loadComponentRegistry } from './repl.utils.js';
import { findClosestMatch } from './object.show.js';

/** The contexts design.compose composes an object in. */
export const OBJECT_CONTEXTS = ['list', 'detail', 'form', 'timeline', 'card', 'inline'] as const;
/** The contexts a trait's views may extend: the object contexts and the dashboard layout. */
const VIEW_CONTEXTS = [...OBJECT_CONTEXTS, 'dashboard'] as const;
const NAME = /^[A-Za-z][A-Za-z0-9]*$/;
// SemVer identifiers: numeric prerelease identifiers cannot have leading zeroes; build identifiers can.
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const OBJECT_KEYS = ['object', 'relationships', 'samples', 'traits', 'schema', 'semantics', 'tokens', 'metadata'];
const TRAIT_KEYS = ['trait', 'parameters', 'schema', 'semantics', 'view_extensions', 'tokens', 'dependencies', 'metadata', 'events', 'state_machine', 'actions', 'detection', 'outputs'];
/** Components that read an amount stored in minor units (their contracts say so); PriceBadge reads major units too. */
const MINOR_UNIT_READERS = new Set(['BillingSummaryBadge', 'BillingCardMeta', 'BillingAmountInput', 'PriceSummary', 'PriceCardMeta']);

export type ObjectValidateInput = { yaml: string };

export type DefinitionProblem = {
  kind: RelationshipProblem['kind'] | 'malformed' | 'not-a-definition' | 'invalid-name' | 'missing-header' | 'invalid-trait-reference' | 'unknown-trait'
    | 'invalid-parameter' | 'missing-parameter' | 'invalid-field' | 'unknown-context' | 'unknown-component' | 'invalid-view' | 'invalid-state-machine'
    | 'shipped-name' | 'duplicate' | 'compose-failed' | 'money-units' | 'trait-conflict' | 'invalid-version';
  path?: string;
  message: string;
};

export type ObjectValidateOutput = {
  kind: 'object' | 'trait' | null;
  name: string | null;
  valid: boolean;
  errors: DefinitionProblem[];
  warnings: string[];
  /** For an object: the contexts it composes. For a trait: the contexts its views extend. */
  contexts: string[];
  /** The shipped object a team's object of this name is used in place of. */
  replaces?: string;
  /** The folder `register` would write it to, or null when none is set. */
  folder: string | null;
};

export type Checked = ObjectValidateOutput & { document?: Record<string, unknown> };

const isMap = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const quoted = (values: readonly string[]) => values.map(value => `"${value}"`).join(', ');
const suggestion = (name: string, available: string[]) => {
  const closest = findClosestMatch(name, available);
  return closest ? ` Did you mean "${closest}"?` : '';
};

function checkUnknownKeys(document: Record<string, unknown>, known: string[], warnings: string[]): string[] {
  const unknown = Object.keys(document).filter(key => !known.includes(key));
  for (const key of unknown) warnings.push(`Unknown top-level key "${key}" is ignored.${suggestion(key, known)}`);
  return unknown;
}

function checkHeader(header: unknown, key: 'object' | 'trait', required: readonly string[], errors: DefinitionProblem[]): string | null {
  if (!isMap(header)) {
    errors.push({ kind: 'missing-header', path: key, message: `"${key}" must be a mapping with ${quoted(required)}.` });
    return null;
  }
  for (const field of required) {
    if (field === 'version' && header.version !== undefined) {
      if (typeof header.version !== 'string' || !VERSION.test(header.version) || header.version.trim() !== header.version) {
        errors.push({ kind: 'invalid-version', path: `${key}.version`, message: `${key}.version must be a semantic version such as "1.2.3" (optionally with prerelease and build parts, for example "1.2.3-beta.1+build.5").` });
      }
      continue;
    }
    if (typeof header[field] !== 'string' || !(header[field] as string).trim()) {
      errors.push({ kind: 'missing-header', path: `${key}.${field}`, message: `${key}.${field} is required and must be text.` });
    }
  }
  const name = typeof header.name === 'string' ? header.name : null;
  if (name && !NAME.test(name)) {
    errors.push({ kind: 'invalid-name', path: `${key}.name`, message: `${key}.name "${name}" must start with a letter and use only letters and digits (it names files, types and components in generated code).` });
  }
  return name;
}

function checkFields(schema: unknown, owner: string, errors: DefinitionProblem[]) {
  if (schema === undefined) return;
  if (!isMap(schema)) {
    errors.push({ kind: 'invalid-field', path: 'schema', message: `${owner}'s schema must be a mapping of field names to fields.` });
    return;
  }
  for (const [field, definition] of Object.entries(schema)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      errors.push({ kind: 'invalid-field', path: `schema.${field}`, message: `The field name "${field}" must start with a letter or underscore and use only letters, digits and underscores.` });
    }
    if (!isMap(definition) || typeof definition.type !== 'string' || !definition.type.trim()) {
      errors.push({ kind: 'invalid-field', path: `schema.${field}`, message: `The field "${field}" needs a "type" (for example string, number, integer, boolean, datetime).` });
      continue;
    }
    if (definition.required !== undefined && typeof definition.required !== 'boolean') {
      errors.push({ kind: 'invalid-field', path: `schema.${field}.required`, message: `"required" on the field "${field}" must be true or false.` });
    }
  }
}

function checkObject(document: Record<string, unknown>, result: Checked, available: readonly string[]) {
  const { errors, warnings } = result;
  checkUnknownKeys(document, OBJECT_KEYS, warnings);
  const name = checkHeader(document.object, 'object', ['name', 'version', 'domain', 'description'], errors);
  result.name = name;
  checkFields(document.schema, name ?? 'The object', errors);

  const references = document.traits ?? [];
  if (!Array.isArray(references)) {
    errors.push({ kind: 'invalid-trait-reference', path: 'traits', message: '"traits" must be a list of { name, parameters }.' });
  } else {
    const unbound: Array<{ name: string; conflicts: string[] }> = [];
    references.forEach((reference, index) => {
      const at = `traits[${index}]`;
      if (!isMap(reference) || typeof reference.name !== 'string' || !reference.name.trim()) {
        errors.push({ kind: 'invalid-trait-reference', path: at, message: `${at} needs a "name" naming a shipped trait or one of your traits.` });
        return;
      }
      if (reference.parameters !== undefined && !isMap(reference.parameters)) {
        errors.push({ kind: 'invalid-trait-reference', path: `${at}.parameters`, message: `${at}.parameters must be a mapping of parameter names to values.` });
        return;
      }
      if (!hasTrait(reference.name)) {
        errors.push({ kind: 'unknown-trait', path: `${at}.name`, message: `No shipped trait or trait of yours is named "${reference.name}".${suggestion(reference.name.split('/').pop()!, listTraits())} Register your trait first, then this object.` });
        return;
      }
      const trait = traitEntry(reference.name)!;
      const definition = loadTrait(trait.name);
      const given = (reference.parameters ?? {}) as Record<string, unknown>;
      // Match composeObject's bound-chart projection: these references contribute no mark fields to conflict.
      if (!(definition.trait.name.startsWith('Mark') && given.chart)) {
        const declaredConflicts = definition.metadata.conflicts_with;
        unbound.push({ name: trait.name.split('/').pop()!, conflicts: Array.isArray(declaredConflicts)
          ? declaredConflicts.filter(conflict => typeof conflict === 'string').map(conflict => conflict.split('/').pop()!) : [] });
      }
      for (const parameter of definition.parameters) {
        if (parameter.required && parameter.default === undefined && !(parameter.name in given)) {
          errors.push({ kind: 'missing-parameter', path: `${at}.parameters.${parameter.name}`, message: `The trait "${trait.name}" requires the parameter "${parameter.name}" (${parameter.description}).` });
        }
      }
      for (const problem of parameterProblems(reference.name, given)) {
        errors.push({ kind: 'invalid-parameter', path: `${at}.parameters${problem.path}`, message: problem.message });
      }
      const declared = new Set(definition.parameters.map(parameter => parameter.name));
      for (const parameter of Object.keys(given)) {
        if (!declared.has(parameter)) warnings.push(`${at}: the trait "${trait.name}" declares no parameter "${parameter}", so it is ignored.`);
      }
    });
    for (let index = 0; index < unbound.length; index++) {
      const first = unbound[index]!;
      for (const second of unbound.slice(index + 1)) {
        if (first.conflicts.includes(second.name) || second.conflicts.includes(first.name)) {
          errors.push({ kind: 'trait-conflict', path: 'traits', message: `The traits "${first.name}" and "${second.name}" are declared to conflict; remove one from the object.` });
        }
      }
    }
  }

  const metadata = document.metadata;
  const supported = isMap(metadata) ? metadata.supportedContexts : undefined;
  if (supported !== undefined) {
    if (!Array.isArray(supported) || supported.some(context => typeof context !== 'string')) {
      errors.push({ kind: 'unknown-context', path: 'metadata.supportedContexts', message: `metadata.supportedContexts must be a list of contexts: ${quoted(OBJECT_CONTEXTS)}.` });
    } else {
      for (const context of supported) {
        if (!(OBJECT_CONTEXTS as readonly string[]).includes(context)) {
          errors.push({ kind: 'unknown-context', path: 'metadata.supportedContexts', message: `"${context}" is not a context OODS Foundry composes. Use ${quoted(OBJECT_CONTEXTS)}.` });
        }
      }
    }
  }

  if (name && objectRefusal(name)) {
    errors.push({ kind: 'duplicate', path: 'object.name', message: objectRefusal(name)!.message });
  }
  if (name) {
    const existing = objectEntry(name);
    if (existing?.source === 'shipped') {
      result.replaces = existing.shown;
      warnings.push(`A shipped object is named "${name}"; once registered, yours is used in its place everywhere (${existing.shown}).`);
    } else if (existing?.replaces) {
      result.replaces = existing.replaces;
    }
  }
  if (errors.length) return;

  const definition = normalizeObjectDocument(document);
  const shape: UiSchema = { version: '2026.02', screens: [{ id: 'validate-shape', component: 'Stack' }] };
  let composed: ReturnType<typeof composeObject>;
  try {
    composed = composeObject(definition);
    warnings.push(...composed.warnings);
    populateObjectSchema(shape, composed.schema, composed.semantics, composed.traits, composed.samples);
  } catch (error) {
    errors.push({ kind: 'compose-failed', message: `Composing ${name} with its traits failed: ${(error as Error).message}` });
    return;
  }
  errors.push(...relationshipProblems(document.relationships, name!, composed.schema, available));
  // s213-m03 (finding 7): money and its units come only from declared semantics, so say where a declaration is missing.
  const fields = shape.objectSchema ?? {};
  for (const [field, entry] of Object.entries(fields)) {
    const hint = composed.semantics[field]?.ui_hints?.currencyField;
    if (entry.money && !entry.money.currencyField) warnings.push(`${field} is declared money, but ${typeof hint === 'string' ? `the object has no "${hint}" field` : 'no currencyField is declared'}, so it shows as a number with no currency.`);
  }
  for (const [context, extensions] of Object.entries(composed.viewExtensions)) {
    for (const extension of extensions) {
      const amountField = extension.props?.amountField;
      if (!MINOR_UNIT_READERS.has(extension.component) || typeof amountField !== 'string' || !fields[amountField]) continue;
      if (fields[amountField]!.money?.minorUnits || typeof extension.props?.minorUnitsParameter === 'string') continue;
      errors.push({ kind: 'money-units', path: `view_extensions.${context}`,
        message: `${extension.component} (${context}) reads amounts stored in minor units, but "${amountField}" is not declared in minor units, so it would show 100 times too small. If it is stored in minor units, declare it in semantics (ui_hints: component CurrencyAmount, currencyField, minorUnits); if it is in major units, place PriceBadge, which reads major units.` });
    }
  }
  result.contexts = OBJECT_CONTEXTS.filter(context => supportsContext(definition, context));
}

function checkTrait(document: Record<string, unknown>, result: Checked) {
  const { errors, warnings } = result;
  const unknownKeys = checkUnknownKeys(document, TRAIT_KEYS, warnings);
  const name = checkHeader(document.trait, 'trait', ['name', 'version', 'description', 'category'], errors);
  result.name = name;
  if (name && traitRefusal(name)) {
    errors.push({ kind: 'duplicate', path: 'trait.name', message: traitRefusal(name)!.message });
  }
  if (name) {
    const existing = traitEntry(name);
    if (existing?.source === 'shipped') {
      errors.push({ kind: 'shipped-name', path: 'trait.name', message: `A shipped trait is named "${name}" (${existing.shown}), and shipped objects compose it, so yours cannot replace it. Give yours a name of its own.` });
    }
  }
  checkFields(document.schema, name ?? 'The trait', errors);

  if (document.parameters !== undefined) {
    if (!Array.isArray(document.parameters)) {
      errors.push({ kind: 'invalid-field', path: 'parameters', message: '"parameters" must be a list of { name, type, required, description }.' });
    } else {
      document.parameters.forEach((parameter, index) => {
        if (!isMap(parameter) || typeof parameter.name !== 'string' || typeof parameter.type !== 'string') {
          errors.push({ kind: 'invalid-field', path: `parameters[${index}]`, message: `parameters[${index}] needs a "name" and a "type".` });
        }
      });
    }
  }

  const registry = loadComponentRegistry();
  const components = [...registry.names].sort();
  const views = document.view_extensions ?? {};
  if (!isMap(views)) {
    errors.push({ kind: 'invalid-view', path: 'view_extensions', message: '"view_extensions" must map contexts to lists of { component, position, priority, props }.' });
  } else {
    for (const [context, extensions] of Object.entries(views)) {
      if (!(VIEW_CONTEXTS as readonly string[]).includes(context)) {
        errors.push({ kind: 'unknown-context', path: `view_extensions.${context}`, message: `"${context}" is not a context a trait's views extend. Use ${quoted(VIEW_CONTEXTS)}.` });
        continue;
      }
      if (!Array.isArray(extensions)) {
        errors.push({ kind: 'invalid-view', path: `view_extensions.${context}`, message: `view_extensions.${context} must be a list.` });
        continue;
      }
      result.contexts.push(context);
      extensions.forEach((extension, index) => {
        const at = `view_extensions.${context}[${index}]`;
        if (!isMap(extension) || typeof extension.component !== 'string') {
          errors.push({ kind: 'invalid-view', path: at, message: `${at} needs a "component".` });
          return;
        }
        if (registry.names.size && !registry.names.has(extension.component)) {
          errors.push({ kind: 'unknown-component', path: `${at}.component`,
            message: `"${extension.component}" is not a component OODS Foundry ships.${suggestion(extension.component, components)} A trait of yours places only components OODS Foundry ships (catalog.list names them); use map substitution to replace a shipped component id with your implementation.` });
        }
        if (extension.priority !== undefined && typeof extension.priority !== 'number') {
          errors.push({ kind: 'invalid-view', path: `${at}.priority`, message: `${at}.priority must be a number.` });
        }
        if (extension.props !== undefined && !isMap(extension.props)) {
          errors.push({ kind: 'invalid-view', path: `${at}.props`, message: `${at}.props must be a mapping.` });
        }
      });
    }
  }

  for (const dependency of Array.isArray(document.dependencies) ? document.dependencies : []) {
    if (typeof dependency === 'string' && !hasTrait(dependency)) {
      errors.push({ kind: 'unknown-trait', path: 'dependencies', message: `The dependency "${dependency}" is not a shipped trait or one of yours.` });
    }
  }

  const machine = document.state_machine;
  if (machine !== undefined) {
    const states = isMap(machine) && Array.isArray(machine.states) ? machine.states.map(String) : null;
    if (!states || !isMap(machine) || typeof machine.initial !== 'string' || !states.includes(machine.initial)) {
      errors.push({ kind: 'invalid-state-machine', path: 'state_machine', message: 'state_machine needs "states", and an "initial" state that is one of them.' });
    } else {
      for (const transition of Array.isArray(machine.transitions) ? machine.transitions : []) {
        if (!isMap(transition) || !states.includes(String(transition.from)) || !states.includes(String(transition.to))) {
          errors.push({ kind: 'invalid-state-machine', path: 'state_machine.transitions', message: `Every transition must go from one declared state to another (states: ${quoted(states)}).` });
          break;
        }
      }
    }
  }
  if (!result.contexts.length && !errors.length && !unknownKeys.some(key => findClosestMatch(key, TRAIT_KEYS) === 'view_extensions')) {
    warnings.push(`The trait "${name}" extends no view, so it adds fields but places nothing on a screen.`);
  }
}

/** Validate one definition; `register` calls this first and writes only what passes. */
export function validateDefinition(yaml: string, available: readonly string[] = listObjects()): Checked {
  const result: Checked = { kind: null, name: null, valid: false, errors: [], warnings: [], contexts: [], folder: null };
  let document: unknown;
  try {
    document = parseYaml(yaml);
  } catch (error) {
    result.errors.push({ kind: 'malformed', message: `The definition is not valid YAML: ${parseProblem(error)}` });
    return result;
  }
  if (!isMap(document) || (!isMap(document.object) && !isMap(document.trait))) {
    result.errors.push({ kind: 'not-a-definition', message: 'A definition starts with "object:" (an object) or "trait:" (a trait), with a "name:" under it.' });
    return result;
  }
  if (isMap(document.object) && isMap(document.trait)) {
    result.errors.push({ kind: 'not-a-definition', message: 'A definition is an object or a trait, not both: keep "object:" or "trait:".' });
    return result;
  }
  result.document = document;
  if (isMap(document.object)) {
    result.kind = 'object';
    result.folder = userObjectsFolder();
    checkObject(document, result, available);
  } else {
    result.kind = 'trait';
    result.folder = userTraitsFolder();
    checkTrait(document, result);
  }
  result.valid = result.errors.length === 0;
  return result;
}

export async function handle(input: ObjectValidateInput): Promise<ObjectValidateOutput> {
  const { document: _document, ...result } = validateDefinition(input.yaml);
  return result;
}
