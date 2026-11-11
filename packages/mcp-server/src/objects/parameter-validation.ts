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
  return traitEntry(name)?.source === 'shipped' ? [...problems, ...levelProblems(definition.trait.name, parameters)] : problems;
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
