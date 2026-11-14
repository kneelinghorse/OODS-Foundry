/**
 * s248-m03: the importer recognises another system's record of a grant where the schema says so.
 * - A state enum holding a value in force beside a value that says it was revoked or ended, a date-time named for an end,
 *   and a single reference to an agent's or an app's own record (not named for who asked) propose Mandate at medium. Any
 *   one or two of them propose nothing new.
 * - It binds the holder and the end, and where the source has them the other seats by their references and when it was
 *   last used; a same-named field of another type stays unbound and the proposal valid. The references it binds are not
 *   guessed again as an owner or as the record acting for someone; an owner reference is still an owner.
 * - The record's lifecycle is the grant's state. Where all three facts hold, the grant wins over an answer enum's reading
 *   as an approval; without them the approval reading stands.
 * - Two general fixes: among several string enums the one named for the record's status or state is its lifecycle where no
 *   record rule chose one (FDX's status, not durationType), and a date-time named for an end is never created_at.
 * - Where none of this applies, every proposal is the one the 0.14.0 importer drafted (the fixture's "before", by id).
 * - The run-as evidence sentence points at Grant. Accepting the proposal with fields unbound never rolls back, and the
 *   accepted record's screens compose.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import type { Proposal } from '../../src/importer/draft.js';
import { grantValues, namedForEnd, namedForState } from '../../src/importer/proposals.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';

type Source = { format: 'openapi' | 'json-schema' | 'sql' | 'prisma'; name: string; content: string };
type Before = { id: string; trait: string; grade: string; valid: boolean; evidence: string[] };
const FIXTURES = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/importer/grant-records.s248.json'), 'utf8')) as { sources: Record<string, Source>; before: Record<string, Record<string, Before[]>> };
type Result = ReturnType<typeof draftSource>;
const drafted = new Map<string, Result>();
const draft = (key: string) => { if (!drafted.has(key)) drafted.set(key, draftSource(FIXTURES.sources[key])); return drafted.get(key)!; };
const draftOf = (key: string, name: string) => draft(key).drafts.find(item => item.name === name)!;
const proposal = (key: string, object: string, trait: string): Proposal | undefined => draftOf(key, object).proposals.find(item => item.trait.name === trait);
const bound = (item: Proposal | undefined) => Object.fromEntries(Object.entries(item?.trait.fieldBindings ?? {}).filter(([, target]) => target));
const before = (key: string, object: string) => FIXTURES.before[key][object];
const beforeOf = (key: string, object: string, trait: string) => before(key, object).find(item => item.trait === trait);
/** The grant records in the fixtures, and nothing else, get Mandate. */
const FIRES: Array<[string, string]> = [['sql-grant', 'AgentGrants'], ['prisma-grant', 'AgentGrant'], ['openapi-grant', 'Grant'], ['openapi-consent', 'ConsentWithEnd']];
/** What each change moves where the rule does not fire: the lifecycle named for the state, and an end that is not created_at. */
const MOVED: Array<[string, string, string]> = [
  ['fdx-mini', 'ConsentGrant', 'Stateful'], ['stripe-mini', 'SharedPaymentIssuedToken', 'Stateful'],
  ['openapi-end-first', 'Invite', 'Timestampable'], ['openapi-end-first', 'Link', 'Timestampable'], ['sql-end-alone', 'Invites', 'Timestampable'], ['aa-mini', 'SignedConsentDetail', 'Timestampable'],
];
const moved = (key: string, object: string, trait: string) => MOVED.some(([k, o, t]) => k === key && o === object && t === trait);

