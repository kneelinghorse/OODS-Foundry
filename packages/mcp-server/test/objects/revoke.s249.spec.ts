import { vi } from 'vitest';

// Decision #1833: generation work has an explicit serial execution budget.
vi.setConfig({ testTimeout: 180_000 });

/**
 * s249-m03 (Interfaces 6 to 10): taking a grant back ends the yes, not the work. A generated app's Revoke, Pause and
 * Resume are each one change its store writes; a revoke asks once first, saying what ends with it, what is under way,
 * what it does not recall, what it leaves running and who is ending it; the store keeps the declared order for every
 * object that declares one; and told who is acting, the store names them. Every renderer offers each action only from the
 * states it moves from, and a grant has no Delete.
 */
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { declaredMoveRefusal } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { declaredOrder } from '../../src/objects/state-actions.js';
import { enumOptionLabel } from '../../src/compose/internal-fields.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { UNTOLD_ENDER } from '../../src/compose/ending-fields.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, renderGeneratedModels, runGeneratedApplication, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment: (html: string) => DocumentFragment } };
type Record_ = Record<string, any>;
const NOW = '2026-11-20T09:00:00.000Z';
const RUTH = { id: '8b2e4d6f-1a3c-4e5b-9d7f-2c4e6a8b0d02', name: 'Ruth Adeyemi', kind: 'person' };
const id = (n: number) => `4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c0${n}`;
const TIDEWATER = id(1), RESEND = id(2), MARLOW = id(3), BLUE_HARBOR = id(7);
const ORDERED = ['Approval', 'Task', 'Grant'] as const;
/** The words a page shows, each element's text apart from the next, as a person reads them. */
const shown = (html: string) => {
  const fragment = JSDOM.fragment(html);
  fragment.querySelectorAll('style, script, template, [hidden]').forEach(node => node.remove());
  const words: string[] = [];
  const walk = (node: Node) => { if (node.nodeType === 3) words.push(node.textContent ?? ''); else node.childNodes.forEach(walk); };
  walk(fragment);
  return words.map(word => word.trim()).filter(Boolean).join(' ');
};
/** The form's inputs for why it ended. s250-m04 (next step 1887, item 5): drawn only while the grant is open, the input is
 * labelled for an open grant; once the grant has ended, why is a fact labelled "Why it ended". */
const reasonInputs = (html: string) => { const fragment = JSDOM.fragment(html); return [...fragment.querySelectorAll('label')].filter(label => label.textContent?.trim() === 'Why it is ending, if you end it here' && fragment.querySelector(`[id="${label.htmlFor}"]`)?.matches('input, textarea')).length; };
const barLabels = (html: string) => [...JSDOM.fragment(html).querySelectorAll('[data-oods-screen-actions] button, .oods-action-bar button')].map(button => (button.textContent ?? '').trim());
const statusOptions = (html: string) => [...JSDOM.fragment(html).querySelectorAll('select[name="status"] option')].map(option => (option as HTMLOptionElement).value);

const workflows = {} as Record<string, UiSchema>;
const apps = {} as Record<string, Record<'react' | 'vue', GeneratedArtifact>>;
const samples = (object: string) => loadObject(object).samples as Record_[];
const file = (artifact: GeneratedArtifact, name: string) => artifact.files.find(entry => entry.path === name)!.contents;
const grantStore = (script: string) => runGeneratedStore(apps.Grant!.react.files, `const fresh = (options = {}) => store.createStore({ latency: 0, now: () => ${JSON.stringify(NOW)}, ...options });\n${script}`);
const grantApp = (script: string) => runGeneratedApplication(apps.Grant!.react.files, `const workflow = (options = {}) => app.createWorkflow({ latency: 0, now: () => ${JSON.stringify(NOW)}, ...options });\n${script}`);

