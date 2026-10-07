/** File-only drafting is staged separately; only explicit apply mutates accepted team definitions. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump } from 'js-yaml';
import { draftSource, type Draft, type ImportResult } from '../importer/draft.js';
import { canonical, hash, ImportProblem, type SourceInput } from '../importer/source.js';
import { listObjects, loadObject, objectEntry, userObjectsFolder } from '../objects/object-loader.js';
import { composeObject } from '../objects/trait-composer.js';
import { withDefinitionWrite } from '../objects/definition-write.js';
import type { ObjectDefinition } from '../objects/types.js';
import { ToolError } from '../errors/tool-error.js';
import { validateDefinition } from './object.validate.js';
import { reloadDefinitions } from './object.register.js';
import { handle as compose } from './design.compose.js';

export type ObjectImportInput =
  | { action: 'draft'; source: SourceInput }
  | { action: 'show'; importId: string; object: string }
  | { action: 'apply'; importId: string; objects: Array<{ name: string; proposals?: string[] }>; overwrite?: boolean; confirmShipped?: string[] };
export type ImportDiff = { name: string; status: 'new' | 'changed' | 'unchanged'; fields: { added: string[]; removed: string[]; changed: string[] }; screens: string[]; traitsChanged: boolean; relationshipsChanged: boolean };
const contexts = ['list', 'detail', 'form'] as const;

function stagingRoot(): string {
  // A configurable Foundry home supports portable installations; the launcher/user decides it, never the source input.
  return path.join(path.resolve(process.env.OODS_FOUNDRY_HOME || path.join(os.homedir(), '.oods-foundry')), 'imports');
}
function stagedPath(importId: string): string {
  if (!/^import-[a-f0-9]{64}$/.test(importId)) throw new ToolError('OODS-V220', 'Invalid import id; use the id returned by draft.');
  return path.join(stagingRoot(), importId);
}
function stage(result: ImportResult): { importId: string; directory: string } {
  const bytes = canonical(result);
  const importId = `import-${hash(bytes)}`;
  const directory = stagedPath(importId);
  fs.mkdirSync(stagingRoot(), { recursive: true, mode: 0o700 });
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isSymbolicLink() || hash(fs.readFileSync(path.join(directory, 'import.json'))) !== importId.slice(7)) throw new ToolError('OODS-V220', 'Existing staging content failed its hash check; draft into a clean Foundry home.');
    return { importId, directory };
  }
  const partial = fs.mkdtempSync(path.join(stagingRoot(), '.partial-'));
  try {
    fs.mkdirSync(path.join(partial, 'objects'));
    for (const draft of result.drafts) fs.writeFileSync(path.join(partial, 'objects', `${draft.name}.object.yaml`), draft.yaml, { mode: 0o600 });
    fs.writeFileSync(path.join(partial, 'hub.json'), canonical(result.hub), { mode: 0o600 });
    fs.writeFileSync(path.join(partial, 'report.json'), canonical({ counts: result.counts, elements: result.report }), { mode: 0o600 });
    fs.writeFileSync(path.join(partial, 'order.json'), canonical({ objects: result.drafts.map(draft => draft.name), cycles: result.cycles }), { mode: 0o600 });
    fs.writeFileSync(path.join(partial, 'import.json'), bytes, { mode: 0o600 });
    fs.renameSync(partial, directory);
  } finally { fs.rmSync(partial, { recursive: true, force: true }); }
  return { importId, directory };
}
function read(importId: string): ImportResult {
  const directory = stagedPath(importId);
  try {
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('staging folder is a symbolic link');
    const file = path.join(directory, 'import.json');
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('staged content is a symbolic link');
    const bytes = fs.readFileSync(file);
    if (hash(bytes) !== importId.slice(7)) throw new Error('content hash mismatch');
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) { throw new ToolError('OODS-V220', `Cannot read staged import ${importId}: ${(error as Error).message}. Run draft again.`); }
}

/** Differences describe the unaccepted base draft against the effective registered object, including accepted traits. */
export function diffDraft(draft: Draft): ImportDiff {
  const existing = objectEntry(draft.name);
  if (!existing) return { name: draft.name, status: 'new', fields: { added: Object.keys(draft.definition.schema).sort(), removed: [], changed: [] }, screens: [...contexts], traitsChanged: false, relationshipsChanged: !!draft.dependencies.length };
  const prior = loadObject(draft.name), before = composeObject(prior), after = composeObject(draft.definition);
  const oldFields = before.schema, newFields = after.schema;
  const fields = {
    added: Object.keys(newFields).filter(field => !Object.hasOwn(oldFields, field)).sort(),
    removed: Object.keys(oldFields).filter(field => !Object.hasOwn(newFields, field)).sort(),
    changed: Object.keys(newFields).filter(field => Object.hasOwn(oldFields, field) && canonical([oldFields[field], before.semantics[field]]) !== canonical([newFields[field], after.semantics[field]])).sort(),
  };
  const traitsChanged = canonical(prior.traits) !== canonical(draft.definition.traits);
  const relationshipsChanged = canonical(prior.relationships ?? []) !== canonical(draft.definition.relationships ?? []);
  const metadataChanged = canonical([prior.object, prior.metadata, prior.samples, prior.tokens]) !== canonical([draft.definition.object, draft.definition.metadata, draft.definition.samples, draft.definition.tokens]);
  const changed = traitsChanged || relationshipsChanged || metadataChanged || Object.values(fields).some(list => list.length);
  return { name: draft.name, status: changed ? 'changed' : 'unchanged', fields, screens: changed ? [...contexts] : [], traitsChanged, relationshipsChanged };
}

