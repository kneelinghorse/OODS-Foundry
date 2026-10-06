/** s227-m03: reproduce the maintenance contract through source tool handlers, without touching a consumer app. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedActionContractDigest } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import type { GeneratedArtifact } from '../../packages/mcp-server/src/codegen/types.js';
import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as generate } from '../../packages/mcp-server/src/tools/code.generate.js';
import { handle as register, reloadDefinitions } from '../../packages/mcp-server/src/tools/object.register.js';

const root = path.resolve(import.meta.dirname, '../..');
export const generatedAppKinds = ['component', 'application', 'workflow'] as const;
export const generatedAppFrameworks = ['react', 'vue'] as const;
const digest = (contents: string | Buffer) => `sha256:${createHash('sha256').update(contents).digest('hex')}`;
const writeJson = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
export function folderHashes(directory: string): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => {
      const file = path.join(entry.parentPath, entry.name);
      return [path.relative(directory, file).replaceAll(path.sep, '/'), digest(fs.readFileSync(file))];
    }).sort(([left], [right]) => left!.localeCompare(right!)));
}

/** Keep full artifact envelopes as source evidence: they include every emitted byte, dependency and action. */
export async function reproduceGeneratedApps(scratch: string, editedTrait: string, receiptDir?: string) {
  assert.ok(path.resolve(scratch).startsWith(root + path.sep), 'Scratch stays inside the repository');
  if (receiptDir) assert.ok(path.resolve(receiptDir).startsWith(root + path.sep), 'Receipts stay inside the repository');
  const vars = {
    OODS_OBJECTS_DIR: path.join(scratch, 'objects'), OODS_TRAITS_DIR: path.join(scratch, 'traits'),
    MCP_SCHEMA_STORE_ROOT: scratch, MCP_SCHEMA_STORE_DIR: path.join(scratch, 'schemas'),
    MCP_MAPPINGS_PATH: path.join(scratch, 'absent-mappings.json'), OODS_BRANDS_DIR: path.join(scratch, 'brands'), OODS_PREVIEW_HOST_URL: '',
  };
  const prior = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
  Object.assign(process.env, vars); reloadDefinitions();
  const beforeTrait = fs.readFileSync(path.join(root, 'packages/foundry/quickstart/Stockable.trait.yaml'), 'utf8');
  const warehouse = fs.readFileSync(path.join(root, 'packages/foundry/quickstart/Warehouse.object.yaml'), 'utf8');
  const rows: Array<{
    output: typeof generatedAppKinds[number]; framework: typeof generatedAppFrameworks[number];
    before: { artifact: GeneratedArtifact; schema: UiSchema; directory: string; hashes: Record<string, string> };
    after: { artifact: GeneratedArtifact; schema: UiSchema; directory: string; hashes: Record<string, string> };
    changedFiles: string[]; unchangedFiles: string[]; changedActions: string[]; firstFolderUnchanged: boolean; samePayloadReused: boolean; editedGeneratedFileOverwritten: boolean;
  }> = [];
  const callLog: Array<{ tool: string; input: unknown }> = [];
  const call = async <T>(tool: string, input: unknown, run: () => Promise<T>) => {
    callLog.push({ tool, input }); return run();
  };
  try {
    for (const [name, yaml] of [['Stockable', beforeTrait], ['Warehouse', warehouse]]) {
      await call('object', { action: 'register', source: `${name}.${name === 'Stockable' ? 'trait' : 'object'}.yaml` }, () => register({ yaml: yaml! }));
    }
    const versions: Array<Array<typeof rows[number]['before']>> = [];
    for (const phase of ['before', 'after'] as const) {
      if (phase === 'after') await call('object', { action: 'register', source: 'Stockable.after.trait.yaml', overwrite: true }, () => register({ yaml: editedTrait, overwrite: true }));
      const schemas = {} as Record<'detail' | 'workflow', Awaited<ReturnType<typeof compose>>['schema']>;
      for (const context of ['detail', 'workflow'] as const) {
        const input = { object: 'Warehouse', context, options: { transient: true } };
        const result = await call('design.compose', input, () => compose(input));
        assert.equal(result.status, 'ok', JSON.stringify(result.errors)); schemas[context] = result.schema;
        assert.equal(Object.hasOwn(result.schema.objectSchema ?? {}, 'last_counted_at'), phase === 'after');
        if (receiptDir) writeJson(path.join(receiptDir, 'inputs', `${phase}-${context}.json`), result.schema);
      }
      const outputs = [];
      for (const output of generatedAppKinds) for (const framework of generatedAppFrameworks) {
        const schema = schemas[output === 'workflow' ? 'workflow' : 'detail'];
        const options = { payloadMode: 'file' as const, ...(output === 'application' ? { output: 'application' as const } : {}) };
        const result = await call('code.generate', { schema: `${phase}-${output === 'workflow' ? 'workflow' : 'detail'}.json`, framework, options }, () => generate({ schema, framework, options }));
        assert.equal(result.status, 'ok', JSON.stringify(result.errors)); assert.ok(result.payload);
        const directory = result.payload.directory;
        const artifact: GeneratedArtifact = JSON.parse(fs.readFileSync(path.join(directory, 'artifact.json'), 'utf8'));
        assert.deepEqual(result.payload.files.map(file => file.path).sort(), [...artifact.files.map(file => file.path), 'artifact.json'].sort());
        if (receiptDir) writeJson(path.join(receiptDir, output, framework, `${phase}.artifact.json`), artifact);
        outputs.push({ artifact, schema, directory, hashes: folderHashes(directory) });
      }
      versions.push(outputs);
    }
    let index = 0;
    for (const output of generatedAppKinds) for (const framework of generatedAppFrameworks) {
      const before = versions[0]![index]!, after = versions[1]![index++]!;
      assert.notEqual(after.directory, before.directory, `${output}/${framework} must change when its detail adds a row`);
      assert.deepEqual(folderHashes(before.directory), before.hashes, 'New generation must leave the first payload byte-identical');
      const paths = [...new Set([...Object.keys(before.hashes), ...Object.keys(after.hashes)])].sort();
      const beforeActions = Object.fromEntries(before.artifact.actions.map(action => [action.name, generatedActionContractDigest(action)]));
      const afterActions = Object.fromEntries(after.artifact.actions.map(action => [action.name, generatedActionContractDigest(action)]));
      // An unchanged payload is reused, with no edit detection: a deliberate edit to its generated source is overwritten.
      const sourceFile = after.artifact.files.find(file => /\.(tsx|vue)$/.test(file.path))!;
      fs.appendFileSync(path.join(after.directory, sourceFile.path), '\n<!-- team edit detection probe -->\n');
      const options = { payloadMode: 'file' as const, ...(output === 'application' ? { output: 'application' as const } : {}) };
      const repeated = await call('code.generate', { schema: `after-${output === 'workflow' ? 'workflow' : 'detail'}.json`, framework, options, probe: 'same content after an edit to a generated file' }, () => generate({ schema: after.schema, framework, options }));
      assert.equal(repeated.status, 'ok', JSON.stringify(repeated.errors));
      assert.equal(repeated.payload?.directory, after.directory);
      assert.deepEqual(folderHashes(after.directory), after.hashes, 'Same content overwrites the edited generated file');
      assert.ok(!repeated.warnings.some(warning => /edit|overwrit/i.test(warning.message)), 'No edit detection is advertised');
      rows.push({ output, framework, before, after,
        changedFiles: paths.filter(file => before.hashes[file] !== after.hashes[file]),
        unchangedFiles: paths.filter(file => before.hashes[file] === after.hashes[file]),
        changedActions: [...new Set([...Object.keys(beforeActions), ...Object.keys(afterActions)])].filter(name => beforeActions[name] !== afterActions[name]),
        firstFolderUnchanged: true, samePayloadReused: true, editedGeneratedFileOverwritten: true,
      });
    }
    if (receiptDir) {
      for (const [name, contents] of Object.entries({ 'Stockable.before.trait.yaml': beforeTrait, 'Stockable.after.trait.yaml': editedTrait, 'Warehouse.object.yaml': warehouse })) {
        fs.writeFileSync(path.join(receiptDir, 'inputs', name), contents);
      }
      const describe = (version: typeof rows[number]['before']) => ({
        directory: path.relative(root, version.directory), contentHash: version.artifact.contentHash,
        files: version.hashes, actions: version.artifact.actions.map(action => ({ ...action, digest: generatedActionContractDigest(action) })),
        dependencies: version.artifact.dependencies,
        doNotEditHeaders: version.artifact.files.filter(file => /do not edit/i.test(file.contents)).map(file => file.path),
      });
      writeJson(path.join(receiptDir, 'reproduction.json'), {
        mission: 's227-m03', evidenceKind: 'source-tool-handlers', recordedAt: new Date().toISOString(),
        inputs: { traitBefore: digest(beforeTrait), traitAfter: digest(editedTrait), warehouse: digest(warehouse) },
        sourceFiles: Object.fromEntries(['scripts/product-reality/s227-generated-apps.ts', 'packages/mcp-server/src/tools/code.generate.ts', 'packages/mcp-server/src/lib/payload-store.ts', 'packages/mcp-server/src/codegen/screen-app.ts', 'packages/mcp-server/src/codegen/workflow-emitter.ts'].map(file => [file, digest(fs.readFileSync(path.join(root, file)))])),
        calls: callLog,
        rows: rows.map(row => ({ ...row, before: describe(row.before), after: describe(row.after) })),
      });
    }
    return rows;
  } finally {
    for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    reloadDefinitions();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const receiptDir = path.resolve(args[0] ?? path.join(root, 'artifacts/product-reality/sprint-227/m03'));
  const editedTrait = args[1] ? fs.readFileSync(path.resolve(args[1]), 'utf8') :
    (await import('./s227-first-change.js')).editedStockable(
      fs.readFileSync(path.join(root, 'packages/foundry/quickstart/Stockable.trait.yaml'), 'utf8'),
      fs.readFileSync(path.join(root, 'packages/foundry/QUICKSTART.md'), 'utf8'));
  const scratchRoot = path.join(root, '.tmp/s227-tmp'); fs.mkdirSync(scratchRoot, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(scratchRoot), 'm03-generation-'));
  const rows = await reproduceGeneratedApps(scratch, editedTrait, receiptDir);
  console.log(JSON.stringify(rows.map(({ output, framework, changedFiles, changedActions, firstFolderUnchanged }) => ({ output, framework, changedFiles, changedActions, firstFolderUnchanged })), null, 2));
}
