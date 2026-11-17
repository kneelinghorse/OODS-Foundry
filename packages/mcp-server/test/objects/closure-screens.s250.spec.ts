/**
 * s250-m02: Closure's screens, the third part of the Grant story on the page. A closure is read-only: a product writes it
 * from reports, so no person edits one, and its page offers no Edit, no Delete and no move. These specs pin, in React,
 * Vue and HTML alike:
 * - it composes list, detail, timeline, card and inline; a form is refused in the words a read-only object's is, and it
 *   composes no workflow and declares no action;
 * - its page shows its name and state, every line with its reporter and time, who answers for it, the trait's facts and
 *   its three lists, which read the grant's end: on Northwind customer replies' closure the task still waiting on Dana
 *   Whitfield reads "When the grant ended: needs input. Now: needs input.";
 * - each list's empty sentence and the page's closing sentence are true of what the list reads;
 * - one page draws a window with an instant and one says the window is not known;
 * - the list filters by state and finds a closure by what ended, its party or a reporter, and no row or cell prints an
 *   instant as stored;
 * - every state a sample rests in has its tone, reported closed is never a success, and no badge, row or filter calls a
 *   closure's state "Closed" alone.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { getStatusPresentation } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { seedSchema } from '../../src/compose/workflow-assembler.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, options?: Record<string, unknown>) => { window: Window & typeof globalThis } };
type Sample = Record<string, any>;
const RENDERERS = ['html', 'react', 'vue'] as const;
const CONTEXTS = ['list', 'detail', 'timeline', 'card', 'inline'] as const;
const RAW_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const KEYED = 'These lists show only records here, matched by id; records named only in words, or that another product keeps, are not listed.';
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

const samples = () => (loadObject('Closure').samples ?? []) as Sample[];
const byGrant = (name: string) => samples().find(sample => sample.closes_name === name)!;
const composed: Partial<Record<(typeof CONTEXTS)[number], UiSchema>> = {};
const code: Record<string, Record<'react' | 'vue', { code: string; actions: string[] }>> = {};
let seed: UiSchema;

beforeAll(async () => {
  for (const context of CONTEXTS) {
    const result = await compose({ object: 'Closure', context, options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
    expect(result.status, `${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
    composed[context] = result.schema;
    code[context] = {} as never;
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: result.schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(generated.status, `${context}/${framework}: ${JSON.stringify(generated.errors)}`).toBe('ok');
      code[context]![framework] = { code: generated.code, actions: generated.artifact.actions.map(action => action.name) };
    }
  }
  seed = (await seedSchema({ object: 'Closure', context: 'detail' } as never, compose as never))!;
});

/** One context's page in each renderer, for one closure (by default the seed's third, the measured cell's), with its lists. */
function pages(context: (typeof CONTEXTS)[number], record?: Sample): Record<(typeof RENDERERS)[number], string> {
  const schema = composed[context]!;
  const seeded = workflowSampleRecords(seed);
  const chosen = record ? seeded.find(row => row.closure_id === record.closure_id)! : undefined;
  const established = chosen ? Object.fromEntries(Object.entries(chosen).map(([field, value]) => [snakeToCamel(field), value])) : {};
  const model: Record<string, unknown> = { ...seedPreviewModel({ schema, context, object: 'Closure', workflowSchema: seed, established }) };
  if (chosen && schemaNodes(schema).some(node => node.collection?.source === 'related')) model.related = resolveRelatedLists('Closure', chosen);
  return {
    html: renderRecordBody(schema, { objectName: 'Closure', sampleModel: model } as never),
    react: renderGenerated('react', code[context]!.react.code, model, code[context]!.react.actions),
    vue: renderGenerated('vue', code[context]!.vue.code, model, code[context]!.vue.actions),
  };
}

