/**
 * s255-m04 (settled 6, 10): the generated User, Agent and Grant apps carry the shipped memories as copies, made from the
 * registered Memory's samples when the app is made, under the note that says so, and they still compile strictly in
 * React and Vue. A copied row carries a memory's words, as every copied row carries the fields its row shows; a removed
 * memory has no words to copy.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 600_000 });

import { describe, expect, it } from 'vitest';
import { RELATED_COPIED_NOTE } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { GeneratedArtifact } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';

const LISTS: Record<string, string[]> = { User: ['kept-about', 'removed-about'], Agent: ['keeps'], Grant: ['kept'] };
const memories = (loadObject('Memory').samples ?? []) as Array<Record<string, any>>;

async function app(object: string, framework: 'react' | 'vue'): Promise<GeneratedArtifact> {
  const workflow = await compose({ object, context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
  expect(workflow.status, JSON.stringify(workflow.errors)).toBe('ok');
  const result = await generate({ schema: workflow.schema, framework, profile: 'build', options: { typescript: true, styling: 'tokens' } } as never) as { status: string; artifact: GeneratedArtifact; errors?: unknown };
  expect(result.status, `${object}/${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
  return result.artifact;
}

describe('the generated User, Agent and Grant apps carry the memories as copies', () => {
  it.each(Object.keys(LISTS))('%s: its memory lists read copied Memory records under the copied note', async object => {
    const artifact = await app(object, 'react');
    const data = artifact.files.find(file => file.path === 'src/related-data.ts')!.contents;
    for (const id of LISTS[object]!) expect(data, `${object} ${id}`).toContain(JSON.stringify(id));
    expect(data).toContain(RELATED_COPIED_NOTE);
    // Every shipped memory is copied, by its id and kept name; the words of those not removed travel with them.
    for (const memory of memories) {
      expect(data, memory.name).toContain(memory.memory_id);
      if (typeof memory.words === 'string') expect(data, memory.name).toContain(JSON.stringify(memory.words).slice(1, -1));
    }
    // The labels the rows print for how a memory was made travel with the copies, never the codes alone.
    expect(data).toContain('Said by the person it is about');
  });

  it.each(Object.keys(LISTS).flatMap(object => (['react', 'vue'] as const).map(framework => [object, framework] as const)))('%s/%s compiles strictly with its copied memories', async (object, framework) => {
    const checked = typecheckWorkflow(await app(object, framework));
    expect(checked.status, `${checked.stdout}${checked.stderr}`).toBe(0);
  });
});
