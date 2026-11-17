/**
 * s250-m01: the states a closure rests in, in the shared tone table (Interface 5). A closure is opened when a given grant
 * ends, and only a report moves it, so its badge must carry the claim: a badge prints its state's own name, and the
 * table's words are only its hover title. These specs pin why each entry is as it is:
 * - four new states, under names nothing else uses (closing, reported_closed, still_running, not_known), so no badge on a
 *   record that is not a closure changes; the shared table keeps the declared order working, which a table of Closure's
 *   own would switch off;
 * - none is drawn as a success: reported closed is what a report says, never a confirmation that everything stopped;
 * - the words read true on a team's own state of the same name, since the table is shared;
 * - `closed` and `unknown` gain no entry: `unknown` is what every badge with no status reads, and `closed` is a state of
 *   the quickstart's Warehouse, so words for either would land on records that are not closures;
 * - failed keeps the shared «Failed.», critical.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { getStatusPresentation } from '@oods/component-contracts';
import { renderTree } from '../../src/render/tree-renderer.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { renderGenerated } from '../product-reality/render-generated.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: { fragment(html: string): DocumentFragment } };
const root = path.resolve(import.meta.dirname, '../../../..');
const table = JSON.parse(fs.readFileSync(path.join(root, 'packages/component-contracts/registry/lifecycle-status-tones.json'), 'utf8')) as { states: Record<string, { tone: string; icon: string; description: string }> };
const FALLBACK = 'Status not found in registry; falling back to the requested token set.';
const STATES = ['closing', 'reported_closed', 'still_running', 'not_known', 'failed'];

describe('the four states of a closure join the shared table, and none reads as a success', () => {
  it('says each in words that read for any record in that state', () => {
    expect(Object.fromEntries(STATES.map(state => [state, table.states[state]]))).toEqual({
      closing: { tone: 'info', icon: 'icon.status.pending', description: 'Closing: an end was asked for, and no report yet says what became of it.' },
      reported_closed: { tone: 'neutral', icon: 'icon.status.default', description: 'Reported closed: a report says nothing more can start under it, for the scope it states.' },
      still_running: { tone: 'warning', icon: 'icon.status.processing', description: 'Still running: it, or some of the work it covers, is still going.' },
      not_known: { tone: 'warning', icon: 'icon.status.warning', description: 'Not known: no report says.' },
      failed: { tone: 'critical', icon: 'icon.status.critical', description: 'Failed.' },
    });
    for (const state of STATES) {
      const shown = getStatusPresentation('lifecycle', state);
      expect(shown.tone, state).not.toBe('success');
      expect(shown.iconName, state).not.toMatch(/success|paid/);
      // The words never name a grant, a closure or OODS Foundry: the table is shared by every record in that state.
      expect(shown.description, state).not.toMatch(/grant|closure|foundry|oods/i);
    }
    // A closure's state is never called closed without "reported".
    expect(getStatusPresentation('lifecycle', 'reported_closed').label).toBe('Reported Closed');
  });

  it('gives closed and unknown no entry, so a status-less badge and the quickstart\'s Warehouse read as before', () => {
    for (const state of ['closed', 'unknown']) {
      expect(Object.hasOwn(table.states, state), state).toBe(false);
      expect(getStatusPresentation('lifecycle', state).description, state).toBe(FALLBACK);
    }
    const warehouse = load(fs.readFileSync(path.join(root, 'packages/foundry/quickstart/Warehouse.object.yaml'), 'utf8')) as { traits: Array<{ name: string; parameters?: { states?: string[] } }> };
    expect(warehouse.traits.find(trait => trait.name.endsWith('Stateful'))!.parameters!.states).toContain('closed');
  });

  it('draws no badge of a closure\'s five states with the fallback, in HTML, React or Vue, each with its words as its title', async () => {
    const schema = { version: '2026.02', screens: [{ id: 'root', component: 'Stack', children: STATES.map((status, index) => ({ id: `badge-${index}`, component: 'StatusBadge', props: { status, tone: 'lifecycle' } })) }] } as UiSchema;
    const pages = [renderTree(schema)];
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true } } as never) as { status: string; code: string; errors?: unknown };
      expect(result.status, `${framework}: ${JSON.stringify(result.errors)}`).toBe('ok');
      pages.push(renderGenerated(framework, result.code, {}, []));
    }
    for (const [index, page] of pages.entries()) {
      const where = ['html', 'react', 'vue'][index]!;
      expect(page, where).not.toContain('not found in registry');
      const badges = [...JSDOM.fragment(page).querySelectorAll('.oods-status-badge')];
      expect(badges.map(badge => badge.getAttribute('title')), where).toEqual(STATES.map(state => table.states[state]!.description));
      expect(badges.map(badge => badge.getAttribute('data-tone')), where).toEqual(['info', 'neutral', 'warning', 'warning', 'critical']);
    }
  });
});
