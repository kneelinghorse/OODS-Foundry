import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { handle as objects } from '../../src/tools/object.js';
import { handle as register } from '../../src/tools/object.write.js';
import { handle as schemas } from '../../src/tools/schema.read.js';
import { handle as mappings } from '../../src/tools/map.read.js';
import { handle as brands } from '../../src/tools/brand.read.js';
import { handle as imports } from '../../src/tools/object.import.read.js';
import { handle as versions } from '../../src/tools/design.versions.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { wire } from '../helpers/wire-boundary.js';

it('the new boundaries refuse writes as reads, while registration persists only through its write tool', async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 's240-split-'));
  const env = { OODS_OBJECTS_DIR: path.join(work, 'objects'), OODS_TRAITS_DIR: path.join(work, 'traits'), OODS_FOUNDRY_HOME: work, MCP_SCHEMA_STORE_ROOT: work, MCP_MAPPINGS_PATH: path.join(work, 'mappings.json') };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]])); Object.assign(process.env, env); reloadDefinitions();
  try {
    const yaml = 'object:\n  name: SplitCheck\n  version: 1.0.0\n  domain: demo\n  description: Read-write boundary fixture\nschema:\n  id:\n    type: string\n    required: true\n    description: Record identifier\n';
    await expect(objects({ action: 'register', yaml })).rejects.toThrow(/Call object_register/);
    expect(fs.existsSync(env.OODS_OBJECTS_DIR)).toBe(false);
    const saved = await register(wire('object.write', 'input', { action: 'register', yaml }));
    expect(saved.file).toBe(path.join(env.OODS_OBJECTS_DIR, 'SplitCheck.object.yaml'));
    const listed = await schemas(wire('schema.read', 'input', { action: 'list' })); expect(listed).toEqual([]);
    expect(await mappings(wire('map.read', 'input', { action: 'list' }))).toHaveProperty('mappings');
    expect(await brands(wire('brand.read', 'input', { action: 'template' }) as never)).toHaveProperty('documents');
    await expect(imports(wire('object.import.read', 'input', { action: 'show', importId: 'import-0000000000000000', object: 'SplitCheck' }) as never)).rejects.toThrow();
    const composition = await compose({ object: 'SplitCheck', context: 'detail' });
    const history = await versions(wire('design.versions', 'input', { action: 'versions', compositionId: composition.compositionId }) as never);
    expect(history.latest).toBe(1); expect(history.versions).toHaveLength(1); expect(history).not.toHaveProperty('host');
    for (const [read, action] of [[schemas, 'save'], [mappings, 'draft'], [brands, 'create'], [imports, 'apply'], [versions, 'render']] as const) await expect(read({ action } as never)).rejects.toThrow(/accepts/);
  } finally {
    for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true });
  }
});
