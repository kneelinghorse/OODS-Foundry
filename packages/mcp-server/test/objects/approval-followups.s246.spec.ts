/**
 * s246-m01: the approval model says and checks what Forge told Writing-and-Strategy it would (#2876). These specs pin
 * why each part matters:
 * - who is asking is the fifth fact on the screen where an answer is given: the person answering sees who wants the yes,
 *   and for whom when an agent or a delegate asks. It is refused when left out and warned when not kept, like the other
 *   four; who it is asked for is held to the screen only when the record keeps it. An import that keeps its asker as a
 *   read-only reference, by its id alone, still accepts, and its answer screen reads who asked;
 * - a fact counts only beside the answer: on the answer's own screen, not in another tab, and not on the other side of a
 *   dialog. Every answer control on a screen needs the facts beside it;
 * - Approval declares the order of its states and its endings are final; OODS Foundry keeps the order as data and holds
 *   only its own samples to it, since the product is what enforces it;
 * - the worked example obeys its own rule: what was shown is what the yes approves, so the correction is in the shown
 *   line and Ruth Adeyemi's comment is a remark.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { parameterProblems } from '../../src/objects/parameter-validation.js';
import { APPROVAL_FACTS, enforceApprovalFacts } from '../../src/compose/approval-facts.js';
import { FORM_FACT } from '../../src/compose/form-detail.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { getDefinition } from '../../src/errors/registry.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html).textContent ?? '').replace(/\s+/g, ' ');
type Sample = Record<string, unknown>;
type Step = { from: string | null; to: string };
const CORRECTED = 'Resend $12,000.00 by bank transfer for INV-2026-0155, with the invoice number in the reference';
const FINAL = ['declined', 'out_of_date', 'taken_back', 'expired', 'withdrawn', 'not_needed', 'used'];

describe('who is asking is the fifth fact on the screen where an answer is given', () => {
  it('names five facts, the fifth carrying who it is asked for, and the registry says five', () => {
    expect(APPROVAL_FACTS.map(({ fact }) => fact)).toEqual(['the thing', 'exactly what was shown', 'the level', 'the meaning', 'who is asking']);
    expect(APPROVAL_FACTS[4]).toMatchObject({ fields: ['requested_by_id', 'requested_by_name'], also: { fact: 'who it is asked for', fields: ['requested_for_id', 'requested_for_name'] } });
    expect(getDefinition('OODS-V221')!.cause).toContain('who is asking');
    expect(getDefinition('OODS-V222')!.cause).toContain('who is asking');
  });

  it("reads who asked and for whom on Approval's form, after the meaning and before the answer, in HTML, React and Vue", async () => {
    const { schema } = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const nodes = schemaNodes(schema);
    const rows = nodes.filter(node => node.meta?.intent === FORM_FACT);
    // The name is read; the id's row would only repeat it.
    expect(rows.map(row => row.children?.[1]?.props?.field)).toEqual(['subject_name', 'shown', 'level', 'meaning', 'requested_by_name', 'requested_for_name']);
    const order = nodes.map(node => node.meta?.intent === FORM_FACT ? String(node.children?.[1]?.props?.field) : node.component === 'StatusSelector' ? 'answer' : '').filter(Boolean);
    expect(order.indexOf('requested_for_name')).toBeLessThan(order.indexOf('answer'));
    const workflow = (await compose({ object: 'Approval', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    const html = String((await pipeline({ object: 'Approval', context: 'form', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
    const pages: Record<string, string> = { html };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      pages[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context: 'form', object: 'Approval', workflowSchema: workflow }), result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    for (const [renderer, page] of Object.entries(pages)) {
      const body = text(page);
      for (const label of ['Asked by', 'Asked for']) expect(body, `${renderer}: ${label}`).toContain(label);
      const fragment = JSDOM.fragment(page);
      for (const field of ['requested_by_id', 'requested_by_name', 'requested_for_id', 'requested_for_name']) expect(fragment.querySelectorAll(`input[name="${field}"], select[name="${field}"], textarea[name="${field}"]`).length, `${renderer}: ${field}`).toBe(0);
    }
  });

  it('refuses a screen that leaves out who is asking or, when the record keeps it, who it is asked for', async () => {
    const result = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    const composed = composeObject(loadObject('Approval'));
    const without = (fields: string[]) => {
      const schema = structuredClone(result.schema);
      const drop = (node: UiElement): void => { node.children = node.children?.filter(child => !Object.values(child.props ?? {}).some(value => fields.includes(String(value))) && !(child.meta?.intent === FORM_FACT && fields.includes(String(child.children?.[1]?.props?.field)))); node.children?.forEach(drop); };
      schema.screens.forEach(drop);
      return schema;
    };
    expect(() => enforceApprovalFacts(without(['requested_by_id', 'requested_by_name']), composed)).toThrowError(expect.objectContaining({ opiCode: 'OODS-V221', message: expect.stringContaining('without showing who is asking where the answer is given'), details: expect.objectContaining({ facts: ['who is asking'] }) }));
    expect(() => enforceApprovalFacts(without(['requested_for_id', 'requested_for_name']), composed)).toThrowError(expect.objectContaining({ opiCode: 'OODS-V221', details: expect.objectContaining({ facts: ['who it is asked for'] }) }));
    expect(enforceApprovalFacts(result.schema, composed)).toEqual([]);
  });

  describe('records that keep some of the parties', () => {
    let home: string;
    const previous = { objects: process.env.OODS_OBJECTS_DIR, traits: process.env.OODS_TRAITS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
    const DECISION_FIELDS = Object.keys(loadTrait('core/Decision').schema);
    // An approval table as an import accepts it: every fact but the named ones unbound, the answer the source's status.
    const table = (name: string, keep: Record<string, string>) => fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), [
      `object: { name: ${name}, version: 1.0.0, domain: imported, description: Imported approval table. }`,
      'schema:',
      '  decision: { type: string, required: true, description: The answer., validation: { enum: [pending, approved, declined] } }',
      ...Object.values(keep).map(field => `  ${field}: { type: string, required: false, readOnly: true, description: A kept fact. }`),
      'traits:',
      '  - name: Stateful',
      '    parameters: { states: [pending, approved, declined], initialState: pending }',
      '    fieldBindings: { status: decision, state_history: null, allowed_transitions: null }',
      '  - name: Decision',
      `    fieldBindings: ${JSON.stringify(Object.fromEntries(DECISION_FIELDS.map(field => [field, keep[field] ?? null])))}`,
      'samples:',
      `  - { decision: approved${Object.values(keep).map(field => `, ${field}: kept ${field}`).join('')} }`,
      'metadata: { supportedContexts: [list, detail, form] }',
    ].join('\n') + '\n');
    const facts = { subject_name: 'thing', shown: 'shown_text', level: 'level_text', meaning: 'meaning_text' };
    beforeAll(() => {
      home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s246-m01-'));
      for (const kind of ['objects', 'traits']) fs.mkdirSync(path.join(home, kind));
      table('NoAsker', facts);
      table('AskerOnly', { ...facts, requested_by_name: 'asker' });
      table('AskerById', { ...facts, requested_by_id: 'asker_ref' });
      table('ForWhomOnly', { ...facts, requested_for_name: 'on_behalf_of' });
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
    const form = (object: string) => compose({ object, context: 'form', options: { transient: true } } as never) as Promise<{ status: string; schema: UiSchema; warnings?: Array<{ code: string; message: string }> }>;
    const v222 = (result: { warnings?: Array<{ code: string; message: string }> }) => (result.warnings ?? []).filter(warning => warning.code === 'OODS-V222').map(warning => warning.message);
    const factRows = (schema: UiSchema) => schemaNodes(schema).filter(node => node.meta?.intent === FORM_FACT).map(row => row.children?.[1]?.props?.field);

    it('warns, naming who is asking, when the record keeps no asker, and the form composes', async () => {
      const result = await form('NoAsker');
      expect(result.status).toBe('ok');
      expect(v222(result)).toEqual([expect.stringContaining('do not keep who is asking')]);
    });

    it('says nothing of who it is asked for when the record keeps no one: a person who asks for themselves names no one else', async () => {
      const result = await form('AskerOnly');
      expect(result.status).toBe('ok');
      expect(result.warnings?.map(warning => warning.code) ?? []).not.toContain('OODS-V222');
      expect(factRows(result.schema)).toEqual(['thing', 'shown_text', 'level_text', 'meaning_text', 'asker']);
    });

    it('reads an asker kept by its id alone, read-only, as a fact: the id is shown and never edited', async () => {
      const result = await form('AskerById');
      expect(result.status).toBe('ok');
      expect(factRows(result.schema)).toContain('asker_ref');
      expect(schemaNodes(result.schema).filter(node => node.props?.field === 'asker_ref' && node.component !== 'Text')).toEqual([]);
    });

    it('holds who it is asked for to the screen when the record keeps it, even with no asker', async () => {
      const result = await form('ForWhomOnly');
      expect(result.status).toBe('ok');
      expect(factRows(result.schema)).toContain('on_behalf_of');
      expect(v222(result)).toEqual([expect.stringContaining('do not keep who is asking')]);
    });
  });
});

describe('an import that keeps its asker as a read-only reference, by its id alone', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's246-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
  afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });

  it('is accepted with no rollback, and its answer screen reads who asked', async () => {
    // The one asked and the asker are both references to a person; the asker is written by the source system (readOnly).
    const source = { openapi: '3.0.1', info: { title: 'Sign-offs', version: '1' }, paths: {}, components: { schemas: {
      UserDTO: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
      SignOff: { type: 'object', properties: {
        id: { type: 'string' },
        approver: { allOf: [{ $ref: '#/components/schemas/UserDTO' }], description: 'Who is asked.' },
        requested_by: { allOf: [{ $ref: '#/components/schemas/UserDTO' }], description: 'Who asked.', readOnly: true },
        decision: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
      } },
    } } };
    const staged = await importObjects({ action: 'draft', source: { content: JSON.stringify(source), name: 'signoffs.openapi.json', format: 'openapi' } } as never) as { directory: string; importId: string };
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; definition: { schema: Record<string, { readOnly?: boolean }> }; proposals: Array<{ id: string; valid: boolean; grade: string; trait: { name: string; fieldBindings?: Record<string, string | null> } }> }>;
    const signOff = drafts.find(draft => draft.name === 'SignOff')!;
    const decision = signOff.proposals.find(item => item.trait.name === 'Decision')!;
    // The case the plan's review found: the asker bound by its id, the name not, the source field read-only.
    expect(decision.trait.fieldBindings).toMatchObject({ asked_of_id: 'approver', requested_by_id: 'requested_by' });
    expect(decision.trait.fieldBindings?.requested_by_name ?? null).toBeNull();
    expect(signOff.definition.schema.requested_by).toMatchObject({ readOnly: true });
    const applied = await importObjects({ action: 'apply', importId: staged.importId, objects: drafts.map(draft => ({ name: draft.name, proposals: draft.proposals.filter(item => item.valid && item.grade !== 'weak').map(item => item.id) })) } as never) as { applied: Array<{ name: string; contexts: string[] }> };
    expect(applied.applied.find(item => item.name === 'SignOff')?.contexts).toContain('form');
    const answer = await compose({ object: 'SignOff', context: 'form', options: { transient: true } } as never) as { status: string; schema: UiSchema; warnings?: Array<{ code: string; message: string }> };
    expect(answer.status).toBe('ok');
    const rows = schemaNodes(answer.schema).filter(node => node.meta?.intent === FORM_FACT);
    expect(rows.map(row => row.children?.[1]?.props?.field)).toContain('requested_by');
    expect(rows.find(row => row.children?.[1]?.props?.field === 'requested_by')?.children?.[0]?.props?.content).toBe('Asked by');
    // It still warns for what the source does not keep, and never names who is asking.
    const warning = (answer.warnings ?? []).find(item => item.code === 'OODS-V222')?.message ?? '';
    expect(warning).toContain('do not keep the thing, exactly what was shown, the level or the meaning');
    expect(warning).not.toContain('who is asking');
  });
});

describe('a fact counts only beside the answer, on its own screen and not in another tab or across a dialog', () => {
  const composed = composeObject(loadObject('Approval'));
  let id = 0;
  const node = (component: string, props?: Record<string, unknown>, children?: UiElement[]): UiElement => ({ id: `n${++id}`, component, ...(props ? { props } : {}), ...(children ? { children } : {}) });
  const facts = (...fields: string[]) => (fields.length ? fields : ['subject_name', 'shown', 'level', 'meaning', 'requested_by_name', 'requested_for_name']).map(field => node('Text', { field }));
  const answer = () => node('StatusSelector', { field: 'status' });
  const schema = (...screens: UiElement[]) => ({ version: '2025.11', screens }) as unknown as UiSchema;
  const refusal = (value: UiSchema) => { try { enforceApprovalFacts(value, composed); return undefined; } catch (error) { return error as { opiCode: string; message: string; details: { facts: string[]; where?: Record<string, string[]> } }; } };

  it('refuses facts on another screen of the same schema, which 0.13.0 counted (called directly: design_compose composes one screen)', () => {
    const error = refusal(schema(node('Stack', undefined, facts()), node('Stack', undefined, [answer()])));
    expect(error).toMatchObject({ opiCode: 'OODS-V221', details: { facts: ['the thing', 'exactly what was shown', 'the level', 'the meaning', 'who is asking', 'who it is asked for'] } });
    expect(error!.details.where!['the level']).toEqual(['on another screen']);
    expect(error!.message).toContain('the level is on another screen');
  });

  it('refuses facts in another tab, and accepts them in the answer\'s tab or above the tabs', () => {
    const tabbed = refusal(schema(node('Stack', undefined, [node('Tabs', undefined, [node('Stack', undefined, facts()), node('Stack', undefined, [answer()])])])));
    expect(tabbed).toMatchObject({ opiCode: 'OODS-V221', details: { where: { 'the meaning': ['in another tab'] } } });
    expect(tabbed!.message).toContain('without showing the thing, exactly what was shown, the level, the meaning, who is asking or who it is asked for where the answer is given (the thing is in another tab;');
    expect(refusal(schema(node('Stack', undefined, [node('Tabs', undefined, [node('Stack', undefined, [...facts(), answer()]), node('Stack')])])))).toBeUndefined();
    expect(refusal(schema(node('Stack', undefined, [...facts(), node('Tabs', undefined, [node('Stack', undefined, [answer()]), node('Stack')])])))).toBeUndefined();
  });

  it('treats a Tabs with a single panel as hiding nothing: that panel is always the one shown', () => {
    expect(refusal(schema(node('Stack', undefined, [node('Tabs', undefined, [node('Stack', undefined, facts())]), answer()])))).toBeUndefined();
  });

  it('separates a dialog both ways: a fact in a dialog the answer is not in, or outside the dialog the answer is in', () => {
    const inDialog = refusal(schema(node('Stack', undefined, [node('Dialog', { title: 'Details' }, facts('level')), ...facts('subject_name', 'shown', 'meaning', 'requested_by_name', 'requested_for_name'), answer()])));
    expect(inDialog).toMatchObject({ opiCode: 'OODS-V221', details: { facts: ['the level'], where: { 'the level': ['in a dialog'] } } });
    expect(inDialog!.message).toContain('(the level is in a dialog)');
    const answerInDialog = refusal(schema(node('Stack', undefined, [...facts(), node('Dialog', { title: 'Answer' }, [answer()])])));
    expect(answerInDialog!.details.where!['the thing']).toEqual(['outside the dialog the answer is in']);
    expect(refusal(schema(node('Stack', undefined, [node('Dialog', { title: 'Answer' }, [...facts(), answer()])])))).toBeUndefined();
  });

  it('needs the facts beside every answer control on a screen, and names a fact once wherever it is missing', () => {
    const two = refusal(schema(node('Stack', undefined, [...facts(), answer(), node('Dialog', { title: 'Answer again' }, [answer()])])));
    expect(two).toMatchObject({ opiCode: 'OODS-V221', details: { facts: ['the thing', 'exactly what was shown', 'the level', 'the meaning', 'who is asking', 'who it is asked for'] } });
    expect(two!.details.where!['the level']).toEqual(['outside the dialog the answer is in']);
    expect(refusal(schema(node('Stack', undefined, [...facts(), answer(), node('Card', undefined, [answer()])])))).toBeUndefined();
  });

  it('composes Approval\'s own form and its workflow\'s form as in 0.13.0: every fact sits beside the answer', async () => {
    const form = await compose({ object: 'Approval', context: 'form', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(form.status).toBe('ok');
    expect(enforceApprovalFacts(form.schema, composed)).toEqual([]);
    expect((await compose({ object: 'Approval', context: 'workflow', options: { transient: true } } as never) as { status: string }).status).toBe('ok');
  });
});

describe('Approval declares the order of its states, and the product enforces it', () => {
  const approval = loadObject('Approval');
  const lifecycle = approval.traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as { states: string[]; initialState: string; transitionRules: Record<string, string[]> };
  const samples = (approval.samples ?? []) as Sample[];

  it('names only declared states, gives every state a list, and writes the seven endings as empty lists', () => {
    const declared = new Set(lifecycle.states);
    expect(Object.keys(lifecycle.transitionRules).sort()).toEqual([...lifecycle.states].sort());
    for (const [from, targets] of Object.entries(lifecycle.transitionRules)) for (const to of targets) expect(declared.has(to), `${from} -> ${to}`).toBe(true);
    expect(Object.entries(lifecycle.transitionRules).filter(([, targets]) => !targets.length).map(([state]) => state).sort()).toEqual([...FINAL].sort());
    expect(lifecycle.transitionRules).toMatchObject({ not_yet_asked: ['waiting', 'withdrawn', 'not_needed'], waiting: ['approved', 'declined', 'expired', 'withdrawn', 'not_needed'] });
  });

  it('every sample\'s history follows the order from nothing to not yet asked, and ends at its status', () => {
    for (const sample of samples) {
      const history = sample.state_history as Step[];
      expect(history[0], String(sample.name)).toMatchObject({ from: null, to: lifecycle.initialState });
      for (const step of history.slice(1)) expect(lifecycle.transitionRules[step.from!], `${sample.name}: ${step.from} -> ${step.to}`).toContain(step.to);
      expect(history.at(-1)!.to, String(sample.name)).toBe(sample.status);
    }
  });

  it('validates under the loosened parameter schema, as does Stateful\'s own example with its final state', () => {
    expect(parameterProblems('lifecycle/Stateful', lifecycle as never)).toEqual([]);
    expect(parameterProblems('lifecycle/Stateful', { states: ['draft', 'active', 'paused', 'archived'], initialState: 'draft', transitionRules: { draft: ['active', 'archived'], active: ['paused', 'archived'], paused: ['active', 'archived'], archived: [] } })).toEqual([]);
    // A target list is still a list of names.
    expect(parameterProblems('lifecycle/Stateful', { states: ['a', 'b'], initialState: 'a', transitionRules: { a: [''] } }).length).toBeGreaterThan(0);
  });

  it('says who enforces it: Stateful 2.2.1 names the product, and the samples leave allowed_transitions to it', () => {
    const stateful = loadTrait('lifecycle/Stateful');
    expect(stateful.trait.version).toBe('2.2.1');
    expect(stateful.trait.description).toContain('The product does that enforcing');
    expect(stateful.trait.description).toContain('a generated StatusSelector offers every state');
    for (const sample of samples) expect(sample, String(sample.name)).not.toHaveProperty('allowed_transitions');
  });
});

describe('the worked example obeys its own rule: what was shown is what the yes approves', () => {
  const approvals = (loadObject('Approval').samples ?? []) as Sample[];
  const resend = approvals.find(sample => sample.subject_id === 'PAY-2026-0429')!;
  const rule = loadObject('Transaction').traits.find(trait => trait.name === 'core/Approvable')!.parameters as { levelDefinitions: Record<string, Record<string, string>> };

  it('puts the correction in the shown line, so the comment is a remark', () => {
    expect(resend.shown).toBe(CORRECTED);
    expect(resend.comment).toBe('Go ahead, with the invoice number in the reference');
    expect(String(resend.shown)).toContain('with the invoice number in the reference');
    expect(loadTrait('core/Decision').schema.shown!.description!.replace(/\s+/g, ' ')).toContain(CORRECTED);
  });

  it("states in the payment's rule what the shown line carries and when the yes is used, each within 160 characters", () => {
    expect(rule.levelDefinitions.approval!.shown).toBe('The amount, the method, the invoice it is for, and anything this resend must do differently');
    expect(rule.levelDefinitions.approval!.lapses).toBe('Once it is used (the resend is sent and recorded, not when the bank answers), or when the amount changes');
    for (const [level, definition] of Object.entries(rule.levelDefinitions)) for (const [key, value] of Object.entries(definition)) expect(value.length, `${level}.${key}`).toBeLessThanOrEqual(160);
    expect(loadObject('Transaction').object.version).toBe('1.2.1');
  });
});