describe('Closure is read-only: shown, never edited', () => {
  it('refuses a form and a workflow in the words a read-only object\'s are, and declares no action', async () => {
    for (const context of ['form', 'workflow']) {
      const result = await compose({ object: 'Closure', context, options: { transient: true } } as never) as { status: string; errors: Array<{ code: string; message: string; hint: string }> };
      expect(result.status, context).toBe('error');
      expect(result.errors[0], context).toMatchObject({
        code: 'OODS-V003',
        message: `Object 'Closure' does not compose the '${context}' context; it composes only card, detail, inline, list and timeline.`,
        hint: 'Closure\'s records are read-only in OODS Foundry: they are shown, never edited, so it composes no form and no workflow.',
      });
    }
    const lifecycle = loadObject('Closure').traits.find(trait => trait.name === 'lifecycle/Stateful')!.parameters as Record<string, unknown>;
    expect(lifecycle.actions).toBeUndefined();
  });

  it('offers no Edit, no Delete and no move on any screen, in HTML, React and Vue', () => {
    for (const context of CONTEXTS) {
      const page = pages(context);
      for (const renderer of RENDERERS) {
        const buttons = [...documentOf(page[renderer]).querySelectorAll('button, a[role="button"]')].map(button => words(button.textContent));
        expect(buttons.filter(label => /^(?:Edit|Delete|Revoke|Close|Reopen|Report|Mark)/.test(label)), `${renderer} ${context}: ${buttons.join(' | ')}`).toEqual([]);
        expect(page[renderer], `${renderer} ${context}`).not.toMatch(/data-oods-action="handle(?:Edit|Delete|Cancel|Archive)"/);
      }
    }
  });
});

describe('a closure\'s page: its name and state, its lines, who answers for it, its facts and its three lists', () => {
  it('draws Northwind customer replies\' closure alike in HTML, React and Vue, with the task still waiting read at the grant\'s end', () => {
    const page = pages('detail', byGrant('Northwind customer replies'));
    const read = Object.fromEntries(RENDERERS.map(renderer => [renderer, shown(page[renderer])])) as Record<(typeof RENDERERS)[number], string>;
    for (const renderer of RENDERERS) {
      const body = read[renderer];
      const inOrder = (list: string[]) => { let at = 0; for (const word of list) { const found = body.indexOf(word, at); expect(found, `${renderer}: "${word}" after ${at}`).toBeGreaterThanOrEqual(0); at = found + word.length; } };
      // Its name, then its state; every line with its title, its time in UTC and its reporter.
      inOrder(['Closure of Northwind customer replies', 'Still running']);
      inOrder(['Opened', 'Oct 8, 2026, 4:00 PM UTC', 'Northwind support desk', 'A reply is still waiting', 'Oct 8, 2026, 4:05 PM UTC', 'Northwind support desk', 'Receipt sent', 'Oct 8, 2026, 4:10 PM UTC', 'Northwind support desk']);
      // Who answers for it, and the trait's facts.
      expect(body, renderer).toContain('Dana Whitfield');
      inOrder(['What ended', 'Northwind customer replies', 'How it ended', 'Revoked', 'When it ended', 'Oct 8, 2026, 4:00 PM UTC', 'For', 'Northwind Traders',
        'This record covers', 'What the support desk controls', 'Where it stands', 'Still running; the reply about order NW-2207', 'May still work until', 'Oct 9, 2026, 4:00 PM UTC',
        'Receipt sent', 'Oct 8, 2026, 4:10 PM UTC', 'Receipt sent to', 'Dana Whitfield', 'Receipt sent by', 'Email']);
      // The three lists, the task read at the grant's end, and the page's sentence on what its lists read.
      inOrder(['The grant and its party now (2)', 'Grant: Northwind customer replies', 'Revoked', 'Replies go back to the support team', 'For: Northwind Traders',
        'Still under way when the grant ended, by the records here (1)', 'Reply about order NW-2207', 'Needs input', 'When the grant ended: needs input. Now: needs input.',
        'These are read from the records here that name the grant. They are not a report.',
        'Recorded under the grant after it ended (0)', 'Nothing here was recorded under the grant after it ended.', KEYED]);
      expect(body, renderer).not.toMatch(RAW_INSTANT);
      expect(body, renderer).not.toMatch(/Not recorded|unavailable|not resolved|OODS Foundry/);
      // A line that keeps the state reads its title and that state, never a move to itself.
      expect(body, renderer).not.toMatch(/Closing → Closing|Still Running → Still Running/);
    }
  });

  it('draws the other two closures true to what their lists read: nothing under way, nothing after the end', () => {
    for (const [name, state] of [['Northwind spring order replies', 'Reported closed'], ['Marlow Yoga class bookings', 'Not known']] as const) {
      const page = pages('detail', byGrant(name));
      for (const renderer of RENDERERS) {
        const body = shown(page[renderer]);
        expect(body, `${renderer} ${name}`).toContain(`Closure of ${name}`);
        expect(body, `${renderer} ${name}`).toContain(state);
        expect(body, `${renderer} ${name}`).toContain('Still under way when the grant ended, by the records here (0) No record here that names the grant was under way when it ended.');
        expect(body, `${renderer} ${name}`).toContain('Recorded under the grant after it ended (0) Nothing here was recorded under the grant after it ended.');
        expect(body, `${renderer} ${name}`).toContain(KEYED);
      }
    }
  });

  it('draws one window as an instant and says on another that it is not known', () => {
    const replies = pages('detail', byGrant('Northwind customer replies'));
    const marlow = pages('detail', byGrant('Marlow Yoga class bookings'));
    for (const renderer of RENDERERS) {
      expect(shown(replies[renderer]), renderer).toContain('May still work until Oct 9, 2026, 4:00 PM UTC');
      expect(shown(marlow[renderer]), renderer).toContain('What may still work Not known: the booking service has not said');
      expect(shown(marlow[renderer]), renderer).not.toContain('May still work until');
      expect(shown(marlow[renderer]), renderer).toContain('Waits for answers until Jul 17, 2026, 8:55 AM UTC');
    }
  });
});

