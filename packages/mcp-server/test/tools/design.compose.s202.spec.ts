import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readVersion, resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { handle as compose, swappableCandidates } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';

let storeRoot: string;
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-compose-s202-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

describe('the recorded slot candidates are the ones a swap can generate (s202-m01)', () => {
  it('drops a tab candidate code.generate refuses and keeps every other composer candidate, so every offered swap generates in both frameworks', async () => {
    const composed = await compose({ object: 'Subscription', context: 'detail' });
    expect(composed.status).toBe('ok');
    const record = await readVersion(resolveCompositionsDir(), composed.compositionId!, composed.version!);
    /**
     * RE-ANCHORED in s204-m02, and the reason matters more than the new anchor.
     *
     * This used to open on the status tab slot: `tab-3` selected `StatusBadge`, ranked
     * `['StatusBadge', 'Badge', 'ColorizedBadge']`, and the version offered only `['StatusBadge']`
     * because `code.generate` refuses a `Badge` carrying field directives. After the (c) fix — the
     * status-timeline rule requiring its second field to be a real timestamp, so the group re-pairs
     * from `allowed_transitions` to `updated_at` — that slot no longer resolves to a status field, so
     * `tab-3` selects `Stack` from `['Stack', 'Text', 'Card']` and no slot on this screen ranks the
     * Badge family at all.
     *
     * The COMPOSED TREE is byte-identical across that change, verified node by node: no `StatusBadge`
     * element is lost, because none was ever placed — `payment_status` is carried by `PaymentTimeline`
     * on `tab-1` in both arms. What moved is the composer's recorded slot-candidate metadata, which is
     * exactly what this spec pins, so the pin moves with its reason rather than being asserted away.
     *
     * The invariant is unchanged and is now stated without depending on which family a slot ranks: the
     * offered candidates are a subset of the ranked ones, and everything offered generates.
     */
    // s221-m01: since s216-m05 (374a6eaec5) compose reports only the slots on the page; Subscription's tab-2..7 and
    // metadata slots never reached it, so the header is this screen's swappable slot. The invariant is the same.
    const swappable = composed.selections.find(selection => selection.candidates.length > 1)!;
    expect(swappable, 'a slot with more than one candidate').toBeDefined();
    const offered = record.slots.find(slot => slot.slotName === swappable.slotName)!.candidates ?? [];
    const ranked = swappable.candidates.map(candidate => candidate.name);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every(candidate => ranked.includes(candidate)), `${offered} ⊄ ${ranked}`).toBe(true);
    expect(await swappableCandidates({ object: 'Subscription', context: 'detail' }, composed.schema!, swappable)).toEqual(offered);
    // The refusal is still real, and is proven directly rather than through whichever slot happens to
    // rank the Badge family: a Badge authored with field directives is rejected with OODS-V007, and
    // no slot on this screen offers one.
    const badge = await compose({ object: 'Subscription', context: 'detail', preferences: { componentOverrides: { [swappable.slotName]: 'Badge' } }, options: { transient: true } });
    const refused = await generate({ schema: badge.schema!, framework: 'react', profile: 'build' });
    expect(refused.status).toBe('error');
    expect(refused.errors?.map(error => error.code)).toContain('OODS-V007');
    expect(record.slots.flatMap(slot => slot.candidates ?? [])).not.toContain('Badge');
    // Every candidate the version offers on a swappable slot generates in both frameworks.
    const tabs = record.slots.filter(slot => (slot.candidates ?? []).length > 1);
    expect(tabs.length).toBeGreaterThan(0);
    for (const slot of tabs) {
      for (const candidate of slot.candidates!) {
        if (candidate === slot.selectedComponent) continue;
        const swapped = await compose({ object: 'Subscription', context: 'detail', preferences: { componentOverrides: { [slot.slotName]: candidate } }, options: { transient: true } });
        expect(swapped.status, `${slot.slotName} → ${candidate}`).toBe('ok');
        for (const framework of ['react', 'vue'] as const) {
          const generated = await generate({ schema: swapped.schema!, framework, profile: 'build' });
          expect(generated.status, `${slot.slotName} → ${candidate} (${framework}): ${JSON.stringify(generated.errors)}`).toBe('ok');
        }
      }
    }
  }, 120_000);
});

