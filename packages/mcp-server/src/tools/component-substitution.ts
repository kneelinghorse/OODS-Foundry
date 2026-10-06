/** A Forge-to-team translation, separate from Stage1's external-to-trait hints. */
import { componentContracts } from '@oods/component-contracts';
import type { ComponentContract } from '@oods/component-contracts';
import { ToolError } from '../errors/tool-error.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export type PropTranslation = { name: string; values?: Record<string, string | number | boolean | null> };
export type ComponentImplementation = {
  package?: string;
  shadcn?: { project: string; module: string };
  export: string;
  /** Exact consumer dependency version. Required by code generation when not installed locally. */
  version?: string;
  /** Absolute built-package directory used by preview; never emitted as a consumer import. */
  localPath?: string;
  /** Unlisted props retain their names by default. False drops unlisted optional props. */
  passthrough?: boolean;
  props?: Record<string, PropTranslation>;
};
export type ComponentSubstitution = {
  component: string;
  react?: ComponentImplementation;
  vue?: ComponentImplementation;
};

const identifier = /^[A-Za-z_$][\w$]*$/;
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function fail(field: string, message: string): never {
  throw new ToolError('OODS-V001', `${field}: ${message}`, { field, reason: 'component-substitution' });
}

export function validateSubstitution(value: unknown): asserts value is ComponentSubstitution {
  if (!object(value)) fail('substitution', 'expected an object');
  for (const key of Object.keys(value)) if (!['component', 'react', 'vue'].includes(key)) fail(`substitution.${key}`, 'unknown field');
  const contract = Object.values(componentContracts).find(item => item.id === value.component) as ComponentContract | undefined;
  if (!contract) fail('substitution.component', 'name a shipped OODS Foundry component');
  if (!value.react && !value.vue) fail('substitution', 'provide a React or Vue implementation');
  for (const framework of ['react', 'vue'] as const) {
    const source = value[framework];
    if (source === undefined) continue;
    const prefix = `substitution.${framework}`;
    if (!object(source)) fail(prefix, 'expected an implementation object');
    for (const key of Object.keys(source)) if (!['package', 'shadcn', 'export', 'version', 'localPath', 'passthrough', 'props'].includes(key)) fail(`${prefix}.${key}`, 'unknown field');
    if (source.localPath !== undefined && (typeof source.localPath !== 'string' || !path.isAbsolute(source.localPath))) fail(`${prefix}.localPath`, 'expected an absolute package directory');
    if (source.shadcn !== undefined) {
      const invalid = (message: string): never => { throw new ToolError('OODS-V219', `${object(source.shadcn) && typeof source.shadcn.project === 'string' ? path.join(source.shadcn.project, 'components.json') : prefix}:1: ${message}`); };
      if (framework !== 'react') invalid('vue.shadcn is not supported: shadcn sources are React only');
      if (source.package !== undefined || source.version !== undefined || source.localPath !== undefined) invalid('shadcn is exclusive with package, version and localPath');
      if (!object(source.shadcn) || typeof source.shadcn.project !== 'string' || !path.isAbsolute(source.shadcn.project) || typeof source.shadcn.module !== 'string' || !source.shadcn.module) invalid('shadcn requires an absolute project and a module import');
      for (const key of Object.keys(source.shadcn as object)) if (!['project', 'module'].includes(key)) invalid(`unknown shadcn field '${key}'`);
    } else if (typeof source.package !== 'string' || !packageName.test(source.package)) fail(`${prefix}.package`, 'expected a bare package name or package subpath');
    if (typeof source.export !== 'string' || !identifier.test(source.export)) fail(`${prefix}.export`, 'expected an export identifier (or default)');
    if (source.version !== undefined && (typeof source.version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(source.version))) fail(`${prefix}.version`, 'expected an exact semantic version');
    if (source.passthrough !== undefined && typeof source.passthrough !== 'boolean') fail(`${prefix}.passthrough`, 'expected a boolean');
    if (source.props !== undefined && !object(source.props)) fail(`${prefix}.props`, 'expected a map from OODS Foundry props to translations');
    const props = (source.props ?? {}) as Record<string, unknown>;
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const bundled = path.resolve(directory, '../registry/component-prop-types.v1.json');
    const catalog = JSON.parse(fs.readFileSync(fs.existsSync(bundled) ? bundled : path.resolve(directory, '../../registry/component-prop-types.v1.json'), 'utf8'));
    const catalogProps = catalog.components[contract.id]?.[framework] ?? {};
    const destinations = new Set<string>();
    for (const [name, translation] of Object.entries(props)) {
      const field = `${prefix}.props.${name}`;
      const event = /^on[A-Z]/.test(name) && Object.hasOwn(catalogProps, name);
      if (!contract.props.includes(name) && !event) fail(field, `unknown OODS Foundry prop for ${contract.id}`);
      if (event && object(translation) && translation.values !== undefined) fail(`${field}.values`, 'event translations may rename only; value maps cannot translate callbacks');
      if (!object(translation) || typeof translation.name !== 'string' || !identifier.test(translation.name)) fail(field, 'expected { name, values? }, without executable expressions');
      for (const key of Object.keys(translation)) if (!['name', 'values'].includes(key)) fail(`${field}.${key}`, 'unknown field');
      if (destinations.has(translation.name)) fail(field, 'two OODS Foundry props cannot overwrite the same team prop');
      destinations.add(translation.name);
      if (source.passthrough !== false && translation.name !== name && contract.props.includes(translation.name) && !Object.hasOwn(props, translation.name)) fail(field, 'destination collides with a passed-through OODS Foundry prop');
      if (translation.values !== undefined && (!object(translation.values) || Object.values(translation.values).some(item => item !== null && (!['string', 'boolean', 'number'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item)))))) fail(`${field}.values`, 'expected a map of JSON scalar values');
    }
    if (source.passthrough === false) for (const name of contract.requiredProps ?? []) {
      if (!Object.hasOwn(props, name)) fail(`${prefix}.props.${name}`, 'required OODS Foundry prop has no translation');
    }
  }
}

/** Pure data translation used by emitters and contract scenarios. Unmapped values retain their original value. */
export function translateProps(props: Record<string, unknown>, source: ComponentImplementation): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const [name, value] of Object.entries(props)) {
    const translation = source.props && Object.hasOwn(source.props, name) ? source.props[name] : undefined;
    if (!translation && source.passthrough === false && name !== 'children' && !/^on[A-Z]/.test(name)) continue;
    result[translation?.name ?? name] = translation?.values && Object.hasOwn(translation.values, String(value))
      ? translation.values[String(value)] : value;
  }
  return result;
}
