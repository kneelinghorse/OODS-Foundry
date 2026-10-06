/**
 * object.register — keep a team's object or trait in its own folder (s213-m03).
 *
 * The definition is validated first (object.validate). An object must then compose in every context it declares: it is
 * written, the registry is re-read, and each context is composed through design.compose. If any of that fails, the
 * folder is put back exactly as it was and nothing is registered (OODS-V215). A name the team has already registered is
 * replaced only with overwrite: true (OODS-C004). The folders live outside the unpacked runtime, so what is registered
 * survives restarts and upgrades.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ToolError } from '../errors/tool-error.js';
import { clearObjectCache, definitionRegistryReport, objectEntry, type DefinitionRegistryReport } from '../objects/object-loader.js';
import { clearTraitCache, traitEntry } from '../objects/trait-loader.js';
import { loadObject } from '../objects/object-loader.js';
import { supportsContext } from '../objects/supported-contexts.js';
import { OBJECT_CONTEXTS, validateDefinition, type DefinitionProblem } from './object.validate.js';
import { handle as compose } from './design.compose.js';

export type ObjectRegisterInput = { yaml: string; overwrite?: boolean };

export type ContextCheck = { context: string; status: 'ok' | 'error'; messages: string[] };

export type ObjectRegisterOutput = {
  kind: 'object' | 'trait';
  name: string;
  file: string;
  status: 'created' | 'updated';
  replaces?: string;
  contexts: ContextCheck[];
  warnings: string[];
  registry: DefinitionRegistryReport;
};

/** Re-read both folders: the next call of any tool sees what is on disk now. */
export function reloadDefinitions(): void {
  clearTraitCache();
  clearObjectCache();
}

/** Compose the object in every context it declares, through the tool agents call. */
async function composeContexts(name: string): Promise<ContextCheck[]> {
  const definition = loadObject(name);
  const contexts: string[] = OBJECT_CONTEXTS.filter(context => supportsContext(definition, context));
  if (supportsContext(definition, 'workflow')) contexts.push('workflow');
  const checks: ContextCheck[] = [];
  for (const context of contexts) {
    const result = await compose({ object: name, context: context as never, options: { transient: true } });
    checks.push({
      context,
      status: result.status === 'ok' ? 'ok' : 'error',
      messages: result.status === 'ok' ? [] : (result.errors ?? []).map(error => `${error.code}: ${error.message}`),
    });
  }
  return checks;
}

export async function handle(input: ObjectRegisterInput): Promise<ObjectRegisterOutput> {
  const checked = validateDefinition(input.yaml);
  const refuse = (errors: DefinitionProblem[], contexts: ContextCheck[] = []) => new ToolError('OODS-V215',
    `${checked.kind === 'trait' ? 'Trait' : 'Object'} ${checked.name ? `"${checked.name}" ` : ''}was not registered: ${errors.map(error => error.message).join(' ')}`,
    { errors, contexts, warnings: checked.warnings });
  if (!checked.valid || !checked.kind || !checked.name) throw refuse(checked.errors);

  const { kind, name } = checked;
  const variable = kind === 'object' ? 'OODS_OBJECTS_DIR' : 'OODS_TRAITS_DIR';
  if (!checked.folder) {
    throw new ToolError('OODS-N023', `No folder is set for your ${kind}s, so "${name}" was not registered. Set ${variable} to a folder outside OODS Foundry's install; the npm launcher sets it to ~/.oods-foundry/${kind}s.`, { variable });
  }

  // A name the team already keeps is written back to the file that declares it, and only when asked to.
  const existing = kind === 'object' ? objectEntry(name) : traitEntry(name);
  const own = existing?.source === 'user' ? existing.file : undefined;
  if (own && !input.overwrite) {
    throw new ToolError('OODS-C004', `Your ${kind} "${name}" is already registered (${own}). Pass overwrite: true to replace it.`, { file: own });
  }
  const file = own ?? path.join(checked.folder, `${name}.${kind}.yaml`);
  if (!own && fs.existsSync(file)) {
    throw new ToolError('OODS-C004', `${file} already exists and does not declare the ${kind} "${name}"; rename or remove it first.`, { file });
  }
  const previous = own ? fs.readFileSync(file) : undefined;
  const restore = () => {
    if (previous) fs.writeFileSync(file, previous); else fs.rmSync(file, { force: true });
    reloadDefinitions();
  };

  try {
    fs.mkdirSync(checked.folder, { recursive: true });
    const partial = `${file}.partial-${process.pid}`;
    fs.writeFileSync(partial, input.yaml.endsWith('\n') ? input.yaml : `${input.yaml}\n`);
    fs.renameSync(partial, file);
  } catch (error) {
    throw new ToolError('OODS-S021', `Could not write ${file}: ${(error as Error).message}. Nothing was registered.`, { file });
  }
  reloadDefinitions();

  let contexts: ContextCheck[] = [];
  try {
    const registered = definitionRegistryReport().issues.filter(issue => issue.severity === 'error' && issue.name === name);
    if (registered.length) {
      restore();
      throw refuse(registered.map(issue => ({ kind: issue.kind === 'duplicate' ? 'duplicate' : 'compose-failed', message: issue.message })));
    }
    if (kind === 'object') {
      contexts = await composeContexts(name);
      const failed = contexts.filter(check => check.status === 'error');
      if (failed.length) {
        restore();
        throw refuse(failed.map(check => ({ kind: 'compose-failed', message: `It does not compose in the ${check.context} context: ${check.messages.join('; ')}` })), contexts);
      }
    }
  } catch (error) {
    if (error instanceof ToolError) throw error;
    restore();
    throw refuse([{ kind: 'compose-failed', message: (error as Error).message }], contexts);
  }

  return {
    kind, name, file,
    status: own ? 'updated' : 'created',
    ...(checked.replaces ? { replaces: checked.replaces } : {}),
    contexts,
    warnings: checked.warnings,
    registry: definitionRegistryReport(),
  };
}