async function apply(input: Extract<ObjectImportInput, { action: 'apply' }>, imported: ImportResult) {
  return withDefinitionWrite(async () => {
    reloadDefinitions();
    const folder = userObjectsFolder();
    if (!folder) throw new ToolError('OODS-N023', 'Set OODS_OBJECTS_DIR before applying an import.');
    if (!input.objects?.length) throw new ToolError('OODS-V220', 'Accept at least one named object explicitly.');
    const selected = new Map(input.objects.map(selection => [selection.name, selection]));
    if (selected.size !== input.objects.length) throw new ToolError('OODS-V220', 'An object may be accepted only once in a batch.');
    const drafts = imported.drafts.filter(draft => selected.has(draft.name));
    if (drafts.length !== selected.size) throw new ToolError('OODS-V220', 'An accepted object is not in this import. Use show and the staged order.json.');
    const available = [...new Set([...listObjects(), ...selected.keys()])];
    const writes: Array<{ name: string; file: string; yaml: string; previous?: Buffer }> = [];
    for (const draft of drafts) {
      const selection = selected.get(draft.name)!;
      const definition: ObjectDefinition = structuredClone(draft.definition);
      const ids = new Set(selection.proposals ?? []);
      if (ids.size !== (selection.proposals ?? []).length) throw new ToolError('OODS-V220', `Repeated proposal for ${draft.name}.`);
      for (const id of ids) {
        const proposal = draft.proposals.find(p => p.id === id);
        if (!proposal || !proposal.valid) throw new ToolError('OODS-V220', `Proposal ${id} for ${draft.name} is missing or invalid; review show before accepting it.`);
        if (definition.traits.some(trait => trait.name === proposal.trait.name)) throw new ToolError('OODS-V220', `Two accepted proposals configure ${proposal.trait.name} on ${draft.name}; choose one.`);
        definition.traits.push(proposal.trait);
      }
      const yaml = dump(definition, { noRefs: true, sortKeys: true, lineWidth: 120 });
      const checked = validateDefinition(yaml, available);
      if (!checked.valid) throw new ToolError('OODS-V220', `${draft.name} was not applied: ${checked.errors.map(error => error.message).join(' ')}`, { errors: checked.errors });
      const existing = objectEntry(draft.name);
      if ((existing?.source === 'shipped' || existing?.replaces) && !input.confirmShipped?.includes(draft.name)) throw new ToolError('OODS-C006', `Accepting ${draft.name} replaces a shipped object. Name it in confirmShipped to confirm this specific replacement.`, { name: draft.name });
      const own = existing?.source === 'user' ? existing.file : undefined;
      if (own && !input.overwrite) throw new ToolError('OODS-C004', `${draft.name} is already registered by your team; pass overwrite: true to replace it.`);
      const file = own ?? path.join(folder, `${draft.name}.object.yaml`);
      if (fs.existsSync(file) && (!own || fs.lstatSync(file).isSymbolicLink())) throw new ToolError('OODS-C004', `Refusing occupied or symbolic-link target ${file}.`);
      writes.push({ name: draft.name, file, yaml, ...(own ? { previous: fs.readFileSync(file) } : {}) });
    }
    // Every validation above finishes before the first definition changes. Snapshot exact bytes for rollback.
    const changed: typeof writes = [];
    const checks: Array<{ name: string; contexts: string[] }> = [];
    try {
      for (const write of writes) {
        const partial = `${write.file}.import-partial-${process.pid}`;
        try { fs.writeFileSync(partial, write.yaml, { flag: 'wx' }); fs.renameSync(partial, write.file); changed.push(write); }
        finally { fs.rmSync(partial, { force: true }); }
      }
      reloadDefinitions();
      for (const write of writes) {
        for (const context of contexts) {
          const result = await compose({ object: write.name, context, options: { transient: true } });
          if (result.status !== 'ok') throw new Error(`${write.name}/${context}: ${(result.errors ?? []).map(error => error.message).join('; ')}`);
        }
        checks.push({ name: write.name, contexts: [...contexts] });
      }
    } catch (error) {
      const restoreErrors: string[] = [];
      for (const write of [...changed].reverse()) {
        try { if (write.previous !== undefined) fs.writeFileSync(write.file, write.previous); else fs.rmSync(write.file, { force: true }); }
        catch (restoreError) { restoreErrors.push(`${write.file}: ${(restoreError as Error).message}`); }
      }
      reloadDefinitions();
      throw new ToolError('OODS-V220', `Import failed: ${(error as Error).message}. ${restoreErrors.length ? `Rollback needs attention: ${restoreErrors.join('; ')}` : 'Every previous definition was restored; no object was applied.'}`, { rollbackComplete: !restoreErrors.length, restoreErrors });
    }
    return { action: 'apply' as const, importId: input.importId, applied: checks, count: checks.length };
  });
}