describe('the states and the names of a grant', () => {
  it('reads a value in force beside one revoked or ended, in the spellings grant and consent schemas write', () => {
    expect(grantValues(['ACTIVE', 'EXPIRED', 'REVOKED'])).toEqual({ inForce: 'ACTIVE', ended: 'EXPIRED' }); // FDX 6.6
    expect(grantValues(['ACTIVE', 'PAUSED', 'REVOKED', 'EXPIRED'])).toEqual({ inForce: 'ACTIVE', ended: 'REVOKED' }); // ReBIT AA's artefact
    expect(grantValues(['AwaitingAuthorisation', 'Authorised', 'Rejected', 'Consumed', 'Revoked'])).toEqual({ inForce: 'Authorised', ended: 'Revoked' }); // UK Open Banking
    expect(grantValues(['received', 'rejected', 'partiallyAuthorised', 'valid', 'revokedByPsu', 'expired', 'terminatedByTpp'])).toEqual({ inForce: 'valid', ended: 'expired' }); // Berlin Group
    expect(grantValues(['active', 'deactivated', 'requires_action'])).toEqual({ inForce: 'active', ended: 'deactivated' }); // Stripe's issued token
    expect(grantValues(['GRANT_STATE_ACTIVE', 'GRANT_STATE_WITHDRAWN'])).toEqual({ inForce: 'GRANT_STATE_ACTIVE', ended: 'GRANT_STATE_WITHDRAWN' });
  });

  it('reads no grant where nothing is in force, nothing ends, or the values are an account\'s, an answer\'s, a work\'s or a subscription\'s', () => {
    for (const values of [
      ['active', 'inactive'], ['enabled', 'disabled'], ['active', 'suspended'], // an account's
      ['pending', 'approved', 'rejected', 'expired'], // an answer's: approved is a yes, not a state in force
      ['queued', 'in_progress', 'needs_input', 'completed'], // a work's
      ['active', 'canceled', 'past_due', 'trialing'], // a subscription's
      ['revoked', 'expired'], ['active'], ['active', 'revoked', 3],
    ]) expect(grantValues(values), JSON.stringify(values)).toBeUndefined();
  });

  it('names an end and a state in any spelling, and nothing that only contains the words', () => {
    for (const name of ['expirationTime', 'consentExpiry', 'token_expires_at', 'expires_at', 'expired_at', 'valid_until', 'validTo', 'ends_at', 'endTime', 'end_date']) expect(namedForEnd(name), name).toBe(true);
    for (const name of ['endpoint', 'weekend_at', 'appended_at', 'spend_at', 'created_at', 'backend_updated_at', 'sent_at', 'due_at']) expect(namedForEnd(name), name).toBe(false);
    for (const name of ['status', 'state', 'consentStatus', 'grant_state', 'STATUS']) expect(namedForState(name), name).toBe(true);
    for (const name of ['estate', 'realEstate', 'statement', 'status_reason', 'stateless']) expect(namedForState(name), name).toBe(false);
  });
});