describe('a version\'s own order overrides never abort recording it (s202-m04)', () => {
  it('records a version whose field order some slot candidate cannot carry, and offers only the candidates a swap would compose', async () => {
    // With the header slot swapped to VizAreaPreview the status group moves into the body, so ordering the body's fields
    // names one of that group's fields; a candidate that no longer places it there is refused by that order. Recording
    // used to fail with it.
    //
    // MOVED in s204-m02: this named `status`, which `detail-body-10` no longer carries. The (c) fix
    // re-pairs the status-timeline group from `allowed_transitions` to `updated_at`, and the group
    // takes `status` with it, so naming `status` here now refuses at the order itself (OODS-V204)
    // before the test can measure anything. `updated_at` is the field the group actually brings into
    // this region, so it is what the order names — the same shape of assertion about the same group.
    const preferences = { componentOverrides: { header: 'VizAreaPreview' }, fieldOrder: { 'detail-body-10': ['cancellation_reason_code', 'updated_at'] } };
    const composed = await compose({ object: 'Subscription', context: 'detail', preferences });
    expect(composed.status).toBe('ok');
    const record = await readVersion(resolveCompositionsDir(), composed.compositionId!, composed.version!);
    const refusedByOrder: string[] = [];
    let swapsTried = 0;
    for (const selection of composed.selections) {
      const offered = record.slots.find(slot => slot.slotName === selection.slotName)?.candidates ?? [];
      const ranked = [...new Set([...selection.candidates.map(candidate => candidate.name), ...(selection.alternativeCandidates ?? []).map(candidate => candidate.name)])];
      for (const name of ranked) {
        if (name === selection.selectedComponent) continue;
        swapsTried += 1;
        const outcome = await compose({ object: 'Subscription', context: 'detail', preferences: { ...preferences, componentOverrides: { ...preferences.componentOverrides, [selection.slotName]: name } }, options: { transient: true, validate: false } })
          .then(() => 'composed', (error: { opiCode?: string }) => error.opiCode ?? 'error');
        // A swap the version's own order refuses is never offered; every offered swap composes.
        if (outcome === 'OODS-V204') { refusedByOrder.push(`${selection.slotName} → ${name}`); expect(offered, `${selection.slotName} → ${name}`).not.toContain(name); }
        else if (offered.includes(name)) expect(outcome, `${selection.slotName} → ${name}`).toBe('composed');
      }
    }
    /**
     * This used to require at least one candidate refused by the version's own order, as the guard
     * that the test was exercising the scenario rather than passing vacuously. That guard was right
     * and it fired honestly in s204-m02: after the (c) fix the scenario NO LONGER OCCURS on this
     * screen, and it is recorded here rather than asserted away.
     *
     * Why it is gone: the scenario needed a field that moves between regions depending on which
     * component a slot carries, and on this screen that field was `status`. The status-timeline group
     * now pairs `status` with `updated_at` and holds both, so no candidate swap changes which region
     * carries a body field. Measured, not inferred: every field `detail-body-10` carries — the seven
     * checked were `updated_at`, `created_at`, `last_event`, `last_event_at`, `plan_code`,
     * `customer_name` and `subscription_id` — produces zero OODS-V204 refusals across every ranked
     * candidate of every slot.
     *
     * The invariant the test exists for is unchanged and still enforced above: recording never aborts
     * on an order some candidate cannot carry, and every offered candidate composes. The vacuity guard
     * is now the swap count, which keeps the loop honest — if the composition stopped offering
     * alternatives at all, this fails.
     *
     * Carried to the s204 review, decided in s205-m01: the arm is re-anchored on Transaction/detail in the
     * next test, where the same group still moves between regions on a header swap.
     */
    // s221-m01: the off-page slots s216-m05 stopped reporting (374a6eaec5) were the other swaps; one remains on the page.
    expect(swapsTried, 'the loop actually exercised candidate swaps').toBeGreaterThan(0);
    expect(refusedByOrder, 'no candidate is refused by this order since the s204-m02 (c) fix').toEqual([]);
  }, 180_000);

  /**
   * RE-ANCHORED in s205-m01 (#2193, the s204 review's carry). The OODS-V204 arm above stopped reproducing on
   * Subscription/detail's single-region order, so the invariant's refusing half went unexercised. A probe over all
   * 23 objects and four contexts (artifacts/product-reality/sprint-205/m01/v204-probe.json) found it on 34 screens.
   * Transaction/detail is the one taken here because it is the same group moving the other way: the version as
   * composed carries `updated_at` in `detail-body-10`, and swapping the header slot to StatusTimeline pulls the
   * status group — `updated_at` with it — up into the header. So the version's own order names a field that
   * candidate would take out of the region, recording must still succeed, and that candidate must not be offered.
   *
   * RE-ANCHORED again in s221-m02 (#2482 ruling 7). A Details panel of read-only rows is now one list, so `updated_at`
   * no longer rides in the status group's slot container and stays in the body on that swap. The same swap still takes
   * the record's status out of the header, which the header's own order names, so the arm is anchored there: same
   * screen, same candidate (artifacts/product-reality/sprint-221/m02/v204-probe.json).
   */
  it('re-anchored on Transaction/detail: the refused candidate is really refused, and still never offered', async () => {
    const preferences = { fieldOrder: { 'detail-header-1': ['status'] } };
    const composed = await compose({ object: 'Transaction', context: 'detail', preferences });
    expect(composed.status).toBe('ok');
    const record = await readVersion(resolveCompositionsDir(), composed.compositionId!, composed.version!);
    const refusedByOrder: string[] = [];
    for (const selection of composed.selections) {
      const offered = record.slots.find(slot => slot.slotName === selection.slotName)?.candidates ?? [];
      const ranked = [...new Set([...selection.candidates.map(candidate => candidate.name), ...(selection.alternativeCandidates ?? []).map(candidate => candidate.name)])];
      for (const name of ranked) {
        if (name === selection.selectedComponent) continue;
        const outcome = await compose({ object: 'Transaction', context: 'detail', preferences: { ...preferences, componentOverrides: { [selection.slotName]: name } }, options: { transient: true, validate: false } })
          .then(() => 'composed', (error: { opiCode?: string }) => error.opiCode ?? 'error');
        if (outcome === 'OODS-V204') { refusedByOrder.push(`${selection.slotName} → ${name}`); expect(offered, `${selection.slotName} → ${name}`).not.toContain(name); }
        else if (offered.includes(name)) expect(outcome, `${selection.slotName} → ${name}`).toBe('composed');
      }
    }
    expect(refusedByOrder, 'the arm reproduces: the version\'s own order refuses the header swap that moves the status').toContain('header → StatusTimeline');
  }, 180_000);
});
