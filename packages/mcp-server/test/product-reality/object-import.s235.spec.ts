import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/object.import.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/object.import.output.json' assert { type: 'json' };

let failObject: string | undefined;
vi.mock('../../src/tools/design.compose.js', async original => {
  const actual = await original<typeof import('../../src/tools/design.compose.js')>();
  return { ...actual, handle: vi.fn(async (input: Parameters<typeof actual.handle>[0]) => {
    if (input.object === failObject && input.context === 'detail') throw new Error('planted composition failure');
    return actual.handle(input);
  }) };
});
const { handle } = await import('../../src/tools/object.import.js');
const { handle: register, reloadDefinitions } = await import('../../src/tools/object.register.js');
const { listObjects, loadObject } = await import('../../src/objects/object-loader.js');
const inputValid = getAjv().compile(inputSchema), outputValid = getAjv().compile(outputSchema);
const call = async (input: Parameters<typeof handle>[0]): Promise<any> => {
  expect(inputValid(input), JSON.stringify(inputValid.errors)).toBe(true);
  const output = await handle(input);
  expect(outputValid(output), JSON.stringify(outputValid.errors)).toBe(true);
  return output;
};
let folder: string, objects: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'import-tool-')); objects = path.join(folder, 'home', 'objects');
  fs.mkdirSync(objects, { recursive: true });
  process.env.OODS_FOUNDRY_HOME = path.join(folder, 'home');
  process.env.OODS_OBJECTS_DIR = objects;
  process.env.OODS_TRAITS_DIR = path.join(folder, 'home', 'traits');
  process.env.MCP_SCHEMA_STORE_ROOT = folder;
  failObject = undefined; reloadDefinitions();
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ['OODS_FOUNDRY_HOME','OODS_OBJECTS_DIR','OODS_TRAITS_DIR','MCP_SCHEMA_STORE_ROOT']) delete process.env[key];
  reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true });
});
const widget = { type: 'object', properties: { title: { type: 'string', examples: ['Copper widget'] }, status: { type: 'string', enum: ['draft', 'active'] } } };
const draft = (schemas = { ImportedWidget: widget }) => call({ action: 'draft', source: { content: JSON.stringify({ $defs: schemas }) } });