describe('a grant record proposes Mandate on structure', () => {
  it('proposes Mandate at medium, valid, for the four grant records and nothing else', () => {
    for (const key of Object.keys(FIXTURES.sources)) for (const item of draft(key).drafts) {
      const mandate = item.proposals.find(p => p.trait.name === 'Mandate');
      if (FIRES.some(([k, object]) => k === key && object === item.name)) expect(mandate, `${key}/${item.name}`).toMatchObject({ grade: 'medium', valid: true });
      else expect(mandate, `${key}/${item.name}`).toBeUndefined();
    }
  });

  it('binds the seats by their references, the end and the last use, and fields of the same name and type, on a team\'s flat table', () => {
    const mandate = proposal('sql-grant', 'AgentGrants', 'Mandate')!;
    expect(bound(mandate)).toEqual({
      granted_to_id: 'agent_id', ends_at: 'expires_at', granted_by_id: 'granted_by', requested_by_id: 'requested_by', ended_by_id: 'revoked_by',
      granted_for_id: 'organization_id', last_used_at: 'last_used_at', scope: 'scope', timezone: 'timezone', uses: 'uses',
    });
    const reasons = mandate.evidence.map(item => item.reason);
    expect(reasons[0]).toBe('agent_id references Agents, an agent\'s or an app\'s own record: the one that holds the grant (granted_to_id).');
    expect(reasons[1]).toBe('status holds a value in force (active) beside a value that says it was revoked or ended (revoked): the states of a grant, proposed as its lifecycle (Stateful) unless the source declares another.');
    expect(reasons[2]).toMatch(/^expires_at is a date-time named for an end: when the grant ends \(ends_at\)\./);
    expect(reasons).toContain('organization_id references Organizations, the one person or organization left that the record points at: who the grant is for (granted_for_id); confirm before accepting.');
    // The lifecycle is the grant's eight states, starting requested.
    expect(proposal('sql-grant', 'AgentGrants', 'Stateful')!.trait).toMatchObject({ fieldBindings: { status: 'status' }, parameters: { initialState: 'requested' } });
    expect(proposal('prisma-grant', 'AgentGrant', 'Mandate')!.trait.fieldBindings).toMatchObject({ granted_to_id: 'agentId', ends_at: 'expiresAt', granted_by_id: 'grantedById', granted_for_id: 'userId' });
  });

  it('leaves a same-named field of another type unbound, keeps the proposal valid, and takes the grant\'s state over an enum that sorts first', () => {
    const mandate = proposal('openapi-grant', 'Grant', 'Mandate')!;
    expect(mandate.valid).toBe(true);
    expect(mandate.trait.fieldBindings).toMatchObject({ granted_to_id: 'client', granted_for_id: 'user', ends_at: 'valid_until', last_used_at: 'last_used', scope: null, uses: null });
    expect(proposal('openapi-grant', 'Grant', 'Stateful')!.trait.fieldBindings?.status).toBe('state');
    expect(beforeOf('openapi-grant', 'Grant', 'Stateful')!.id).not.toBe(proposal('openapi-grant', 'Grant', 'Stateful')!.id);
  });

  it('proposes nothing new from one or two of the three facts', () => {
    // State and holder without an end; state and end held by a person; each fact alone.
    for (const [key, object] of [['sql-no-end', 'AgentGrants'], ['sql-person-holder', 'AgentGrants'], ['sql-state-alone', 'Memberships'], ['sql-end-alone', 'Invites'], ['sql-holder-alone', 'AgentRuns']]) {
      const item = draftOf(key, object);
      expect(item.proposals.map(p => p.trait.name), `${key}/${object}`).not.toContain('Mandate');
      const kept = item.proposals.filter(p => !moved(key, object, p.trait.name)).map(p => p.id).sort();
      expect(kept, `${key}/${object}`).toEqual(before(key, object).filter(p => !moved(key, object, p.trait)).map(p => p.id).sort());
    }
  });

  it('does not guess the references it binds again as owners, and an owner reference is still the owner', () => {
    const owner = proposal('sql-grant', 'AgentGrants', 'Ownerable')!;
    expect(owner).toMatchObject({ grade: 'medium', valid: true });
    expect(bound(owner)).toEqual({ owner_id: 'owner_id' });
    expect(owner.evidence.map(item => item.pointer)).toEqual(['/statements/3/columns/7']);
    // Before, every reference to a user was owner evidence.
    expect(beforeOf('sql-grant', 'AgentGrants', 'Ownerable')!.evidence.length).toBeGreaterThan(1);
    // Prisma's grant names no owner: its user and its giver are seats, so no owner is guessed.
    expect(proposal('prisma-grant', 'AgentGrant', 'Ownerable')).toBeUndefined();
    expect(beforeOf('prisma-grant', 'AgentGrant', 'Ownerable')).toBeDefined();
  });

  it('wins over an answer enum\'s approval reading only with all three facts', () => {
    expect(proposal('openapi-consent', 'ConsentWithEnd', 'Decision')).toBeUndefined();
    expect(beforeOf('openapi-consent', 'ConsentWithEnd', 'Decision')).toBeDefined();
    expect(proposal('openapi-consent', 'ConsentWithEnd', 'Stateful')!.trait.fieldBindings?.status).toBe('status');
    // Without an end the record is read as before: an answer, kept as a Decision, its lifecycle the answer.
    expect(proposal('openapi-consent', 'ConsentNoEnd', 'Mandate')).toBeUndefined();
    expect(draftOf('openapi-consent', 'ConsentNoEnd').proposals.map(p => p.id).sort()).toEqual(before('openapi-consent', 'ConsentNoEnd').map(p => p.id).sort());
  });
});

