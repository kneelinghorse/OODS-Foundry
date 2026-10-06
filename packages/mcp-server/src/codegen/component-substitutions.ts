import fs from 'node:fs';
import { parseFragment } from 'parse5';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { UiSchema } from '../schemas/generated.js';
import { loadMappings } from '../tools/map.shared.js';
import { validateSubstitution, type ComponentSubstitution, type ComponentImplementation } from '../tools/component-substitution.js';
import { inspectShadcn, type ShadcnClosure } from '../tools/map.shadcn.js';
import { packageShadcnApplication } from './shadcn-application.js';
import type { CodegenResult } from './types.js';

export type RecordedSubstitution = { mappingId: string; substitution: ComponentSubstitution };
export type EmittedSubstitution = { mappingId: string; component: string; source: Omit<ComponentImplementation, 'shadcn' | 'localPath'> & { shadcn?: ShadcnClosure }; packageContentHash?: string };
export const sourceSpecifier = (source: EmittedSubstitution['source']): string => source.shadcn?.module ?? source.package!;
export const sourceVersion = (source: EmittedSubstitution['source']): string => source.shadcn?.closureHash ?? source.version!;
export const substitutionPackage = (specifier: string): string => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;

/** A component has one mapping owner; ambiguity must never depend on store ordering. */
export function activeSubstitutions(schema?: UiSchema): RecordedSubstitution[] {
  const pinned = new Map<string, RecordedSubstitution>();
  const visit = (node: UiSchema['screens'][number]) => {
    const entry = node.meta?.substitution as RecordedSubstitution | undefined;
    if (entry) {
      validateSubstitution(entry.substitution);
      if (entry.substitution.component !== node.component) throw new Error(`Substitution on '${node.id}' does not match its OODS Foundry component.`);
      const previous = pinned.get(node.component);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error(`Conflicting pinned substitutions for ${node.component}.`);
      pinned.set(node.component, entry);
    }
    node.children?.forEach(visit);
  };
  schema?.screens.forEach(visit);
  const entries = loadMappings().mappings.filter(entry => entry.substitution && !pinned.has(entry.substitution.component))
    .map(entry => ({ mappingId: entry.id, substitution: entry.substitution! })).concat([...pinned.values()]);
  const owners = new Set<string>();
  for (const entry of entries) {
    validateSubstitution(entry.substitution);
    const key = entry.substitution.component;
    if (owners.has(key)) throw new Error(`Multiple mappings substitute ${key}; put both framework implementations in one mapping.`);
    owners.add(key);
  }
  return entries.sort((a, b) => a.mappingId.localeCompare(b.mappingId));
}

export function annotateSubstitutions(schema: UiSchema): Array<{ nodeId: string; mappingId: string; component: string }> {
  const entries = activeSubstitutions(schema);
  const summary: Array<{ nodeId: string; mappingId: string; component: string }> = [];
  const visit = (node: UiSchema['screens'][number]) => {
    const matches = entries.filter(entry => entry.substitution.component === node.component);
    if (matches.length) {
      const entry = matches[0]!;
      node.meta = { ...node.meta, substitution: structuredClone(entry) };
      summary.push({ nodeId: node.id, mappingId: entry.mappingId, component: node.component });
    }
    node.children?.forEach(visit);
  };
  schema.screens.forEach(visit);
  return summary;
}

function exactVersion(source: ComponentImplementation): string {
  if (source.version) return source.version;
  const name = substitutionPackage(source.package!);
  try {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    // Read the installed package identity without requiring a CommonJS export or an exposed package.json subpath.
    for (const directory of source.localPath ? [source.localPath] : (require.resolve.paths(name) ?? []).map(directory => path.join(directory, name))) {
      const file = path.join(directory, 'package.json');
      if (fs.existsSync(file)) {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (manifest.name === name && typeof manifest.version === 'string') return manifest.version;
      }
    }
  } catch { /* Name the missing pin below, rather than silently inventing a dependency version. */ }
  throw new Error(`Mapping for ${source.package} needs an exact version or an installed package with a readable manifest.`);
}

