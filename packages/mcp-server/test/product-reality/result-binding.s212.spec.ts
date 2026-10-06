import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESULT_STATE_TONE } from '@oods/component-contracts';
import { handle as compose, swappableCandidates } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

let store: string;
beforeEach(() => { store = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-result-binding-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', store); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(store, { recursive: true, force: true }); });
const nodes = (schema: UiSchema) => { const all: UiElement[] = []; const walk = (node: UiElement) => { all.push(node); node.children?.forEach(walk); }; schema.screens.forEach(walk); return all; };

// Recording trials must filter an unsafe swap without aborting the already-safe composed screen.
// Transient composition does not record candidates, and would miss this regression.
describe('a result-family refusal removes a swap, not the safe composition (s212-m06)', () => {
  it.each(['react', 'vue'] as const)('records CapturedArtifact inline, keeps its neutral result and generates in %s', async framework => {
    const composed = await compose({ object: 'CapturedArtifact', context: 'inline' });
    const bound = nodes(composed.schema).filter(node => Object.entries(node.props ?? {}).some(([key, value]) => (key === 'field' || key.endsWith('Field')) && value === 'result_state'));
    expect(bound, 'the result must remain visible, not disappear to make composition pass').toHaveLength(1);
    expect(bound[0]).toMatchObject({ component: 'StatusBadge', props: { tone: RESULT_STATE_TONE } });
    const record = await readVersion(resolveCompositionsDir(), composed.compositionId!, composed.version!);
    const resultSlot = composed.selections.find(selection => selection.slotName === 'items')!;
    // s223-m02 (#2527 ruling 13g): catalog regions now come from the contexts trait recipes place. ColorizedBadge's old
    // "badges" region was its only lead over InlineLabel here, so this composition no longer ranks it. The recording's
    // trial must still refuse it: offered for this slot, it is left out without failing, and the safe selection stays.
    const offered = { ...resultSlot, candidates: [...resultSlot.candidates, { ...resultSlot.candidates[0]!, name: 'ColorizedBadge' }] };
    const viable = await swappableCandidates({ object: 'CapturedArtifact', context: 'inline' } as never, composed.schema!, offered);
    expect(viable).toContain('StatusBadge');
    expect(viable, 'an unsafe swap is left out, not fatal').not.toContain('ColorizedBadge');
    expect(record.slots.find(slot => slot.slotName === 'items')!.candidates, 'the saved version cannot offer an unsafe swap').not.toContain('ColorizedBadge');
    const generated = await generate({ schema: composed.schema, framework, profile: 'build', options: { styling: 'tokens', typescript: true } });
    expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
    expect(generated.code).toContain('StatusBadge');
  });

  it('still refuses an explicitly requested colored result before writing a composition', async () => {
    await expect(compose({ object: 'CapturedArtifact', context: 'inline', preferences: { componentOverrides: { items: 'ColorizedBadge' } } }))
      .rejects.toMatchObject({ opiCode: 'OODS-V211' });
    expect(fs.existsSync(resolveCompositionsDir()), 'a refused authored screen must write nothing').toBe(false);
  });
});
