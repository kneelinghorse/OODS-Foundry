/**
 * s255-m04 (settled 10): where a person sees what is kept about them, in HTML, React and Vue alike.
 * - Ruth Adeyemi's page lists "What is kept about Ruth Adeyemi", each row with its words, how it was made and who keeps
 *   it, and below it, closed until opened, "Removed memories about Ruth Adeyemi", whose row names who removed it and what
 *   remains, and holds no words.
 * - The Billing Agent's page lists "What Billing Agent keeps" and the Tidewater grant's page "Kept under it", five rows
 *   and the one more counted; Tomas Lindqvist's and the Inventory Agent's pages list his memory, kept under no grant, so
 *   no grant's page lists it.
 * - No organization's page lists memories, and a page with none says so in its list's empty sentence.
 * - Each memory list says under its rows what it cannot see.
 * (related-region.s249 holds that every list on these pages draws alike in the three renderers.)
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 600_000 });

import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadObject } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { snakeToCamel } from '../../src/codegen/binding-utils.js';
import { workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { resolveRelatedLists } from '../../src/compose/related-records.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: { document: Document } } };
type Sample = Record<string, any>;
const OBJECTS = ['User', 'Agent', 'Grant', 'Organization'] as const;
const NAME: Record<string, string> = { User: 'name', Organization: 'label', Agent: 'name', Grant: 'name' };
const RENDERERS = ['html', 'react', 'vue'] as const;
const words = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const textOf = (node: Node): string => {
  const pieces: string[] = [];
  const visit = (current: Node) => { if (current.nodeType === 3) { if (current.textContent?.trim()) pieces.push(current.textContent); return; } current.childNodes.forEach(visit); };
  visit(node);
  return words(pieces.join(' '));
};
const sample = (object: string, name: string) => ((loadObject(object).samples ?? []) as Sample[]).find(record => record[NAME[object]!] === name)!;
const memories = (loadObject('Memory').samples ?? []) as Sample[];
const NOTE = (who: string) => `A summary can hold more than one thing, and a store elsewhere may keep more${who} than is listed here.`;

const composed: Record<string, UiSchema> = {};
const workflows: Record<string, UiSchema> = {};
const code: Record<string, Record<'react' | 'vue', { code: string; actions: string[] }>> = {};
beforeAll(async () => {
  for (const object of OBJECTS) {
    composed[object] = (await compose({ object, context: 'detail', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    workflows[object] = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as { schema: UiSchema }).schema;
    code[object] = {} as never;
    for (const framework of ['react', 'vue'] as const) {
      const generated = await generate({ schema: composed[object]!, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact };
      code[object]![framework] = { code: generated.code, actions: generated.artifact.actions.map(action => action.name) };
    }
  }
});

/** One record's page in each renderer, its related region as a section per list: heading, rows, whether it starts closed. */
function page(object: string, name: string) {
  const record = sample(object, name);
  const schema = composed[object]!;
  const seeded = workflowSampleRecords(workflows[object]!).find(row => row[NAME[object]!] === name)!;
  const established = Object.fromEntries(Object.entries(seeded).map(([field, value]) => [snakeToCamel(field), value]));
  const model = { ...seedPreviewModel({ schema, context: 'detail', object, established }), related: resolveRelatedLists(object, record) };
  const html = {
    html: renderRecordBody(schema, { objectName: object, sampleModel: model } as never),
    react: renderGenerated('react', code[object]!.react.code, model, code[object]!.react.actions),
    vue: renderGenerated('vue', code[object]!.vue.code, model, code[object]!.vue.actions),
  };
  return Object.fromEntries(RENDERERS.map(renderer => {
    const document = new JSDOM(html[renderer]).window.document;
    const sections = [...document.querySelectorAll('[data-oods-collection="related"] section.oods-related')];
    return [renderer, Object.fromEntries(sections.map(section => [section.getAttribute('data-oods-list'), {
      text: textOf(section), closed: section.querySelector('details') ? !section.querySelector('details')!.hasAttribute('open') : false,
    }]))];
  })) as Record<(typeof RENDERERS)[number], Record<string, { text: string; closed: boolean }>>;
}

