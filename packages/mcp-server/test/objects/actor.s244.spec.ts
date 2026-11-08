/**
 * s244-m01 (#2829): an agent is an actor, not a user. Actor is the trait User and Agent share: the ability to act. These
 * specs pin why each part matters:
 * - Actor adds no record field, so composing it into User changes nothing a user's records or screens show.
 * - An actor of kind agent is marked "Agent" beside its name, so no one reads an agent's record as a person's; the mark is
 *   the existing Badge, placed by the composer because no view extension can depend on a parameter.
 * - Every place history is printed names who acted, who it acted for and who approved it; an entry that names no one
 *   renders exactly as it did, its "Actor: <id>" line included.
 * - A delegation is a Relationship type, with no new field, so no existing relationship gains an empty row.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearObjectCache, loadObject } from '../../src/objects/object-loader.js';
import { clearTraitCache, listTraits, loadTrait } from '../../src/objects/trait-loader.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { parameterProblems } from '../../src/objects/parameter-validation.js';
import { renderTree } from '../../src/render/tree-renderer.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as validate } from '../../src/tools/object.validate.js';
import { getObjectFilePath } from '../../src/objects/object-loader.js';
import type { ObjectDefinition } from '../../src/objects/types.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const phrase = 'Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi';
const named = {
  title: 'Refunded', from: 'paid', to: 'refunded', at: '2026-11-03T10:00:00Z', reason: 'Duplicate charge',
  actor_id: 'agt_billing', actor_name: 'Billing Agent', actor_kind: 'agent', on_behalf_of_name: 'Tidewater Co-op', approved_by_name: 'Ruth Adeyemi',
};
const unnamed = { title: 'Activated', from: 'draft', to: 'active', at: '2026-10-02T09:00:00Z', reason: 'Approved', actor_id: 'usr_1' };
const audit = (entry: Record<string, unknown>) => ({ ...entry, from_state: entry.from, to_state: entry.to, transitioned_at: entry.at });
const walk = (node: UiElement, visit: (node: UiElement) => void): void => { visit(node); for (const child of node.children ?? []) walk(child, visit); };
const components = (schema: UiSchema) => { const all: UiElement[] = []; for (const screen of schema.screens) walk(screen, node => all.push(node)); return all; };
const html = (children: UiElement[]) => renderTree({ version: '2026.02', screens: [{ id: 'root', component: 'Stack', children }] } as UiSchema);

describe('core/Actor', () => {
  it('is a shipped trait with no record field and a validated kind', () => {
    expect(listTraits()).toContain('Actor');
    const actor = loadTrait('core/Actor');
    expect(actor.schema).toEqual({});
    expect(actor.parameters.map(parameter => [parameter.name, parameter.default])).toEqual([['kind', 'person']]);
    for (const kind of ['person', 'agent', 'system']) expect(parameterProblems('Actor', { kind })).toEqual([]);
    expect(parameterProblems('Actor', { kind: 'robot' })[0]?.message).toMatch(/must be equal to one of the allowed values/);
    expect(parameterProblems('Actor', { kind: 'agent', label: 'Bot' })).not.toEqual([]);
  });

  it("leaves User's composition unchanged apart from the trait's name", () => {
    const user = loadObject('User');
    expect(user.traits?.[0]).toEqual({ name: 'core/Actor', parameters: { kind: 'person' } });
    const withActor = composeObject(user);
    const without = composeObject({ ...user, traits: user.traits!.filter(trait => trait.name !== 'core/Actor') });
    expect(withActor.traits.map(trait => trait.ref.name)).toEqual(['core/Actor', ...without.traits.map(trait => trait.ref.name)]);
    for (const key of ['schema', 'semantics', 'viewExtensions', 'tokens', 'warnings', 'samples'] as const) {
      expect(withActor[key], key).toEqual(without[key]);
    }
  });

  it('marks an agent "Agent" beside its name in list, card and detail, with the existing Badge, and a person or system with nothing', () => {
    const define = (kind?: string): ObjectDefinition => ({
      object: { name: 'Probe', version: '1.0.0' },
      traits: [{ name: 'core/Actor', ...(kind ? { parameters: { kind } } : {}) }],
      schema: { name: { type: 'string', required: true } },
    } as ObjectDefinition);
    const agent = composeObject(define('agent')).viewExtensions;
    for (const context of ['list', 'card', 'detail']) {
      expect(agent[context], context).toEqual([expect.objectContaining({ component: 'Badge', props: { label: 'Agent', tone: 'info' } })]);
    }
    for (const kind of ['person', 'system', undefined]) expect(composeObject(define(kind)).viewExtensions, String(kind)).toEqual({});
  });

  it("places no Agent badge on any of User's screens", async () => {
    for (const context of ['detail', 'list', 'card', 'form', 'timeline', 'inline'] as const) {
      const result = await compose({ object: 'User', context, options: { transient: true } });
      expect(result.status, context).toBe('ok');
      expect(components(result.schema).filter(node => node.component === 'Badge' && node.props?.label === 'Agent'), context).toEqual([]);
    }
  });
});

describe('history names in the HTML renderer', () => {
  it('StatusTimeline and AuditTimeline print the phrase in place of a named actor id, and an unnamed entry as before', () => {
    const page = html([
      { id: 'status', component: 'StatusTimeline', props: { status: 'refunded', history: [unnamed, named] } },
      { id: 'audit', component: 'AuditTimeline', props: { auditLog: [audit(unnamed), audit(named)] } },
    ]);
    expect(page.match(new RegExp(`<p data-timeline-attribution="true">${phrase}</p>`, 'g'))).toHaveLength(2);
    expect(page).not.toContain('Actor: agt_billing');
    expect(page.match(/<p>Actor: usr_1<\/p>/g)).toHaveLength(2);
  });

  it('an entry with no names renders byte for byte as before, and showActorId false hides who acted', () => {
    const before = html([{ id: 'status', component: 'StatusTimeline', props: { status: 'active', history: [unnamed] } }]);
    expect(before).not.toContain('data-timeline-attribution');
    expect(html([{ id: 'status', component: 'StatusTimeline', props: { status: 'active', history: [{ ...unnamed, actor_name: '', actor_kind: 'person' }] } }])).toBe(before);
    const hidden = html([{ id: 'status', component: 'StatusTimeline', props: { status: 'refunded', history: [named, unnamed], showActorId: false } }]);
    expect(hidden).not.toContain(phrase);
    expect(hidden).not.toContain('Actor:');
  });

  it("AuditSummaryCard's last actor and the recipe rows print the phrase", () => {
    const page = html([
      { id: 'summary', component: 'AuditSummaryCard', props: { auditLog: [audit(unnamed), audit(named)] } },
      { id: 'rows', component: 'StateTransitionEvent', props: { history: [unnamed, named] } },
    ]);
    expect(page).toContain(`<dt>Last actor</dt><dd>${phrase}</dd>`);
    expect(page).toContain(`<p>${phrase}</p>`);
    expect(page).toContain('<p>Actor: usr_1</p>');
    expect(page).not.toContain('Actor: agt_billing');
  });
});

describe('history names on the generated timeline rail', () => {
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s244-m01-'));
    fs.mkdirSync(path.join(home, 'objects'));
    // A team's object whose sample history has one entry an agent made for an organization and a person approved.
    fs.writeFileSync(path.join(home, 'objects', 'Refund.object.yaml'), [
      'object: { name: Refund, version: 1.0.0, description: A refund request. }',
      'traits:',
      '  - { name: lifecycle/Stateful, parameters: { states: [requested, paid, refunded], initialState: requested } }',
      'schema:',
      '  refund_id: { type: string, required: true, description: Refund reference. }',
      '  name: { type: string, required: true, description: What is refunded. }',
      'samples:',
      '  - refund_id: rf_1',
      '    name: Duplicate charge',
      '    status: refunded',
      '    state_history:',
      `      - ${JSON.stringify({ ...unnamed, title: 'Requested', from: null, to: 'requested', at: '2026-11-01T09:00:00Z' })}`,
      `      - ${JSON.stringify({ ...named, from: 'requested' })}`,
    ].join('\n'));
    process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
    process.env.MCP_SCHEMA_STORE_ROOT = home;
    clearTraitCache(); clearObjectCache();
  });
  afterEach(() => {
    delete process.env.OODS_OBJECTS_DIR;
    delete process.env.MCP_SCHEMA_STORE_ROOT;
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('prints the phrase under the named event in HTML, and React and Vue emit it for any named event', async () => {
    const rendered = await pipeline({ object: 'Refund', context: 'timeline', framework: 'html', options: { skipValidation: true } });
    const page = String((rendered as { render?: { html?: string } }).render?.html ?? '');
    expect(page).toContain(phrase);
    expect(page.indexOf(phrase)).toBeGreaterThan(page.indexOf('Refunded'));
    expect(page).not.toContain('agt_billing');

    const timeline = await compose({ object: 'Refund', context: 'timeline', options: { transient: true } });
    for (const framework of ['react', 'vue'] as const) {
      const code = await generate({ schema: timeline.schema, framework, options: { typescript: true } });
      const source = JSON.stringify(code);
      expect(source, framework).toContain(framework === 'react'
        ? '{collectionEvent.attribution ? <p>{collectionEvent.attribution}</p> : null}'
        : '<p v-if=\\"collectionEvent.attribution\\">{{ collectionEvent.attribution }}</p>');
    }
  });
});

describe('Relationship gains the delegation type and nothing else', () => {
  const yaml = fs.readFileSync(getObjectFilePath('Relationship')!, 'utf8');
  // The first sample becomes a grant from Tidewater Co-op to an agent, its scope and end in its label and description.
  const delegation = (type: string) => yaml
    .replace('label: Dana Whitfield — Northwind Traders', 'label: Tidewater Co-op — Billing Agent')
    .replace('description: Workspace owner membership', 'description: Acts for Tidewater Co-op on refunds and replies until 31 Dec 2026')
    .replace('relationship_type: membership', `relationship_type: ${type}`);

  it('accepts a delegation with no new field', () => {
    const relationship = composeObject(loadObject('Relationship'));
    expect(relationship.schema.relationship_type.validation?.enum).toEqual(['membership', 'ownership', 'follows', 'depends_on', 'references', 'delegation']);
    expect(Object.keys(relationship.schema).filter(field => /scope|expires|delegat/.test(field))).toEqual([]);
  });

  it('validates a delegation record, and still refuses a type the enum does not allow', async () => {
    const accepted = await validate({ yaml: delegation('delegation') });
    expect(accepted.valid, JSON.stringify(accepted.errors)).toBe(true);
    const refused = await validate({ yaml: delegation('grant') });
    expect(refused.valid).toBe(false);
    expect(JSON.stringify(refused.errors)).toMatch(/grant/);
  });

  it("renders a delegation on Relationship's detail", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s244-m01-rel-'));
    try {
      fs.mkdirSync(path.join(home, 'objects'));
      // Only the delegation sample, so every record the preview seeds is the grant.
      const text = delegation('delegation').replace('  name: Relationship', '  name: DelegationProbe');
      const second = text.indexOf('\n  - label:', text.indexOf('\nsamples:\n  - label:') + 10);
      fs.writeFileSync(path.join(home, 'objects', 'DelegationProbe.object.yaml'), text.slice(0, second) + '\n');
      process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
      clearTraitCache(); clearObjectCache();
      const rendered = await pipeline({ object: 'DelegationProbe', context: 'detail', framework: 'html', options: { skipValidation: true } });
      const page = String((rendered as { render?: { html?: string } }).render?.html ?? '');
      expect(page).toContain('Tidewater Co-op — Billing Agent');
      expect(page).toContain('Acts for Tidewater Co-op on refunds and replies until 31 Dec 2026');
      expect(page).toMatch(/>Delegation</);
    } finally {
      delete process.env.OODS_OBJECTS_DIR;
      clearTraitCache(); clearObjectCache();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
