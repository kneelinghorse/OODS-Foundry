/**
 * s255-m03: Memory's screens (Interface 2). A memory is read-only: the product that holds it writes it, so its page
 * offers no Edit, no Delete and no move. These specs pin, in React, Vue and HTML alike:
 * - it composes list, detail, timeline, card and inline; a form is refused in the words a read-only object's is, and it
 *   composes no workflow and declares no action;
 * - its page shows the words and how it was made, who made it, who keeps it and in what product, for whom and under which
 *   grant, the note on its source, what happens to it if its source goes, the person's statement, an expiry, and what
 *   removing it would leave, or, once removed, what remains;
 * - a removed memory shows no words, no note on its source and no statement, and its page says who removed it and when;
 * - where the product does not say how a memory was made, or what removing it would leave, the page says so;
 * - its lines name who acted and when, and no line, on any screen, holds a memory's words;
 * - the list filters by state and finds a memory by the person it is about, by who keeps it or by its grant; it has no
 *   origin filter, and the origin is on every row;
 * - every state a sample rests in has its tone, and removed is never a success;
 * - no screen says a memory was deleted, erased or forgotten.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation, recordCollectionEvents } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { seedSchema } from '../../src/compose/workflow-assembler.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { recordEventAliases } from '../../src/codegen/collection-emitter.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options?: Record<string, unknown>) => { window: Window & typeof globalThis } };
type Sample = Record<string, any>;
const RENDERERS = ['html', 'react', 'vue'] as const;
const CONTEXTS = ['list', 'detail', 'timeline', 'card', 'inline'] as const;
const RAW_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const STATES = ['active', 'paused', 'replaced', 'removed'];
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const documentOf = (html: string) => new JSDOM(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).window.document;
/** Every text node's words, joined by spaces, as the HTML cells' measure reads a page (s215-html-measure.ts). */
const textOf = (node: Node): string => {
  const pieces: string[] = [];
  const visit = (current: Node) => { if (current.nodeType === 3) { if (current.textContent?.trim()) pieces.push(current.textContent); return; } current.childNodes.forEach(visit); };
  visit(node);
  return words(pieces.join(' '));
};
/** The words a person sees, before the closed Reference details block, which lists every raw id by design. */
const shown = (html: string) => { const body = textOf(documentOf(html).body); const at = body.indexOf('Reference details'); return at >= 0 ? body.slice(0, at) : body; };
const inOrder = (body: string, list: string[], where: string) => {
  let at = 0;
  for (const word of list) { const found = body.indexOf(word, at); expect(found, `${where}: "${word}" after ${at}`).toBeGreaterThanOrEqual(0); at = found + word.length; }
};

const samples = () => (loadObject('Memory').samples ?? []) as Sample[];
const named = (name: string) => samples().find(sample => sample.name === name)!;
const ALL_WORDS = () => samples().flatMap(sample => typeof sample.words === 'string' ? [sample.words as string] : []);
const RUTH_REMOVED = 'Memory about Ruth Adeyemi, 28 Sep 2026, 21:15 UTC', MEI = 'Memory about Mei Chen, 24 Sep 2026, 02:00 UTC';
const OLD_CALL = 'Memory about Ruth Adeyemi, 14 Sep 2026, 03:40 UTC', NEW_CALL = 'Memory about Ruth Adeyemi, 30 Sep 2026, 22:10 UTC';
const NOTES_FILE = 'Memory about Ruth Adeyemi, 2 Sep 2026, 01:00 UTC';
const composed: Partial<Record<(typeof CONTEXTS)[number], UiSchema>> = {};
const code: Record<string, Record<'react' | 'vue', { code: string; actions: string[] }>> = {};
let seed: UiSchema;