describe('the measured grant schemas, in miniature, and the two general fixes', () => {
  it('gives FDX\'s Consent Grant, Stripe\'s issued token, ReBIT\'s consent and GitHub\'s programmatic access grant no Mandate, and says why in their shape', () => {
    // FDX: its parties are an array of inline objects, not a reference to the app's record.
    expect(draftOf('fdx-mini', 'ConsentGrant').definition.relationships ?? []).toEqual([]);
    // Stripe: its end sits inside usage_limits and its times are Unix seconds, not date-times.
    expect(proposal('stripe-mini', 'SharedPaymentIssuedToken', 'Timestampable')).toBeUndefined();
    // ReBIT: the artefact has the state and no end, the signed detail the end and no state.
    expect(proposal('aa-mini', 'ConsentArtefact', 'Stateful')).toBeDefined();
    expect(proposal('aa-mini', 'SignedConsentDetail', 'Timestampable')!.trait.fieldBindings?.created_at).toBe('consentStart');
    // GitHub: no state enum, an end with no date-time format, and its one reference is the token's user. With no enum named
    // for a state, its lifecycle guess is still its only enum (found, not changed: a person rejects it on review).
    expect(proposal('github-pat-mini', 'OrganizationProgrammaticAccessGrant', 'Stateful')!.trait.fieldBindings?.status).toBe('repository_selection');
    expect(proposal('github-pat-mini', 'OrganizationProgrammaticAccessGrant', 'Timestampable')).toBeUndefined();
    for (const [key, object] of [['fdx-mini', 'ConsentGrant'], ['stripe-mini', 'SharedPaymentIssuedToken'], ['aa-mini', 'ConsentArtefact'], ['aa-mini', 'SignedConsentDetail'], ['github-pat-mini', 'OrganizationProgrammaticAccessGrant']]) {
      expect(draftOf(key, object).proposals.map(p => p.trait.name), `${key}/${object}`).not.toContain('Mandate');
    }
  });

  it('takes the lifecycle from the enum named for the state where no record rule chose one (closes 1868)', () => {
    for (const [key, object, was] of [['fdx-mini', 'ConsentGrant', 'durationType'], ['stripe-mini', 'SharedPaymentIssuedToken', 'deactivated_reason']]) {
      expect(proposal(key, object, 'Stateful')!.trait.fieldBindings?.status, object).toBe('status');
      expect(draft(key).report.some(entry => entry.reason === `Alternative Stateful configuration (${was}) retained as evidence; status is named for the record's state, so its lifecycle is status.`), object).toBe(true);
    }
  });

  it('takes a record\'s own status over a prefixed one, and a prefixed one only where there is no status or state', () => {
    // s248-m04 (the fresh read): Stripe's Checkout Session keeps billing_address_collection, payment_status and status.
    const result = draftSource({ format: 'openapi', name: 'checkout.json', content: JSON.stringify({ openapi: '3.0.1', info: { title: 'Checkout', version: '1' }, paths: {}, components: { schemas: {
      CheckoutSession: { type: 'object', properties: { id: { type: 'string' }, billing_address_collection: { type: 'string', enum: ['auto', 'required'] }, payment_status: { type: 'string', enum: ['no_payment_required', 'paid', 'unpaid'] }, status: { type: 'string', enum: ['complete', 'expired', 'open'] } } },
      Lock: { type: 'object', properties: { id: { type: 'string' }, lock_duration: { type: 'string', enum: ['day', 'week'] }, lock_status: { type: 'string', enum: ['active', 'expired', 'none'] } } },
    } } }) });
    const lifecycle = (object: string) => result.drafts.find(item => item.name === object)!.proposals.find(p => p.trait.name === 'Stateful')!.trait.fieldBindings?.status;
    expect(lifecycle('CheckoutSession')).toBe('status');
    expect(lifecycle('Lock')).toBe('lock_status');
  });

  it('never takes a date-time named for an end as created_at', () => {
    expect(proposal('openapi-end-first', 'Invite', 'Timestampable')!.trait.fieldBindings?.created_at).toBe('sent_at');
    expect(proposal('openapi-end-first', 'Link', 'Timestampable')!.trait.fieldBindings?.created_at).toBeNull();
    expect(proposal('sql-end-alone', 'Invites', 'Timestampable')!.trait.fieldBindings?.created_at).toBeNull();
    expect(proposal('fdx-mini', 'ConsentGrant', 'Timestampable')!.trait.fieldBindings?.created_at).toBe('createdTime');
  });

  it('keeps every other proposal as 0.14.0 drafted it, by id', () => {
    for (const key of Object.keys(FIXTURES.sources)) for (const item of draft(key).drafts) {
      if (FIRES.some(([k, object]) => k === key && object === item.name)) continue;
      const kept = item.proposals.filter(p => !moved(key, item.name, p.trait.name)).map(p => p.id).sort();
      expect(kept, `${key}/${item.name}`).toEqual(before(key, item.name).filter(p => !moved(key, item.name, p.trait)).map(p => p.id).sort());
    }
  });
});

