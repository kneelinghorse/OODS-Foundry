/**
 * s250-m04: the grant items left after Sprint 249 (next steps 1884, 1885 and 1887), each fixed so that nothing on grants
 * is left after this sprint:
 * - 1884: the dashboard layout keeps a few of a trait's detail places and adds the other fields back as plain rows; a
 *   field the trait's own detail view draws only when it holds a value keeps that, so an empty reference no longer reads
 *   "<seat> unavailable" on Grant's and Task's dashboards;
 * - 1885: a generated app's own plain button style left the design system's Buttons alone only inside a marked element, so
 *   a primary or danger Button read as a plain one until hovered; it now leaves every Button alone, and a team's mapped
 *   adapters as before;
 * - 1887, item 1: a form's date-time input holds the time in UTC, as the app writes it back, and its label now says so
 *   ("Due (UTC)"), alike in HTML, React and Vue;
 * - 1887, item 2: the owner's kind read as its stored code ("Owner Type: user"); one shared formatter prints it as a word,
 *   as a detail page writes an enum's value ("User", "Team"), in all three renderers;
 * - 1887, item 3: HTML's search label sat flush beside its box; it sits above it, in the field wrapper the Status and Sort
 *   selects beside it use, as React draws it;
 * - 1887, item 4: a row line could add words for a value but not leave a field out for one, so a person's sponsor row read
 *   "Support Agent · Active · None" for an agent that acts for no one; a line item { field, except } leaves it out;
 * - 1887, item 5: an open grant's form labelled its note "Why it ended"; drawn only while the grant is open, the input is
 *   labelled for an open grant, and the ended grant's fact keeps "Why it ended" (revoke.s249 and mandate-traits.s248 read
 *   both, in HTML, React and Vue);
 * - 1887, item 6: one validate reply wrote a trait parameter's path as a JSON pointer ("traits[0].parameters/actions/0/to")
 *   beside the object check's dotted paths ("traits[0].parameters.actions[0].event"); every path now reads one way, and a
 *   message that opened with the pointer opens with the path.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { OBJECTS, supportsWorkflow } from '../../src/lib/runtime-ledger.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { renderGenerated } from '../product-reality/render-generated.js';
import { ownerKindLabel } from '@oods/component-contracts';
import { dump } from 'js-yaml';
import fs from 'node:fs';
import { handle as validate } from '../../src/tools/object.validate.js';
import { getObjectFilePath, loadObject } from '../../src/objects/object-loader.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import { load } from 'js-yaml';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
const textOf = (html: string) => {
  const document = new JSDOM(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).window.document;
  const pieces: string[] = [];
  const visit = (node: Node) => { if (node.nodeType === 3) { if (node.textContent?.trim()) pieces.push(node.textContent); return; } node.childNodes.forEach(visit); };
  visit(document.body);
  return pieces.join(' ').replace(/\s+/g, ' ');
};
const dashboard = async (object: string) => textOf(String(((await pipeline({ object, context: 'detail', layout: 'dashboard', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? ''));

describe('1884: the dashboard layout leaves out an empty place the trait asked to leave out', () => {
  it('draws no "<seat> unavailable" row on Grant\'s and Task\'s dashboards, which drew four each', async () => {
    for (const object of ['Grant', 'Task']) expect((await dashboard(object)).match(/\b[A-Z][A-Za-z ]* unavailable\b/g), object).toBeNull();
  });

  it('leaves out an empty Requested for seat on the dashboard and shows the named party when supplied', async () => {
    expect(await dashboard('Approval')).not.toContain('Requested for unavailable');
    const { schema } = await compose({ object: 'Approval', context: 'detail', layout: 'dashboard', options: { transient: true } });
    const populated = renderRecordBody(schema!, { objectName: 'Approval', sampleModel: { requestedForId: 'org-1', requestedForName: 'Tidewater Co-op' } });
    expect(textOf(populated)).toContain('Asked for Tidewater Co-op');
  });
});

describe('1885: every generated app leaves the design system\'s Buttons in their own look', () => {
  it('matches its plain button rules to a plain button, never to a Button or to a mapped adapter\'s, in every app', async () => {
    for (const object of OBJECTS.filter(supportsWorkflow)) {
      const workflow = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
      for (const framework of ['react', 'vue'] as const) {
        const app = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact };
        expect(app.status, `${object} ${framework}`).toBe('ok');
        const css = app.artifact.files.find(file => file.path === 'src/app.css')!.contents;
        const selectors = [...css.matchAll(/^\s*(\.workflow-app button:not\([^{]*?\))(?=[\s{:[])/gm)].map(match => match[1]!);
        expect(selectors.length, `${object} ${framework}`).toBeGreaterThanOrEqual(1);
        const document = new JSDOM('<main class="workflow-app"><button id="plain">Next</button><button id="button" class="oods-button oods-button--danger">Revoke grant</button><div data-oods-adapter="Button"><button id="mapped">Save</button></div></main>').window.document;
        for (const selector of new Set(selectors)) {
          expect(document.getElementById('plain')!.matches(selector), `${object} ${framework}: ${selector}`).toBe(true);
          expect(document.getElementById('button')!.matches(selector), `${object} ${framework}: ${selector}`).toBe(false);
          expect(document.getElementById('mapped')!.matches(selector), `${object} ${framework}: ${selector}`).toBe(false);
        }
      }
    }
  });

  it('draws the Revoke confirmation\'s buttons as the design system\'s Buttons with no mark of their own', async () => {
    const workflow = (await compose({ object: 'Grant', context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    for (const framework of ['react', 'vue'] as const) {
      const app = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never) as { artifact: GeneratedArtifact };
      const files = app.artifact.files.map(file => file.contents).join('\n');
      expect(files, framework).toContain('workflow-confirm-buttons');
      expect(files, framework).not.toContain('data-oods-adapter="Button"');
    }
  });
});

/** The labels of a page's controls, as a person reads them beside each control. */
const controlLabels = (html: string): string[] => {
  const page = new JSDOM(html).window.document;
  return [...page.querySelectorAll('input, select, textarea')].filter(control => control.getAttribute('type') !== 'hidden').map(control => {
    const id = control.getAttribute('id');
    const label = (id ? page.querySelector(`label[for="${id}"]`) : null) ?? control.closest('label');
    return (label?.textContent ?? control.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
  });
};
/** One context's page in HTML, React and Vue, seeded as the cells seed it. */
async function threePages(object: string, context: string): Promise<Record<'html' | 'react' | 'vue', string>> {
  const schema = (await compose({ object, context, options: { transient: true } } as never) as { schema: UiSchema }).schema;
  const workflow = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
  const model = seedPreviewModel({ schema, context, object, workflowSchema: workflow });
  const out = { html: renderRecordBody(schema, { objectName: object, sampleModel: model } as never) } as Record<'html' | 'react' | 'vue', string>;
  for (const framework of ['react', 'vue'] as const) {
    const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact };
    expect(result.status).toBe('ok');
    out[framework] = renderGenerated(framework, result.code, model, result.artifact.actions.map(action => action.name));
  }
  return out;
}