const literal = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

/**
 * Lower only the framework import boundary: bindings, normalized props and action contracts remain Forge's. The names this
 * adds to generated code are the customer's code, so they name nothing after the product (s221-m03, #2482 ruling 8).
 */
export function substituteGeneratedComponents(result: CodegenResult, schema: UiSchema, typescript: boolean): EmittedSubstitution[] {
  if (result.status !== 'ok') return [];
  const framework = result.framework;
  const entries = activeSubstitutions(schema);
  if (framework !== 'react') {
    const components = new Set<string>();
    const visit = (node: UiSchema['screens'][number]) => { components.add(node.component); node.children?.forEach(visit); };
    schema.screens.forEach(visit);
    // Screen action controls are emitted outside the schema tree.
    for (const match of result.code.matchAll(/import \{ ([^}]+) \} from '@oods\/components-vue'/g)) for (const name of match[1]!.split(',')) components.add(name.trim().split(/\s+as\s+/)[0]!);
    if (framework === 'html') {
      const visitHtml = (node: { attrs?: Array<{ name: string; value: string }>; childNodes?: any[] }) => {
        const component = node.attrs?.find(attr => attr.name === 'data-oods-component')?.value;
        if (component) components.add(component);
        node.childNodes?.forEach(visitHtml);
      };
      visitHtml(parseFragment(result.code));
    }
    for (const entry of entries) if (entry.substitution.react?.shadcn && (framework === 'html' || !entry.substitution.vue) && components.has(entry.substitution.component)) {
      result.warnings.push({ code: 'OODS-V218', component: entry.substitution.component, message: `Mapping '${entry.mappingId}' is React-only shadcn source; ${framework} output keeps the OODS Foundry component.` });
    }
  }
  if (framework === 'html') return [];
  const used = new Map<string, EmittedSubstitution>();
  const transform = (code: string): string => code.replace(new RegExp(`import \\{ ([^}]+) \\} from '@oods/components-${framework}';`, 'g'), (_match, names: string) => {
    const remaining: string[] = [];
    const mapped: Array<EmittedSubstitution & { local: string; alias: string }> = [];
    for (const declaration of names.split(',').map(name => name.trim())) {
      const [component, local = component] = declaration.split(/\s+as\s+/) as [string, string?];
      const entry = entries.find(entry => entry.substitution.component === component && entry.substitution[framework]);
      if (!entry) { remaining.push(declaration); continue; }
      const source = entry.substitution[framework]!;
      const { localPath: _localPath, shadcn, ...implementation } = source;
      let emitted: EmittedSubstitution;
      if (shadcn) {
        const { project: _project, ...closure } = inspectShadcn(shadcn, source.export);
        emitted = { mappingId: entry.mappingId, component, source: { ...implementation, shadcn: closure } };
      } else emitted = { mappingId: entry.mappingId, component, source: { ...implementation, version: exactVersion(source) } };
      used.set(component, emitted);
      mapped.push({ ...emitted, local, alias: `__Mapped${component}` });
    }
    if (!mapped.length) return _match;
    const lines = remaining.length ? [`import { ${remaining.join(', ')} } from '@oods/components-${framework}';`] : [];
    const groups = new Map<string, string[]>();
    for (const entry of mapped) {
      const group = groups.get(sourceSpecifier(entry.source)) ?? [];
      group.push(`${entry.source.export} as ${entry.alias}`);
      groups.set(sourceSpecifier(entry.source), group);
    }
    for (const [source, imports] of [...groups].sort(([a], [b]) => a.localeCompare(b))) lines.push(`import { ${imports.join(', ')} } from '${source}';`);
    if (framework === 'react' && typescript) lines.push(`import type { ${mapped.map(entry => `${entry.component} as __Contract${entry.component}`).join(', ')} } from '@oods/components-react';`);
    if (framework === 'vue') lines.push("import { defineComponent as __vueDefineComponent, h as __vueH } from 'vue';");
    lines.push(`function __mappedProps(props${typescript ? ': Record<string, any>' : ''}, source${typescript ? ': { passthrough?: boolean; props?: Record<string, { name: string; values?: Record<string, any> }> }' : ''}) {
  const result${typescript ? ': Record<string, any>' : ''} = Object.create(null);
  for (const [name, value] of Object.entries(props)) {
    const translation = source.props && Object.prototype.hasOwnProperty.call(source.props, name) ? source.props[name] : undefined;
    if (!translation && source.passthrough === false && name !== 'children' && !/^on[A-Z]/.test(name)) continue;
    result[translation?.name ?? name] = translation?.values && Object.prototype.hasOwnProperty.call(translation.values, String(value)) ? translation.values[String(value)] : value;
  }
  return result;
}`);
    for (const entry of mapped) {
      const props = { ...entry.source.props };
      // Vue's controlled fields emit modelValue; mappings use the shared value/checked contract vocabulary.
      const modelProp = entry.component === 'Checkbox' || entry.component === 'Switch' ? 'checked' : ['Input', 'Select', 'SegmentedControl', 'Combobox', 'Textarea', 'DatePicker'].includes(entry.component) ? 'value' : undefined;
      if (framework === 'vue' && modelProp && props[modelProp]) props.modelValue = props[modelProp]!;
      // JSON.parse preserves scalar-map keys such as __proto__ as own properties.
      const source = `JSON.parse(${literal(JSON.stringify({ passthrough: entry.source.passthrough, props }))})`;
      lines.push(framework === 'react'
        ? `const ${entry.local} = React.forwardRef${typescript ? `<unknown, React.ComponentProps<typeof __Contract${entry.component}>>` : ''}((props, ref) => React.createElement(${entry.alias}${typescript ? ' as unknown as React.ComponentType<any>' : ''}, { ...__mappedProps(props, ${source}), ref }));`
        : `const ${entry.local} = __vueDefineComponent({ inheritAttrs: false, setup(_, { attrs, slots }) { return () => __vueH(${entry.alias}, __mappedProps(attrs, ${source}), slots); } });`);
    }
    return lines.join('\n');
  });
  result.code = transform(result.code);
  if (result.files) result.files = result.files.map(file => ({ ...file, contents: /\.(tsx?|jsx?|vue)$/.test(file.path) ? transform(file.contents) : file.contents }));
  const substitutions = [...used.values()].sort((a, b) => a.component.localeCompare(b.component));
  if (!substitutions.length) return [];
  // Next App Router treats imported modules as server components until this boundary is explicit.
  // Only files that actually import the team's shadcn source need the directive; Vite accepts it too.
  if (framework === 'react' && substitutions.some(entry => entry.source.shadcn)) {
    const client = (code: string) => substitutions.some(entry => entry.source.shadcn && code.includes(`from '${sourceSpecifier(entry.source)}'`))
      ? `'use client';\n\n${code.replace(/^['"]use client['"];?\s*/, '')}` : code;
    result.code = client(result.code);
    if (result.files) result.files = result.files.map(file => ({ ...file, contents: /\.[jt]sx?$/.test(file.path) ? client(file.contents) : file.contents }));
  }
  for (const entry of substitutions) if (!result.imports.includes(sourceSpecifier(entry.source))) result.imports.push(sourceSpecifier(entry.source));
  // Remove a fully replaced Forge import, but retain its component stylesheet for the surrounding app.
  const contents = result.files?.map(file => file.contents).join('\n') ?? result.code;
  if (!contents.includes(`from '@oods/components-${framework}'`)) result.imports = result.imports.filter(name => name !== `@oods/components-${framework}`);
  if (framework === 'vue' && !result.imports.includes('vue')) result.imports.push('vue');
  for (const file of result.files ?? []) if (file.path === 'package.json') {
    const manifest = JSON.parse(file.contents);
    for (const { source } of substitutions) if (!source.shadcn) manifest.dependencies[substitutionPackage(source.package!)] = source.version;
    file.contents = JSON.stringify(manifest, null, 2) + '\n';
  }
  if (result.files?.some(file => file.path === 'package.json')) packageShadcnApplication(result, substitutions, entries);
  return substitutions;
}