beforeAll(async () => {
  for (const object of ORDERED) {
    const composed = await compose({ object, context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(composed.status, object).toBe('ok');
    workflows[object] = composed.schema;
    apps[object] = {} as Record<'react' | 'vue', GeneratedArtifact>;
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: composed.schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(generated.status, `${object} ${framework}: ${JSON.stringify(generated.errors)}`).toBe('ok');
      apps[object][framework] = generated.artifact;
    }
  }
}, 600_000);

describe('a declared action is one change the store writes (Interface 6)', () => {
  it('Revoke writes the state, the note only when one is given, a line titled Revoked with it as its reason, and the ended event; told no one, it names no one and never writes ended_as', () => {
    const out = grantStore(`
const before = fresh().get(${JSON.stringify(TIDEWATER)});
const noted = fresh().transition(${JSON.stringify(TIDEWATER)}, 'revoke', '  Moved to the new bank  ');
const silent = fresh().transition(${JSON.stringify(TIDEWATER)}, 'revoke');
process.stdout.write(JSON.stringify({ before, noted, silent }));`) as { before: Record_; noted: Record_; silent: Record_ };
    const line = (reason: string) => ({ title: 'Revoked', from: 'active', to: 'revoked', at: NOW, reason });
    for (const [record, reason, endedReason] of [[out.noted, 'Moved to the new bank', 'Moved to the new bank'], [out.silent, '', out.before.ended_reason]] as const) {
      expect(record).toEqual({ ...out.before, status: 'revoked', ended_reason: endedReason, last_event: 'ended', last_event_at: NOW, updated_at: NOW, state_history: [...out.before.state_history, line(reason)] });
    }
    // Nothing names who ended it, and the capacity they ended it in is the product's to write.
    for (const field of ['ended_by_id', 'ended_by_name', 'ended_by_kind', 'ended_as']) expect(out.noted[field], field).toBe(out.before[field]);
  });

  it('told who is acting, Revoke names them in its seat and signs its line, and so on each grant that ends with it', () => {
    const out = grantStore(`
const s = fresh({ actor: ${JSON.stringify(RUTH)} });
const outer = s.transition(${JSON.stringify(TIDEWATER)}, 'revoke', 'Moved to the new bank');
process.stdout.write(JSON.stringify({ outer, inner: s.get(${JSON.stringify(RESEND)}) }));`) as { outer: Record_; inner: Record_ };
    const signed = { actor_id: RUTH.id, actor_name: RUTH.name, actor_kind: RUTH.kind };
    for (const record of [out.outer, out.inner]) {
      expect({ id: record.ended_by_id, name: record.ended_by_name, kind: record.ended_by_kind }).toEqual({ id: RUTH.id, name: RUTH.name, kind: RUTH.kind });
      expect(record.ended_as).toBe('');
    }
    expect(out.outer.state_history.at(-1)).toEqual({ title: 'Revoked', from: 'active', to: 'revoked', at: NOW, reason: 'Moved to the new bank', ...signed });
    expect(out.inner.state_history.at(-1)).toEqual({ title: 'Revoked', from: 'active', to: 'revoked', at: NOW, reason: 'Ended with Tidewater invoices and payments', ...signed });
  });

  it('the grants inside end with it, each with its own line, and the outer grant\'s page then lists them ended', () => {
    const out = grantStore(`
const s = fresh();
s.transition(${JSON.stringify(TIDEWATER)}, 'revoke');
const inner = s.get(${JSON.stringify(RESEND)});
process.stdout.write(JSON.stringify({ inner, inside: s.related(s.get(${JSON.stringify(TIDEWATER)})).find((list) => list.id === 'inside'), others: s.list({ pageSize: 100 }).records.filter((record) => ![${JSON.stringify(TIDEWATER)}, ${JSON.stringify(RESEND)}].includes(record.grant_id)).map((record) => [record.name, record.status]) }));`) as { inner: Record_; inside: { rows: Array<{ title: string; state: string }> }; others: string[][] };
    expect(out.inner).toMatchObject({ status: 'revoked', last_event: 'ended', last_event_at: NOW });
    expect(out.inner.state_history.at(-1)).toEqual({ title: 'Revoked', from: 'active', to: 'revoked', at: NOW, reason: 'Ended with Tidewater invoices and payments' });
    expect(out.inside.rows.map(row => [row.title, row.state])).toEqual([['Resend returned transfers', 'revoked']]);
    // No other grant moves: the same holder's and party's grants that do not sit inside it are left as they were.
    expect(out.others.sort()).toEqual(samples('Grant').filter(sample => ![TIDEWATER, RESEND].includes(sample.grant_id)).map(sample => [sample.name, sample.status]).sort());
  });

  it('Pause and Resume write their state and event, and each is refused from a state it does not move from, in plain words', () => {
    const out = grantStore(`
const s = fresh();
const attempt = (run) => { try { run(); return 'ok'; } catch (error) { return error.message; } };
const resumeActive = attempt(() => s.transition(${JSON.stringify(TIDEWATER)}, 'resume'));
const paused = s.transition(${JSON.stringify(TIDEWATER)}, 'pause');
const pauseAgain = attempt(() => s.transition(${JSON.stringify(TIDEWATER)}, 'pause'));
const resumed = s.transition(${JSON.stringify(TIDEWATER)}, 'resume', 'Bank details checked');
const revokeRevoked = attempt(() => s.transition(${JSON.stringify(MARLOW)}, 'revoke'));
process.stdout.write(JSON.stringify({ resumeActive, paused, pauseAgain, resumed, revokeRevoked, resend: s.get(${JSON.stringify(RESEND)}).status }));`) as Record_;
    expect(out.resumeActive).toBe('This grant\'s status is Active; Resume is for a grant whose status is Paused.');
    expect(out.paused).toMatchObject({ status: 'paused', last_event: 'paused', last_event_at: NOW });
    expect(out.paused.state_history.at(-1)).toEqual({ title: 'Paused', from: 'active', to: 'paused', at: NOW, reason: '' });
    expect(out.pauseAgain).toBe('This grant\'s status is Paused; Pause is for a grant whose status is Active.');
    expect(out.resumed).toMatchObject({ status: 'active', last_event: 'resumed' });
    expect(out.resumed.state_history.at(-1)).toEqual({ title: 'Active', from: 'paused', to: 'active', at: NOW, reason: 'Bank details checked' });
    expect(out.revokeRevoked).toBe('This grant\'s status is Revoked, and that status is final.');
    // Only Revoke ends the grants inside: a pause leaves the standing yes as it was.
    expect(out.resend).toBe('active');
  });

  it('a saved move on the form that Revoke makes is Revoke, written as the button writes it, after the form\'s other change as an edit', () => {
    const out = grantStore(`
const button = fresh().transition(${JSON.stringify(TIDEWATER)}, 'revoke', 'Moved to the new bank');
const s = fresh();
const record = s.get(${JSON.stringify(TIDEWATER)});
const action = s.actionFor({ ...record, status: 'revoked' });
const form = s.update({ ...record, status: 'revoked', ended_reason: 'Moved to the new bank', name: 'Tidewater invoices (old)' });
process.stdout.write(JSON.stringify({ button, form, action: action && action.id, inner: s.get(${JSON.stringify(RESEND)}).status }));`) as { button: Record_; form: Record_; action: string; inner: string };
    expect(out.action).toBe('revoke');
    const { name, state_history: formLines, ...formRest } = out.form;
    const { name: _name, state_history: buttonLines, ...buttonRest } = out.button;
    expect(name).toBe('Tidewater invoices (old)');
    expect(formRest).toEqual(buttonRest);
    expect(formLines.slice(-2)).toEqual([{ title: 'Updated', from: null, to: 'active', at: NOW, reason: 'Edited Name' }, buttonLines.at(-1)]);
    expect(out.inner).toBe('revoked');
  });

  it('a move the lifecycle declares no action for saves as an edit, with an Edited line and the updated event', () => {
    const out = grantStore(`
const s = fresh();
process.stdout.write(JSON.stringify(s.update({ ...s.get(${JSON.stringify(id(8))}), status: 'expired' })));`) as Record_;
    expect(out).toMatchObject({ status: 'expired', last_event: 'updated' });
    expect(out.state_history.at(-1)).toEqual({ title: 'Expired', from: 'active', to: 'expired', at: NOW, reason: 'Edited Status' });
  });
});

describe('a final grant keeps how it ended (Interface 6)', () => {
  it('refuses a change to why or by whom it ended and any move out of it, and still saves its name', () => {
    const out = grantStore(`
const attempt = (run) => { try { return run().name; } catch (error) { return error.message; } };
const marlow = fresh().get(${JSON.stringify(MARLOW)});
process.stdout.write(JSON.stringify({
  reason: attempt(() => fresh().update({ ...marlow, ended_reason: 'Another reason' })),
  ender: attempt(() => fresh().update({ ...marlow, ended_by_name: 'Someone else' })),
  enderId: attempt(() => fresh().update({ ...marlow, ended_by_id: 'someone-else' })),
  back: attempt(() => fresh().update({ ...marlow, status: 'active' })),
  name: attempt(() => fresh().update({ ...marlow, name: 'Marlow Yoga bookings (closed)' })),
}));`) as Record<string, string>;
    expect(out).toEqual({
      reason: 'This grant\'s status is Revoked, and how it ended stays as it was recorded.',
      ender: 'This grant\'s status is Revoked, and how it ended stays as it was recorded.',
      enderId: 'This grant\'s status is Revoked, and how it ended stays as it was recorded.',
      back: 'This grant\'s status is Revoked, and that status is final.',
      name: 'Marlow Yoga bookings (closed)',
    });
  });

  it('renaming a revoked grant in the app reads «Changes saved in this session.»', () => {
    const out = grantApp(`
const flow = workflow();
await flow.navigate('form', ${JSON.stringify(MARLOW)});
flow.snapshot().draft.name = 'Marlow Yoga bookings (closed)'; // the form's edit, as edit() publishes it
flow.actions.handleSubmit();
await new Promise((resolve) => setTimeout(resolve, 50));
process.stdout.write(JSON.stringify({ notice: flow.snapshot().notice, screen: flow.snapshot().screen, name: flow.snapshot().draft.name, open: flow.snapshot().actionOpen }));`) as Record_;
    expect(out).toEqual({ notice: 'Changes saved in this session.', screen: 'detail', name: 'Marlow Yoga bookings (closed)', open: '' });
  });

  it('the form shows why it ended as a fact once final, and as an input while open, in React, Vue and HTML', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
    for (const sample of samples('Grant')) {
      const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), sample[field] ?? null]));
      const model = seedPreviewModel({ schema, context: 'form', object: 'Grant', established });
      const pages: Record<string, string> = { html: renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never) };
      for (const framework of ['react', 'vue'] as const) {
        const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { code: string; artifact: GeneratedArtifact };
        pages[framework] = renderGenerated(framework, result.code, model, result.artifact.actions.map(action => action.name));
      }
      const final = (declaredOrder(loadObject('Grant'))![sample.status] ?? []).length === 0;
      for (const [renderer, page] of Object.entries(pages)) {
        const where = `${renderer} ${sample.name} (${sample.status})`;
        expect(reasonInputs(page), where).toBe(final ? 0 : 1);
        if (final && sample.ended_reason) expect(shown(page), where).toContain(`Why it ended ${sample.ended_reason}`);
      }
    }
  });
});

