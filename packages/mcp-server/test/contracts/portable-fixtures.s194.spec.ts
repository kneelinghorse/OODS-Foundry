import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { wire, repositoryRoot } from '../helpers/wire-boundary.js';

it('pins one portable recipe per advertised tool and binds only untouched live producer output', async () => {
  const read = (file: string) => fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
  const directory = 'packages/mcp-server/test/fixtures/portable-runtime/';
  const provenance = JSON.parse(read(directory + 'provenance.json')).s194_tool_fixtures;
  const registry = JSON.parse(read('packages/mcp-server/src/tools/registry.json'));
  const pins = JSON.parse(read('scripts/runtime/e2e.mjs').match(/const TOOL_FIXTURE_PINS = Object.freeze\(([\s\S]*?)\);/)![1]);
  expect(pins).toEqual(provenance.fixtures);
  expect(pins.map((pin: any) => pin.tool).sort()).toEqual([...registry.auto].sort());
  const state: Record<string, any> = {
    compose: await compose({ object: 'Subscription', context: 'card' }),
    viz: await render(JSON.parse(read(directory + 'd3-viz-bar.json'))),
  };
  const before = JSON.stringify(state);
  for (const pin of pins) {
    const bytes = read(directory + pin.fixture);
    expect(Buffer.byteLength(bytes)).toBe(pin.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);
    const recipe = JSON.parse(bytes); const args = { ...recipe.arguments };
    for (const [key, binding] of Object.entries(recipe.bindings) as Array<[string, string]>) {
      const [producer, field] = binding.split('.'); args[key] = state[producer][field];
    }
    wire(recipe.tool, 'input', args);
    for (const followup of recipe.followups ?? []) wire(recipe.tool, 'input', followup);
  }
  expect(JSON.stringify(state)).toBe(before);
});
