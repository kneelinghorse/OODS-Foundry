/**
 * s250-m01: an object with one to four samples seeds exactly its samples, under their own ids. Closure ships three, one per
 * grant that was given and then ended. Repeated to five under made-up ids, as they were, every authored id was replaced, so
 * a list that reads an id (a closure's grant, a grant inside another) found nothing in a generated app, and a list of one
 * record per grant would show one closure twice. These specs pin, on a team's own object with three samples whose page
 * lists the records inside a record by id:
 * - the seed is the three samples, each once, under its own id, in a generated React and Vue app and on HTML's list;
 * - the app's own list reads those ids: the records inside the first are listed under it;
 * - an object with no samples keeps its ten records, and one with five or more seeds them as before.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { seedSchema } from '../../src/compose/workflow-assembler.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { renderRecordBody } from '../../src/render/record-renderer.js';
import { seedPreviewModel } from '../../src/codegen/preview-model.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated, runGeneratedStore } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const text = (html: string) => (JSDOM.fragment(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')).textContent ?? '').replace(/\s+/g, ' ');
const ID = (n: number) => `7a1b2c3d-0000-4000-8000-0000000000b${n}`;
const NAMES = ['Granite', 'Quartz', 'Basalt'];
const pebble = {
  object: { name: 'Pebble', version: '1.0.0', domain: 'team.test', description: 'A test stone that may sit inside another.' },
  traits: [{ name: 'lifecycle/Stateful', parameters: { states: ['loose', 'set'], initialState: 'loose' } }],
  schema: {
    pebble_id: { type: 'uuid', required: true, description: 'The record\'s own id.' },
    name: { type: 'string', required: true, description: 'What it is called.' },
    within_id: { type: 'string', required: false, description: 'The stone this one sits inside, by id.' },
  },
  semantics: { name: { semantic_type: 'text.label', token_mapping: 'tokenMap(text.body.*)' } },
  samples: [
    { pebble_id: ID(1), name: 'Granite', status: 'set' },
    { pebble_id: ID(2), name: 'Quartz', status: 'loose', within_id: ID(1) },
    { pebble_id: ID(3), name: 'Basalt', status: 'loose', within_id: ID(1) },
  ],
  metadata: { relatedLists: [{ id: 'inside', label: 'Inside {name}', empty: 'Nothing sits inside {name}.', sources: [{ from: 'Pebble', via: 'within_id' }] }] },
};

let home: string;
const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s250-samples-'));
  fs.mkdirSync(path.join(home, 'objects'));
  fs.writeFileSync(path.join(home, 'objects', 'Pebble.object.yaml'), dump(pebble));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  clearTraitCache(); clearObjectCache();
});
afterAll(() => {
  for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  clearTraitCache(); clearObjectCache();
  fs.rmSync(home, { recursive: true, force: true });
});

const composed = async (object: string, context: string): Promise<UiSchema> => {
  const result = await compose({ object, context, options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
  expect(result.status, `${object}/${context}: ${JSON.stringify(result.errors)}`).toBe('ok');
  return result.schema;
};

describe('an object with three samples seeds exactly its three, under their own ids', () => {
  it('seeds each sample once, by its own id', async () => {
    const workflow = await composed('Pebble', 'workflow');
    expect(workflow.workflow!.data.sampleCount).toBe(3);
    const { records } = workflowSampleData(workflow);
    expect(records.map(record => [record.pebble_id, record.name])).toEqual(NAMES.map((name, index) => [ID(index + 1), name]));
  });

  it('a generated React and Vue app holds the three, and its own list reads their ids', async () => {
    const workflow = await composed('Pebble', 'workflow');
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: workflow, framework, profile: 'build', options: { typescript: true } } as never) as { status: string; artifact: GeneratedArtifact; errors?: unknown };
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      const out = runGeneratedStore(result.artifact.files, `
const s = store.createStore({ latency: 0 });
const all = s.list({ pageSize: 1000 }).records;
process.stdout.write(JSON.stringify(all.map((record) => ({ id: record.pebble_id, name: record.name, inside: s.related(record)[0] }))));
`) as Array<{ id: string; name: string; inside: { heading: string; rows: Array<{ title: string }> } }>;
      expect(out.map(row => row.id).sort(), framework).toEqual([ID(1), ID(2), ID(3)]);
      const granite = out.find(row => row.name === 'Granite')!;
      expect(granite.inside.heading, framework).toBe('Inside Granite (2)');
      expect(granite.inside.rows.map(row => row.title), framework).toEqual(['Quartz', 'Basalt']);
      expect(out.find(row => row.name === 'Basalt')!.inside.heading, framework).toBe('Inside Basalt (0)');
    }
  });

  it('a list screen shows each of the three once, in HTML, React and Vue', async () => {
    const list = await composed('Pebble', 'list');
    const workflow = await composed('Pebble', 'workflow');
    const model = seedPreviewModel({ schema: list, context: 'list', object: 'Pebble', workflowSchema: workflow });
    const pages = [renderRecordBody(list, { objectName: 'Pebble', sampleModel: model } as never)];
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: list, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; code: string; artifact: GeneratedArtifact };
      expect(result.status).toBe('ok');
      pages.push(renderGenerated(framework, result.code, model, result.artifact.actions.map(action => action.name)));
    }
    for (const [index, page] of pages.entries()) {
      const body = text(page);
      for (const name of NAMES) expect(body.split(name).length - 1, `${['html', 'react', 'vue'][index]}: ${name}`).toBe(1);
    }
  });
});

describe('every other object seeds as before', () => {
  it('an object with no samples keeps its ten, and one with five or more seeds one record per sample', async () => {
    // A read-only object with no samples (a capture record) seeds from its list composition's data descriptor, as Closure
    // will with its three.
    expect(loadObject('Run').samples ?? []).toEqual([]);
    expect((await seedSchema({ object: 'Run', context: 'list' } as never, compose as never))!.workflow!.data.sampleCount).toBe(10);
    for (const object of ['User', 'Grant', 'Task']) {
      const workflow = await composed(object, 'workflow');
      expect(workflow.workflow!.data.sampleCount, object).toBe(Math.min(10, loadObject(object).samples!.length));
      expect(loadObject(object).samples!.length, object).toBeGreaterThanOrEqual(5);
    }
  });
});
