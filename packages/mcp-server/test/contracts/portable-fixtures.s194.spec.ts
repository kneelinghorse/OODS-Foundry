import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { wire, repositoryRoot } from '../helpers/wire-boundary.js';

it('preserves the pinned portable recipes while object_import uses its draft/show/apply lifecycle', async () => {
  const read = (file: string) => fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
  const directory = 'packages/mcp-server/test/fixtures/portable-runtime/';
  const provenance = JSON.parse(read(directory + 'provenance.json')).s194_tool_fixtures;
  const registry = JSON.parse(read('packages/mcp-server/src/tools/registry.json'));
  const pins = JSON.parse(read('scripts/runtime/e2e.mjs').match(/const TOOL_FIXTURE_PINS = Object.freeze\(([\s\S]*?)\);/)![1]);
  expect(pins).toEqual(provenance.fixtures);
  // The new importer creates its review ID at runtime; e2e.mjs exercises and records that lifecycle.
  // Do not rewrite the historical fixture provenance to imply it covered a tool introduced later.
  expect(registry.auto).toContain('object.import');
  expect(pins.map((pin: any) => pin.tool).sort()).toEqual(registry.auto.filter((name: string) => !['object.import', 'object.write', 'schema.read', 'map.read', 'brand.read', 'object.import.read', 'design.versions'].includes(name)).sort());
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
    // The historical operands are retained; split read actions use their new validator.
    const currentTool = (input: any) => recipe.tool === 'brand.intake' && input.action === 'template' ? 'brand.read'
      : recipe.tool === 'map' && input.action === 'resolve' ? 'map.read'
      : recipe.tool === 'schema' && input.action === 'load' ? 'schema.read' : recipe.tool;
    wire(currentTool(args), 'input', args);
    for (const followup of recipe.followups ?? []) wire(currentTool(followup), 'input', followup);
  }
  expect(JSON.stringify(state)).toBe(before);
});
