/** Trait parameters at the MCP authoring boundary. Defaults match the trait composer; no coercion or mutation. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvImport, { type ValidateFunction } from 'ajv';
import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { isKnownBrand } from '../lib/brand-registry.js';
import { loadTrait, traitEntry } from './trait-loader.js';

const folder = fileURLToPath(new URL('../../../../schemas/traits/', import.meta.url));
const options = { strict: false, allErrors: true, allowUnionTypes: true, $data: true };
const draft7 = new (AjvImport as any)(options);
const draft2020 = new (Ajv2020Import as any)(options);
for (const ajv of [draft7, draft2020]) {
  (addFormatsImport as any)(ajv);
  ajv.addFormat('oods-brand', { type: 'string', validate: isKnownBrand });
}
const validators = new Map<string, ValidateFunction>();

export function parameterProblems(name: string, supplied: Record<string, unknown>): Array<{ path: string; message: string }> {
  const definition = loadTrait(name);
  const parameters = Object.fromEntries(definition.parameters.filter(p => p.default !== undefined).map(p => [p.name, p.default]));
  Object.assign(parameters, supplied);
  const key = definition.trait.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const file = path.join(folder, `${key}.parameters.schema.json`);
  let validate = validators.get(key);
  if (!validate) {
    if (traitEntry(name)?.source === 'shipped' && fs.existsSync(file)) {
      const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!String(schema.$schema).includes('2020-12')) schema.$schema = 'http://json-schema.org/draft-07/schema#';
      validate = (String(schema.$schema).includes('2020-12') ? draft2020 : draft7).compile(schema);
      validators.set(key, validate!);
    } else {
      // Team traits and the few shipped traits without a dedicated schema retain their declared parameter contract.
      const properties = Object.fromEntries(definition.parameters.map(p => [p.name, {
        type: p.type === 'enum' ? 'string' : p.type.endsWith('[]') ? 'array' : p.type.startsWith('Record<') ? 'object' : p.type,
        ...(p.type === 'string[]' ? { items: { type: 'string' } } : {}), ...p.validation,
      }]));
      validate = draft7.compile({ type: 'object', properties,
        required: definition.parameters.filter(p => p.required && p.default === undefined).map(p => p.name) });
    }
  }
  const problems = validate!(parameters) ? [] : (validate!.errors ?? []).map(error => ({
    path: error.instancePath || '/', message: `${definition.trait.name}${error.instancePath}: ${error.message} (${JSON.stringify(error.params)})`,
  }));
  return traitEntry(name)?.source === 'shipped' ? [...problems, ...levelProblems(definition.trait.name, parameters), ...inAdvanceProblems(definition.trait.name, parameters), ...orderProblems(definition.trait.name, parameters), ...actionProblems(definition.trait.name, parameters)] : problems;
}

/**
 * s245-m01: a thing's approval rule may name only the levels its trait declares in `levels`. A parameter schema cannot
 * hold one parameter's keys or values to another parameter's list, so the shipped trait's references are checked here,
 * each problem naming the level that is not declared and where it is named.
 */
const LEVEL_REFERENCES: Readonly<Record<string, ReadonlyArray<{ parameter: string; at: 'keys' | 'values' | 'items'; names: string }>>> = {
  Approvable: [
    { parameter: 'levelDefinitions', at: 'keys', names: 'defines' },
    { parameter: 'requiredLevels', at: 'values', names: 'requires' },
    { parameter: 'approvalsNeeded', at: 'keys', names: 'counts' },
    { parameter: 'agentLevels', at: 'items', names: 'lets an agent give' },
  ],
};

function levelProblems(trait: string, parameters: Record<string, unknown>): Array<{ path: string; message: string }> {
  const references = LEVEL_REFERENCES[trait];
  const levels = parameters.levels;
  if (!references || !Array.isArray(levels) || !levels.every(level => typeof level === 'string')) return [];
  const declared = new Set(levels as string[]);
  return references.flatMap(({ parameter, at, names }) => {
    const value = parameters[parameter];
    const named: Array<[string, unknown]> = Array.isArray(value) ? (at === 'items' ? value.map((level, index) => [String(index), level]) : [])
      : value && typeof value === 'object' ? Object.entries(value).map(([key, level]) => [key, at === 'keys' ? key : level]) : [];
    return named.filter(([, level]) => typeof level === 'string' && !declared.has(level)).map(([key, level]) => ({
      path: `/${parameter}/${key}`,
      message: `${trait}/${parameter}/${key}: ${names} the level "${level}", which levels does not declare (${[...declared].join(', ')}).`,
    }));
  });
}

/**
 * s248-m01: a thing's rule may open a change to a yes given in advance by a grant's standing yes (`inAdvance`). A change
 * the rule does not name needs no yes, so there is nothing to give in advance: opening it is refused, naming it. A change
 * whose level is the rule's last, most deliberate one (sign-off, in every shipped rule) is always asked, so opening it is
 * refused too, where the rule declares two or more levels: a rule with one level has no more deliberate one to keep.
 * `levels` is in order, least deliberate first. A change is named by the rule's own keys, never an inherited one. A parameter schema cannot hold one
 * parameter's items to another's keys, so both are checked here.
 */
