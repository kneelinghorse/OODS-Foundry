/**
 * s246-m02: three small fixes, each pinned with why it matters.
 * - A record with no title reads its state in its detail header (next step 1853). Its lifecycle's timeline is removed when
 *   it has no history, and that timeline covers the status, so before this an imported approval with no name and no
 *   history (Jira's ApproverDTO) never showed its answer on its own page. The empty timeline still renders nothing.
 * - Article's body and Approval's comment are edited in text areas, so their lines stay apart (next step 1859): Article's required body reached
 *   the form through the required-field backfill as a one-line input and its sample ran together ("Payments.2. Under
 *   Retries"); Approval's comment, typed beside the answer, was cut off in a one-line input on a phone. A required text
 *   area keeps the required mark and the browser's enforcement the one-line input had.
 * (The third, fast-xml-parser past GHSA-474x-hrwr-fgx4, is measured by s246-odata-proposals.mjs: the OData reader drafts
 * every published source the same under 5.11.2 and 5.12.0.)
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { listObjects, loadObject } from '../../src/objects/object-loader.js';
import { seedPreviewModel, schemaNodes } from '../../src/codegen/preview-model.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
type Composed = { status: string; schema: UiSchema };
const composeIn = (object: string, context: string) => compose({ object, context, options: { transient: true } } as never) as Promise<Composed>;
const find = (nodes: UiElement[], match: (node: UiElement) => boolean): UiElement | undefined => {
  for (const node of nodes) { if (match(node)) return node; const found = find(node.children ?? [], match); if (found) return found; }
  return undefined;
};

/** The control a visible label names (React and Vue key a control by its node id, not by a name attribute). */
const labelled = (page: string, label: string): Element | null => {
  const fragment = JSDOM.fragment(page);
  const target = [...fragment.querySelectorAll('label')].find(node => (node.textContent ?? '').replace(/\s+/g, ' ').replace(/\*/g, '').trim() === label);
  const id = target?.getAttribute('for');
  return id ? fragment.querySelector(`[id="${id}"]`) : target?.querySelector('input, select, textarea') ?? null;
};

/** The form in HTML, React and Vue, each with the preview's seeded record. */
async function formPages(object: string): Promise<Record<string, string>> {
  const { schema } = await composeIn(object, 'form');
  const workflow = (await composeIn(object, 'workflow')).schema;
  const html = String((await pipeline({ object, context: 'form', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
  const pages: Record<string, string> = { html };
  for (const framework of ['react', 'vue'] as const) {
    const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
    pages[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context: 'form', object, workflowSchema: workflow }), result.artifact!.actions.map(({ name }: { name: string }) => name));
  }
  return pages;
}

describe('a record with no title reads its state in the detail header (Jira\'s ApproverDTO)', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  // Jira Service Management's approver record as its swagger.v3.json writes it: an approver and the answer, nothing else.
  const JIRA = { openapi: '3.0.1', info: { title: 'Service desk', version: '1' }, paths: {}, components: { schemas: {
    UserDTO: { type: 'object', additionalProperties: false, properties: { accountId: { type: 'string' }, displayName: { type: 'string' }, active: { type: 'boolean' } } },
    ApproverDTO: { type: 'object', additionalProperties: false, properties: {
      approver: { allOf: [{ $ref: '#/components/schemas/UserDTO' }], description: 'Details of the User who is providing approval.' },
      approverDecision: { type: 'string', enum: ['approved', 'declined', 'pending'], description: 'Decision made by the approver.' },
    } },
  } } };
  beforeAll(async () => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 's246-m02-'));
    for (const key of keys) process.env[key] = path.join(work, key);
    fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true });
    reloadDefinitions();
    const staged = await importObjects({ action: 'draft', source: { content: JSON.stringify(JIRA), name: 'jsm.openapi.json', format: 'openapi' } } as never) as { directory: string; importId: string };
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; proposals: Array<{ id: string; valid: boolean; grade: string }> }>;
    await importObjects({ action: 'apply', importId: staged.importId, objects: drafts.map(draft => ({ name: draft.name, proposals: draft.proposals.filter(item => item.valid && item.grade !== 'weak').map(item => item.id) })) } as never);
  });
  afterAll(() => {
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    reloadDefinitions();
    fs.rmSync(work, { recursive: true, force: true });
  });

  it('opens the header with the record summary: the answer as a badge, before the timeline that is removed when empty', async () => {
    const { status, schema } = await composeIn('ApproverDTO', 'detail');
    expect(status).toBe('ok');
    const nodes = schemaNodes(schema);
    // No title: nothing names the record, so the summary has no title to follow.
    expect(nodes.some(node => node.component === 'DetailHeader')).toBe(false);
    const header = find(schema.screens, node => node.id.includes('detail-header'))!;
    const summary = header.children?.[0];
    expect(summary).toMatchObject({ meta: { intent: 'record-summary' } });
    expect(summary!.children!.map(node => [node.component, node.props?.statusField])).toEqual([['StatusBadge', 'approverDecision']]);
    // The timeline stays in the header and is still removed when the record has no history (the s241 rule).
    expect(header.children!.slice(1).map(node => node.component)).toContain('StatusTimeline');
  });

  it('shows the answer on the detail page in HTML, React and Vue, where 0.13.0 showed it nowhere', async () => {
    const { schema } = await composeIn('ApproverDTO', 'detail');
    const workflow = (await composeIn('ApproverDTO', 'workflow')).schema;
    const html = String((await pipeline({ object: 'ApproverDTO', context: 'detail', framework: 'html', options: { skipValidation: true } } as never) as { render?: { html?: string } }).render?.html ?? '');
    const pages: Record<string, string> = { html };
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never);
      pages[framework] = renderGenerated(framework, result.code!, seedPreviewModel({ schema, context: 'detail', object: 'ApproverDTO', workflowSchema: workflow }), result.artifact!.actions.map(({ name }: { name: string }) => name));
    }
    for (const [renderer, page] of Object.entries(pages)) {
      const badges = [...JSDOM.fragment(page).querySelectorAll('[data-oods-component="StatusBadge"]')].map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
      expect(badges.length, renderer).toBeGreaterThan(0);
      expect(badges.some(label => /\b(Approved|Declined|Pending)\b/.test(label)), `${renderer}: ${JSON.stringify(badges)}`).toBe(true);
    }
  });

  it('puts the answer in the generated workflow app\'s detail screen, ahead of its actions', async () => {
    const workflow = (await composeIn('ApproverDTO', 'workflow')).schema;
    for (const framework of ['react', 'vue'] as const) {
      const app = await generate({ schema: workflow, framework, profile: 'build' } as never) as { status: string; artifact: { files: Array<{ path: string; contents: string }> } };
      expect(app.status).toBe('ok');
      const detail = app.artifact.files.find(file => /src\/screens\/Detail\.(tsx|vue)$/.test(file.path))!.contents;
      const summary = detail.indexOf('record-summary"');
      expect(summary, framework).toBeGreaterThan(-1);
      expect(detail.indexOf('<StatusBadge', summary), framework).toBeGreaterThan(summary);
      expect(detail.indexOf('data-oods-screen-actions=', summary), framework).toBeGreaterThan(summary);
    }
  });
});