describe('the list, its tones and its words', () => {
  /** The ids HTML's list script shows after typing a search, or choosing a state. */
  function htmlFinds(html: string, act: (document: Document, window: Window & typeof globalThis) => void): string[] {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    act(dom.window.document, dom.window);
    const found = [...dom.window.document.querySelectorAll<HTMLElement>('[data-oods-collection="rows"] [data-oods-row]')]
      .filter(row => !row.hidden).map(row => String((JSON.parse(row.dataset.oodsRow!) as Sample).name)).sort();
    dom.window.close();
    return found;
  }

  it('filters by state and finds a closure by what ended, its party or a reporter, in HTML\'s own list', async () => {
    const html = String(((await pipeline({ object: 'Closure', context: 'list', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
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
    expect(search('Marlow Yoga class bookings')).toEqual(['Closure of Marlow Yoga class bookings']);
    expect(search('Northwind Traders')).toEqual(['Closure of Northwind customer replies', 'Closure of Northwind spring order replies']);
    expect(search('Marlow Yoga front desk')).toEqual(['Closure of Marlow Yoga class bookings']);
    expect(search('Northwind support desk')).toEqual(['Closure of Northwind customer replies', 'Closure of Northwind spring order replies']);
    expect(state('not_known')).toEqual(['Closure of Marlow Yoga class bookings']);
    expect(state('reported_closed')).toEqual(['Closure of Northwind spring order replies']);
    // The filter names each state as its badge does, and none as "Closed" alone.
    // The list draws its controls twice (as every shipped HTML list does); each copy reads the same.
    const options = [...documentOf(html).querySelector('select[data-oods-control="filter"]')!.querySelectorAll('option')].map(option => words(option.textContent));
    expect(options).toEqual(['All states', 'Closing', 'Reported closed', 'Still running', 'Not known', 'Failed']);
  });

  it('draws each state a sample rests in with its tone, never reported closed as a success, and no instant raw on a row or a card', () => {
    for (const context of ['list', 'card', 'inline'] as const) {
      const page = pages(context);
      for (const renderer of RENDERERS) {
        expect(shown(page[renderer]), `${renderer} ${context}`).not.toMatch(RAW_INSTANT);
        for (const badge of documentOf(page[renderer]).querySelectorAll('.oods-status-badge')) {
          const status = badge.getAttribute('data-status') ?? '';
          if (!['closing', 'reported_closed', 'still_running', 'not_known', 'failed'].includes(status)) continue;
          expect(badge.getAttribute('data-tone'), `${renderer} ${context} ${status}`).toBe(getStatusPresentation('lifecycle', status).tone);
          expect(badge.getAttribute('data-tone'), `${renderer} ${context} ${status}`).not.toBe('success');
          expect(words(badge.textContent), `${renderer} ${context}`).not.toMatch(/^Closed$/i);
        }
      }
    }
    const list = pages('list');
    for (const renderer of RENDERERS) {
      const states = [...documentOf(list[renderer]).querySelectorAll('.oods-status-badge')].map(badge => [badge.getAttribute('data-status'), badge.getAttribute('data-tone'), words(badge.textContent)]);
      for (const [status, tone, label] of [['reported_closed', 'neutral', 'Reported closed'], ['not_known', 'warning', 'Not known'], ['still_running', 'warning', 'Still running']]) {
        expect(states, `${renderer}: ${status}`).toContainEqual([status, tone, label]);
      }
    }
  });

  it('prints no state as "Closed" alone on the timeline, and the lines that keep the state read as reports', () => {
    const page = pages('timeline');
    for (const renderer of RENDERERS) {
      const body = shown(page[renderer]);
      expect(body, renderer).toContain('Receipt sent');
      expect(body, renderer).not.toMatch(/(?<!Reported )\bClosed\b/);
      expect(body, renderer).not.toMatch(/Closing → Closing|Still Running → Still Running/);
    }
  });
});