function inAdvanceProblems(trait: string, parameters: Record<string, unknown>): Array<{ path: string; message: string }> {
  const opened = parameters.inAdvance;
  if (trait !== 'Approvable' || !Array.isArray(opened)) return [];
  const required = parameters.requiredLevels && typeof parameters.requiredLevels === 'object' && !Array.isArray(parameters.requiredLevels)
    ? parameters.requiredLevels as Record<string, unknown> : {};
  const levels = Array.isArray(parameters.levels) ? parameters.levels : [];
  const last = levels.length > 1 ? levels[levels.length - 1] : undefined;
  return opened.flatMap((change, index) => {
    if (typeof change !== 'string') return [];
    const level = Object.hasOwn(required, change) ? required[change] : undefined;
    if (level === undefined) return [{ path: `/inAdvance/${index}`,
      message: `${trait}/inAdvance/${index}: opens "${change}" to a yes given in advance, but requiredLevels does not name it, so it needs no yes; ${Object.keys(required).length ? `requiredLevels names ${Object.keys(required).join(', ')}` : 'requiredLevels names no change'}.` }];
    if (last !== undefined && level === last) return [{ path: `/inAdvance/${index}`,
      message: `${trait}/inAdvance/${index}: opens "${change}" to a yes given in advance, but it needs "${level}", the rule's last and most deliberate level, which is always asked.` }];
    return [];
  });
}

/**
 * s247-m01 (next step 1860): a declared order may name only the states its lifecycle declares. The parameter schema holds
 * transitionRules to a map of lists of names, and cannot hold those names to the states parameter, so each key and target
 * is checked here, the problem naming the state that is not declared and where it is named. A team object whose order has
 * a typo is refused where its definition is validated, registered or imported; it was accepted before 0.14.0.
 */
function orderProblems(trait: string, parameters: Record<string, unknown>): Array<{ path: string; message: string }> {
  const states = parameters.states;
  const rules = parameters.transitionRules;
  if (trait !== 'Stateful' || !Array.isArray(states) || !states.every(state => typeof state === 'string')) return [];
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return [];
  const declared = new Set(states as string[]);
  const list = [...declared].join(', ');
  return Object.entries(rules as Record<string, unknown>).flatMap(([from, targets]) => [
    ...(declared.has(from) ? [] : [{ path: `/transitionRules/${from}`, message: `${trait}/transitionRules/${from}: "${from}" is not one of the lifecycle's states (${list}).` }]),
    ...(Array.isArray(targets) ? targets : []).flatMap((target, index) => typeof target === 'string' && !declared.has(target)
      ? [{ path: `/transitionRules/${from}/${index}`, message: `${trait}/transitionRules/${from}/${index}: "${target}" is not one of the lifecycle's states (${list}).` }]
      : []),
  ]);
}

/**
 * s249-m03: a lifecycle's declared actions (Stateful 2.5.0 `actions`) move a record within its declared order. Each moves
 * to a state the lifecycle declares, from states it declares, by moves the order allows; with no `from`, an action is
 * offered from every state whose declared targets include its `to`, and one that no state reaches is refused. Ids are
 * unique. An action needs `transitionRules`: without an order there is nothing to move within. The fields an action names
 * and its event are checked against the composed object (objects/state-actions.ts).
 */
function actionProblems(trait: string, parameters: Record<string, unknown>): Array<{ path: string; message: string }> {
  const actions = parameters.actions;
  if (trait !== 'Stateful' || !Array.isArray(actions)) return [];
  const states = Array.isArray(parameters.states) ? (parameters.states as unknown[]).map(String) : [];
  const rules = parameters.transitionRules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return [{ path: '/actions', message: `${trait}/actions: an action moves a record within its declared order, so it needs transitionRules.` }];
  }
  const order = rules as Record<string, unknown>;
  const targets = (from: string) => Array.isArray(order[from]) ? (order[from] as unknown[]).map(String) : [];
  const ids = new Set<string>();
  return actions.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const action = raw as Record<string, unknown>;
    const at = `/actions/${index}`;
    const problems: Array<{ path: string; message: string }> = [];
    if (typeof action.id === 'string') {
      if (ids.has(action.id)) problems.push({ path: `${at}/id`, message: `${trait}${at}/id: "${action.id}" names another action too.` });
      ids.add(action.id);
    }
    const to = typeof action.to === 'string' ? action.to : undefined;
    if (to !== undefined && !states.includes(to)) problems.push({ path: `${at}/to`, message: `${trait}${at}/to: "${to}" is not one of the lifecycle's states (${states.join(', ')}).` });
    const from = Array.isArray(action.from) ? (action.from as unknown[]).map(String) : undefined;
    for (const [position, state] of (from ?? []).entries()) {
      if (!states.includes(state)) problems.push({ path: `${at}/from/${position}`, message: `${trait}${at}/from/${position}: "${state}" is not one of the lifecycle's states (${states.join(', ')}).` });
      else if (to !== undefined && !targets(state).includes(to)) problems.push({ path: `${at}/from/${position}`, message: `${trait}${at}/from/${position}: the declared order does not move "${state}" to "${to}"; add "${to}" to transitionRules.${state}, or take "${state}" out of from.` });
    }
    if (!from && to !== undefined && states.includes(to) && !states.some(state => targets(state).includes(to))) {
      problems.push({ path: `${at}/to`, message: `${trait}${at}/to: no state of the declared order moves to "${to}", so the action is offered from none; add "${to}" to the transitionRules of the states it should move from.` });
    }
    return problems;
  });
}