describe('every shipped object with a lifecycle has a title, so none composes its detail the new way', () => {
  it('places the record summary right after the level-one title on each shipped Stateful object', async () => {
    const stateful = listObjects().filter(name => loadObject(name).traits.some(trait => trait.name.endsWith('Stateful')));
    expect(stateful.length).toBeGreaterThanOrEqual(10);
    for (const object of stateful) {
      const { status, schema } = await composeIn(object, 'detail');
      if (status !== 'ok') continue;
      const title = find(schema.screens, node => node.component === 'DetailHeader' && node.props?.headingLevel === 1);
      expect(title, object).toBeDefined();
      const parent = find(schema.screens, node => Boolean(node.children?.includes(title!)))!;
      expect(parent.children![parent.children!.indexOf(title!) + 1]?.meta?.intent, object).toBe('record-summary');
    }
  });
});

describe('Article\'s body and Approval\'s comment are edited in text areas, so their lines stay apart', () => {
  it('gives Article\'s required body a text area that keeps its sample\'s lines, in HTML, React and Vue', async () => {
    const { schema } = await composeIn('Article', 'form');
    const body = schemaNodes(schema).filter(node => node.props?.field === 'body_markdown' && node.component !== 'Text');
    expect(body.map(node => node.component)).toEqual(['Textarea']);
    const label = String(body[0]!.props?.label);
    for (const [renderer, page] of Object.entries(await formPages('Article'))) {
      const area = labelled(page, label);
      expect(area?.tagName, `${renderer}: ${label}`).toBe('TEXTAREA');
      const value = (area as HTMLTextAreaElement).value || area!.textContent || '';
      expect(value.split('\n').filter(line => line.trim()).length, `${renderer}: ${JSON.stringify(value.slice(0, 80))}`).toBeGreaterThan(1);
      // A required field keeps the mark and the browser's enforcement it had as a one-line input.
      expect(area!.hasAttribute('required'), `${renderer}: required`).toBe(true);
    }
  });

  it('gives Approval\'s comment a text area, and keeps a one-line input for its name and Article\'s title', async () => {
    const approval = schemaNodes((await composeIn('Approval', 'form')).schema);
    expect(approval.find(node => node.props?.field === 'comment' && node.component !== 'Text')?.component).toBe('Textarea');
    expect(approval.find(node => node.props?.field === 'name' && node.component !== 'Text')?.component).toBe('Input');
    const article = schemaNodes((await composeIn('Article', 'form')).schema);
    expect(article.find(node => node.props?.field === 'label' && node.component !== 'Text')?.component).toBe('Input');
    for (const [renderer, page] of Object.entries(await formPages('Approval'))) {
      const comment = labelled(page, 'Comment');
      expect(comment?.tagName, renderer).toBe('TEXTAREA');
      // The comment is optional: a text area is required only when its field is.
      expect(comment!.hasAttribute('required'), renderer).toBe(false);
    }
  });
});
