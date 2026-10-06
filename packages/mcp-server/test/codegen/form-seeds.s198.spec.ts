import { JSDOM } from 'jsdom';
import { renderMappedComponent } from '../../src/render/component-map.js';
import { recordCollectionEvents } from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { workflowSampleData, workflowSampleRecords, workflowDataFiles } from '../../src/codegen/workflow-data-emitter.js';
import { OBJECTS, supportsWorkflow } from '../../src/lib/runtime-ledger.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHANNEL_SEEDS, TEMPLATE_SEEDS } from '../../../../src/data/communication/sample-data.js';
import { loadTrait } from '../../src/objects/trait-loader.js';
const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);

describe('s198 form craft and one attributable seed policy', () => {
  it.each(OBJECTS.filter(supportsWorkflow))('%s exposes one editor per simple form field so Save has an unambiguous value', async object => {
    for (const context of ['form', 'workflow']) {
      const { schema } = await compose({ object, context });
      const forms = context === 'form' ? schema.screens : schema.screens.filter(screen => screen.id.startsWith('form-'));
      expect(forms).toHaveLength(1);
      const fields = walk(forms).filter(node => ['Input', 'Textarea', 'Select', 'DatePicker', 'Checkbox', 'Switch'].includes(node.component) && node.props?.field)
        .map(node => String(node.props!.field));
      expect(fields.length).toBeGreaterThan(0);
      expect(fields, `${object}/${context} must not duplicate a title-slot editor in its field slot`).toEqual([...new Set(fields)]);
      if (object === 'Plan') expect(fields.filter(field => field === 'plan_name')).toHaveLength(1);
    }
  });
  it('does not invent archive or restore activity for neutral records', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const records = workflowSampleRecords(schema);
    // s222-m03 (#2502 ruling 14): one record per authored Subscription sample (eight).
    expect(records).toHaveLength(8);
    for (const record of records) {
      expect(record.is_archived).toBe(false);
      for (const field of ['archived_at', 'restored_at', 'archive_reason', 'archived_by']) expect(record[field] == null || record[field] === '').toBe(true);
    }
  });
  it('HTML uses catalog names for labels while retaining stored role/template IDs', () => {
    for (const [component, props, names] of [
      ['RoleAssignmentForm', { availableRoles: [{ id: 'role-001', name: 'Owner' }, { id: 'role-002', name: 'Editor', label: 'Content editor' }] }, ['Owner', 'Content editor']],
      ['TemplatePicker', { templates: [{ id: 'template-001', name: 'Welcome Email' }], channels: [{ id: 'channel-001', name: 'Primary Email' }] }, ['Welcome Email', 'Primary Email']],
    ] as const) {
      const html = renderMappedComponent({ id: 'catalog', component, props }, '')!;
      const options = [...JSDOM.fragment(html).querySelectorAll('option')];
      expect(options.map(option => option.textContent)).toEqual(names);
      expect(options.every(option => option.value.includes('-00'))).toBe(true);
    }
  });
  it('keeps authored trait examples tied to canonical role and communication catalogs', () => {
    // The canonical fixture imports root aliases; evaluate it with the root tsx config.
    const roles = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "import { AUTHZ_SAMPLE_DATASET } from './src/data/authz/sample-entitlements.ts'; console.log(JSON.stringify(AUTHZ_SAMPLE_DATASET.roles));"], { cwd: fileURLToPath(new URL('../../../../', import.meta.url)), encoding: 'utf8' }));
    expect(loadTrait('Authable').schema.role_catalog!.examples![0]).toEqual(roles);
    expect(loadTrait('Communicable').schema.channel_catalog!.examples![0]).toEqual(CHANNEL_SEEDS.map(({ id, name, channelType }) => ({ id, name, type: channelType })));
    expect(loadTrait('Communicable').schema.template_catalog!.examples![0]).toEqual(TEMPLATE_SEEDS.map(({ id, name, channelType, subject, body, variables, locale }) => ({ id, name, channelType, subject, body, variables, locale })));
    expect(loadTrait('Authable').schema.role_catalog!.default).toEqual([]);
  });
  it.each(OBJECTS)('%s has deterministic, declared enum values and no placeholder strings', async object => {
    const context = supportsWorkflow(object) ? 'workflow' : 'inline';
    const result = await compose({ object, context });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    const { records, seedTable } = workflowSampleData(result.schema);
    expect(records).toEqual(workflowSampleRecords(result.schema));
    expect(JSON.stringify(records)).not.toMatch(/ sample \d+/);
    expect(seedTable.length).toBeGreaterThan(0);
    expect(seedTable.every(row => row.rule.length > 0)).toBe(true);
    for (const record of records) for (const [field, entry] of Object.entries(result.schema.objectSchema ?? {})) {
      if (entry.enum?.length && record[field] !== undefined) expect(entry.enum, field).toContain(record[field]);
    }
  });
  it.each(['Organization', 'User'])('%s retains trait catalog examples and preference parameters in both frameworks', async object => {
    const { schema } = await compose({ object, context: 'workflow' });
    const record = workflowSampleRecords(schema)[2]!;
    expect(record.role_catalog).toEqual(loadTrait('Authable').schema.role_catalog!.examples![0]);
    expect(record.template_catalog).toEqual(loadTrait('Communicable').schema.template_catalog!.examples![0]);
    expect((record.channel_catalog as unknown[]).length).toBeGreaterThan(1);
    const document = record.preference_document as { version: string; preferences: Record<string, unknown> };
    expect(document).toEqual(schema.objectSchema!.preference_document!.examples?.[0] ?? schema.objectSchema!.preference_document!.default ?? {});
    expect(record.addresses).toEqual([]);
    expect(record.preference_version).toBe('2.0.0');
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema, framework, profile: 'build' });
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      expect(generated.artifact!.files.find(file => file.path === 'src/app.css')!.contents).toContain('.workflow-app label { font-family: var(--sys-text-scale-label-md-font-family);');
      const form = generated.artifact!.files.find(file => file.path.startsWith('src/screens/Form.'))!.contents;
      for (const field of ['preferenceNamespaces', 'roleCatalog', 'templateCatalog', 'channelCatalog']) expect(form).toContain(field);
      const checked = typecheckWorkflow(generated.artifact!);
      expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    }
  }, 60000);
  it.each(['Subscription', 'Invoice', 'Plan'])('%s uses controls for field titles, compact strings and valid date input types', async object => {
    const { schema } = await compose({ object, context: 'form' });
    const nodes = walk(schema.screens);
    expect(nodes.filter(node => node.component === 'DetailHeader' && node.props?.field)).toEqual([]);
    for (const node of nodes) {
      const field = String(node.props?.field ?? '');
      const entry = schema.objectSchema?.[field];
      if (node.component === 'DatePicker' && entry) expect(entry.type).toMatch(/^date/);
      if (node.component === 'Textarea') expect(field).toMatch(/description|reason|notes|body|content|instructions/);
    }
    expect(nodes.filter(node => node.component === 'Button' && node.props?.type === 'submit')).toHaveLength(1);
    if (object === 'Invoice') expect(nodes.find(node => node.props?.field === 'billing_contact_name')?.component).toBe('Input');
    for (const framework of ['react', 'vue'] as const) expect((await generate({ schema, framework, profile: 'build' })).status).toBe('ok');
  });
  it('keeps example precedence and data isolated, without turning preview examples into production defaults', () => {
    const schema = { version: '2026.02', screens: [{ id: 'screen', component: 'Stack' }], objectSchema: { value: { type: 'object', required: true, default: {}, examples: [{ nested: ['example'] }] } } } as UiSchema;
    const first = workflowSampleRecords(schema);
    (first[0]!.value as { nested: string[] }).nested.push('mutated');
    expect(workflowSampleRecords(schema)[0]!.value).toEqual({ nested: ['example'] });
    expect(schema.objectSchema!.value!.default).toEqual({});
  });
  it('does not derive payment history or a price from an absent example', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    // s219-m01: Subscription now authors its payments and prices; without those examples nothing is derived.
    delete schema.objectSchema!.payment_history;
    delete schema.objectSchema!.amount!.examples;
    for (const record of workflowSampleRecords(schema)) {
      expect(record.payment_history).toEqual([]);
      expect(record.amount).toBe(schema.objectSchema!.amount!.default ?? 0);
    }
  });
  it.each(['Invoice', 'Plan'])('%s retains authored timeline dates and does not invent observations', async object => {
    const { schema } = await compose({ object, context: 'workflow' });
    const store = workflowDataFiles(schema).find(file => file.path === 'src/store.ts')!.contents;
    expect(store).toContain('return recordCollectionEvents(record,');
    const field = object === 'Invoice' ? 'created_at' : 'period_start';
    schema.objectSchema![field]!.examples = ['2026-01-02T12:00:00.000Z'];
    const record = workflowSampleRecords(schema)[2]!;
    expect(record[field]).toBe('2026-01-02T12:00:00.000Z');
    expect(recordCollectionEvents(record).some(event => event.at === '2026-01-02T12:00:00.000Z')).toBe(true);
  });
});