describe('a person sees what is kept about them, and what was removed, closed until opened', () => {
  it('lists Ruth Adeyemi\'s five memories with their words, how each was made and who keeps it, then the one removed', () => {
    const drawn = page('User', 'Ruth Adeyemi');
    for (const renderer of RENDERERS) {
      const kept = drawn[renderer]['kept-about']!;
      expect(kept.text, renderer).toMatch(/^What is kept about Ruth Adeyemi \(5\)/);
      for (const memory of memories.filter(item => item.about_name === 'Ruth Adeyemi' && item.status !== 'removed')) {
        expect(kept.text, `${renderer} ${memory.name}`).toContain(memory.name);
        // A memory's words are its claim, labelled as such on every row (s255-m05, the fresh read).
        expect(kept.text, `${renderer} ${memory.name}`).toContain(`What it says: ${memory.words}`);
      }
      for (const label of ['How it was made: Copied in from another store', 'How it was made: Said by the person it is about', 'How it was made: Not known', 'How it was made: Made from other memories', 'Kept by: Billing Agent']) expect(kept.text, renderer).toContain(label);
      expect(kept.text, renderer).not.toMatch(/\b(told|inferred|combined|imported|added_by_someone_else)\b/);
      expect(kept.text, renderer).toContain(NOTE(' about Ruth Adeyemi'));
      const removed = drawn[renderer]['removed-about']!;
      expect(removed.closed, renderer).toBe(true);
      expect(removed.text, renderer).toContain('Removed memories about Ruth Adeyemi (1)');
      expect(removed.text, renderer).toContain('Memory about Ruth Adeyemi, 28 Sep 2026, 21:15 UTC');
      expect(removed.text, renderer).toContain('Removed by: Ruth Adeyemi');
      expect(removed.text, renderer).toContain('What remains: A log of the removal is kept for 30 days. What it was concluded from is unchanged, and no copy went to another agent.');
      expect(removed.text, renderer).toContain('What remains is what the product that held each memory reports.');
      expect(removed.text, renderer).not.toContain('How it was made');
    }
  });

  it('says on a page with none that nothing is kept or removed, and lists Mei Chen\'s and Tomas Lindqvist\'s own', () => {
    for (const renderer of RENDERERS) {
      const dana = page('User', 'Dana Whitfield')[renderer];
      expect(dana['kept-about']!.text, renderer).toBe('What is kept about Dana Whitfield (0) No memory about Dana Whitfield is kept here now.');
      expect(dana['removed-about']!.text, renderer).toBe('Removed memories about Dana Whitfield (0) No memory about Dana Whitfield here has been removed.');
      expect(page('User', 'Mei Chen')[renderer]['kept-about']!.text, renderer).toContain('Memory about Mei Chen, 24 Sep 2026, 02:00 UTC Paused');
      const tomas = page('User', 'Tomas Lindqvist')[renderer]['kept-about']!.text;
      expect(tomas, renderer).toContain('What it says: Tomas Lindqvist wants the stock counted before 06:00, Stockholm time.');
      expect(tomas, renderer).toContain('Kept by: Inventory Agent');
    }
  });
});

describe('an agent\'s and a grant\'s pages list what is kept by it and under it', () => {
  it('lists five of the Billing Agent\'s six and counts the sixth, and the Inventory Agent\'s one', () => {
    for (const renderer of RENDERERS) {
      const billing = page('Agent', 'Billing Agent')[renderer]['keeps']!.text;
      expect(billing, renderer).toMatch(/^What Billing Agent keeps \(6\)/);
      expect(billing, renderer).toContain('1 more not shown');
      expect(billing, renderer).toContain('About: Mei Chen');
      expect(billing, renderer).not.toContain('Memory about Ruth Adeyemi, 28 Sep 2026, 21:15 UTC');
      expect(billing, renderer).toContain(NOTE(''));
      expect(page('Agent', 'Inventory Agent')[renderer]['keeps']!.text, renderer).toMatch(/^What Inventory Agent keeps \(1\) Memory about Tomas Lindqvist, 15 Oct 2026, 06:30 UTC/);
      expect(page('Agent', 'Support Agent')[renderer]['keeps']!.text, renderer).toBe('What Support Agent keeps (0) Support Agent keeps no memory here now.');
    }
  });

  it('lists what was kept under the Tidewater grant, never Tomas Lindqvist\'s, and says so on a grant with none', () => {
    for (const renderer of RENDERERS) {
      const tidewater = page('Grant', 'Tidewater invoices and payments')[renderer]['kept']!.text;
      expect(tidewater, renderer).toMatch(/^Kept under it \(6\)/);
      expect(tidewater, renderer).toContain('Kept by: Billing Agent');
      expect(tidewater, renderer).not.toContain('Tomas Lindqvist');
      expect(page('Grant', 'Northwind customer replies')[renderer]['kept']!.text, renderer).toBe('Kept under it (0) No memory kept under this grant is here now.');
    }
  });

  it('lists no memories on any organization\'s page', () => {
    for (const name of ['Tidewater Co-op', 'Lindqvist Bakery']) {
      for (const renderer of RENDERERS) {
        const lists = page('Organization', name)[renderer];
        expect(Object.keys(lists).filter(id => /kept|keeps|removed-about/.test(id)), `${renderer} ${name}`).toEqual([]);
        // A grant's row may name its last use, a memory, by its kept name (settled 9); no memory's words appear.
        const all = Object.values(lists).map(list => list.text).join(' ');
        expect(all, `${renderer} ${name}`).not.toMatch(/What is kept|keeps no memory/);
        for (const memory of memories) if (typeof memory.words === 'string') expect(all, `${renderer} ${name}`).not.toContain(memory.words);
        // Its work list names the kinds it reads under its rows, so its count is not read as everything done for it.
        if (name === 'Tidewater Co-op') expect(lists['done-for']!.text, renderer).toMatch(/^Recorded on behalf of Tidewater Co-op \(\d+\) .* These are only the tasks, approvals, payments and grants here recorded on behalf of Tidewater Co-op\.$/);
      }
    }
  });
});
