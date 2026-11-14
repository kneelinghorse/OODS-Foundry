/**
 * s248-m01 (next step 1871): a fact behind a dialog is not shown. The approval-facts rule held each answer control to the
 * five facts beside it, and counted a Dialog only for what its children bind: a Dialog that bound a fact through its own
 * props (a team trait's form view `{ component: Dialog, props: { field: shown } }`) counted as showing it beside the
 * answer, though a closed dialog shows nothing; and so did a multi-panel Tabs, which shows one panel at a time. Both now
 * hide what they bind themselves, as they hide their children's, and every shipped answer screen still composes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enforceApprovalFacts } from '../../src/compose/approval-facts.js';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { schemaNodes } from '../../src/codegen/preview-model.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

type Refusal = { opiCode: string; message: string; details: { facts: string[]; where?: Record<string, string[]> } };
const refusal = (schema: UiSchema, composed: ReturnType<typeof composeObject>): Refusal | undefined => {
  try { enforceApprovalFacts(schema, composed); return undefined; } catch (error) { return error as Refusal; }
};

describe('a fact a Dialog or a multi-panel Tabs binds through its own props is hidden, as its children\'s are', () => {
  const composed = composeObject(loadObject('Approval'));
  let id = 0;
  const node = (component: string, props?: Record<string, unknown>, children?: UiElement[]): UiElement => ({ id: `d${++id}`, component, ...(props ? { props } : {}), ...(children ? { children } : {}) });
  const facts = (...fields: string[]) => fields.map(field => node('Text', { field }));
  const others = () => facts('subject_name', 'level', 'meaning', 'requested_by_name', 'requested_for_name');
  const answer = () => node('StatusSelector', { field: 'status' });
  const schema = (...children: UiElement[]) => ({ version: '2025.11', screens: [node('Stack', undefined, children)] }) as unknown as UiSchema;

  it('refuses exactly what was shown bound only by a Dialog\'s own props, naming where it is', () => {
    const error = refusal(schema(node('Dialog', { title: 'What was shown', field: 'shown' }), ...others(), answer()), composed);
    expect(error).toMatchObject({ opiCode: 'OODS-V221', details: { facts: ['exactly what was shown'], where: { 'exactly what was shown': ['in a dialog'] } } });
  });

  it('refuses a fact bound only by a multi-panel Tabs\' own props, and not one a single-panel Tabs binds', () => {
    const tabs = (...panels: UiElement[]) => node('Tabs', { field: 'shown' }, panels);
    const error = refusal(schema(tabs(node('Stack'), node('Stack')), ...others(), answer()), composed);
    expect(error).toMatchObject({ opiCode: 'OODS-V221', details: { facts: ['exactly what was shown'], where: { 'exactly what was shown': ['in another tab'] } } });
    expect(refusal(schema(tabs(node('Stack')), ...others(), answer()), composed)).toBeUndefined();
  });

  it('accepts the fact where the answer is given inside the same dialog, or shown beside the answer as well', () => {
    expect(refusal(schema(node('Dialog', { title: 'Answer', field: 'shown' }, [...others(), answer()])), composed)).toBeUndefined();
    expect(refusal(schema(node('Dialog', { title: 'What was shown', field: 'shown' }), ...facts('shown'), ...others(), answer()), composed)).toBeUndefined();
  });
});

describe('a team trait\'s form view that puts a fact in a dialog\'s own props, and every shipped answer screen', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, traits: process.env.OODS_TRAITS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s248-1871-'));
    for (const kind of ['objects', 'traits']) fs.mkdirSync(path.join(home, kind));
    fs.writeFileSync(path.join(home, 'traits', 'ShownInDialog.trait.yaml'), [
      'trait: { name: ShownInDialog, version: 1.0.0, description: A team trait that shows what was asked about in a dialog., category: workflow }',
      'schema: {}',
      'view_extensions:',
      '  form:',
      '    - { component: Dialog, position: main, priority: 5, props: { title: What was shown, field: shown } }',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(home, 'objects', 'DialogApproval.object.yaml'), [
      'object: { name: DialogApproval, version: 1.0.0, domain: test, description: A team approval that shows what was asked in a dialog. }',
      'traits:',
      '  - name: core/Decision',
      '  - name: lifecycle/Stateful',
      '    parameters: { states: [not_yet_asked, waiting, approved, declined], initialState: not_yet_asked }',
      '  - name: ShownInDialog',
      'schema:',
      '  name: { type: string, required: true, description: What is asked. }',
    ].join('\n') + '\n');
    Object.assign(process.env, { OODS_OBJECTS_DIR: path.join(home, 'objects'), OODS_TRAITS_DIR: path.join(home, 'traits'), MCP_SCHEMA_STORE_ROOT: home });
    clearTraitCache(); clearObjectCache();
  });
  afterAll(() => {
    for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['OODS_TRAITS_DIR', previous.traits], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('the dialog\'s copy counts for nothing: with the form\'s own row for the fact taken out, the screen is refused', async () => {
    const result = await compose({ object: 'DialogApproval', context: 'form', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(result.status).toBe('ok');
    const dialogs = schemaNodes(result.schema).filter(item => item.component === 'Dialog' && item.props?.field === 'shown');
    expect(dialogs).toHaveLength(1);
    // The form reads the fact beside the answer as well, so the screen composes; the dialog alone would not show it.
    const withoutRow = structuredClone(result.schema);
    const strip = (item: UiElement): void => { item.children = item.children?.filter(child => !(child.meta?.intent === 'form-fact' && child.children?.some(part => part.props?.field === 'shown'))); item.children?.forEach(strip); };
    withoutRow.screens.forEach(strip);
    expect(refusal(withoutRow, composeObject(loadObject('DialogApproval')))).toMatchObject({ opiCode: 'OODS-V221', details: { where: { 'exactly what was shown': ['in a dialog'] } } });
  });

  it('Approval\'s form and workflow, and Transaction\'s and Article\'s answer screens, compose as in 0.14.0', async () => {
    for (const [object, context] of [['Approval', 'form'], ['Approval', 'workflow'], ['Transaction', 'form'], ['Article', 'form']] as const) {
      const result = await compose({ object, context, options: { transient: true } } as never) as { status: string };
      expect(result.status, `${object}/${context}`).toBe('ok');
    }
  });
});