describe('1887, item 1: a date-time input says it is in UTC', () => {
  it('labels Task\'s due date input "Due (UTC)", a datetime-local input holding the UTC time, alike in HTML, React and Vue', async () => {
    const pages = await threePages('Task', 'form');
    for (const [renderer, html] of Object.entries(pages)) {
      expect(controlLabels(html), renderer).toContain('Due (UTC)');
      const input = [...new JSDOM(html).window.document.querySelectorAll('input[type="datetime-local"]')];
      expect(input.length, renderer).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('1887, item 2: the owner\'s kind reads as a word', () => {
  it('formats the kind once for every renderer: a word, sentence case, never the stored code', () => {
    expect([ownerKindLabel('user'), ownerKindLabel('team'), ownerKindLabel('organization'), ownerKindLabel('service_account'), ownerKindLabel(''), ownerKindLabel(undefined)])
      .toEqual(['User', 'Team', 'Organization', 'Service account', undefined, undefined]);
  });

  it('prints the kind as a word on the detail page of every object that composes Ownerable, alike in HTML, React and Vue', async () => {
    for (const object of ['Agent', 'Grant', 'Organization', 'Task', 'Relationship']) {
      const pages = await threePages(object, 'detail');
      const read = Object.fromEntries(Object.entries(pages).map(([renderer, html]) => [renderer, /Owner Type (\S+)/.exec(textOf(html))?.[1]]));
      expect(read.html, object).toMatch(/^[A-Z][a-z]+$/);
      expect(read, object).toEqual({ html: read.html, react: read.html, vue: read.html });
    }
  });
});

describe('1887, item 3: HTML\'s search label sits above its box, as the selects\' labels beside it do', () => {
  it('wraps the label and the box in one field, the label first, on every list', async () => {
    for (const object of ['Grant', 'User', 'Closure']) {
      const html = String(((await pipeline({ object, context: 'list', framework: 'html', options: { skipValidation: true } } as never)) as { render?: { html?: string } }).render?.html ?? '');
      const document = new JSDOM(html).window.document;
      for (const search of document.querySelectorAll('[data-oods-control="search"]')) {
        const field = search.querySelector(':scope > .oods-field')!;
        expect(field, object).not.toBeNull();
        expect([...field.children].map(child => `${child.tagName.toLowerCase()}${child.classList.contains('oods-field-label') ? '.label' : ''}`), object).toEqual(['label.label', 'input']);
        expect(field.querySelector('label')!.getAttribute('for'), object).toBe(field.querySelector('input')!.id);
      }
      // The Status select beside it reads the same way.
      expect(document.querySelector('select[data-oods-control="filter"]')!.parentElement!.classList.contains('oods-field'), object).toBe(true);
    }
  });
});

describe('1887, item 4: a row line can leave a field out for one value', () => {
  const user = load(fs.readFileSync(getObjectFilePath('User')!, 'utf8')) as Record<string, any>;
  const withLine = (line: unknown) => dump({ ...user, metadata: { ...user.metadata, relatedLists: user.metadata.relatedLists.map((list: any) => list.id === 'sponsors' ? { ...list, sources: [{ ...list.sources[0], row: { line } }] } : list) } });

  it('accepts { field, except } and refuses it malformed, naming its path', async () => {
    expect((await validate({ yaml: withLine([{ field: 'acts_for', except: ['None', ''] }]) })).errors).toEqual([]);
    for (const [line, where, says] of [
      [[{ field: 'acts_for' }], 'metadata.relatedLists[5].sources[0].row.line[0].except', /must be the value, or a list of the values, for which the field is left out/],
      [[{ field: 'acts_for', except: { a: 1 } }], 'metadata.relatedLists[5].sources[0].row.line[0].except', /must be the value, or a list of the values/],
      [[{ field: 'acts_on', except: 'None' }], 'metadata.relatedLists[5].sources[0].row.line[0].field', /"acts_on" is not a field of Agent/],
      [[{ field: 'acts_for', except: 'None', says: 'x' }], 'metadata.relatedLists[5].sources[0].row.line[0].except', /takes field and says/],
    ] as const) {
      const result = await validate({ yaml: withLine(line) });
      const problem = result.errors.find(error => error.path === where);
      expect(problem, JSON.stringify(result.errors)).toMatchObject({ kind: 'malformed' });
      expect(problem!.message).toMatch(says);
    }
  });

  it('leaves "None" off the sponsor row of an agent that acts for no one, and shows every other agent\'s line as before', () => {
    const rows = Object.fromEntries((loadObject('User').samples as Array<Record<string, any>>).flatMap(sample => resolveRelatedLists('User', sample).find(list => list.id === 'sponsors')!.rows.map(row => [row.title, row.lineText ?? null])));
    expect(rows).toEqual({
      'Support Agent': null, 'Inventory Agent': null, 'Scheduling Agent': null,
      'Billing Agent': 'Tidewater Co-op · invoices and payments · until 31 Dec 2026',
      'Booking Agent': 'Blue Harbor Studio · session bookings · until 31 Jan 2027',
      'Order Agent': 'Summit Outfitters · online orders · until 31 Mar 2027',
    });
    // The agents keep their own words: only the row leaves them out.
    expect((loadObject('Agent').samples as Array<Record<string, any>>).find(agent => agent.name === 'Support Agent')!.acts_for).toBe('None');
  });
});

describe('1887, item 6: a validate reply writes every path one way', () => {
  const ticket = (actions: unknown[]) => dump({
    object: { name: 'Ticket', version: '1.0.0', domain: 'team.test', description: 'A test ticket.' },
    traits: [
      { name: 'lifecycle/Stateful', parameters: { states: ['open', 'closed'], initialState: 'open', transitionRules: { open: ['closed'], closed: [] }, actions } },
      { name: 'lifecycle/Timestampable', parameters: { recordedEvents: ['created', 'closed'] } },
    ],
    schema: { ticket_id: { type: 'string', required: true, description: 'Id.' }, name: { type: 'string', required: true, description: 'Name.' } },
  });

  it('writes a parameter problem as the action check writes its own: dots and brackets, the message opening with the path', async () => {
    // The parameter check (a JSON pointer before: traits[0].parameters/actions/0/from/0), and the action check (dotted).
    const order = (await validate({ yaml: ticket([{ id: 'close', from: ['archived'], to: 'closed', verb: 'Close', event: 'closed' }]) })).errors;
    const event = (await validate({ yaml: ticket([{ id: 'shut', to: 'closed', verb: 'Shut', event: 'shut' }]) })).errors;
    expect(order.map(error => error.path)).toEqual(['traits[0].parameters.actions[0].from[0]']);
    expect(event.map(error => error.path)).toEqual(['traits[0].parameters.actions[0].event']);
    for (const error of [...order, ...event]) {
      expect(error.kind).toBe('invalid-parameter');
      expect(error.path, error.message).toMatch(/^traits\[\d+\]\.parameters(?:\.[A-Za-z_]+|\[\d+\])*$/);
      expect(error.message.startsWith(error.path), error.message).toBe(true);
    }
  });
});