describe('the run-as evidence', () => {
  const defs = (schemas: Record<string, unknown>) => draftSource({ content: JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: schemas }), name: 'source.json', format: 'json-schema' });

  it('names the grant as a Grant record, and a name alone still grades weak', () => {
    const result = defs({
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
      Agent: { type: 'object', properties: { id: { type: 'string' }, run_as: { $ref: '#/$defs/User' } } },
      Bot: { type: 'object', properties: { id: { type: 'string' }, acting_for: { type: 'string' } } },
    });
    const actor = result.drafts.find(item => item.name === 'Agent')!.proposals.find(p => p.trait.name === 'Actor')!;
    expect(actor.grade).toBe('medium');
    expect(actor.evidence[0].reason).toBe('This record acts as or for a User record: an agent acting under a grant. Keep the grant as a record of its own, a Grant (the Mandate trait), from that User to this record.');
    const named = result.drafts.find(item => item.name === 'Bot')!.proposals.find(p => p.trait.name === 'Actor')!;
    expect(named.grade).toBe('weak');
    expect(named.evidence[0].reason).toBe('Name alone suggests this record acts as or for someone else (under a grant); the field references no person or principal record.');
  });
});

describe('acceptance', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's248-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
  afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
  const acceptAll = async (key: string) => {
    const staged = await importObjects({ action: 'draft', source: FIXTURES.sources[key] }) as any;
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; proposals: Proposal[] }>;
    const objects = drafts.map(item => ({ name: item.name, proposals: item.proposals.filter(p => p.valid && p.grade !== 'weak').map(p => p.id) }));
    return importObjects({ action: 'apply', importId: staged.importId, objects, overwrite: true, confirmShipped: objects.map(item => item.name) }) as Promise<any>;
  };

  it('accepts Mandate with fields unbound, rolls nothing back, and every screen of the accepted record composes', async () => {
    for (const key of ['sql-grant', 'prisma-grant', 'openapi-grant', 'openapi-consent']) {
      const applied = await acceptAll(key);
      for (const [k, object] of FIRES.filter(([k]) => k === key)) {
        expect(applied.applied.find((item: any) => item.name === object), `${k}/${object}`).toMatchObject({ name: object, contexts: expect.arrayContaining(['list', 'detail', 'form']) });
        for (const context of ['list', 'detail', 'form']) expect((await compose({ object, context, options: { transient: true } })).status, `${object}/${context}`).toBe('ok');
      }
    }
  });
});
