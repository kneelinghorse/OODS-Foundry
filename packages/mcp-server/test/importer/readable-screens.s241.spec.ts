import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { bindRecordSchema } from '../../src/render/record-renderer.js';
import { displayFieldExpression, statusTimelineCondition } from '../../src/codegen/binding-utils.js';
import { sortRecordsAsStated } from '../../src/codegen/workflow-data-emitter.js';
import { enumOptionLabel } from '../../src/compose/internal-fields.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';

let work: string;
const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's241-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
afterEach(() => { for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; } reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
const nodes = (node: any): any[] => [node, ...(node.children ?? []).flatMap(nodes)];

it.each(['teamId', 'team_id'])('names references and joined records consistently without rewriting %s', async field => {
  const document = { $defs: {
    Squad: { required: ['id', 'name'], properties: { id: { type: 'integer' }, name: { type: 'string', examples: ['Design', 'Platform'] } } },
    Member: { required: ['id', 'name'], properties: { id: { type: 'integer' }, name: { type: 'string', examples: ['Elena Novak', 'Ava Martin'] } } },
    Membership: { required: ['id', 'memberId', field, 'role'], properties: { id: { type: 'integer' }, memberId: { type: 'integer' }, [field]: { type: 'integer' }, role: { type: 'string', enum: ['OWNER', 'PAST_DUE'], 'x-oods': { enumLabels: { OWNER: 'Team lead' } } }, createdAt: { type: 'string', format: 'date-time' } }, 'x-oods': { relationships: [{ target: 'Member', via: 'memberId', cardinality: 'many-to-one', label: 'Member' }, { target: 'Squad', via: field, cardinality: 'many-to-one', label: field.replace(/_/g, ' ') }] } },
  } };
  const staged = await importObjects({ action: 'draft', source: { content: JSON.stringify(document) } }) as any;
  const draft = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8'));
  await importObjects({ action: 'apply', importId: staged.importId, objects: draft.drafts.map((item: any) => ({ name: item.name, proposals: item.proposals.filter((p: any) => p.valid && p.trait.name === 'Timestampable').map((p: any) => p.id) })) });
  for (const context of ['list', 'detail', 'form', 'timeline'] as const) {
    const screen = await compose({ object: 'Membership', context, options: { transient: true } });
    const fields = screen.schema.objectSchema!;
    expect(fields[field].displayLabel).toBe('Team');
    expect(fields.role.enumLabels).toEqual({ OWNER: 'Team lead' });
    expect(fields.id.titleReferences).toEqual(['memberId', field]);
    const all = screen.schema.screens.flatMap(nodes);
    expect(all.some(node => node.component === 'StatusTimeline')).toBe(false);
    if (context === 'form') expect(all.find(node => node.props?.field === field)?.props.label).toBe('Team');
    if (context === 'list') expect(all.find(node => node.collectionControl === 'sort')?.props.options[0].label).toBe('Member · Team A–Z');
    const data = { id: 3, memberId: Object.keys(fields.memberId.referenceLabels!)[0], [field]: Object.keys(fields[field].referenceLabels!)[0], role: 'OWNER' };
    const expression = displayFieldExpression('id', fields, name => `record[${JSON.stringify(name)}]`);
    const title = new Function('record', `return ${expression}`)(data);
    expect(title).toBe('Elena Novak · Design');
    expect(new Function('record', `return ${expression}`)({ id: 3 })).toBe('Membership 3');
    const bound = bindRecordSchema({ ...screen.schema, screens: [{ id: 'heading', component: 'DetailHeader', props: { titleField: 'id' } }] }, data);
    expect(bound.screens[0].props!.title).toBe(title);
    expect(data.id).toBe(3);
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: screen.schema, framework });
      expect(generated.errors ?? []).toEqual([]);
      if (context !== 'timeline') expect(generated.code).toContain('Team lead');
      if (context !== 'form') expect(generated.code).toContain("join(' · ')");
    }
    const other = { ...data, id: 1, memberId: Object.keys(fields.memberId.referenceLabels!)[1] };
    expect(sortRecordsAsStated([data, other], 'id', fields).map(row => row.id)).toEqual([1, 3]);
  }
  // The same joined title is the row's accessible name. It must compile in a team's strict Vue project,
  // where HTML-escaped arrow/boolean operators in bound attributes are not decoded by vue-tsc.
  const workflow = await compose({ object: 'Membership', context: 'workflow', options: { transient: true } });
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema: workflow.schema, framework, profile: 'build', options: { output: 'application' } });
    expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
    const checked = typecheckWorkflow(generated.artifact!);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  }
}, 90_000);

it('uses sentence labels while retaining authored labels and raw enum values', () => {
  expect(['OWNER', 'PAST_DUE', 'pastDue'].map(value => enumOptionLabel(value))).toEqual(['Owner', 'Past due', 'Past due']);
  expect(enumOptionLabel('OWNER', { OWNER: 'VIP owner' })).toBe('VIP owner');
  const fields = { role: { type: 'string', required: true, enum: ['OWNER'], enumLabels: { OWNER: 'VIP owner' } } };
  const schema: any = { version: '2026.02', objectSchema: fields, screens: [{ id: 'badge', component: 'StatusBadge', props: { statusField: 'role' } }] };
  expect(bindRecordSchema(schema, { role: 'OWNER' }).screens[0].props).toMatchObject({ status: 'OWNER', content: 'VIP owner' });
});

it('does not show an empty status history as a broken panel, and still reacts to real history', () => {
  const node: any = { id: 'history', component: 'StatusTimeline', props: { historyField: 'history' } };
  const fields = { history: { type: 'array', required: false } };
  expect(statusTimelineCondition(node, fields)).toContain('history?.length');
  const schema: any = { version: '2026.02', objectSchema: fields, screens: [node] };
  expect(bindRecordSchema(schema, { history: [] }).screens).toEqual([]);
  expect(bindRecordSchema(schema, { history: [{ title: 'Activated' }] }).screens).toHaveLength(1);
});

// A join title must not silently replace the value under a labelled identifier row.
it('keeps the identifier row distinct from the record title on all targets', async () => {
  const schema: any = { version: '2026.02', objectSchema: {
    id: { type: 'integer', required: true, titleReferences: ['teamId'] },
    teamId: { type: 'integer', required: true, referenceLabels: { '2': 'Design' } },
  }, screens: [{ id: 'root', component: 'Stack', children: [
    { id: 'heading', component: 'Text', props: { field: 'id', as: 'h1' } },
    { id: 'identifier', component: 'Text', meta: { intent: 'read-only-field' }, props: { field: 'id' } },
  ] }] };
  const bound = bindRecordSchema(schema, { id: 3, teamId: 2 });
  expect(bound.screens[0].children![0].props!.text).toBe('Design');
  expect(String(bound.screens[0].children![1].props!.text)).toBe('3');
  for (const framework of ['react', 'vue'] as const) {
    const generated = await generate({ schema, framework });
    expect(generated.errors ?? []).toEqual([]);
    expect(generated.code).toContain('formatReadOnlyValue(id,');
    expect(generated.code).toContain("join(' · ')");
  }
});
