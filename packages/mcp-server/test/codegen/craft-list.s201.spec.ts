import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 60_000 });

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { enumOptionLabel, isInternalField } from '../../src/compose/internal-fields.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

// Sprint 201 m06 — the Sprint 198 craft carries (#2046), fixed at the producer:
// field-name chips on list rows, internal fields in forms, saves not updating history, duplicate Role
// fields, doubled empty states, lowercase filter options, and the Subscription detail tab order and
// billing-cycle contradiction. Each test fails on the base and passes here.

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
const schemas = new Map<string, UiSchema>();
const artifacts = new Map<string, GeneratedArtifact>();

beforeAll(async () => {
  for (const object of ['Subscription', 'Organization', 'User']) {
    const result = await compose({ object, context: 'workflow', options: { transient: true } });
    expect(result.status, `${object} workflow composes`).toBe('ok');
    schemas.set(object, result.schema);
    const generated = await generate({ schema: result.schema, framework: 'react', profile: 'build', options: { typescript: true } });
    expect(generated.status, `${object} react generation`).toBe('ok');
    artifacts.set(object, generated.artifact!);
  }
});

const file = (object: string, name: string) => artifacts.get(object)!.files.find(entry => entry.path === name)!.contents;

describe('list rows show record values, not field names', () => {
  it('drops the summary badges whose text would be their own label from User and Organization rows', () => {
    for (const object of ['User', 'Organization']) {
      const list = walk(schemas.get(object)!.screens).find(node => node.collection?.source === 'rows')!;
      const row = walk([list]).map(node => node.component);
      for (const chip of ['MessageStatusBadge', 'AddressSummaryBadge', 'PreferenceSummaryBadge', 'RoleBadgeList']) expect(row, `${object} row without ${chip}`).not.toContain(chip);
      expect(row).toContain('StatusBadge');
      expect(row).toContain('RelativeTimestamp');
    }
    expect(walk([walk(schemas.get('Organization')!.screens).find(node => node.collection?.source === 'rows')!]).map(node => node.component)).toContain('OwnerBadge');
    const subscription = walk([walk(schemas.get('Subscription')!.screens).find(node => node.collection?.source === 'rows')!]).map(node => node.component);
    expect(subscription).toContain('BillingSummaryBadge');
    for (const chip of ['Default address role', 'Preferences', 'Roles']) expect(file('User', 'src/screens/List.tsx')).not.toContain(`"${chip}"`);
  });
});

describe('filter options read like the badges', () => {
  it('uses sentence case for every lifecycle option', () => {
    expect(enumOptionLabel('pending_cancellation')).toBe('Pending cancellation');
    const filter = walk(schemas.get('Subscription')!.screens).find(node => node.collectionControl === 'filter')!;
    const labels = (filter.props!.options as Array<{ value: string; label: string }>).map(option => option.label);
    expect(labels).toContain('Pending cancellation');
    expect(labels).toContain('Past due');
    expect(labels.filter(label => label !== 'All states').every(label => /^[A-Z]/.test(label))).toBe(true);
    expect(file('Subscription', 'src/screens/List.tsx')).toContain('Pending cancellation');
    expect(file('Subscription', 'src/screens/List.tsx')).not.toContain("label: 'pending cancellation'");
  });
});

describe('one empty state per list', () => {
  it('lets the rows collection own the empty banner so an empty search shows it once', async () => {
    for (const object of ['Subscription', 'User']) {
      const screen = schemas.get(object)!.screens.find(node => node.id === 'list-screen')!;
      expect(screen.children!.map(node => node.state)).toEqual(['loading', 'error', 'success']);
      const code = file(object, 'src/screens/List.tsx');
      // Only the collection's own banner remains and it is the empty branch; the screen-level one is gone.
      expect(code).not.toContain('title="No records found"');
      expect(code).not.toContain('Change the filters or add a record.');
      expect(code).toContain('data-oods-state="empty"');
      expect(code).toContain('content="No records found."');
      expect(walk([screen]).filter(node => node.state === 'empty').map(node => node.collectionControl)).toEqual(['empty']);
    }
    const standalone = await compose({ object: 'Subscription', context: 'list', options: { transient: true } });
    expect(standalone.schema.screens[0]!.children!.map(node => node.state)).toEqual(['loading', 'error', 'success']);
    // Record screens keep their empty branch: a missing record is a real empty state.
    expect(schemas.get('Subscription')!.screens.find(node => node.id === 'detail-screen')!.children!.map(node => node.state)).toEqual(['loading', 'empty', 'error', 'success']);
  });
});

describe('forms edit the record, not its bookkeeping', () => {
  it('keeps one Role field on User and no Role Assignment editor beside it', () => {
    const form = walk(schemas.get('User')!.screens.find(node => node.id === 'form-screen')!.children!);
    expect(form.filter(node => node.component === 'RoleAssignmentForm')).toHaveLength(0);
    expect(form.filter(node => node.props?.field === 'role')).toHaveLength(1);
    expect(file('User', 'src/screens/Form.tsx')).not.toContain('RoleAssignmentForm');
    // Organization has no scalar role field, so its membership editor stays.
    expect(walk(schemas.get('Organization')!.screens.find(node => node.id === 'form-screen')!.children!).filter(node => node.component === 'RoleAssignmentForm')).toHaveLength(1);
  });

  it('leaves placeholder, tag count and the preference counters out of the Organization form and calls the label field Name', () => {
    const fields = schemas.get('Organization')!.objectSchema!;
    for (const name of ['placeholder', 'tag_count', 'preference_version', 'preference_mutations']) expect(isInternalField(name, fields), name).toBe(true);
    expect(isInternalField('billing_contact_email', fields)).toBe(false);
    const form = walk(schemas.get('Organization')!.screens.find(node => node.id === 'form-screen')!.children!);
    const edited = form.filter(node => typeof node.props?.field === 'string' && ['Input', 'Select', 'Textarea', 'Checkbox', 'DatePicker'].includes(node.component));
    for (const name of ['placeholder', 'tag_count']) expect(edited.map(node => node.props!.field), name).not.toContain(name);
    expect(form.filter(node => node.component === 'FormLabelGroup')).toHaveLength(0);
    expect(edited.find(node => node.props!.field === 'label')?.props?.label).toBe('Name');
    const code = file('Organization', 'src/screens/Form.tsx');
    expect(code).not.toContain('name="placeholder"');
    expect(code).not.toContain('name="tag_count"');
    const application = file('Organization', 'src/application.ts');
    expect(application).not.toContain('"name":"preference_version"');
    expect(application).not.toContain('"name":"preference_mutations"');
  });
});

