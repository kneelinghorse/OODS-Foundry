/**
 * s221-m03 (#2482 ruling 8; the website's defect (c), message a232e944): generated React and Vue code is the customer's
 * code, so it names nothing after the product. 0.3.2's Warehouse apps declared __ForgeTeamButton, __ForgeContractButton
 * and __forgeTeamProps (React) and __forgeDefineComponent and __forgeH (Vue) wherever a team's component replaces a
 * shipped one. The legacy schema and resource identifiers #2463 ruling (e) keeps (forge-runtime-manifest/v1,
 * ui://oods-forge/...) are not generated code and are not covered here.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadMappings, saveMappings } from '../../src/tools/map.shared.js';

const PRODUCT_NAMED = /__[Ff]orge\w*/g;
let directory: string;
let previous: string | undefined;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 's221-names-'));
  previous = process.env.MCP_MAPPINGS_PATH;
  process.env.MCP_MAPPINGS_PATH = path.join(directory, 'mappings.json');
  const doc = loadMappings();
  doc.mappings = [{ id: 'team-button', externalSystem: 'team', externalComponent: 'TeamButton', oodsTraits: ['Stateful'], confidence: 'manual',
    substitution: { component: 'Button', ...Object.fromEntries(['react', 'vue'].map(framework => [framework, {
      package: `@team/components/${framework}`, export: 'TeamButton', version: '1.0.0', props: { intent: { name: 'appearance' } },
    }])) } }];
  saveMappings(doc);
});
afterEach(() => {
  if (previous === undefined) delete process.env.MCP_MAPPINGS_PATH;
  else process.env.MCP_MAPPINGS_PATH = previous;
  fs.rmSync(directory, { recursive: true, force: true });
});

const everyFile = (result: Awaited<ReturnType<typeof generate>>) => [result.code, ...(result.artifact?.files ?? []).map(file => file.contents)].join('\n');

describe('generated code with a team component names nothing after the product', () => {
  it.each([['react', true], ['react', false], ['vue', true], ['vue', false]] as const)('%s (typescript: %s)', async (framework, typescript) => {
    const result = await generate({ framework, profile: 'build', options: { typescript },
      schema: { version: '2026.02', screens: [{ id: 'save', component: 'Button', props: { content: 'Save', intent: 'primary' } }] } });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    // The mapping still applies: the team's component is imported and the prop is translated.
    expect(result.code).toContain(`from '@team/components/${framework}'`);
    expect(result.code).toContain('appearance');
    expect(everyFile(result).match(PRODUCT_NAMED) ?? []).toEqual([]);
  });

  it.each(['react', 'vue'] as const)('a %s workflow application', async framework => {
    const composed = await compose({ object: 'Subscription', context: 'workflow', options: { transient: true } });
    const result = await generate({ schema: composed.schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(everyFile(result)).toContain(`@team/components/${framework}`);
    expect(everyFile(result).match(PRODUCT_NAMED) ?? []).toEqual([]);
  });
});
