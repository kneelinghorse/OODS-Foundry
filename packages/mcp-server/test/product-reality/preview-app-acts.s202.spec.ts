import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Frame } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReferenceHost, type RenderedApp } from '../../../../scripts/product-reality/s202-reference-host.js';

/**
 * Acting from the conversation (s202-m04). In the reference host (Chromium, the double iframe, the spec's default CSP, the
 * SDK's app-bridge, the real adapter over stdio) the preview app decides a design through the host: each of the four edits
 * records a new version with its parent and operation and opens it in place; side by side mounts both running apps and
 * lists exactly the what-changed the preview host computes for the pair, with both measurement panels, in fullscreen;
 * accept writes accepted.json with the version's measurements, shows it on the app and the browser page and puts the
 * accepted summary into the model's context, and a second accept supersedes the first with lineage; a change request
 * reaches the host as ui/message naming the composition and the version. No console error, no CSP violation.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
type Json = Record<string, unknown>;
type Act = { act: string; ok: boolean; detail: Json };
type Side = { compositionId: string; version: number; components: number };
type AppState = {
  mounts: number; pending: string | null; errors: string[]; view: string; compares: number; displayMode: string;
  current: { compositionId: string; version: number; parentVersion: number | null; operation: string } | null;
  lineage: Array<[number, number | null, string]>;
  toolCalls: Array<{ arguments: Json; ok: boolean; code?: string }>; acts: Act[];
  compare: { left: Side; right: Side; identical: boolean; differenceCount: number; summary: Record<string, number>; renderedChanges: number } | null;
  messages: string[]; modelContext: Array<{ text: string; structuredContent: Json }>;
};
type Live = { __oodsPreviewApp: { errors: string[]; mounts: number; pending: string | null; compares: number; displayMode: string; acts: Act[]; messages: string[] } };

/** The app's state with the mounted version's lineage read from its record and the versions list. */
const appState = (frame: Frame): Promise<AppState> => frame.evaluate(() => {
  const { record, versions, ...rest } = (window as unknown as { __oodsPreviewApp: Record<string, unknown> & { record?: { compositionId: string; version: number; parentVersion: number | null; operation: string }; versions?: Array<{ version: number; parentVersion: number | null; operation: string }> } }).__oodsPreviewApp;
  return { ...rest, current: record ? { compositionId: record.compositionId, version: record.version, parentVersion: record.parentVersion, operation: record.operation } : null, lineage: (versions ?? []).map(entry => [entry.version, entry.parentVersion, entry.operation]) };
}) as unknown as Promise<AppState>;
/** Until the app mounted again with nothing pending, or an act was refused, or the view reported an error. */
async function mountedAfter(frame: Frame, previous: { mounts: number; acts: number }): Promise<AppState> {
  await frame.waitForFunction(([mounts, acts]) => {
    const state = (window as unknown as Live).__oodsPreviewApp;
    return state.errors.length > 0 || state.acts.slice(acts).some(act => !act.ok) || (state.mounts > mounts && state.pending === null);
  }, [previous.mounts, previous.acts] as const, { timeout: 240_000 });
  const state = await appState(frame);
  expect(state.errors, state.errors.join(' | ')).toEqual([]);
  const refused = state.acts.slice(previous.acts).filter(act => !act.ok);
  expect(refused, JSON.stringify(refused)).toEqual([]);
  return state;
}
const since = (state: AppState) => ({ mounts: state.mounts, acts: state.acts.length });
const hostUrlOf = (rendered: RenderedApp) => new URL((rendered.result as { structuredContent: { previewUrl: string } }).structuredContent.previewUrl).origin;
function clean(host: ReferenceHost): void {
  expect(host.cspViolations).toEqual([]);
  expect(host.consoleErrors).toEqual([]);
  expect(host.pageErrors).toEqual([]);
}