it('stages a bounded review bundle without changing any team definition and show returns the actual YAML and evidence', async () => {
  const result = await draft();
  expect(result.directory).toBe(path.join(folder, 'home', 'imports', result.importId));
  expect(fs.readdirSync(objects)).toEqual([]);
  expect(result.objects).toEqual(['ImportedWidget']);
  const shown = await call({ action: 'show', importId: result.importId, object: 'ImportedWidget' });
  expect(shown.yaml).toBe(fs.readFileSync(path.join(result.directory, 'objects', 'ImportedWidget.object.yaml'), 'utf8'));
  expect(shown.proposals[0]).toMatchObject({ grade: 'medium', valid: true, evidence: [expect.objectContaining({ kind: 'structure' })] });
  expect(shown.diff).toMatchObject({ status: 'new', fields: { added: ['status','title'] }, screens: ['list','detail','form'] });
});
it('applies only named objects and explicitly accepted proposals, then reports an unchanged base re-import', async () => {
  const staged = await draft({ ImportedWidget: widget, AnotherWidget: widget });
  const output = await call({ action: 'apply', importId: staged.importId, objects: [{ name: 'ImportedWidget' }] });
  expect(output.applied).toEqual([{ name: 'ImportedWidget', contexts: ['list','detail','form'] }]);
  expect(loadObject('ImportedWidget').traits).toEqual([]);
  expect(listObjects()).not.toContain('AnotherWidget');
  expect((await draft({ ImportedWidget: widget, AnotherWidget: widget })).diff).toMatchObject({ new: 1, unchanged: 1, changed: 0 });
  const shown = await call({ action: 'show', importId: staged.importId, object: 'AnotherWidget' });
  await call({ action: 'apply', importId: staged.importId, objects: [{ name: 'AnotherWidget', proposals: [shown.proposals[0].id] }] });
  expect(loadObject('AnotherWidget').traits[0].name).toBe('Stateful');
});
it('reports fields and affected screens when re-import changes a registered schema', async () => {
  const old = await draft();
  await call({ action: 'apply', importId: old.importId, objects: [{ name: 'ImportedWidget' }] });
  const newer = await draft({ ImportedWidget: { type: 'object', properties: { title: { type: 'integer' }, other: { type: 'boolean' } } } } as any);
  const shown = await call({ action: 'show', importId: newer.importId, object: 'ImportedWidget' });
  expect(shown.diff).toMatchObject({ status:'changed', fields:{ added:['other'],removed:['status'],changed:['title'] },screens:['list','detail','form'] });
  await expect(call({ action:'apply',importId:newer.importId,objects:[{name:'ImportedWidget'}] })).rejects.toMatchObject({opiCode:'OODS-C004'});
});
it('requires a separate confirmation for each shipped replacement before writing any definition', async () => {
  const staged = await draft({ User: widget, Product: widget });
  await expect(call({ action:'apply',importId:staged.importId,objects:[{name:'User'},{name:'Product'}],confirmShipped:['User'] })).rejects.toMatchObject({opiCode:'OODS-C006'});
  expect(fs.readdirSync(objects)).toEqual([]);
  const applied = await call({ action:'apply',importId:staged.importId,objects:[{name:'User'},{name:'Product'}],confirmShipped:['User','Product'] });
  expect(applied.count).toBe(2);
});
it('requires unregistered dependencies to be accepted and composes a cyclic batch after all files exist', async () => {
  const staged = await draft({ AImport: { type:'object',properties:{ title:{type:'string'},other:{$ref:'#/$defs/BImport'} } }, BImport:{type:'object',properties:{title:{type:'string'},other:{$ref:'#/$defs/AImport'}}} } as any);
  await expect(call({action:'apply',importId:staged.importId,objects:[{name:'AImport'}]})).rejects.toMatchObject({opiCode:'OODS-V220'});
  expect(fs.readdirSync(objects)).toEqual([]);
  expect((await call({action:'apply',importId:staged.importId,objects:[{name:'AImport'},{name:'BImport'}]})).count).toBe(2);
});
it('restores every previous byte and removes every new file after a planted composition throw', async () => {
  const earlier = await draft();
  await call({action:'apply',importId:earlier.importId,objects:[{name:'ImportedWidget'}]});
  const file = path.join(objects,'ImportedWidget.object.yaml');
  const previous = fs.readFileSync(file);
  const staged = await draft({ ImportedWidget:{...widget,description:'Changed'}, ZFailure:widget });
  failObject = 'ZFailure';
  await expect(call({action:'apply',importId:staged.importId,objects:[{name:'ImportedWidget'},{name:'ZFailure'}],overwrite:true})).rejects.toMatchObject({opiCode:'OODS-V220',details:{rollbackComplete:true}});
  expect(fs.readFileSync(file)).toEqual(previous);
  expect(fs.readdirSync(objects)).toEqual(['ImportedWidget.object.yaml']);
  expect(listObjects()).not.toContain('ZFailure');
});
it('also rolls back after the second file write fails, with no partial files or locks left', async () => {
  const staged = await draft({ AImport:widget, BImport:widget });
  const rename = fs.renameSync;
  vi.spyOn(fs,'renameSync').mockImplementation((from,to) => { if(String(to).endsWith('BImport.object.yaml')) throw new Error('planted disk failure'); return rename(from,to); });
  await expect(call({action:'apply',importId:staged.importId,objects:[{name:'AImport'},{name:'BImport'}]})).rejects.toMatchObject({details:{rollbackComplete:true}});
  expect(fs.readdirSync(objects)).toEqual([]);
});
it('refuses tampered staging and path traversal import ids', async () => {
  const staged=await draft();
  fs.appendFileSync(path.join(staged.directory,'import.json'),' ');
  await expect(call({action:'show',importId:staged.importId,object:'ImportedWidget'})).rejects.toThrow(/hash mismatch/);
  await expect(handle({action:'show',importId:'../../escape',object:'ImportedWidget'})).rejects.toThrow(/Invalid import id/);
});
it('does not accept an unknown or invalid proposal and keeps register/import under the same lock', async () => {
  const staged=await draft();
  await expect(call({action:'apply',importId:staged.importId,objects:[{name:'ImportedWidget',proposals:['not-a-proposal']}]})).rejects.toMatchObject({opiCode:'OODS-V220'});
  const shown=await call({action:'show',importId:staged.importId,object:'ImportedWidget'});
  fs.writeFileSync(path.join(objects,'.definition-write.lock'),'another process');
  await expect(register({yaml:shown.yaml})).rejects.toThrow(/Another definition write/);
  await expect(handle({action:'apply',importId:staged.importId,objects:[{name:'ImportedWidget'}]})).rejects.toThrow(/Another definition write/);
});
it('keeps responses compact and complete files for a large generated schema catalog', async () => {
  const definitions=Object.fromEntries(Array.from({length:250},(_,i)=>[`Widget${i}`,widget]));
  const staged=await draft(definitions);
  expect(Buffer.byteLength(JSON.stringify(staged),'utf8')).toBeLessThan(20_000);
  expect(staged.objectsTruncated).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(staged.directory,'order.json'),'utf8')).objects).toHaveLength(250);
});