describe('Subscription detail tells one story', () => {
  it('orders Billing before the read-only Details and hides internal fields there', () => {
    const tabs = walk(schemas.get('Subscription')!.screens.find(node => node.id === 'detail-screen')!.children!).find(node => node.component === 'Tabs')!;
    expect(tabs.children!.map(panel => panel.props?.label)).toEqual(['Billing', 'Details']);
    const rows = walk([tabs.children!.at(-1)!]).flatMap(node => typeof node.props?.field === 'string' ? [node.props.field] : []);
    expect(rows).not.toContain('allowed_transitions');
    expect(rows).toContain('plan_interval');
  });

  it('keeps declared interval and outcome values without inventing customer names or history', () => {
    // s219-m01: Subscription authors its customers, payments and outcomes; the seed carries exactly those, per plan.
    const schema = schemas.get('Subscription')!;
    const records = workflowSampleRecords(schema);
    const examples = (field: string) => schema.objectSchema![field]!.examples!;
    // s222-m03 (#2502 ruling 14): one record per authored sample (eight), matched by its key, since customers now share plans.
    expect(records).toHaveLength(8);
    for (const record of records) {
      const authored = examples('subscription_id').indexOf(record.subscription_id);
      expect(record.customer_name).toBe(examples('customer_name')[authored]);
      expect(schema.objectSchema!.payment_status!.enum).toContain(record.payment_status);
      expect(record.payment_status).toBe(examples('payment_status')[authored]);
      expect(record.payment_history).toEqual(examples('payment_history')[authored]);
    }
  });
});

describe('the paginator keeps its narrow layout', () => {
  it('scopes the workflow screen navigation rule to the direct child nav so the PaginationBar grid applies under 600px', () => {
    const css = file('Subscription', 'src/app.css');
    expect(css).toContain('.workflow-app > nav {');
    expect(css).not.toMatch(/\.workflow-app nav \{/);
  });
});

describe('a saved edit is history', () => {
  function link(source: string, target: string) {
    mkdirSync(path.dirname(target), { recursive: true });
    symlinkSync(source, target, 'junction');
  }

  it('appends an Updated entry naming the edited fields, refreshes updated_at and keeps cancellation entries single', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oods-s201-store-'));
    try {
      // s213-m01: the store is transpiled to CommonJS .js, so the folder declares that scope itself; a temp folder inside a
      // "type": "module" package (the handoff keeps TMPDIR in the repository) otherwise loads it as ESM.
      writeFileSync(path.join(directory, 'package.json'), '{"type":"commonjs"}\n');
      for (const name of ['store', 'sample-data', 'chart-assets']) {
        writeFileSync(path.join(directory, `${name}.js`), ts.transpileModule(file('Subscription', `src/${name}.ts`), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      link(path.join(root, 'packages/component-contracts'), path.join(directory, 'node_modules/@oods/component-contracts'));
      const req = createRequire(path.join(directory, 'entry.cjs'));
      const { createStore } = req('./store.js');
      const store = createStore({ latency: 0, now: () => '2026-09-15T12:00:00.000Z' });
      // s222-m03 (#2502 ruling 14): Northwind Traders' Business sample, active since its trial converted (two entries).
      const before = store.get('sub_northwind_business');
      expect(before.state_history).toHaveLength(2);
      const edited = { ...before, plan_name: 'Team annual', amount: 1999 };
      const saved = store.update(edited);
      expect(saved.plan_name).toBe('Team annual');
      expect(saved.updated_at).toBe('2026-09-15T12:00:00.000Z');
      expect(saved.state_history).toHaveLength(before.state_history.length + 1);
      expect(saved.state_history.at(-1)).toEqual({ title: 'Updated', from: null, to: 'active', at: '2026-09-15T12:00:00.000Z', reason: 'Edited Amount, Plan name; a new billing period started' });
      // Saving the same record again records nothing new.
      expect(store.update(store.get('sub_northwind_business')).state_history).toHaveLength(saved.state_history.length);
      // A status edit is a transition with its own title.
      const paused = store.update({ ...store.get('sub_northwind_business'), status: 'paused' });
      expect(paused.state_history.at(-1)).toMatchObject({ title: 'Paused', from: 'active', to: 'paused', reason: 'Edited Status' });
      // Cancellation still writes exactly one entry through its own path.
      const cancelled = store.cancel('sub_lindqvist_starter', 'Budget', 'customer_request', true);
      expect(cancelled.state_history.filter((entry: { to: string }) => entry.to === 'pending_cancellation')).toHaveLength(1);
      expect(file('Subscription', 'src/application.ts')).toContain('store.update(state.draft)');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