describe('the store keeps the declared order (Interface 10)', () => {
  for (const object of ORDERED) {
    it(`${object}: refuses every move its order does not allow and any move out of a final state, in plain words, and saves the rest`, () => {
      const order = declaredOrder(loadObject(object))!;
      const words = { object: object.toLowerCase(), labels: Object.fromEntries(Object.keys(order).map(state => [state, enumOptionLabel(state)])) };
      const out = runGeneratedStore(apps[object]!.react.files, `
const fresh = () => store.createStore({ latency: 0, now: () => ${JSON.stringify(NOW)} });
const seen = new Set(); const out = [];
for (const record of fresh().list({ pageSize: 1000 }).records) {
  if (seen.has(record.status)) continue; seen.add(record.status);
  for (const status of ${JSON.stringify(Object.keys(order))}) {
    if (status === record.status) continue;
    try { out.push({ from: record.status, to: status, saved: fresh().update({ ...record, status }).status }); } catch (error) { out.push({ from: record.status, to: status, refused: error.message }); }
  }
}
process.stdout.write(JSON.stringify(out));`) as Array<{ from: string; to: string; saved?: string; refused?: string }>;
      expect(new Set(out.map(entry => entry.from)).size, `${object} samples reach several states`).toBeGreaterThan(2);
      expect(out.some(entry => entry.saved) && out.some(entry => entry.refused)).toBe(true);
      for (const entry of out) {
        const refusal = declaredMoveRefusal(order, entry.from, entry.to, words);
        if (order[entry.from]!.includes(entry.to)) expect(entry, `${entry.from} to ${entry.to}`).toEqual({ from: entry.from, to: entry.to, saved: entry.to });
        else expect(entry, `${entry.from} to ${entry.to}`).toEqual({ from: entry.from, to: entry.to, refused: refusal });
      }
      if (object === 'Grant') expect(out.find(entry => entry.from === 'revoked')?.refused).toBe('This grant\'s status is Revoked, and that status is final.');
    });

    it(`${object}: its status select offers the current state and the moves the order allows, alike in React, Vue and HTML, and in the app`, async () => {
      const order = declaredOrder(loadObject(object))!;
      const states = Object.keys(order);
      const { schema } = await compose({ object, context: 'form', options: { transient: true } } as never) as { schema: UiSchema };
      const generated = {} as Record<'react' | 'vue', { code: string; artifact: GeneratedArtifact }>;
      for (const framework of ['react', 'vue'] as const) generated[framework] = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as never;
      const reached = [...new Map(samples(object).map(sample => [sample.status, sample])).values()];
      for (const sample of reached) {
        const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), sample[field] ?? null]));
        const model = seedPreviewModel({ schema, context: 'form', object, established });
        const expected = states.filter(state => state === sample.status || order[sample.status]!.includes(state));
        expect(statusOptions(renderRecordBody(schema, { objectName: object, sampleModel: model } as never)), `html ${sample.status}`).toEqual(expected);
        for (const framework of ['react', 'vue'] as const) {
          expect(statusOptions(renderGenerated(framework, generated[framework].code, model, generated[framework].artifact.actions.map(action => action.name))), `${framework} ${sample.status}`).toEqual(expected);
          // The generated app's own Form screen, given the record as the app gives it.
          const form = file(apps[object]![framework], `src/screens/Form.${framework === 'react' ? 'tsx' : 'vue'}`);
          const props = { ...Object.fromEntries(Object.entries(sample).map(([key, value]) => [snakeToCamel(key), value])), uiState: 'success' };
          const [page] = renderGeneratedModels(framework, form, [props], apps[object]![framework].actions.map(action => action.name), { entry: `src/screens/Form.${framework === 'react' ? 'tsx' : 'vue'}`, files: apps[object]![framework].files });
          expect(statusOptions(page!), `app ${framework} ${sample.status}`).toEqual(expected);
        }
      }
    });
  }
});

