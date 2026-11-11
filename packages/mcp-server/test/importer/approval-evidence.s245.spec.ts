/**
 * s245-m03: the importer recognises another system's approval records where the schema says so.
 * - (a) A reference wrapped in allOf beside nothing but annotations is that reference (Jira Service Management's
 *   ApproverDTO.approver -> UserDTO); a shape built from allOf keeps merging (importer.spec.ts).
 * - (b) A principal's name is read with one technical suffix off and a plural s (UserDTO, users), nothing wider.
 * - (c) A single reference to a person or other principal beside an answer enum proposes Decision at medium; either
 *   alone proposes nothing, and the record's lifecycle is its answer.
 * - (d) A record does not start in an answer: a pending value, when present, is the proposed initial state.
 * Plus what the measurement found: Swagger 2.0's file type no longer refuses a draft (Gitea), and a field named like a
 * built-in member (Jira's ChangeDetails.toString) no longer rolls an acceptance back. The importer never proposes
 * Approvable, and the composer's warning for facts the source lacks is seen in design_compose, not at acceptance.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import type { Proposal } from '../../src/importer/draft.js';
import { answerValues, initialStateOf, principal } from '../../src/importer/proposals.js';
import { wrappedReference } from '../../src/importer/source.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { fallbackKeyField } from '../../src/objects/record-identity.js';
import { workflowSampleData } from '../../src/codegen/workflow-data-emitter.js';

type Result = ReturnType<typeof draftSource>;
const draftOf = (result: Result, name: string) => result.drafts.find(draft => draft.name === name)!;
const proposal = (result: Result, object: string, trait: string): Proposal | undefined => draftOf(result, object).proposals.find(item => item.trait.name === trait);
const bound = (item: Proposal | undefined) => Object.fromEntries(Object.entries(item?.trait.fieldBindings ?? {}).filter(([, target]) => target));
const openapi = (schemas: Record<string, unknown>) => ({ openapi: '3.0.1', info: { title: 'Service desk', version: '1' }, paths: {}, components: { schemas } });
const swagger = (definitions: Record<string, unknown>, paths: Record<string, unknown> = {}) => ({ swagger: '2.0', info: { title: 'Forge', version: '1' }, paths, definitions });
const api = (document: unknown, name = 'source.openapi.json') => draftSource({ content: JSON.stringify(document), name, format: 'openapi' });
const defs = (schemas: Record<string, unknown>) => draftSource({ content: JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: schemas }), name: 'source.json', format: 'json-schema' });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Jira Service Management's three records, as its swagger.v3.json writes them (trimmed to the fields that matter).
const JIRA = openapi({
  UserDTO: { type: 'object', additionalProperties: false, properties: { accountId: { type: 'string' }, displayName: { type: 'string' }, active: { type: 'boolean' } } },
  DateDTO: { type: 'object', additionalProperties: false, properties: { epochMillis: { type: 'integer', format: 'int64' }, friendly: { type: 'string' }, iso8601: { type: 'string' }, jira: { type: 'string' } } },
  ApproverDTO: { type: 'object', additionalProperties: false, properties: {
    approver: { allOf: [ref('UserDTO')], description: 'Details of the User who is providing approval.' },
    approverDecision: { type: 'string', enum: ['approved', 'declined', 'pending'], description: 'Decision made by the approver.' },
  } },
  ApprovalDTO: { type: 'object', additionalProperties: false, properties: {
    id: { type: 'string' }, name: { type: 'string' }, canAnswerApproval: { type: 'boolean' },
    finalDecision: { type: 'string', enum: ['approved', 'declined', 'pending'] },
    approvers: { type: 'array', items: ref('ApproverDTO') },
    createdDate: { allOf: [ref('DateDTO')], description: 'Date the approval was created.' },
    completedDate: { allOf: [ref('DateDTO')], description: 'Date the approval was completed.' },
  } },
});
// Gitea's PullReview (OpenAPI 2.0), beside a raw-file download whose response is Swagger 2.0's file type.
const GITEA = swagger({
  User: { type: 'object', properties: { id: { type: 'integer', format: 'int64' }, login: { type: 'string' }, full_name: { type: 'string' } } },
  Team: { type: 'object', properties: { id: { type: 'integer', format: 'int64' }, name: { type: 'string' } } },
  PullReview: { type: 'object', properties: {
    id: { type: 'integer', format: 'int64' }, body: { type: 'string' }, commit_id: { type: 'string' }, comments_count: { type: 'integer', format: 'int64' },
    state: { type: 'string', enum: ['APPROVED', 'PENDING', 'COMMENT', 'REQUEST_CHANGES', 'REQUEST_REVIEW'] },
    submitted_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
    dismissed: { type: 'boolean' }, official: { type: 'boolean' }, stale: { type: 'boolean' }, pull_request_url: { type: 'string' },
    team: { $ref: '#/definitions/Team' }, user: { $ref: '#/definitions/User' },
  } },
}, { '/repos/{owner}/{repo}/raw/{filepath}': { get: { produces: ['application/octet-stream'], responses: { 200: { description: 'Returns raw file content.', schema: { type: 'file' } } } } } });
// Bitbucket Cloud's participant, built with allOf from its base object.
const BITBUCKET = swagger({
  object: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'], discriminator: 'type' },
  account: { allOf: [{ $ref: '#/definitions/object' }, { type: 'object', title: 'Account', properties: { uuid: { type: 'string' }, display_name: { type: 'string' }, created_on: { type: 'string', format: 'date-time' } } }] },
  participant: { allOf: [{ $ref: '#/definitions/object' }, { type: 'object', title: 'Participant', properties: {
    user: { $ref: '#/definitions/account' }, role: { type: 'string', enum: ['PARTICIPANT', 'REVIEWER'] }, approved: { type: 'boolean' },
    state: { type: 'string', enum: ['approved', 'changes_requested', null] }, participated_on: { type: 'string', format: 'date-time' },
  } }] },
});

describe('Jira Service Management: the approver kept, read as a person, and the record recognised', () => {
  const jira = api(JIRA, 'jsm.openapi.json');

  it('keeps ApproverDTO.approver as a link to UserDTO, marked at the wrapped $ref', () => {
    const approver = draftOf(jira, 'ApproverDTO');
    expect(approver.definition.schema.approver).toMatchObject({ type: 'string', description: 'Details of the User who is providing approval.' });
    expect(approver.definition.relationships).toContainEqual(expect.objectContaining({ via: 'approver', target: 'UserDTO', cardinality: 'many-to-one' }));
    expect(jira.report.find(entry => entry.pointer === '/components/schemas/ApproverDTO/properties/approver/allOf/0/$ref')).toMatchObject({ outcome: 'mapped', reason: 'Named schema reference becomes a relationship to UserDTO.' });
    expect(principal('UserDTO')).toBe(true);
  });

  it('proposes Decision at medium with the approver as the one asked and no kept name, its lifecycle starting at pending', () => {
    const decision = proposal(jira, 'ApproverDTO', 'Decision')!;
    expect(decision).toMatchObject({ grade: 'medium', valid: true, errors: [] });
    expect(bound(decision)).toEqual({ asked_of_id: 'approver' });
    expect(decision.trait.fieldBindings).toMatchObject({ asked_of_name: null, subject_id: null, subject_name: null, shown: null, level: null, meaning: null });
    expect(decision.evidence.map(item => [item.kind, item.pointer])).toEqual([
      ['structure', '/components/schemas/ApproverDTO/properties/approver'],
      ['structure', '/components/schemas/ApproverDTO/properties/approverDecision/enum'],
    ]);
    expect(decision.evidence[0].reason).toBe('approver references UserDTO, a person or other principal: the one asked, whose answer the record keeps (asked_of_id).');
    for (const object of ['ApproverDTO', 'ApprovalDTO']) expect(proposal(jira, object, 'Stateful')!.trait.parameters).toMatchObject({ initialState: 'pending' });
  });

  it('gives ApprovalDTO, an ask with several approvers and no person beside its outcome, no Decision; its dates become links to DateDTO', () => {
    expect(proposal(jira, 'ApprovalDTO', 'Decision')).toBeUndefined();
    const approval = draftOf(jira, 'ApprovalDTO').definition;
    for (const field of ['createdDate', 'completedDate']) {
      expect(approval.schema[field].type).toBe('string');
      expect(approval.relationships).toContainEqual(expect.objectContaining({ via: field, target: 'DateDTO' }));
    }
    expect(Object.keys(draftOf(jira, 'DateDTO').definition.schema).sort()).toEqual(['epochMillis', 'friendly', 'iso8601', 'jira']);
  });

  it('never proposes Approvable, on any measured shape', () => {
    for (const result of [jira, api(GITEA), api(BITBUCKET)]) expect(result.drafts.flatMap(draft => draft.proposals).some(item => item.trait.name === 'Approvable')).toBe(false);
  });
});

describe('Gitea and Bitbucket: the review and the participant recognised on structure', () => {
  it("drafts Gitea's file whole: Swagger 2.0's file type is a binary string", () => {
    const gitea = api(GITEA);
    const download = Object.entries(gitea.hub.$defs).find(([, schema]: [string, any]) => schema.format === 'binary');
    expect(download?.[1]).toMatchObject({ type: 'string', format: 'binary' });
    expect(gitea.report.some(entry => entry.outcome === 'mapped' && entry.reason.startsWith("Swagger 2.0's file type"))).toBe(true);
  });

  it('binds what PullReview has: the reviewer, when the answer was given, the comment and the commit shown; the team stays unbound', () => {
    const gitea = api(GITEA);
    const decision = proposal(gitea, 'PullReview', 'Decision')!;
    expect(decision).toMatchObject({ grade: 'medium', valid: true });
    expect(bound(decision)).toEqual({ asked_of_id: 'user', answered_at: 'submitted_at', comment: 'body', shown: 'commit_id' });
    expect(decision.evidence.filter(item => item.kind === 'name').map(item => item.pointer.split('/').pop())).toEqual(['submitted_at', 'body', 'commit_id']);
    expect(proposal(gitea, 'PullReview', 'Stateful')!.trait).toMatchObject({ fieldBindings: { status: 'state' }, parameters: { initialState: 'PENDING' } });
  });

  it("takes Bitbucket's lifecycle from the answer, not the role that sorts first, and keeps the role as an alternative", () => {
    const bitbucket = api(BITBUCKET);
    expect(bound(proposal(bitbucket, 'Participant', 'Decision'))).toEqual({ asked_of_id: 'user', answered_at: 'participated_on' });
    const lifecycle = proposal(bitbucket, 'Participant', 'Stateful')!;
    // Its null (no answer yet) is not a state the importer can keep, so the first value stays the guess.
    expect(lifecycle).toMatchObject({ grade: 'medium', valid: true, trait: { fieldBindings: { status: 'state' }, parameters: { states: ['approved', 'changes_requested'], initialState: 'approved' } } });
    expect(bitbucket.report.some(entry => entry.object === 'Participant' && /Alternative Stateful configuration \(role\) retained as evidence; the record keeps one answer, so its lifecycle is state\./.test(entry.reason))).toBe(true);
  });
});

describe('the grades', () => {
  const user = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } };
  const local = (name: string) => ({ $ref: `#/$defs/${name}` });
  const result = defs({
    User: user, Team: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }, Document: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } } },
    ReviewNote: { type: 'object', properties: { id: { type: 'string' }, reviewer: local('User'), note: { type: 'string' } } },
    Outcome: { type: 'object', properties: { id: { type: 'string' }, decision: { type: 'string', enum: ['approved', 'rejected', 'pending'] } } },
    LeaveRequest: { type: 'object', properties: { id: { type: 'string' }, requester: local('User'), status: { type: 'string', enum: ['pending', 'approved', 'rejected'] } } },
    Post: { type: 'object', properties: { id: { type: 'string' }, author: local('User'), status: { type: 'string', enum: ['draft', 'in_review', 'approved', 'rejected', 'published'] } } },
    TeamVote: { type: 'object', properties: { id: { type: 'string' }, team: local('Team'), verdict: { type: 'string', enum: ['approve', 'reject'] } } },
    SignOff: { type: 'object', properties: { id: { type: 'string' }, approver: local('User'), requested_by: local('User'), document: local('Document'), decision: { type: 'string', enum: ['not_requested', 'requested', 'approved', 'rejected', 'cancelled'] }, decidedAt: { type: 'string', format: 'date-time' }, due_date: { type: 'string', format: 'date-time' }, comments: { type: 'string' } } },
  });

  it('proposes nothing for a person alone, an answer alone, an asker beside an answer, or a lifecycle that is more than an answer', () => {
    for (const object of ['ReviewNote', 'Outcome', 'LeaveRequest', 'Post', 'User', 'Document']) expect(proposal(result, object, 'Decision'), object).toBeUndefined();
    expect(answerValues(['draft', 'in_review', 'approved', 'rejected', 'published'])).toBeUndefined();
    expect(proposal(result, 'Post', 'Stateful')!.trait.parameters).toMatchObject({ initialState: 'draft' });
    expect(proposal(result, 'Outcome', 'Stateful')!.trait.parameters).toMatchObject({ initialState: 'pending' });
  });

  it('proposes Decision at medium for a group asked, and binds the asker, the thing and the dates a record has', () => {
    expect(proposal(result, 'TeamVote', 'Decision')).toMatchObject({ grade: 'medium', valid: true });
    expect(bound(proposal(result, 'TeamVote', 'Decision'))).toEqual({ asked_of_id: 'team' });
    const signOff = proposal(result, 'SignOff', 'Decision')!;
    expect(signOff).toMatchObject({ grade: 'medium', valid: true });
    expect(bound(signOff)).toEqual({ asked_of_id: 'approver', requested_by_id: 'requested_by', subject_id: 'document', answered_at: 'decidedAt', due_at: 'due_date', comment: 'comments' });
    expect(proposal(result, 'SignOff', 'Stateful')!.trait.parameters).toMatchObject({ initialState: 'not_requested' });
  });

  it('reads principals with a technical suffix or a plural, and nothing wider', () => {
    for (const name of ['User', 'UserDTO', 'Users', 'OrganizationDTO', 'AccountModel', 'TeamResource', 'directoryObject', 'microsoft.graph.group']) expect(principal(name), name).toBe(true);
    for (const name of ['UserLinkDTO', 'CommitUser', 'OrganizationCreateDTO', 'UserSettings', 'DTO', 'Usage']) expect(principal(name), name).toBe(false);
  });
});

describe('the wrapped reference and the initial state', () => {
  it('reads one reference beside annotations, and leaves a shape built from allOf merging', () => {
    expect(wrappedReference({ allOf: [{ $ref: '#/$defs/User' }], description: 'Who.', 'x-go-name': 'User', readOnly: true })).toEqual({ $ref: '#/$defs/User' });
    for (const schema of [{ allOf: [{ $ref: '#/$defs/User' }, { type: 'object' }] }, { allOf: [{ $ref: '#/$defs/User' }], required: ['id'] }, { allOf: [{ $ref: '#/$defs/User', properties: {} }] }, { $ref: '#/$defs/User', allOf: [{ $ref: '#/$defs/User' }] }]) {
      expect(wrappedReference(schema), JSON.stringify(schema)).toBeUndefined();
    }
    // OpenAPI 3.0's nullable wrapped reference is a nullable link.
    const nullable = api(openapi({ UserDTO: { type: 'object', properties: { accountId: { type: 'string' } } }, Ticket: { type: 'object', properties: { id: { type: 'string' }, assignee: { allOf: [ref('UserDTO')], nullable: true } } } }));
    expect(draftOf(nullable, 'Ticket').definition.schema.assignee.type).toBe('string?');
    expect(draftOf(nullable, 'Ticket').definition.relationships).toContainEqual(expect.objectContaining({ via: 'assignee', target: 'UserDTO' }));
  });

  it('guesses a pending value only where the first value is an answer, and a named default always wins', () => {
    expect(initialStateOf(['approved', 'declined', 'pending'])).toBe('pending');
    expect(initialStateOf(['APPROVED', 'PENDING', 'COMMENT', 'REQUEST_CHANGES', 'REQUEST_REVIEW'])).toBe('PENDING');
    expect(initialStateOf(['new', 'open', 'pending', 'hold', 'solved', 'closed'])).toBe('new');
    expect(initialStateOf(['approved', 'changes_requested'])).toBe('approved');
    expect(initialStateOf(['approved', 'declined', 'pending'], 'declined')).toBe('declined');
    const declared = defs({ Ask: { type: 'object', properties: { id: { type: 'string' }, outcome: { type: 'string' } }, 'x-oods': { lifecycle: { field: 'outcome', states: ['approved', 'rejected', 'waiting'] } } } });
    expect(proposal(declared, 'Ask', 'Stateful')).toMatchObject({ grade: 'strong', trait: { parameters: { initialState: 'waiting' } } });
  });
});

describe('acceptance', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's245-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
  afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
  const acceptAll = async (document: unknown, name: string) => {
    const staged = await importObjects({ action: 'draft', source: { content: JSON.stringify(document), name, format: 'openapi' } }) as any;
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; proposals: Proposal[] }>;
    return importObjects({ action: 'apply', importId: staged.importId, objects: drafts.map(draft => ({ name: draft.name, proposals: draft.proposals.filter(item => item.valid && item.grade !== 'weak').map(item => item.id) })) }) as Promise<any>;
  };

  it('accepts Decision with the facts unbound, an id kept without its name included, and warns only when the answer screen is composed', async () => {
    const applied = await acceptAll(JIRA, 'jsm.openapi.json');
    // Acceptance composes every context the accepted object supports (its lifecycle adds the timeline) and rolls nothing back.
    expect(applied.applied.find((item: any) => item.name === 'ApproverDTO')).toEqual({ name: 'ApproverDTO', contexts: ['list', 'detail', 'form', 'timeline'] });
    expect(JSON.stringify(applied)).not.toContain('OODS-V22');
    const form = await compose({ object: 'ApproverDTO', context: 'form', options: { transient: true } });
    expect(form.status).toBe('ok');
    expect((form.warnings ?? []).filter((warning: any) => warning.code === 'OODS-V222').map((warning: any) => warning.message)).toEqual([expect.stringContaining('do not keep the thing, exactly what was shown, the level or the meaning')]);
    const detail = await compose({ object: 'ApproverDTO', context: 'detail', options: { transient: true } });
    expect(detail.status).toBe('ok');
  });

  it('keys a record that names no identifier on a field that tells records apart, so its answer reads on every screen', async () => {
    await acceptAll(JIRA, 'jsm.openapi.json');
    await acceptAll(BITBUCKET, 'bitbucket.json');
    const rowsOf = (node: any): any => node?.collection?.source === 'rows' ? node : (node?.children ?? []).map(rowsOf).find(Boolean);
    for (const [object, key, answer] of [['ApproverDTO', 'approver', 'approverDecision'], ['Participant', 'user', 'state']] as const) {
      const list = await compose({ object, context: 'list', options: { transient: true } });
      expect(list.schema.screens.map(rowsOf).find(Boolean)?.collection.keyField, object).toBe(key);
      const workflow = (await compose({ object, context: 'workflow', options: { transient: true } } as never) as any).schema;
      expect(workflow.workflow.data.idField, object).toBe(key);
      // The generated app's records keep their answers: an enum is never the key its preview makes unique.
      const { records } = workflowSampleData(workflow);
      expect(records.map(record => record[answer]).every(value => typeof value === 'string' && !value.startsWith('sample-')), object).toBe(true);
    }
    // A record with nothing but enums and flags still has a key: its first field.
    expect(fallbackKeyField({ decision: { type: 'string', enum: ['approved', 'declined'] }, open: { type: 'boolean' } })).toBe('decision');
  });

  it("accepts a record with fields named like built-in members (Jira's ChangeDetails.toString)", async () => {
    const builtIns = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__lookupSetter__'];
    const applied = await acceptAll(openapi({ ChangeDetails: { type: 'object', properties: Object.fromEntries([['fieldName', { type: 'string' }], ...builtIns.map(name => [name, { type: 'string' }])]) } }), 'changes.openapi.json');
    expect(applied.applied).toEqual([{ name: 'ChangeDetails', contexts: ['list', 'detail', 'form'] }]);
  });
});
