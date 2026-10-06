import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { componentContracts, sharedScenarios, substitutionContractReport } from '@oods/component-contracts';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as create } from '../../src/tools/map.create.js';
import { getAjv } from '../../src/lib/ajv.js';
import outputSchema from '../../src/schemas/code.generate.output.json' with { type: 'json' };
let folder: string;
beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 's214-contract-report-'));
  vi.stubEnv('MCP_MAPPINGS_PATH', path.join(folder, 'mappings.json')); vi.stubEnv('OODS_PREVIEW_HOST_URL', '');
  vi.stubEnv('MCP_SCHEMA_STORE_ROOT', folder); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas');
  await create({ apply: true, externalSystem: 'team', externalComponent: 'Button', oodsTraits: ['Stateful'], substitution: { component: 'Button', react: { package: '@team/buttons', export: 'Button', version: '1.0.0' }, vue: { package: '@team/buttons', export: 'Button', version: '1.0.0' } } });
});
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(folder, { recursive: true, force: true }); });

it('keeps every declared obligation visible and never converts lack of a browser into a conformance claim', () => {
  for (const contract of Object.values(componentContracts)) {
    const report = substitutionContractReport({ framework: 'react', mappingId: 'fixture', component: contract.id, source: { package: '@team/components', export: contract.id, version: '1.0.0' } }, 'No browser ran.');
    const ids = report.obligations.map(row => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [kind, names] of Object.entries({ prop: contract.props, slot: contract.slots, event: contract.events, state: contract.states, token: contract.tokenRoles, accessibility: contract.accessibility, keyboard: Object.keys(contract.keyboard ?? {}) })) {
      for (const name of names) expect(ids, `${contract.id} must disclose ${kind}:${name}`).toContain(`${kind}:${name}`);
    }
    const scenario = sharedScenarios.find(row => row.oodsComponentId === contract.id)!;
    expect(report.scenarioId).toBe(scenario.id);
    expect(ids.filter(id => id.startsWith('scenario:event:'))).toHaveLength(scenario.event.length);
    expect(ids.filter(id => id.startsWith('scenario:assertion:'))).toHaveLength(scenario.assertions.length);
    expect(report.summary).toEqual({ met: 0, unmet: 0, 'not-checked': ids.length });
    expect(report.obligations.every(row => row.reason === 'No browser ran.')).toBe(true);
  }
});

it.each(['react', 'vue'] as const)('carries an honest %s report without requiring the package or browser to generate code', async framework => {
  const result = await generate({ framework, profile: 'build', schema: { version: '2026.09', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } });
  expect(result.status).toBe('ok');
  const validate = getAjv().compile(outputSchema); expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  // s221-m01: name the one report (a count here read like a nucleus pin to nucleus-pins.s185).
  expect(result.componentContracts!.map(report => report.component)).toEqual(['Button']);
  expect(result.componentContracts![0]).toMatchObject({ framework, component: 'Button', summary: { met: 0, unmet: 0 } });
  expect(result.componentContracts![0]!.obligations.every(row => row.status === 'not-checked' && row.reason.includes('No preview host'))).toBe(true);
  expect(result.validationReceipt.checks).not.toContain('interaction-evidence');
});

it('names host failure as unmeasured while keeping the generated artifact available', async () => {
  const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.09', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } }, { previewHostUrl: 'http://127.0.0.1:1' });
  expect(result.status).toBe('ok'); expect(result.artifact).toBeDefined();
  expect(result.componentContracts![0]!.obligations.every(row => row.status === 'not-checked' && row.reason.includes('unavailable'))).toBe(true);
});

it('leaves unmapped generation without a team report', async () => {
  const result = await generate({ framework: 'react', profile: 'build', schema: { version: '2026.09', screens: [{ id: 'text', component: 'Text', props: { content: 'Ordinary content' } }] } });
  expect(result.status).toBe('ok'); expect(result.componentContracts).toBeUndefined();
});

it('retains the report beside a file payload so a size-limited client does not lose unchecked obligations', async () => {
  const result = await generate({ framework: 'react', options: { payloadMode: 'file' }, schema: { version: '2026.09', screens: [{ id: 'save', component: 'Button', props: { content: 'Save' } }] } });
  expect(result.status).toBe('ok');
  const report = result.payload!.files.find(file => file.path === 'component-contracts.json');
  expect(report).toBeDefined();
  expect(JSON.parse(fs.readFileSync(path.join(result.payload!.directory, report!.path), 'utf8'))).toEqual(result.componentContracts);
});
