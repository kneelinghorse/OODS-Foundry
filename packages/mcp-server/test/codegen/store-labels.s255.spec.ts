/**
 * s255-m03 (settled 15a): a generated app's history names each edited field by the label its object declares, as
 * every screen does. Organization's generated store labelled plan_tier "Plan tier", so an edit read "Edited Plan tier"
 * on a page that calls it "Account tier" everywhere else. The store now reads each field's declared label, and a field
 * that declares none keeps the label made from its name. An id and the kept name beside it declare one label, so an edit
 * that changes both names that label once.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { runGeneratedStore } from '../product-reality/render-generated.js';

const NOW = '2026-11-27T12:00:00.000Z';

async function run(object: string, script: string): Promise<Record<string, any>> {
  const workflow = await compose({ object, context: 'workflow', options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: unknown };
  expect(workflow.status, JSON.stringify(workflow.errors)).toBe('ok');
  const result = await generate({ schema: workflow.schema, framework: 'react', profile: 'build' } as never) as { status: string; artifact: { files: Array<{ path: string; content: string }> }; errors?: unknown };
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  return runGeneratedStore(result.artifact.files, `const s = store.createStore({ now: () => ${JSON.stringify(NOW)} });\n${script}`) as Record<string, any>;
}

describe('a generated history names a field as its screens do', () => {
  it('reads "Edited Account tier" when Northwind Traders moves to enterprise, and keeps a name-made label where none is declared', async () => {
    const out = await run('Organization', `
const before = s.get('3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a01');
const tier = s.update({ ...before, plan_tier: 'enterprise' });
const industry = s.update({ ...tier, industry: 'Retail trade' });
process.stdout.write(JSON.stringify({ labels: store.fieldLabels, tier, industry }));`);
    expect(out.labels.plan_tier).toBe('Account tier');
    expect(out.tier.state_history.at(-1)).toMatchObject({ title: 'Updated', reason: 'Edited Account tier' });
    // Industry declares no label: its label is made from its name, as before.
    expect(out.labels.industry).toBe('Industry');
    expect(out.industry.state_history.at(-1).reason).toBe('Edited Industry');
  });

  it('names the label an id and its kept name share once, when an edit changes both', async () => {
    const out = await run('Task', `
const before = s.get('5c2e8a1d-3f4b-4c6d-9e0a-1b2c3d4e5f01');
const moved = s.update({ ...before, asked_of_id: '6a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a02', asked_of_name: 'Support Agent' });
process.stdout.write(JSON.stringify({ labels: store.fieldLabels, moved }));`);
    expect([out.labels.asked_of_id, out.labels.asked_of_name]).toEqual(['Doing it', 'Doing it']);
    expect(out.moved.state_history.at(-1).reason).toBe('Edited Doing it');
  });
});
