// s181 m02 C3 — duplicate dashboard panel ids must fail before panel rendering.
//
// Provenance: the fixture reproduces the B-10 RED baseline measured at Forge base
// 85004fe. Without the guard, both differently bound `dup` rows render status:ok with
// warnings:[] but receive the same last-writer-wins panel contentHash. The carrier
// compares those hashes to each other; no operand-specific panel hash is pinned.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDefinition } from '../../src/errors/registry.js';
import { isToolError } from '../../src/errors/tool-error.js';
import { getAjv } from '../../src/lib/ajv.js';
import type { DashboardRenderInput } from '../../src/schemas/generated.js';
import { handle as dashboardRender } from '../../src/tools/dashboard.render.js';

const BASELINE_COMMIT = '85004fe';
const EXPECTED_FIXTURE_SHA256 = '3a5238661f061487decaccdbd22fedb0b785533eba797d105bb3884288bbfead';
const fixtureBytes = readFileSync(
  new URL('./__fixtures__/dashboard.duplicate-panel-id.s181.json', import.meta.url),
);
const duplicateInput = JSON.parse(fixtureBytes.toString('utf8')) as DashboardRenderInput;
const dashboardInputSchema = JSON.parse(
  readFileSync(new URL('../../src/schemas/dashboard.render.input.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const validateDashboardInput = getAjv().compile(dashboardInputSchema);

type DashboardOutput = Awaited<ReturnType<typeof dashboardRender>>;

function successfulChartHashes(output: DashboardOutput): string[] {
  return output.panels
    .filter((panel) => panel.kind === 'chart')
    .map((panel) => panel.contentHash)
    .filter((hash): hash is string => hash !== undefined);
}

/**
 * The success branch is reachable only under the delete-the-guard B-10 mutant.
 * Keep the measured equality assertion there so the red state identifies the
 * receipt-collapse bug, then reject with a non-ToolError to fail the contract.
 */
async function renderDuplicateOrCaptureRedBaseline(): Promise<DashboardOutput> {
  const output = await dashboardRender(structuredClone(duplicateInput));
  expect(output.status).toBe('ok');
  expect(output.warnings).toEqual([]);
  const hashes = successfulChartHashes(output);
  expect(hashes).toHaveLength(2);
  expect(hashes[0]).toBe(hashes[1]);
  throw new Error('duplicate panel ids rendered without OODS-C003');
}

describe(`dashboard.render duplicate panel id guard (s181 m02, ${BASELINE_COMMIT})`, () => {
  it('pins the valid vendored RED-baseline operand bytes and both id descriptions', () => {
    expect(createHash('sha256').update(fixtureBytes).digest('hex')).toBe(EXPECTED_FIXTURE_SHA256);
    expect(validateDashboardInput(duplicateInput), JSON.stringify(validateDashboardInput.errors)).toBe(true);

    const defs = dashboardInputSchema.$defs as Record<string, any>;
    expect(defs.ChartPanel.properties.id.description).toContain('OODS-C003');
    expect(defs.KpiPanel.properties.id.description).toContain('OODS-C003');
  });

  it('rejects duplicate ids once, at the call boundary, with the conflict-family error', async () => {
    const error = await renderDuplicateOrCaptureRedBaseline().catch((caught: unknown) => caught);

    expect(isToolError(error)).toBe(true);
    expect(error).toMatchObject({
      opiCode: 'OODS-C003',
      message: 'Duplicate panel id',
      details: { ids: ['dup'] },
    });
    // Glossary metadata is additive; these fields retain the refusal's existing meaning.
    expect(getDefinition('OODS-C003')).toMatchObject({
      code: 'OODS-C003',
      category: 'conflict',
      message: 'Duplicate panel id',
      retryable: false,
    });
  });

  it('keeps distinct ids renderable with two independently derived panel hashes', async () => {
    const distinctInput = structuredClone(duplicateInput);
    distinctInput.panels[1]!.id = 'east-bars';

    const output = await dashboardRender(distinctInput);
    expect(output.status).toBe('ok');
    expect(output.warnings).toEqual([]);
    const hashes = successfulChartHashes(output);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).not.toBe(hashes[1]);
  });
});