beforeAll(async () => {
  for (const context of CONTEXTS) {
    const result = await compose({ object: 'Memory', context, options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
    expect(result.status, `${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
    composed[context] = result.schema;
    code[context] = {} as never;
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: result.schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(generated.status, `${context}/${framework}: ${JSON.stringify(generated.errors)}`).toBe('ok');
      code[context]![framework] = { code: generated.code, actions: generated.artifact.actions.map(action => action.name) };
    }
  }
  seed = (await seedSchema({ object: 'Memory', context: 'detail' } as never, compose as never))!;
});

/**
 * One context's page in each renderer, for one memory (by default the seed's, the measured cell's). A chosen memory's
 * timeline is given its own lines, as a caller gives them: the preview builds a timeline's events from the seed's record
 * unless the caller passes them (seedPreviewModel).
 */
function pages(context: (typeof CONTEXTS)[number], record?: Sample): Record<(typeof RENDERERS)[number], string> {
  const schema = composed[context]!;
  const chosen = record ? workflowSampleRecords(seed).find(row => row.memory_id === record.memory_id)! : undefined;
  const established: Record<string, unknown> = chosen ? Object.fromEntries(Object.entries(chosen).map(([field, value]) => [snakeToCamel(field), value])) : {};
  if (chosen && context === 'timeline') established.events = recordCollectionEvents({ ...chosen, ...Object.fromEntries(Object.entries(recordEventAliases(schema.objectSchema ?? {})).map(([canonical, source]) => [canonical, chosen[source]])) });
  const model: Record<string, unknown> = { ...seedPreviewModel({ schema, context, object: 'Memory', workflowSchema: seed, established }) };
  return {
    html: renderRecordBody(schema, { objectName: 'Memory', sampleModel: model } as never),
    react: renderGenerated('react', code[context]!.react.code, model, code[context]!.react.actions),
    vue: renderGenerated('vue', code[context]!.vue.code, model, code[context]!.vue.actions),
  };
}
const read = (page: Record<(typeof RENDERERS)[number], string>) => Object.fromEntries(RENDERERS.map(renderer => [renderer, shown(page[renderer])])) as Record<(typeof RENDERERS)[number], string>;

describe('Memory is read-only: shown, never edited', () => {
  it('refuses a form and a workflow in the words a read-only object\'s are, and declares no action', async () => {
    for (const context of ['form', 'workflow']) {
      const result = await compose({ object: 'Memory', context, options: { transient: true } } as never) as { status: string; errors: Array<{ code: string; message: string; hint: string }> };
      expect(result.status, context).toBe('error');
      expect(result.errors[0], context).toMatchObject({
        code: 'OODS-V003',
        message: `Object 'Memory' does not compose the '${context}' context; it composes only card, detail, inline, list and timeline.`,
        hint: 'Memory\'s records are read-only in OODS Foundry: they are shown, never edited, so it composes no form and no workflow.',
      });
    }
    const lifecycle = loadObject('Memory').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as Record<string, unknown>;
    expect(lifecycle.actions).toBeUndefined();
  });

  it('offers no Edit, no Delete, no Remove and no move on any screen, in HTML, React and Vue', () => {
    for (const context of CONTEXTS) {
      for (const record of [undefined, named(RUTH_REMOVED), named(MEI)]) {
        const page = pages(context, record);
        for (const renderer of RENDERERS) {
          const where = `${renderer} ${context} ${record?.name ?? 'seed'}`;
          const buttons = [...documentOf(page[renderer]).querySelectorAll('button, a[role="button"]')].map(button => words(button.textContent));
          expect(buttons.filter(label => /^(?:Edit|Delete|Remove|Forget|Pause|Use again|Replace|Correct|Restore)/.test(label)), `${where}: ${buttons.join(' | ')}`).toEqual([]);
          expect(page[renderer], where).not.toMatch(/data-oods-action="handle(?:Edit|Delete|Cancel|Archive)"/);
        }
      }
    }
  });
});

describe('a memory\'s page: what it says and how it was made, who keeps it and for whom, and what removing it would leave', () => {
  it('draws the notes file copied in, with the person\'s own statement, alike in HTML, React and Vue', () => {
    const body = read(pages('detail', named(NOTES_FILE)));
    for (const renderer of RENDERERS) {
      // Its kept name, then its state; its lines, each with its title, its time in UTC and who acted.
      inOrder(body[renderer], [NOTES_FILE, 'Active', 'Copied in', 'Sep 2, 2026, 1:00 AM UTC', 'Tidewater billing', 'Statement added', 'Oct 3, 2026, 9:30 PM UTC', 'Ruth Adeyemi'], renderer);
      inOrder(body[renderer].slice(body[renderer].indexOf('What it says')), ['What it says', 'Ruth Adeyemi approves every payment over $5,000.00 herself.',
        'How it was made', 'Copied in from another store', 'Kept as', 'A file', 'About', 'Ruth Adeyemi', 'Made by', 'Tidewater billing', 'Kept by', 'Billing Agent',
        'Kept in', 'Tidewater billing', 'Kept for', 'Tidewater Co-op', 'Kept under', 'Tidewater invoices and payments', 'Where it came from', 'A notes file copied in on 2 Sep',
        'If its source goes', 'This memory stays', 'The person\'s own statement', 'That was the rule in 2025. Since July I approve payments over $10,000.00, and the team approves the rest.',
        'Removing it would leave', 'Removing it takes the file out of the Billing Agent\'s memory. The notes file it was copied from stays where it is.', 'Made', 'Sep 2, 2026, 1:00 AM UTC'], renderer);
      expect(body[renderer], renderer).not.toMatch(RAW_INSTANT);
      expect(body[renderer], renderer).not.toContain('What remains');
    }
    expect(body.react).toBe(body.vue);
  });

  it('draws an expiry that hides, a replacement by its kept name, and the words a product does not report', () => {
    const mei = read(pages('detail', named(MEI)));
    const old = read(pages('detail', named(OLD_CALL)));
    const unknown = read(pages('detail', named(NEW_CALL)));
    for (const renderer of RENDERERS) {
      inOrder(mei[renderer], [MEI, 'Paused', 'Paused when it expired', 'Nov 12, 2026, 10:59 AM UTC', 'Active → Paused', 'Tidewater billing', 'How it was made', 'Added by someone else',
        'Made by', 'Ruth Adeyemi', 'Kept by', 'Billing Agent', 'Expires', 'Nov 12, 2026, 10:59 AM UTC', 'When it expires', 'It is paused and kept', 'Removing it would leave', 'Not reported'], renderer);
      inOrder(old[renderer], [OLD_CALL, 'Replaced', 'Active → Replaced', 'How it was made', 'Said by the person it is about', 'Replaced by', NEW_CALL], renderer);
      // A store that does not say how a memory was made never reads as "Told", and where it says nothing about removal the page says so.
      inOrder(unknown[renderer], [NEW_CALL, 'Active', 'Used again', 'Paused → Active', 'Ruth Adeyemi', 'How it was made', 'Not known', 'Removing it would leave', 'Not reported'], renderer);
      expect(unknown[renderer], renderer).not.toMatch(/Said by the person it is about|Concluded, not said by the person|Made from other memories|Copied in from another store|Added by someone else/);
      for (const page of [mei, old, unknown]) expect(page[renderer], renderer).not.toMatch(RAW_INSTANT);
    }
  });

  it('draws a removed memory with no words, no note on its source and no statement, and says who removed it, when, and what remains', () => {
    const memory = named(RUTH_REMOVED);
    const SOURCE = '7b3d5f9a-1c2e-4a6b-8d0f-2e4a6c8e0a01';
    for (const record of [memory, { ...memory, words: 'Ruth Adeyemi answers resend requests within minutes.', source_id: SOURCE, source_note: 'An approval on 28 Sep', persons_statement: 'I never said that.', removing_leaves: 'Nothing else.' }]) {
      const body = read(pages('detail', record));
      for (const renderer of RENDERERS) {
        inOrder(body[renderer], [RUTH_REMOVED, 'Removed', 'Made', 'Sep 28, 2026, 9:15 PM UTC', 'Billing Agent', 'Removed', 'Oct 2, 2026, 8:05 PM UTC', 'Active → Removed', 'Ruth Adeyemi',
          'Last happened', 'Removed by Ruth Adeyemi on 2 Oct 2026 at 20:05 UTC.', 'How it was made', 'Concluded, not said by the person', 'Kept under', 'Tidewater invoices and payments',
          'Removed', 'Oct 2, 2026, 8:05 PM UTC', 'Removed by', 'Ruth Adeyemi', 'What remains', 'A log of the removal is kept for 30 days. What it was concluded from is unchanged, and no copy went to another agent.'], renderer);
        // Even where a product still sends them, the page shows none of them.
        expect(body[renderer], renderer).not.toMatch(/What it says|answers resend requests|Where it came from|An approval on 28 Sep|answered an approval|The person's own statement|I never said that|Removing it would leave|Nothing else/);
        // The record it was concluded from is named only by a note, and a removed memory keeps none: its id is never printed.
        expect(body[renderer], renderer).not.toContain(SOURCE);
      }
    }
  });
});

describe('a memory\'s lines and the words rule on every screen', () => {
  it('names who acted and when on every line of every memory, and no line holds a memory\'s words', () => {
    for (const memory of samples()) {
      const body = read(pages('timeline', memory));
      for (const renderer of RENDERERS) {
        const where = `${renderer} ${memory.name}`;
        const lines: Array<{ title: string; at: string; actor_name: string }> = memory.state_history;
        inOrder(body[renderer], lines.flatMap(line => [line.title, line.actor_name]), where);
        expect(body[renderer], where).not.toMatch(RAW_INSTANT);
        for (const text of ALL_WORDS()) expect(body[renderer], where).not.toContain(text);
      }
      // On the detail page, the lines come before the facts: none of them holds the words either.
      const detail = read(pages('detail', memory));
      for (const renderer of RENDERERS) {
        const lines = detail[renderer].slice(detail[renderer].indexOf('Current status:'), detail[renderer].indexOf('Last happened'));
        expect(lines.length, `${renderer} ${memory.name}`).toBeGreaterThan(0);
        for (const text of ALL_WORDS()) expect(lines, `${renderer} ${memory.name}`).not.toContain(text);
      }
    }
  });

  it('never says a memory was deleted, erased or forgotten, on any screen', () => {
    for (const context of CONTEXTS) {
      for (const memory of [undefined, ...samples()]) {
        const body = read(pages(context, memory));
        for (const renderer of RENDERERS) expect(body[renderer], `${renderer} ${context} ${memory?.name ?? 'seed'}`).not.toMatch(/\b(?:delete|deleted|deletes|erase|erased|forget|forgotten|forgets)\b/i);
      }
    }
  });
});

describe('the list, its tones and its words', () => {
  /** The names HTML's list script shows after typing a search, or choosing a state. */
  function htmlFinds(html: string, act: (document: Document, window: Window & typeof globalThis) => void): string[] {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    act(dom.window.document, dom.window);
    const found = [...dom.window.document.querySelectorAll<HTMLElement>('[data-oods-collection="rows"] [data-oods-row]')]
      .filter(row => !row.hidden).map(row => String((JSON.parse(row.dataset.oodsRow!) as Sample).name)).sort();
    dom.window.close();
    return found;
  }
  const of = (test: (memory: Sample) => boolean) => samples().filter(test).map(memory => String(memory.name)).sort();

  it('filters by state and finds a memory by the person it is about, by who keeps it or by its grant, in HTML\'s own list', async () => {
    const html = String(((await pipeline({ object: 'Memory', context: 'list', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
    const search = (text: string) => htmlFinds(html, (document, window) => {
      const input = document.querySelector<HTMLInputElement>('[data-oods-control="search"] input')!;
      input.value = text;
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const state = (value: string) => htmlFinds(html, (document, window) => {
      const select = document.querySelector<HTMLSelectElement>('select[data-oods-control="filter"]')!;
      select.value = value;
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    // The person it is about.
    expect(search('Mei Chen')).toEqual([MEI]);
    expect(search('Tomas Lindqvist')).toEqual(of(memory => memory.about_name === 'Tomas Lindqvist'));
    // Who keeps it: the notes file names the Billing Agent nowhere but as its keeper.
    expect(search('Billing Agent')).toEqual(of(memory => memory.kept_by_name === 'Billing Agent'));
    expect(search('Inventory Agent')).toEqual(of(memory => memory.kept_by_name === 'Inventory Agent'));
    // Its grant, a name no memory's words or summary holds.
    expect(samples().some(memory => `${memory.words ?? ''} ${memory.summary}`.includes('Tidewater invoices and payments'))).toBe(false);
    expect(search('Tidewater invoices and payments')).toEqual(of(memory => memory.grant_name === 'Tidewater invoices and payments'));
    for (const value of STATES) expect(state(value), value).toEqual(of(memory => memory.status === value));
    // One filter, by state, named as the badges name them; no filter by how a memory was made (the composer places one
    // filter field). The list draws its controls twice, as every shipped HTML list does; each copy reads the same.
    const filters = [...documentOf(html).querySelectorAll('select[data-oods-control="filter"]')];
    expect(filters.length).toBeGreaterThan(0);
    for (const filter of filters) expect([...filter.querySelectorAll('option')].map(option => words(option.textContent))).toEqual(['All states', 'Active', 'Paused', 'Replaced', 'Removed']);
    expect(shown(html)).not.toMatch(/All origins|Filter by how it was made/);
  });

  it('puts how a memory was made on every row, says "Not known" where the product does not, and shows no words on a removed row', () => {
    const list = read(pages('list'));
    for (const renderer of RENDERERS) {
      const body = list[renderer];
      const rows = samples().map(memory => memory.name as string).map(name => [name, body.indexOf(name)] as const).sort((a, b) => a[1] - b[1]);
      for (const [index, [name, at]] of rows.entries()) {
        expect(at, `${renderer} ${name}`).toBeGreaterThanOrEqual(0);
        const row = body.slice(at, rows[index + 1]?.[1] ?? body.length);
        const memory = named(name);
        expect(row, `${renderer} ${name}`).toMatch(/How it was made (?:Said by the person it is about|Concluded, not said by the person|Made from other memories|Copied in from another store|Added by someone else|Not known)/);
        if (memory.origin === undefined) expect(row, `${renderer} ${name}`).toContain('How it was made Not known');
        if (memory.status === 'removed') expect(row, `${renderer} ${name}`).not.toContain('What it says');
        else expect(row, `${renderer} ${name}`).toContain(`What it says ${memory.words}`);
        expect(row, `${renderer} ${name}`).toContain(`Kept by ${memory.kept_by_name}`);
      }
      expect(body, renderer).not.toMatch(RAW_INSTANT);
    }
  });

  it('draws each state a sample rests in with its tone, never removed as a success, on the list, a card and inline', () => {
    const list = pages('list');
    for (const renderer of RENDERERS) {
      const states = [...documentOf(list[renderer]).querySelectorAll('.oods-status-badge')].map(badge => [badge.getAttribute('data-status'), badge.getAttribute('data-tone'), words(badge.textContent)]);
      for (const [status, label] of [['active', 'Active'], ['paused', 'Paused'], ['replaced', 'Replaced'], ['removed', 'Removed']]) {
        expect(states, `${renderer}: ${status}`).toContainEqual([status, getStatusPresentation('lifecycle', status!).tone, label]);
      }
      expect(states.find(([status]) => status === 'removed')?.[1], renderer).toBe('neutral');
    }
    for (const context of ['card', 'inline'] as const) {
      for (const memory of [named(RUTH_REMOVED), named(MEI), named(OLD_CALL)]) {
        const page = pages(context, memory);
        for (const renderer of RENDERERS) {
          const badges = [...documentOf(page[renderer]).querySelectorAll('.oods-status-badge')];
          expect(badges.length, `${renderer} ${context} ${memory.name}`).toBeGreaterThan(0);
          for (const badge of badges) {
            expect(badge.getAttribute('data-status'), `${renderer} ${context}`).toBe(memory.status);
            expect(badge.getAttribute('data-tone'), `${renderer} ${context} ${memory.status}`).toBe(getStatusPresentation('lifecycle', memory.status).tone);
            expect(badge.getAttribute('data-tone'), `${renderer} ${context} ${memory.status}`).not.toBe('success');
          }
          expect(shown(page[renderer]), `${renderer} ${context}`).not.toMatch(RAW_INSTANT);
          if (memory.status === 'removed') expect(shown(page[renderer]), `${renderer} ${context}`).not.toMatch(/What it says/);
        }
      }
    }
  });
});