export async function handle(input: ObjectImportInput) {
  try {
    if (input.action === 'draft') {
      const result = draftSource(input.source);
      const staged = stage(result);
      const diffs = result.drafts.map(diffDraft);
      // Full data is staged; replies stay bounded even for enterprise specs with thousands of schemas.
      fs.writeFileSync(path.join(staged.directory, 'diff.json'), canonical(diffs), { mode: 0o600 });
      const summary = {
        action: 'draft' as const, ...staged, contentHash: result.contentHash, counts: result.counts, objectCount: result.drafts.length,
        objects: result.drafts.slice(0, 80).map(draft => draft.name), objectsTruncated: result.drafts.length > 80,
        shippedClashes: result.drafts.filter(draft => { const entry = objectEntry(draft.name); return entry?.source === 'shipped' || !!entry?.replaces; }).map(draft => draft.name).slice(0, 30),
        diff: { new: diffs.filter(d => d.status === 'new').length, changed: diffs.filter(d => d.status === 'changed').length, unchanged: diffs.filter(d => d.status === 'unchanged').length, file: path.join(staged.directory, 'diff.json') },
        proposalGrades: { strong: 0, medium: 0, weak: 0 }, cycleCount: result.cycles.length,
        files: { hub: 'hub.json', report: 'report.json', order: 'order.json', objects: 'objects/' },
      };
      for (const proposal of result.drafts.flatMap(draft => draft.proposals)) summary.proposalGrades[proposal.grade]++;
      return summary;
    }
    const imported = read(input.importId);
    if (input.action === 'show') {
      const draft = imported.drafts.find(d => d.name === input.object);
      if (!draft) throw new ToolError('OODS-N005', `${input.object} is not in this import.`);
      return { action: 'show' as const, importId: input.importId, name: draft.name, yaml: draft.yaml, proposals: draft.proposals,
        unmapped: imported.report.filter(entry => entry.object === draft.name && entry.outcome === 'unmapped'), diff: diffDraft(draft) };
    }
    if (input.action === 'apply') return await apply(input, imported);
    throw new ToolError('OODS-V220', 'Choose draft, show or apply.');
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError('OODS-V220', `Object import failed: ${(error as Error).message}`, error instanceof ImportProblem ? { code: error.code, origin: error.origin } : undefined);
  }
}