describe('acting from the conversation (s202-m04)', () => {
  let host: ReferenceHost;
  let rendered: RenderedApp;
  beforeAll(async () => {
    expect(fs.existsSync(path.join(root, 'packages/mcp-bridge/dist/preview-app/app.html')), 'the preview app must be built').toBe(true);
    host = await ReferenceHost.open({ negotiate: true, hostContext: { theme: 'light', containerDimensions: { width: 900, maxHeight: 700 } } });
    rendered = await host.render('design_preview', { object: 'Subscription', context: 'detail', framework: 'react' }, { width: 900, height: 700 });
  }, 300_000);
  afterAll(async () => { await host?.close(); });

  it('each of the four edits from the app records a new version with its parent and operation, and the app opens it in place', async () => {
    const frame = rendered.appFrame;
    let state = await mountedAfter(frame, { mounts: 0, acts: 0 });
    expect(state.current).toMatchObject({ version: 1, parentVersion: null, operation: 'compose' });
    const edits: Array<{ operation: string; act: () => Promise<void> }> = [
      { operation: 'reorder-region', act: () => frame.click('[data-oods-edit] button.move[data-kind="region"][data-index="0"][data-delta="1"]') },
      {
        operation: 'swap-slot',
        act: async () => {
          await frame.evaluate(() => {
            const form = Array.from(document.querySelectorAll<HTMLFormElement>('form[data-edit="swap-slot"]')).find(candidate => Array.from(candidate.querySelector('select')!.options).some(option => option.value !== candidate.dataset.current))!;
            form.dataset.oodsSpecTarget = 'true';
            const select = form.querySelector('select')!;
            select.value = Array.from(select.options).find(option => option.value !== form.dataset.current)!.value;
          });
          await frame.click('form[data-oods-spec-target="true"] button[type="submit"]');
        },
      },
      { operation: 'reorder-fields', act: () => frame.click('[data-oods-edit] button.move[data-kind="field"][data-index="0"][data-delta="1"]') },
      { operation: 'seed', act: async () => { await frame.fill('form[data-edit="seed"] input[name="seed"]', 's202-m04-acts'); await frame.click('form[data-edit="seed"] button[type="submit"]'); } },
    ];
    for (const [index, entry] of edits.entries()) {
      const before = since(state);
      await entry.act();
      state = await mountedAfter(frame, before);
      expect(state.current).toMatchObject({ version: index + 2, parentVersion: index + 1, operation: entry.operation });
      // The panel shows the new version with its lineage, in the same document.
      expect(await frame.evaluate(() => document.querySelector('[data-oods-versions] li[aria-current="true"]')!.textContent)).toBe(`v${index + 2} · ${entry.operation} ← v${index + 1}`);
    }
    expect(state.lineage).toEqual([[1, null, 'compose'], [2, 1, 'reorder-region'], [3, 2, 'swap-slot'], [4, 3, 'reorder-fields'], [5, 4, 'seed']]);
    expect(state.toolCalls.filter(call => call.ok && call.arguments.action === 'edit').map(call => [call.arguments.version, (call.arguments.edit as Json).operation])).toEqual([[1, 'reorder-region'], [2, 'swap-slot'], [3, 'reorder-fields'], [4, 'seed']]);
    clean(host);
  }, 600_000);

  it('compares two versions side by side: both running apps, the what-changed list exactly as the preview host computes it for the pair, both measurement panels, in fullscreen', async () => {
    const frame = rendered.appFrame;
    const before = await appState(frame);
    const compositionId = before.current!.compositionId;
    await frame.selectOption('form[data-act="compare"] select', '1');
    await frame.click('form[data-act="compare"] button[type="submit"]');
    await frame.waitForFunction(([compares, acts]) => {
      const state = (window as unknown as Live).__oodsPreviewApp;
      return state.errors.length > 0 || state.acts.slice(acts).some(act => !act.ok) || (state.compares > compares && state.pending === null);
    }, [before.compares, before.acts.length] as const, { timeout: 240_000 });
    const state = await appState(frame);
    expect(state.errors).toEqual([]);
    expect(state.view).toBe('compare');
    expect(state.compare).toMatchObject({ left: { compositionId, version: 5 }, right: { compositionId, version: 1 } });
    expect(state.compare!.left.components).toBeGreaterThan(5);
    expect(state.compare!.right.components).toBeGreaterThan(5);
    // The oracle is the preview host's own diff for the pair (the one the browser compare page shows), fetched outside the app.
    const diff = await (await fetch(`${hostUrlOf(rendered)}/compare/${compositionId}@5/${compositionId}@1/diff.json`)).json() as { identical: boolean; differenceCount: number; summary: Record<string, number>; differences: unknown[] };
    expect(diff.differenceCount).toBeGreaterThan(0);
    expect(state.compare).toMatchObject({ identical: diff.identical, differenceCount: diff.differenceCount, summary: diff.summary, renderedChanges: diff.differences.length });
    const view = await frame.evaluate(() => ({
      lists: Object.fromEntries(Array.from(document.querySelectorAll('[data-oods-what-changed] [data-oods-diff]')).map(list => [list.getAttribute('data-oods-diff'), list.querySelectorAll('li').length])),
      panels: Array.from(document.querySelectorAll('[data-oods-compare-panels] [data-oods-measurements]')).map(node => node.getAttribute('data-oods-measurements')),
      sides: [document.querySelectorAll('[data-oods-side-frame="left"] [data-oods-component]').length, document.querySelectorAll('[data-oods-side-frame="right"] [data-oods-component]').length],
      singleHidden: document.querySelector<HTMLElement>('[data-oods-app-frame]')!.hidden,
    }));
    expect(view.lists).toEqual(Object.fromEntries(Object.entries(diff.summary).filter(([, count]) => count > 0)));
    expect(view.panels).toEqual([`${compositionId}@5`, `${compositionId}@1`]);
    expect(view.sides).toEqual([state.compare!.left.components, state.compare!.right.components]);
    expect(view.singleHidden).toBe(true);
    await frame.waitForFunction(() => (window as unknown as Live).__oodsPreviewApp.displayMode === 'fullscreen', undefined, { timeout: 30_000 });
    expect(host.events.filter(event => event.kind === 'ui/request-display-mode').map(event => (event.params as { mode: string }).mode)).toContain('fullscreen');
    // Closing returns to the single view of the same version, inline again.
    await frame.click('button[data-act="close-compare"]');
    const back = await mountedAfter(frame, since(state));
    expect(back).toMatchObject({ view: 'single', compare: null });
    expect(back.current).toMatchObject({ version: 5 });
    await frame.waitForFunction(() => (window as unknown as Live).__oodsPreviewApp.displayMode === 'inline', undefined, { timeout: 30_000 });
    clean(host);
  }, 600_000);

  it('accepts from the app: accepted.json with the measurements snapshot, shown on the app and the browser page, the summary in the model context; a second accept supersedes with lineage; request changes reaches the host as ui/message', async () => {
    const frame = rendered.appFrame;
    let state = await appState(frame);
    const compositionId = state.current!.compositionId;
    const store = path.join(host.storeRoot!, 'compositions', compositionId);
    await frame.click('button[data-act="accept"]');
    await frame.waitForFunction(acts => { const live = (window as unknown as Live).__oodsPreviewApp; return live.errors.length > 0 || live.acts.slice(acts).some(act => act.act === 'accept'); }, state.acts.length, { timeout: 240_000 });
    state = await appState(frame);
    expect(state.acts.filter(act => act.act === 'accept')).toEqual([expect.objectContaining({ ok: true })]);
    const first = JSON.parse(fs.readFileSync(path.join(store, 'accepted.json'), 'utf8')) as { acceptances: Array<Json & { version: number; supersedes: { version: number } | null; measurements: Json }> };
    expect(first.acceptances).toHaveLength(1);
    expect(first.acceptances[0]).toMatchObject({ version: 5, supersedes: null });
    expect(first.acceptances[0]!.measurements).toEqual(JSON.parse(fs.readFileSync(path.join(store, 'versions', '5.json'), 'utf8')).measurements);
    const context = host.events.filter(event => event.kind === 'ui/update-model-context');
    expect(context).toHaveLength(1);
    const contextParams = context[0]!.params as { content: Array<{ type: string; text: string }>; structuredContent: Json };
    expect(contextParams.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining(`Accepted design: Subscription detail, composition ${compositionId} version 5 (seed from v4)`) });
    expect(contextParams.structuredContent).toMatchObject({ compositionId, version: 5, parentVersion: 4, operation: 'seed', acceptances: 1, supersedes: null });
    expect(await frame.evaluate(() => [
      document.querySelector('[data-oods-lineage] [data-oods-accepted="this"]') !== null,
      document.querySelector('[data-oods-versions] [data-oods-accepted="true"]')?.closest('li')?.textContent ?? '',
      document.querySelector<HTMLButtonElement>('button[data-act="accept"]')!.disabled,
    ])).toEqual([true, 'v5 · seed ← v4 · accepted', true]);
    expect(await (await fetch(`${hostUrlOf(rendered)}/preview/${compositionId}/5`)).text()).toContain('data-oods-accepted="this"');

    // Accepting version 4 supersedes version 5; the first acceptance stays as it was written.
    await frame.click('[data-oods-versions] button[data-open-version="4"]');
    state = await mountedAfter(frame, since(state));
    expect(state.current).toMatchObject({ version: 4 });
    await frame.click('button[data-act="accept"]');
    await frame.waitForFunction(acts => { const live = (window as unknown as Live).__oodsPreviewApp; return live.errors.length > 0 || live.acts.slice(acts).some(act => act.act === 'accept'); }, state.acts.length, { timeout: 240_000 });
    const second = JSON.parse(fs.readFileSync(path.join(store, 'accepted.json'), 'utf8')) as typeof first;
    expect(second.acceptances.map(entry => [entry.version, entry.supersedes?.version ?? null])).toEqual([[5, null], [4, 5]]);
    expect(second.acceptances[0]).toEqual(first.acceptances[0]);
    expect(host.events.filter(event => event.kind === 'ui/update-model-context')).toHaveLength(2);

    await frame.fill('form[data-act="request-changes"] textarea', 'Put the billing cycle card first.');
    await frame.click('form[data-act="request-changes"] button[type="submit"]');
    await frame.waitForFunction(() => { const live = (window as unknown as Live).__oodsPreviewApp; return live.messages.length > 0 || live.acts.some(act => act.act === 'request-changes' && !act.ok); }, undefined, { timeout: 60_000 });
    const messages = host.events.filter(event => event.kind === 'ui/message');
    expect(messages).toHaveLength(1);
    expect(messages[0]!.params).toEqual({ role: 'user', content: [{ type: 'text', text: `Request changes to Subscription detail, composition ${compositionId} version 4: Put the billing cycle card first.` }] });
    clean(host);
  }, 600_000);
});