describe('each action is offered only where the order allows, alike in every renderer, and a grant has no Delete (Interface 6)', () => {
  it('Grant\'s standalone detail offers Revoke on active and paused grants, Pause on active, Resume on paused, none on a final grant, and never Delete, in React, Vue and HTML', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema };
    const generated = {} as Record<'react' | 'vue', { code: string; artifact: GeneratedArtifact }>;
    for (const framework of ['react', 'vue'] as const) generated[framework] = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as never;
    const offered: Record<string, string[]> = { active: ['Edit', 'Pause grant', 'View timeline', 'Revoke grant'], paused: ['Edit', 'Resume grant', 'View timeline', 'Revoke grant'] };
    for (const sample of samples('Grant')) {
      const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), sample[field] ?? null]));
      const model = seedPreviewModel({ schema, context: 'detail', object: 'Grant', established });
      const pages: Record<string, string> = { html: renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never) };
      for (const framework of ['react', 'vue'] as const) pages[framework] = renderGenerated(framework, generated[framework].code, model, generated[framework].artifact.actions.map(action => action.name));
      for (const [renderer, page] of Object.entries(pages)) expect(barLabels(page), `${renderer} ${sample.name} (${sample.status})`).toEqual(offered[sample.status] ?? ['Edit', 'View timeline']);
    }
    for (const framework of ['react', 'vue'] as const) expect(generated[framework].artifact.actions.map(action => action.name), framework).not.toContain('handleDelete');
  });

  it('the measured Grant cell, Marlow\'s revoked grant, offers none of the three; other objects\' standalone details keep Delete', async () => {
    const html = String(((await pipeline({ object: 'Grant', context: 'detail', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
    expect(barLabels(html)).toEqual(['Edit', 'View timeline']);
    for (const object of ['Approval', 'Task'] as const) {
      const page = String(((await pipeline({ object, context: 'detail', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
      expect(barLabels(page), object).toContain('Delete');
    }
  });
});

describe('the confirmation asks once, and says what it ends and what goes on (Interface 7)', () => {
  it('on the Tidewater grant it names what ends with it, what is under way and what it leaves running, and keeps the grant until confirmed', () => {
    const out = grantApp(`
const flow = workflow();
await flow.navigate('detail', ${JSON.stringify(TIDEWATER)});
flow.actions.handleRevoke();
const opened = { open: flow.snapshot().actionOpen, preview: flow.actionPreview() };
flow.dismissAction();
const kept = { open: flow.snapshot().actionOpen, status: flow.snapshot().draft.status };
flow.actions.handleRevoke();
await flow.confirmAction('Moved to the new bank');
const done = flow.snapshot();
process.stdout.write(JSON.stringify({ opened, kept, done: { notice: done.notice, screen: done.screen, status: done.draft.status, reason: done.draft.ended_reason, open: done.actionOpen }, confirmation: app.confirmation }));`) as Record_;
    expect(out.opened.open).toBe('revoke');
    expect(out.opened.preview).toEqual({
      name: 'Tidewater invoices and payments',
      endsWith: ['Resend returned transfers'],
      notEnded: [],
      underWay: [{ title: 'Get INV-2026-0155 paid', state: 'Waiting' }, { title: 'PAY-2026-0429', state: 'Pending' }],
      leftRunning: [],
    });
    // What ends with it is under way nowhere else on the confirmation.
    expect(out.opened.preview.underWay.map((row: { title: string }) => row.title)).not.toContain('Resend returned transfers');
    expect(out.kept).toEqual({ open: '', status: 'active' });
    expect(out.done).toEqual({ notice: 'Tidewater invoices and payments is revoked. Resend returned transfers ended with it.', screen: 'detail', status: 'revoked', reason: 'Moved to the new bank', open: '' });
    expect(out.confirmation).toEqual({
      action: 'revoke', verb: 'Revoke', button: 'Revoke grant', keep: 'Keep it', reasonField: 'ended_reason',
      who: 'Who is ending it', untold: 'This app was not told who is ending it.', note: 'Note for the record (optional)',
      notEnded: 'Asked for and not yet answered, so it does not end with this one. Answer it on its own page.',
      notRecalled: 'Revoking changes this app\'s records and nothing else. Credentials issued under the grant may still work, and payments already sent are not recalled.',
      alternative: { action: 'pause', handler: 'handlePause', from: ['active'], lead: 'Not sure?', button: 'Pause it instead' },
    });
  });

  // s249-m05 (the fresh read): the confirmation's sections are headed as the page describes them, in React and Vue alike;
  // what revoking leaves is said to be unchanged by it, and no grant is said to run.
  it('heads the confirmation\'s sections alike in React and Vue', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true } } as never) as { artifact: GeneratedArtifact };
      const app = result.artifact.files.find(file => file.path === `src/App.${framework === 'react' ? 'tsx' : 'vue'}`)!.contents;
      for (const heading of ['Ends with it', 'Not ended with it', 'Still under way, not changed by this', 'Not recalled', 'Other grants still held for this party']) expect(app, `${framework}: ${heading}`).toContain(`<h3>${heading}</h3>`);
      expect(app, framework).not.toMatch(/Left running|<h3>Under way<\/h3>/);
    }
  });

  it('names a grant the same holder holds for the same party as left running, and a request inside it as not ended, and leaves both as they are', () => {
    const out = grantStore(`
const all = fresh().list({ pageSize: 1000 }).records;
const tidewater = all.find((record) => record.grant_id === ${JSON.stringify(TIDEWATER)});
const resend = all.find((record) => record.grant_id === ${JSON.stringify(RESEND)});
const beside = { ...tidewater, grant_id: '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c11', name: 'Tidewater statements' };
const asked = { ...resend, grant_id: '4d7a9c2e-1b3f-4e6a-9c8d-5e2f7a1b3c12', name: 'Write off small balances', status: 'requested' };
const s = fresh({ seed: [...all, beside, asked] });
const preview = s.preview(${JSON.stringify(TIDEWATER)}, 'revoke');
s.transition(${JSON.stringify(TIDEWATER)}, 'revoke');
process.stdout.write(JSON.stringify({ preview, after: [beside.grant_id, asked.grant_id, ${JSON.stringify(RESEND)}].map((key) => s.get(key).status) }));`) as Record_;
    expect(out.preview).toMatchObject({ endsWith: ['Resend returned transfers'], notEnded: ['Write off small balances'], leftRunning: [{ title: 'Tidewater statements', state: 'Active' }] });
    expect(out.after).toEqual(['active', 'requested', 'revoked']);
  });

  it('Pause is written at once and its result says how to resume; a paused grant shows the rule Resume follows', () => {
    const out = grantApp(`
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const flow = workflow();
await flow.navigate('detail', ${JSON.stringify(TIDEWATER)});
const ruleActive = flow.actionRule();
flow.actions.handlePause(); await settle();
const paused = { notice: flow.snapshot().notice, status: flow.snapshot().draft.status, rule: flow.actionRule() };
flow.actions.handleResume(); await settle();
const resumed = { notice: flow.snapshot().notice, status: flow.snapshot().draft.status };
await flow.navigate('detail', ${JSON.stringify(BLUE_HARBOR)});
process.stdout.write(JSON.stringify({ ruleActive, paused, resumed, blueHarbor: flow.actionRule() }));`) as Record_;
    expect(out.ruleActive).toBe('');
    expect(out.paused).toEqual({ notice: 'Tidewater invoices and payments is paused. Choose Resume on this page to resume it.', status: 'paused', rule: 'Only someone who may give grants for Tidewater Co-op should resume this grant; this app does not check.' });
    expect(out.resumed).toEqual({ notice: 'Tidewater invoices and payments is active again.', status: 'active' });
    expect(out.blueHarbor).toBe('Only someone who may give grants for Blue Harbor Studio should resume this grant; this app does not check.');
  });

  it('from the form, a move to revoked opens the same confirmation first, with the reason typed there as its note, and nothing is saved until it is confirmed', () => {
    const out = grantApp(`
const flow = workflow();
await flow.navigate('form', ${JSON.stringify(TIDEWATER)});
Object.assign(flow.snapshot().draft, { status: 'revoked', ended_reason: 'Moved to the new bank' }); // the form's edits, as edit() publishes them
flow.actions.handleSubmit();
const opened = { open: flow.snapshot().actionOpen, via: flow.snapshot().actionVia, ends: flow.actionPreview().endsWith };
flow.dismissAction();
const kept = { open: flow.snapshot().actionOpen, screen: flow.snapshot().screen };
flow.actions.handleSubmit();
await flow.confirmAction('Moved to the new bank');
const done = flow.snapshot();
process.stdout.write(JSON.stringify({ opened, kept, done: { notice: done.notice, screen: done.screen, status: done.draft.status, line: done.draft.state_history.at(-1), inner: done.records.length } }));`) as Record_;
    expect(out.opened).toEqual({ open: 'revoke', via: 'form', ends: ['Resend returned transfers'] });
    expect(out.kept).toEqual({ open: '', screen: 'form' });
    expect(out.done).toMatchObject({ notice: 'Tidewater invoices and payments is revoked. Resend returned transfers ended with it.', screen: 'detail', status: 'revoked', line: { title: 'Revoked', from: 'active', to: 'revoked', reason: 'Moved to the new bank' } });
  });
});

describe('who is acting (Interface 8)', () => {
  const ended = (actor?: typeof RUTH) => grantApp(`
const flow = workflow(${actor ? JSON.stringify({ actor }) : ''});
await flow.navigate('detail', ${JSON.stringify(TIDEWATER)});
flow.actions.handleRevoke();
const preview = flow.actionPreview();
await flow.confirmAction('');
const record = flow.snapshot().draft;
process.stdout.write(JSON.stringify({ preview, line: record.state_history.at(-1), props: { ...app.screenProps(record), events: app.collectionEvents(record), related: flow.related(record), uiState: 'success' } }));`) as { preview: Record_; line: Record_; props: Record_ };

  it('told no one, a line names no one, and the ended grant\'s page says the app was not told who ended it, in words a generated page may use', () => {
    const out = ended();
    expect(out.preview.actor).toBeUndefined();
    expect(out.line).toEqual({ title: 'Revoked', from: 'active', to: 'revoked', at: NOW, reason: '' });
    for (const framework of ['react', 'vue'] as const) {
      const detail = file(apps.Grant![framework], `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`);
      const [page] = renderGeneratedModels(framework, detail, [out.props], apps.Grant![framework].actions.map(action => action.name), { entry: `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`, files: apps.Grant![framework].files });
      expect(shown(page!), framework).toContain(`Ended by ${UNTOLD_ENDER}`);
      expect(shown(page!), framework).not.toMatch(/Not recorded|unavailable|not resolved/);
    }
  });

  it('told Ruth Adeyemi, the confirmation, the line and the page name her', () => {
    const out = ended(RUTH);
    expect(out.preview.actor).toEqual(RUTH);
    expect(out.line).toMatchObject({ actor_id: RUTH.id, actor_name: RUTH.name, actor_kind: RUTH.kind });
    for (const framework of ['react', 'vue'] as const) {
      const detail = file(apps.Grant![framework], `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`);
      const [page] = renderGeneratedModels(framework, detail, [out.props], apps.Grant![framework].actions.map(action => action.name), { entry: `src/screens/Detail.${framework === 'react' ? 'tsx' : 'vue'}`, files: apps.Grant![framework].files });
      expect(shown(page!), framework).toContain('Ended by Ruth Adeyemi');
      expect(shown(page!), framework).not.toContain(UNTOLD_ENDER);
    }
  });

  it('a revoked grant that names no ender says so alike in React, Vue and HTML; one that names its ender, or ended another way, does not', async () => {
    const { schema } = await compose({ object: 'Grant', context: 'detail', options: { transient: true } } as never) as { schema: UiSchema };
    const generated = {} as Record<'react' | 'vue', { code: string; artifact: GeneratedArtifact }>;
    for (const framework of ['react', 'vue'] as const) generated[framework] = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as never;
    const marlow = samples('Grant').find(sample => sample.grant_id === MARLOW)!;
    const untold = { ...marlow, ended_by_id: undefined, ended_by_name: undefined, ended_by_kind: undefined };
    const expiredUntold = { ...untold, status: 'expired' };
    for (const [record, says] of [[untold, true], [marlow, false], [expiredUntold, false]] as const) {
      const established = Object.fromEntries(Object.keys(schema.objectSchema ?? {}).map(field => [snakeToCamel(field), (record as Record_)[field] ?? null]));
      const model = seedPreviewModel({ schema, context: 'detail', object: 'Grant', established });
      const pages: Record<string, string> = { html: renderRecordBody(schema, { objectName: 'Grant', sampleModel: model } as never) };
      for (const framework of ['react', 'vue'] as const) pages[framework] = renderGenerated(framework, generated[framework].code, model, generated[framework].artifact.actions.map(action => action.name));
      for (const [renderer, page] of Object.entries(pages)) {
        const where = `${renderer} ${record.status} ${says ? 'untold' : 'told'}`;
        if (says) expect(shown(page), where).toContain(`Ended by ${UNTOLD_ENDER}`);
        else expect(shown(page), where).not.toContain(UNTOLD_ENDER);
      }
    }
  });
});
