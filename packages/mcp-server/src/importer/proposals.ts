import type { Proposal } from './draft.js';
import type { FieldDefinition, SemanticMapping, TraitReference } from '../objects/types.js';
import { isMap, wrappedReference, type MapValue, type Origin } from './source.js';

type Propose = (trait: TraitReference, grade: Proposal['grade'], evidence: Proposal['evidence']) => void;

/** The named schema a field points at, one level through a nullable union, an array's items or an allOf wrapper (s245-m03). */
function referenceOf(schema: MapValue): { target: string; many: boolean } | undefined {
  if (!isMap(schema)) return undefined;
  const union = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined;
  if (union?.length === 2 && union.some((branch: MapValue) => branch?.type === 'null')) return referenceOf(union.find((branch: MapValue) => branch?.type !== 'null'));
  const name = (value: MapValue) => { const reference = wrappedReference(value) ?? value; return isMap(reference) && typeof reference.$ref === 'string' && reference.$ref.startsWith('#/$defs/') ? reference.$ref.slice(8).replace(/~1/g, '/').replace(/~0/g, '~') : undefined; };
  if (schema.type === 'array' || Array.isArray(schema.type) && schema.type.includes('array')) { const target = name(schema.items); return target ? { target, many: true } : undefined; }
  const target = name(schema);
  return target ? { target, many: false } : undefined;
}
/**
 * s244-m03 (#2837): a record that people or groups are named by: a user, an account, an organization, a team, a group or a
 * directory object. s245-m03: the last part of the record's name is read with one technical suffix taken off (DTO, VO,
 * Model, Entity, Bean, Resource, Response, Schema, Representation) and with a plural s, so Jira's UserDTO and a users
 * table name people. A name with any other word beside the principal word (UserLinkDTO, CommitUser) does not.
 */
const PRINCIPAL = /^(user|account|organi[sz]ation|team|group|directoryobject|person|member|principal)s?$/i;
const TECHNICAL = /(?:dto|vo|model|entity|bean|resource|response|schema|representation)$/i;
const principalWord = (target: string): string | undefined => {
  const last = (target.split('.').pop() ?? target).replace(/[^A-Za-z0-9]/g, '');
  return [last, last.replace(TECHNICAL, '')].find(candidate => PRINCIPAL.test(candidate));
};
export const principal = (target: string) => principalWord(target) !== undefined;
/** A person before a group, when a record references both (Gitea's PullReview has a user and a team). */
const PERSON = /^(user|account|person|member|principal)s?$/i;
/** A boolean field, nullable or not (OData and JSON Schema write a nullable one as type [boolean, null]). */
const boolean = (schema: MapValue) => schema.type === 'boolean' || Array.isArray(schema.type) && schema.type.includes('boolean') && schema.type.every((type: string) => type === 'boolean' || type === 'null');
/** An app or installation record beside a bot flag says the flagged records are an app's (an agent's). */
const APP = /^(app|application|installation|integration|oauthapp|oauthapplication|bot|botprofile|serviceprincipal)$/i;
/**
 * A structural match suggests a capability for review, not an assertion of domain meaning. s247-m03: a declared reference
 * the record-of-work rule has bound (`claimed`: the one doing the work, who asked, the task it came from) is not guessed a
 * second time as an owner or a category tree; with nothing claimed, every guess is as before. s248-m03: the grant rule's
 * references (the holder, the party, who gave, asked for and ended it) are claimed the same way, and are not guessed again
 * as the record acting for someone either.
 */
export function suggestTraits(shape: MapValue, fields: Record<string, MapValue>, originOf: (field: string) => Origin, propose: Propose, note: (field: string, reason: string) => void, claimed: ReadonlySet<string> = new Set()): void {
  const entries = Object.entries(fields);
  const evidence = (field: string, reason: string, kind: 'structure' | 'declaration' = 'structure') => [{ ...originOf(field), kind, reason }];
  const number = (schema: MapValue) => ['integer', 'number'].includes(schema.type);
  const currencies = entries.filter(([, s]) => s.format === 'iso-4217' || s.pattern === '^[A-Z]{3}$' || (s.enum?.length && s.enum.every((v: unknown) => typeof v === 'string' && /^[A-Z]{3}$/.test(v))));
  const amount = entries.find(([, s]) => number(s) && (s['x-oods']?.currency || s.minimum >= 0));
  if (amount && currencies.length) {
    const [field, s] = amount, [currency, code] = currencies[0];
    const declared = s['x-oods']?.currency?.field === currency;
    const codes = code.enum ?? ['USD', 'EUR', 'GBP'];
    propose({ name: 'Priceable', parameters: { supportedCurrencies: codes, defaultCurrency: codes.includes(code.default) ? code.default : codes[0] } }, declared ? 'strong' : 'medium', [
      ...evidence(field, 'Numeric amount paired with a constrained three-letter currency field; review price meaning and minor-unit alignment.', declared ? 'declaration' : 'structure'),
      ...evidence(currency, 'Currency format, enumeration or ISO-shaped pattern constrains the code.'),
    ]);
  }
  const latitude = entries.find(([, s]) => number(s) && s.minimum === -90 && s.maximum === 90);
  const longitude = entries.find(([, s]) => number(s) && s.minimum === -180 && s.maximum === 180);
  if (latitude && longitude) propose({ name: 'Geocodable', parameters: { autoDetect: false, explicitFields: [latitude[0], longitude[0]] } }, 'strong', [...evidence(latitude[0], 'Numeric coordinate bounded at ±90.'), ...evidence(longitude[0], 'Numeric coordinate bounded at ±180.')]);
  for (const [field, schema] of entries) {
    if (schema.type === 'array' && schema.items?.type === 'string' && (schema.uniqueItems || schema.items.enum)) {
      const allowed = schema.items.enum;
      propose({ name: 'Taggable', parameters: { ...(schema.maxItems > 0 && schema.maxItems <= 64 ? { maxTags: schema.maxItems } : {}), ...(allowed?.length ? { allowedTags: allowed, allowCustomTags: false } : {}) } }, 'medium', evidence(field, 'Unique string collection or controlled string vocabulary fits tags; classification meaning requires acceptance.'));
    }
    if (['email', 'phone'].includes(schema.format)) note(field, 'Contact format retained; Communicable models channels, templates and conversations, so a contact alone does not justify that trait.');
    if (typeof schema.pattern === 'string' && /[0-9a-f]/i.test(schema.pattern) && schema.pattern.includes('#')) note(field, 'Colour pattern retained; Colorized models semantic status tones, not arbitrary colour values.');
    if (schema.enum?.length && schema.enum.every((value: string) => ['neutral', 'info', 'accent', 'success', 'warning', 'critical'].includes(value))) {
      propose({ name: 'Colorized', parameters: { colorStates: schema.enum, fallbackTone: schema.enum[0] } }, 'medium', evidence(field, 'Enumeration is entirely within the shipped semantic status tone vocabulary.'));
    }
    if (isMap(schema.properties)) {
      const nested = Object.values(schema.properties) as MapValue[];
      if (nested.some(s => s.format === 'iso-3166-1-alpha-2' || s.pattern === '^[A-Z]{2}$') && nested.filter(s => s.type === 'string').length >= 3) {
        propose({ name: 'Addressable', parameters: {} }, 'medium', evidence(field, 'Structured postal-shaped record includes a constrained country code and multiple text address parts; review role alignment.'));
      }
    }
  }
  const annotation = shape['x-oods'] ?? {};
  const validity = entries.filter(([, schema]) => schema.format === 'date-time');
  const current = entries.find(([, schema]) => schema.type === 'boolean' && schema.default === true);
  if (!annotation.history && validity.length >= 2 && current && validity.some(([, schema]) => Array.isArray(schema.type) && schema.type.includes('null'))) {
    propose({ name: 'Supersedable', parameters: { states: ['active', 'superseded'], initialState: 'active' } }, 'medium', [...validity.map(([field]) => evidence(field, 'Timestamp pair with an open-ended nullable boundary.')[0]), ...evidence(current[0], 'Current-row flag beside validity boundaries suggests type-2 history; confirm replacement meaning.')]);
  }

  if (annotation.lifecycle?.states?.length) propose({ name: 'Stateful', ...(fields[annotation.lifecycle.field] ? { fieldBindings: { status: annotation.lifecycle.field } } : {}), parameters: { states: annotation.lifecycle.states, initialState: annotation.lifecycle.initialState ?? initialStateOf(annotation.lifecycle.states) } }, 'strong', evidence(annotation.lifecycle.field ?? '', 'Explicit lifecycle state declaration.', 'declaration'));
  if (annotation.history) propose({ name: 'Supersedable', parameters: {} }, 'strong', evidence(annotation.history.field ?? '', 'Declared record history; review whether revisions replace one another before accepting Supersedable.', 'declaration'));
  for (const relationship of annotation.relationships ?? []) {
    const field = relationship.via;
    if (claimed.has(field)) continue;
    // s255-m01 (G3): a reference to the record's own kind named for what replaced it, or for what it replaces, is a
    // replacement pointer, the lineage Supersedable keeps, not a category tree (R3 run D's memories.superseded_by).
    const replacement = relationship.target === shape.title && !annotation.history ? REPLACEMENT.exec(word(field)) : null;
    if (replacement) {
      const backward = /^(supersedes|replaces)$/.test(replacement[1]), pointer = backward ? 'supersedes' : 'superseded_by';
      // Supersedable keeps the pointer as text: a key held as a uuid or a number is left unbound, so the proposal stays valid.
      const types = (Array.isArray(fields[field]?.type) ? fields[field].type : [fields[field]?.type]).filter((type: unknown) => type !== 'null');
      const text = types.length === 1 && types[0] === 'string' && !fields[field].format;
      propose({ name: 'Supersedable', parameters: { states: ['active', 'superseded'], initialState: 'active', recordedDirection: backward ? 'backward' : 'forward' }, fieldBindings: { [pointer]: text ? field : null } }, 'medium',
        evidence(field, `${field} references ${shape.title}, this record's own kind, and is named for ${backward ? 'the record this one replaces' : 'the record that replaced this one'}: a replacement pointer (${pointer}), not a category tree; confirm before accepting.${text ? '' : ' It is not held as text, so it is not bound.'}`));
    } else if (relationship.target === shape.title && !annotation.history) propose({ name: 'Classifiable', parameters: { classification_mode: 'taxonomy', hierarchy_storage_model: 'adjacency_list' } }, 'medium', evidence(field, 'A declared self-referencing key can represent an adjacency hierarchy; confirm taxonomy meaning.'));
    // s244-m03 (#2837): group and directory-object targets name principals too (Microsoft Graph's owners and sponsors).
    if (principal(relationship.target)) propose({ name: 'Ownerable', parameters: {} }, 'medium', evidence(field, 'Declared foreign key to a principal record; confirm ownership rather than another association.'));
  }
  if (annotation.archive) propose({ name: 'Archivable', parameters: {} }, 'strong', evidence(annotation.archive.field, 'Explicit archive marker.', 'declaration'));

  // s244-m03 (#2837): agent records (an agent is an actor, not a user). A field's name is name evidence and grades weak; a
  // reference to a principal or an app record is the structure that backs it (medium). Nothing applies without acceptance.
  const named = (field: string, reason: string) => [{ ...originOf(field), kind: 'name' as const, reason }];
  // Sponsors before owners: an agent's sponsor is a person or a team, and the first configuration of a grade is kept.
  for (const [field, schema] of [...entries].sort(([a], [b]) => Number(/^sponsors?$/i.test(b)) - Number(/^sponsors?$/i.test(a)))) {
    const reference = referenceOf(schema);
    const toPrincipal = reference && principal(reference.target) ? reference.target : undefined;
    // A boolean named owner is a role flag (Linear's User.owner), never a reference to who owns the record.
    if (/^(owners?|sponsors?)$/i.test(field) && !boolean(schema)) {
      const sponsor = /^sponsors?$/i.test(field);
      const trait = { name: 'Ownerable', parameters: sponsor ? { ownerTypes: ['user', 'team'], primaryOwnerType: 'user' } : {}, ...(toPrincipal && !reference!.many ? { fieldBindings: { owner_id: field } } : {}) };
      if (toPrincipal) propose(trait, 'medium', evidence(field, `${sponsor ? 'Sponsors' : 'Owners'} reference ${toPrincipal} records: the people or groups ${sponsor ? 'who answer for this record' : 'who own this record'}; confirm ownership before accepting.`));
      else propose(trait, 'weak', named(field, `Name alone suggests ${sponsor ? 'sponsors' : 'owners'}; the field references no person, group or directory record.`));
    }
    // s248-m03: a reference a record rule has bound (a grant's party) is not guessed again as the record acting for it.
    if (!claimed.has(field) && /^(run_?as(_?user)?|runs_?as|on_?behalf_?of(_?(user|id))?|acting_?(as|for)|identity_?parent(_?id)?)$/i.test(field)) {
      if (toPrincipal) propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', evidence(field, `This record acts as or for a ${toPrincipal} record: an agent acting under a grant. Keep the grant as a record of its own, a Grant (the Mandate trait), from that ${toPrincipal} to this record.`));
      else propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'weak', named(field, 'Name alone suggests this record acts as or for someone else (under a grant); the field references no person or principal record.'));
    }
    if (boolean(schema) && /^(is_?bot|bot|is_?app(_?user)?|app|is_?agent|agent)$/i.test(field)) {
      const app = entries.find(([other, value]) => other !== field && APP.test((referenceOf(value)?.target ?? '').split('.').pop() ?? ''));
      const flagged = `Records with ${field} true are agents (an app or a bot); OODS keeps an agent in an object of its own, so separate people from agents before accepting Actor as an agent.`;
      if (app) propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', [...evidence(field, flagged), ...evidence(app[0], `The ${field} flag sits beside a reference to ${referenceOf(app[1])!.target}, the app the flagged records belong to.`)]);
      else propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'weak', named(field, `${flagged} Only the flag's name says so: no app or installation reference sits beside it.`));
    }
    const constant = schema.const ?? (Array.isArray(schema.enum) && schema.enum.length === 1 ? schema.enum[0] : undefined);
    if (/^(resource_?type|type|kind|object)$/i.test(field) && constant === 'agent') {
      propose({ name: 'Actor', parameters: { kind: 'agent' } }, 'medium', evidence(field, `Every record declares ${field} "agent": the records are agents.`));
    }
    if (boolean(schema) && /^(active|is_?active|enabled|is_?enabled|account_?enabled)$/i.test(field)) {
      const states = /enabled/i.test(field) ? ['enabled', 'disabled'] : ['active', 'inactive'];
      propose({ name: 'Stateful', parameters: { states, initialState: states[0] } }, 'weak', named(field, `A boolean named ${field} is a two-state lifecycle (${states.join(', ')}). The source records a flag, not a state, so acceptance binds no status field until the flag is mapped to one.`));
    }
  }
  if (annotation.sortFields?.length) propose({ name: 'Sortable', parameters: { sortableFields: annotation.sortFields, defaultSortField: annotation.sortFields[0] } }, 'strong', evidence(annotation.sortFields[0], 'Declared sortable fields.', 'declaration'));
}

/** s255-m01 (G3): a field named for the record that replaced this one, or for the one it replaces. */
const REPLACEMENT = /^(replaced_by|superseded_by|supersedes|replaces)(?:_id)?$/;
/** The memory that replaced this one, as `Remembered` holds it. A key named supersedes or replaces points the other way, at
 * the memory this one replaced, which the trait does not hold, so the memory rule neither binds it nor reads it as a signal. */
const REPLACED_BY = /^(replaced_by|superseded_by)(?:_id)?$/;
/**
 * s255-m01 (G4): a record of changes (a history, an event, a change or audit log, a revision, a journal) and its field
 * named for the kind of change (event, event type, change type, action, operation). That field says what happened to
 * another record, so it is not this record's lifecycle (R3 runs B and D: MemoryHistoryEntry.event, memory_events.event).
 */
const CHANGE_RECORD = /(?:^|_)(?:histor(?:y|ies)|history_entr(?:y|ies)|events?|changes?|change_?logs?|audits?|audit_(?:logs?|entr(?:y|ies)|events?|trails?)|logs?|log_entr(?:y|ies)|revisions?|journals?)$/;
const CHANGE_KIND = /^(?:event|event_type|change|change_type|action|action_type|operation|operation_type|op|op_type)$/;
export const changeKind = (record: string, field: string) => CHANGE_RECORD.test(word(record)) && CHANGE_KIND.test(word(field));
/** A value or a field name in one spelling: lower case, words joined by underscores (REQUEST_CHANGES, changesRequested). */
const word = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');
const APPROVE = new Set(['approve', 'approved']);
const REFUSE = new Set(['reject', 'rejected', 'decline', 'declined', 'deny', 'denied', 'disapprove', 'disapproved', 'request_changes', 'changes_requested']);
/** s245-m03: the values of an ask still waiting for its answer, in no order of their own. */
export const PENDING_STATES = ['pending', 'waiting', 'awaiting', 'requested', 'not_requested', 'request_review', 'review_requested', 'awaiting_approval', 'pending_approval', 'not_yet_asked'];
/** How an ask is answered other than yes or no, or how it ends unanswered. */
const ASK_ENDINGS = new Set(['comment', 'commented', 'dismissed', 'abstain', 'abstained', 'withdrawn', 'cancelled', 'canceled', 'expired', 'revoked', 'stale', 'out_of_date', 'outdated', 'taken_back', 'not_needed', 'not_required', 'no_longer_required', 'used', 'duplicate', 'skipped', 'timed_out']);
const approves = (value: string) => APPROVE.has(word(value));
const refuses = (value: string) => REFUSE.has(word(value));
const pendingState = (value: string) => PENDING_STATES.includes(word(value));

/**
 * s245-m03 (d): the proposed initial state. A default the schema names wins. Otherwise the first value, unless it is an
 * answer: a record does not start approved or declined (Jira's approved, declined, pending is alphabetical), so the first
 * pending value, in the source's order, is the guess instead. A lifecycle that starts before it waits (new, open,
 * pending, solved) keeps its first value.
 */
export function initialStateOf(states: string[], declared?: unknown): string {
  if (typeof declared === 'string' && states.includes(declared)) return declared;
  const first = states[0];
  return typeof first === 'string' && (approves(first) || refuses(first)) ? states.find(pendingState) ?? first : first;
}

/** One person's answer: an approve value, a reject or decline value, and every value an answer, the wait for one or an ending. */
export function answerValues(values: unknown[]): { approve: string; refuse: string } | undefined {
  if (!values.every((value): value is string => typeof value === 'string')) return undefined;
  const approve = values.find(approves), refuse = values.find(refuses);
  return approve && refuse && values.every(value => approves(value) || refuses(value) || pendingState(value) || ASK_ENDINGS.has(word(value))) ? { approve, refuse } : undefined;
}

export type Edge = { target: string; via: string; cardinality: string };
type Evidence = Proposal['evidence'][number];
/** A reference to a person named for who asked, or who owns or wrote the thing: not the one whose answer is kept. */
const ASKER = /^(requested_by|requester|requestor|author|creator|created_by|owners?|submitter|submitted_by|initiator|reporter)(_id)?$/;
const WHEN: Array<[string, RegExp, string]> = [
  ['answered_at', /^(submitted|answered|decided|responded|reviewed|approved|participated|completed|actioned)(_(at|on|date|time))?$/, 'when the answer was given'],
  ['asked_at', /^(requested|asked|sent)(_(at|on|date|time))?$/, 'when the person was asked'],
  ['due_at', /^(due|deadline|expires|expiry|expiration)(_(at|on|date|time))?$/, 'when the answer is due'],
];
const COMMENT = /^(body|comments?|notes?|remarks?|message|reason)$/;
const SHOWN = /^(commit(_(id|sha))?|(head_)?sha|revision(_id)?)$/;
const typeOf = (field: FieldDefinition) => field.type.replace(/\?$/, '');

/**
 * s245-m03 (c): another system's table of approvals, one person's answer per row, recognised on structure (#2651). Two
 * facts together earn medium: a single reference to a person or other principal (the one asked), and an answer enum
 * (answerValues). Neither alone proposes anything: references to people are everywhere, and an approve/decline enum with
 * no person beside it may be the outcome kept on the thing, which the importer does not read. A reference named for the
 * asker or the owner is not the one asked. What else the record has is bound where its name says what it is: the asker,
 * the one other record it points at (the thing), the dates, the comment and the version shown. Every other Decision field
 * stays unbound, so a fact the source lacks is not on the record; design_compose names it when the answer screen is
 * composed (OODS-V222). Strong stays for a declaration.
 */
export function approvalRecord(fields: Record<string, FieldDefinition>, relationships: Edge[], originOf: (field: string) => Origin, answerOrigin: (field: string) => Origin): { trait: TraitReference; evidence: Proposal['evidence']; answer: string } | undefined {
  const names = Object.keys(fields);
  const answer = names.find(field => Array.isArray(fields[field].validation?.enum) && answerValues(fields[field].validation!.enum as unknown[]));
  if (!answer) return undefined;
  const { approve, refuse } = answerValues(fields[answer].validation!.enum as unknown[])!;
  const single = relationships.filter(edge => edge.cardinality === 'many-to-one' && fields[edge.via] && typeOf(fields[edge.via]) === 'string');
  const people = single.filter(edge => principal(edge.target) && !ASKER.test(word(edge.via)));
  const asked = people.find(edge => PERSON.test(principalWord(edge.target)!.replace(TECHNICAL, ''))) ?? people[0];
  if (!asked) return undefined;
  const bindings: Record<string, string> = { asked_of_id: asked.via };
  const evidence: Evidence[] = [
    { ...originOf(asked.via), kind: 'structure', reason: `${asked.via} references ${asked.target}, a person or other principal: the one asked, whose answer the record keeps (asked_of_id).` },
    { ...answerOrigin(answer), kind: 'structure', reason: `${answer} holds an approve value (${approve}) and a ${/change/.test(word(refuse)) ? 'request-changes' : 'reject or decline'} value (${refuse}), and each of its values is an answer, the wait for one or how an ask ends: the record keeps one answer, and ${answer} is its lifecycle (Stateful).` },
  ];
  const named = (field: string, role: string, reason: string) => { bindings[role] = field; evidence.push({ ...originOf(field), kind: 'name', reason }); };
  const asker = single.find(edge => edge.via !== asked.via && principal(edge.target) && ASKER.test(word(edge.via)));
  if (asker) named(asker.via, 'requested_by_id', `${asker.via} references ${asker.target} and is named for who asked (requested_by_id).`);
  const others = single.filter(edge => !principal(edge.target));
  if (others.length === 1) {
    bindings.subject_id = others[0].via;
    evidence.push({ ...originOf(others[0].via), kind: 'structure', reason: `${others[0].via} references ${others[0].target}, the one record it points at besides people: the thing approved (subject_id).` });
  }
  const unbound = (field: string) => !Object.values(bindings).includes(field) && field !== answer;
  for (const [role, pattern, meaning] of WHEN) {
    const field = names.find(name => unbound(name) && typeOf(fields[name]) === 'datetime' && pattern.test(word(name)));
    if (field) named(field, role, `${field} is a date-time named for ${meaning} (${role}).`);
  }
  const text = (name: string) => unbound(name) && typeOf(fields[name]) === 'string' && !fields[name].validation?.enum;
  const comment = names.find(name => text(name) && COMMENT.test(word(name)));
  if (comment) named(comment, 'comment', `${comment} is free text named as the answer's comment (comment).`);
  const shown = names.find(name => text(name) && SHOWN.test(word(name)));
  if (shown) named(shown, 'shown', `${shown} names the version the answer is about, which is what the person was shown (shown).`);
  return { trait: { name: 'Decision', parameters: {}, fieldBindings: bindings }, evidence, answer };
}

/** s247-m03: the values a record of work holds, read with a prefix every value shares taken off (A2A's TASK_STATE_). */
const WORKING = new Set(['working', 'in_progress', 'running', 'active', 'processing', 'started', 'executing', 'ongoing']);
const FINISHED = new Set(['finished', 'completed', 'complete', 'done', 'succeeded', 'success', 'successful']);
/** A person is needed: an answer or input from a user or a human. Blocked, waiting and pending are not: they wait on anything. */
const NEEDS_PERSON = new Set(['input_required', 'needs_input', 'awaiting_input', 'waiting_for_input', 'input_needed', 'requires_input', 'user_input_required', 'requires_user_input', 'awaiting_user_input', 'waiting_for_user_input', 'waiting_for_user', 'awaiting_user', 'waiting_on_user', 'needs_user', 'needs_human', 'awaiting_human', 'waiting_for_human', 'human_input_required']);

/** A record of work's states: a working value, a finished value and a value that means a person is needed, as the source spells them. */
export function workValues(values: unknown[]): { working: string; finished: string; needsPerson: string } | undefined {
  if (values.length < 3 || !values.every((value): value is string => typeof value === 'string')) return undefined;
  const parts = values.map(value => word(value).split('_'));
  let shared = 0;
  while (parts.every(part => part.length > shared + 1 && part[shared] === parts[0][shared])) shared++;
  const read = parts.map(part => part.slice(shared).join('_'));
  const find = (set: Set<string>) => values[read.findIndex(value => set.has(value))];
  const working = find(WORKING), finished = find(FINISHED), needsPerson = find(NEEDS_PERSON);
  return working && finished && needsPerson ? { working, finished, needsPerson } : undefined;
}

/** An agent's or an app's own record: the one doing the work can be one (Agent, Bot, App, Application, Integration). */
const ACTOR_RECORD = /^(agent|assistant|bot|botprofile|app|application|integration|installation|serviceprincipal|oauthapp|oauthapplication)s?$/i;
const actorRecord = (target: string) => { const last = (target.split('.').pop() ?? target).replace(/[^A-Za-z0-9]/g, ''); return [last, last.replace(TECHNICAL, '')].some(candidate => ACTOR_RECORD.test(candidate)); };
/** A reference named for the one doing the work. */
const DOER = /^(assignee|assigned(_(to|team|user|group|agent))?|asked_of|agent|app_user|app|bot|worker|performer|executor|doer|delegate|delegated_to|runner|handler)(_id)?$/;
/** A reference named for who asked for the work. */
const REQUESTER = /^(requested_by|requester|requestor|creator|created_by|submitter|submitted_by|initiator|initiated_by|started_by|asked_by|triggered_by|triggering_actor|reporter|author)(_id)?$/;
/** A reference named for the thing the work is about, when the record points at more than one other record. */
const THING = /^(subject|issue|ticket|case|item|work_item|target|pull_request|merge_request|document|record)(_id)?$/;
const WORK_FIELDS: Array<[string, RegExp, string, string]> = [
  ['due_at', /^(due|deadline)(_(at|on|by|date|time))?$/, 'datetime', 'a date-time named for when the work is due'],
  ['instruction', /^(instructions?|prompt|ask)$/, 'string', 'free text named for what was asked'],
  ['result', /^(result|outcome|result_summary|outcome_summary|result_text)$/, 'string', 'free text named for what came of the work'],
  ['tries', /^(tries|try_count|attempts|attempt_count|attempts_count|run_count|runs_count|session_count|sessions_count)$/, 'integer', 'a whole number named for how many tries, runs or sessions the work has taken'],
];

/**
 * s247-m03: another system's record of work, one ask to one actor, recognised on structure (#2651). Two facts together earn
 * medium: a state enum that holds a working value, a finished value and a value that means a person is needed (workValues),
 * and a single reference to the one doing the work: a reference to an agent's or an app's record, or a reference to a
 * person or other principal named for the one doing it (assignee, agent, worker...). Neither alone proposes anything:
 * references to people are everywhere, and orders and documents never need input. What else the record has is bound
 * where its structure or name says what it is: who asked, the thing, a reference to its own kind (the task it came from),
 * the due date, what was asked, the result and the count of tries. Every other Assignment field stays unbound, and so
 * does a same-named field of another type, so the proposal stays valid. The doer, who asked and the task it came from
 * are returned as claimed: suggestTraits does not guess them again as an owner or a category tree. Strong stays for a
 * declaration.
 */
export function workRecord(self: string, fields: Record<string, FieldDefinition>, relationships: Edge[], originOf: (field: string) => Origin, stateOrigin: (field: string) => Origin, traitTypes: Record<string, string>): { trait: TraitReference; evidence: Proposal['evidence']; state: string; claimed: string[] } | undefined {
  const names = Object.keys(fields);
  const state = names.find(field => Array.isArray(fields[field].validation?.enum) && workValues(fields[field].validation!.enum as unknown[]));
  if (!state) return undefined;
  const { working, finished, needsPerson } = workValues(fields[state].validation!.enum as unknown[])!;
  const single = relationships.filter(edge => edge.cardinality === 'many-to-one' && fields[edge.via] && typeOf(fields[edge.via]) === 'string');
  const actors = single.filter(edge => edge.target !== self && (principal(edge.target) || actorRecord(edge.target)));
  const role = (edge: Edge) => word(edge.via).replace(/_user_id$/, '_id');
  const doer = actors.find(edge => actorRecord(edge.target) && !REQUESTER.test(role(edge))) ?? actors.find(edge => DOER.test(role(edge)));
  if (!doer) return undefined;
  const bindings: Record<string, string | null> = { asked_of_id: doer.via };
  const evidence: Evidence[] = [
    { ...originOf(doer.via), kind: 'structure', reason: actorRecord(doer.target)
      ? `${doer.via} references ${doer.target}, an agent's or an app's own record: the one doing the work (asked_of_id).`
      : `${doer.via}, a field named for the one doing the work, references ${doer.target}, a person or other principal: the one doing it (asked_of_id).` },
    { ...stateOrigin(state), kind: 'structure', reason: `${state} holds a working value (${working}), a finished value (${finished}) and a value that means a person is needed (${needsPerson}): the states of a record of work, proposed as its lifecycle (Stateful) unless the source declares another.` },
  ];
  const claimed = [doer.via];
  const asker = actors.find(edge => edge.via !== doer.via && REQUESTER.test(role(edge)));
  if (asker) {
    bindings.requested_by_id = asker.via; claimed.push(asker.via);
    evidence.push({ ...originOf(asker.via), kind: 'name', reason: `${asker.via} references ${asker.target} and is named for who asked (requested_by_id).` });
  }
  const own = single.filter(edge => edge.target === self);
  const parent = own.length === 1 ? own[0] : own.find(edge => /^parent/.test(role(edge)));
  if (parent) {
    bindings.parent_id = parent.via; claimed.push(parent.via);
    evidence.push({ ...originOf(parent.via), kind: own.length === 1 ? 'structure' : 'name', reason: `${parent.via} references ${self}, this record's own kind: read as the task this one came from (parent_id), not a category tree; confirm before accepting.` });
  }
  const others = single.filter(edge => edge.target !== self && !principal(edge.target) && !actorRecord(edge.target));
  const thing = others.length === 1 ? others[0] : others.find(edge => THING.test(role(edge)));
  if (thing) {
    bindings.subject_id = thing.via;
    evidence.push(others.length === 1
      ? { ...originOf(thing.via), kind: 'structure', reason: `${thing.via} references ${thing.target}, the one other record it points at by a single text reference, besides people, agents and its own kind: the thing the work is about (subject_id).` }
      : { ...originOf(thing.via), kind: 'name', reason: `${thing.via} references ${thing.target} and is named for the thing the work is about (subject_id).` });
  }
  const unbound = (name: string) => !Object.values(bindings).includes(name) && name !== state;
  for (const [role, pattern, type, meaning] of WORK_FIELDS) {
    const field = names.find(name => unbound(name) && typeOf(fields[name]) === type && !fields[name].validation?.enum && pattern.test(word(name)));
    if (field) { bindings[role] = field; evidence.push({ ...originOf(field), kind: 'name', reason: `${field} is ${meaning} (${role}).` }); }
  }
  // Bindings are filled by name after this: a same-named field of another type, or one already bound to another of the
  // trait's fields, is left unbound here, so the proposal composes.
  for (const [field, type] of Object.entries(traitTypes)) {
    if (Object.hasOwn(bindings, field) || !fields[field]) continue;
    if (typeOf(fields[field]) !== type.replace(/\?$/, '') || Object.values(bindings).includes(field)) bindings[field] = null;
  }
  return { trait: { name: 'Assignment', parameters: {}, fieldBindings: bindings }, evidence, state, claimed };
}

/**
 * s248-m03 (1868): a field named for the record's status or state (status, state, consentStatus, grant_state). Among
 * several string enums, it is the record's lifecycle, ahead of one that sorts first (FDX's durationType before its status).
 */
export const STATE_NAMED = /(?:^|_)(?:status|state)$/;
/**
 * s248-m03: a date-time named for an end, when a grant, a consent or a token stops: expires, expiry, expiration, expired,
 * valid until, valid to, end or ends (expirationTime, consentExpiry, token_expires_at, valid_until, ends_at). It is never
 * the record's created_at, and it is a grant's end.
 */
export const END_NAMED = /(?:^|_)(?:expires?|expiry|expiration|expired|valid_(?:until|to|thru|through)|ends?)(?:_|$)/;
/** A field's name, in any spelling, is named for the record's state, or for an end. */
export const namedForState = (field: string) => STATE_NAMED.test(word(field));
export const namedForEnd = (field: string) => END_NAMED.test(word(field));
/** s248-m03: the values a grant's state holds: one in force, and one that says it was revoked or ended. */
const IN_FORCE = new Set(['active', 'granted', 'authorised', 'authorized', 'in_force', 'valid']);
const ENDED = new Set(['revoked', 'expired', 'ended', 'terminated', 'withdrawn', 'deactivated']);

/** A grant's states: a value in force and a value that says it was revoked or ended, read as workValues reads a work's. */
export function grantValues(values: unknown[]): { inForce: string; ended: string } | undefined {
  if (values.length < 2 || !values.every((value): value is string => typeof value === 'string')) return undefined;
  const parts = values.map(value => word(value).split('_'));
  let shared = 0;
  while (parts.every(part => part.length > shared + 1 && part[shared] === parts[0][shared])) shared++;
  const read = parts.map(part => part.slice(shared).join('_'));
  const find = (set: Set<string>) => values[read.findIndex(value => set.has(value))];
  const inForce = find(IN_FORCE), ended = find(ENDED);
  return inForce && ended ? { inForce, ended } : undefined;
}

/** A reference named for the agent or app that holds the grant, when the record points at more than one. */
const HOLDER = /^(granted_to|grantee|holder|held_by|agent|app|application|client|delegate|delegated_to|bot|integration|installation)(_id)?$/;
/** References named for who gave the grant, and for who ended it. */
const GIVER = /^(granted_by|grantor|giver|given_by|authori[sz]ed_by|consented_by|issued_by)(_id)?$/;
const ENDER = /^(revoked_by|ended_by|terminated_by|withdrawn_by|deactivated_by)(_id)?$/;
/** A reference named for whom the grant is for, when more than one person or organization is left. */
const PARTY = /^(granted_for|on_behalf_of|for|principal|customer|account|organi[sz]ation|org|tenant|user|subject|resource_owner)(_id)?$/;
const LAST_USED = /^last_(?:used|use|accessed|access)(?:_(?:at|on|time|date))?$/;

/**
 * s248-m03: another system's record of a grant, recognised on structure (#2651), from three facts together: a state enum
 * holding a value in force beside a value that says it was revoked or ended (grantValues), a date-time named for an end
 * (END_NAMED), and a single reference to an agent's or an app's own record that is not named for who asked (the holder).
 * Any one or two of them alone propose nothing: an account is active or deactivated, a token expires, and an agent is
 * referenced everywhere. Together they earn medium; strong stays for a declaration. The record trait binds the holder, the
 * end and, where the source has them, the other seats by their references (who gave it, who asked, who ended it, and the
 * person or organization it is for: the one left, or the one named for it) and when it was last used. Every other Mandate
 * field binds afterwards only to a source field of its own name and type (one of another type is left unbound, so the
 * proposal stays valid); a scope or limits written inside the record (FDX's resources, Stripe's usage_limits) are not
 * read. The references it binds are returned as
 * claimed, so suggestTraits does not guess them again as an owner, a category tree or the record acting for someone.
 */
export function grantRecord(self: string, fields: Record<string, FieldDefinition>, relationships: Edge[], originOf: (field: string) => Origin, stateOrigin: (field: string) => Origin, traitTypes: Record<string, string>): { trait: TraitReference; evidence: Proposal['evidence']; state: string; claimed: string[] } | undefined {
  const names = Object.keys(fields);
  const state = names.find(field => Array.isArray(fields[field].validation?.enum) && grantValues(fields[field].validation!.enum as unknown[]));
  const end = names.find(field => typeOf(fields[field]) === 'datetime' && namedForEnd(field));
  if (!state || !end) return undefined;
  const { inForce, ended } = grantValues(fields[state].validation!.enum as unknown[])!;
  const single = relationships.filter(edge => edge.cardinality === 'many-to-one' && fields[edge.via] && typeOf(fields[edge.via]) === 'string');
  const role = (edge: Edge) => word(edge.via).replace(/_user_id$/, '_id');
  const actors = single.filter(edge => edge.target !== self && actorRecord(edge.target) && !REQUESTER.test(role(edge)));
  const holder = actors.length === 1 ? actors[0] : actors.find(edge => HOLDER.test(role(edge)));
  if (!holder) return undefined;
  const bindings: Record<string, string | null> = { granted_to_id: holder.via, ends_at: end };
  const evidence: Evidence[] = [
    { ...originOf(holder.via), kind: actors.length === 1 ? 'structure' : 'name', reason: actors.length === 1
      ? `${holder.via} references ${holder.target}, an agent's or an app's own record: the one that holds the grant (granted_to_id).`
      : `${holder.via} references ${holder.target}, an agent's or an app's own record, and is named for the one that holds the grant (granted_to_id).` },
    { ...stateOrigin(state), kind: 'structure', reason: `${state} holds a value in force (${inForce}) beside a value that says it was revoked or ended (${ended}): the states of a grant, proposed as its lifecycle (Stateful) unless the source declares another.` },
    { ...originOf(end), kind: 'structure', reason: `${end} is a date-time named for an end: when the grant ends (ends_at). Keep the zone and the words a person reads it in where the source has them.` },
  ];
  const claimed = [holder.via];
  const principals = single.filter(edge => edge.target !== self && principal(edge.target));
  for (const [field, pattern, words] of [['granted_by_id', GIVER, 'who gave the grant'], ['requested_by_id', REQUESTER, 'who asked for it'], ['ended_by_id', ENDER, 'who ended it']] as const) {
    const edge = principals.find(item => !claimed.includes(item.via) && pattern.test(role(item)));
    if (!edge) continue;
    bindings[field] = edge.via; claimed.push(edge.via);
    evidence.push({ ...originOf(edge.via), kind: 'name', reason: `${edge.via} references ${edge.target} and is named for ${words} (${field}).` });
  }
  // An owner or a sponsor answers for the grant (Ownerable); it is never the one the grant is for.
  const rest = principals.filter(edge => !claimed.includes(edge.via) && !/^(owners?|sponsors?)(_id)?$/.test(role(edge)));
  const party = rest.length === 1 ? rest[0] : rest.find(edge => PARTY.test(role(edge)));
  if (party) {
    bindings.granted_for_id = party.via; claimed.push(party.via);
    evidence.push(rest.length === 1
      ? { ...originOf(party.via), kind: 'structure', reason: `${party.via} references ${party.target}, the one person or organization left that the record points at: who the grant is for (granted_for_id); confirm before accepting.` }
      : { ...originOf(party.via), kind: 'name', reason: `${party.via} references ${party.target} and is named for whom the grant is for (granted_for_id).` });
  }
  const unbound = (name: string) => !Object.values(bindings).includes(name) && name !== state;
  const used = names.find(name => unbound(name) && typeOf(fields[name]) === 'datetime' && LAST_USED.test(word(name)));
  if (used) { bindings.last_used_at = used; evidence.push({ ...originOf(used), kind: 'name', reason: `${used} is a date-time named for when the grant was last used (last_used_at).` }); }
  // Bindings are filled by name after this: a same-named field of another type, or one already bound to another of the
  // trait's fields, is left unbound here, so the proposal composes.
  for (const [field, type] of Object.entries(traitTypes)) {
    if (Object.hasOwn(bindings, field) || !fields[field]) continue;
    if (typeOf(fields[field]) !== type.replace(/\?$/, '') || Object.values(bindings).includes(field)) bindings[field] = null;
  }
  return { trait: { name: 'Mandate', parameters: {}, fieldBindings: bindings }, evidence, state, claimed };
}

/** s255-m04 (settled 14): a string field named as a person's id. A scope is never a person: stores use it for anything. */
const PERSON_ID = /^(user_id|person_id|about_id|subject_id)$/;
/** A record a person is named by, a user or a person, as `principal` reads a target's name (not a group or a team). */
const personRecord = (target: string) => { const last = (target.split('.').pop() ?? target).replace(/[^A-Za-z0-9]/g, ''); return [last, last.replace(TECHNICAL, '')].some(candidate => /^(user|person|member|account)s?$/i.test(candidate)); };
/** The free text a memory says. */
const MEMORY_TEXT = /^(memory|content|text|words|body|fact)$/;
/** A field named for how a memory was made. */
const ORIGIN_NAMED = /^(origin|origin_type|provenance|source_type|memory_origin|created_via)$/;
/** A boolean named for a memory that was made rather than said (Mem0's synthesized). */
const MADE_FLAG = /^(is_)?(synthesi[sz]ed|inferred|derived)$/;
/** A reference or id named for the agent whose memory it is. */
const KEEPER = /^(agent|assistant|bot|kept_by)(_id)?$/;
/** A date-time named for when a memory expires. */
const EXPIRES = /^(expires|expires_at|expiry|expiry_at|expiration|expiration_at|expiration_date|valid_until)$/;
/**
 * How a memory was made, read from a source's own value by its words: a value whose words name one of the trait's five
 * reads as that one ("user_stated" is told, "assistant_inferred" inferred, "admin_added" added by someone else); a value
 * whose words name none, or two, maps to nothing and reads "Not known".
 */
const ORIGIN_WORDS: Array<[string, RegExp]> = [
  ['told', /^(told|stated|said|explicit|user|direct)$/],
  ['inferred', /^(inferred|inference|concluded|derived|implicit|assistant|guessed)$/],
  ['combined', /^(combined|synthesi[sz]ed|merged|consolidated|summary)$/],
  ['imported', /^(imported|import|copied|migrated)$/],
  ['added_by_someone_else', /^(added|admin|manual|operator)$/],
];
export function memoryOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const words = word(value).split('_').filter(Boolean);
  const found = new Set(ORIGIN_WORDS.filter(([, pattern]) => words.some(item => pattern.test(item))).map(([origin]) => origin));
  return found.size === 1 ? [...found][0] : undefined;
}

/**
 * s255-m04 (settled 14, G5): a team's own record of what an assistant or an agent keeps about a person, recognised on
 * structure from three facts together: a person (a reference to a person's record, which binds even when the key is a
 * uuid, for this trait only (G6), or a string field named as a person's id), the free text it says, and one signal that it
 * is a memory and not a message (a field named for how it was made whose values map to the trait's, a boolean named for a
 * memory made rather than said, or a key named for the memory that replaced it). Any one or two of them alone propose
 * nothing: a chat table has a person and text and no such signal. Together they earn medium, as Mandate's do, and a person
 * held only as a named string binds no higher; strong stays for a declaration. The trait binds the seats the source has
 * and keeps how it was made: bound to the source's own field, whose values then read as the trait's words where they map
 * (the labels acceptance writes, `semantics`), or to the trait's own field, which reads "Not known" where the source does
 * not say. The person and the agent it binds are returned as claimed, so suggestTraits does not guess them again as an
 * owner; a replacement key it binds is still read by G3, so a declared one is proposed as Supersedable too.
 */
/** The three facts the memory rule reads, as it reads them: the person, the text, and each kind of signal it finds. */
export function memoryFacts(self: string, fields: Record<string, FieldDefinition>, relationships: Edge[]): { personEdge?: Edge; person?: string; text?: string; originField?: string; made?: string; replacement?: string } {
  const names = Object.keys(fields);
  const single = relationships.filter(edge => edge.cardinality === 'many-to-one' && fields[edge.via] && ['string', 'uuid'].includes(typeOf(fields[edge.via])));
  const people = single.filter(edge => edge.target !== self && personRecord(edge.target) && !REQUESTER.test(word(edge.via)));
  const personEdge = people.length === 1 ? people[0] : people.find(edge => PERSON_ID.test(word(edge.via)) || /^(user|person|about|subject)$/.test(word(edge.via)));
  const personNamed = personEdge ? undefined : names.find(field => PERSON_ID.test(word(field)) && typeOf(fields[field]) === 'string' && !Array.isArray(fields[field].validation?.enum));
  const person = personEdge?.via ?? personNamed;
  const text = names.find(field => MEMORY_TEXT.test(word(field)) && typeOf(fields[field]) === 'string' && !Array.isArray(fields[field].validation?.enum) && field !== person);
  const values = (field: string) => (Array.isArray(fields[field].validation?.enum) ? fields[field].validation!.enum! : []) as unknown[];
  const originField = names.find(field => ORIGIN_NAMED.test(word(field)) && typeOf(fields[field]) === 'string' && values(field).some(value => memoryOrigin(value)));
  const made = names.find(field => MADE_FLAG.test(word(field)) && typeOf(fields[field]) === 'boolean');
  const replacement = names.find(field => REPLACED_BY.test(word(field)) && ['string', 'uuid'].includes(typeOf(fields[field])));
  return { ...(personEdge ? { personEdge } : {}), ...(person ? { person } : {}), ...(text ? { text } : {}), ...(originField ? { originField } : {}), ...(made ? { made } : {}), ...(replacement ? { replacement } : {}) };
}

export function memoryRecord(self: string, fields: Record<string, FieldDefinition>, relationships: Edge[], originOf: (field: string) => Origin, traitTypes: Record<string, string>, originLabels: Record<string, string>): { trait: TraitReference; evidence: Proposal['evidence']; claimed: string[]; semantics?: Record<string, SemanticMapping>; mapping?: Array<[string, string | undefined]> } | undefined {
  const names = Object.keys(fields);
  const { personEdge, person, text, originField, made, replacement } = memoryFacts(self, fields, relationships);
  if (!person || !text) return undefined;
  if (!originField && !made && !replacement) return undefined;
  const single = relationships.filter(edge => edge.cardinality === 'many-to-one' && fields[edge.via] && ['string', 'uuid'].includes(typeOf(fields[edge.via])));
  const values = (field: string) => (Array.isArray(fields[field].validation?.enum) ? fields[field].validation!.enum! : []) as unknown[];
  // How it was made binds the source's own field where it has one; where it has none the trait keeps its own field (the
  // draft leaves it out of the bindings), which reads "Not known".
  const bindings: Record<string, string | null> = { about_id: person, words: text, ...(originField ? { origin: originField } : {}) };
  const evidence: Evidence[] = [
    personEdge
      ? { ...originOf(person), kind: 'structure', reason: `${person} references ${personEdge.target}, a person's record: who the memory is about (about_id).` }
      : { ...originOf(person), kind: 'name', reason: `${person} is named for a person's id: who the memory is about (about_id). It is held as a string, not a reference, so this proposal grades no higher than medium.` },
    { ...originOf(text), kind: 'name', reason: `${text} is free text named for what the memory says (words).` },
  ];
  const claimed = [person];
  let mapping: Array<[string, string | undefined]> | undefined;
  let semantics: Record<string, SemanticMapping> | undefined;
  if (originField) {
    mapping = values(originField).map(value => [String(value), memoryOrigin(value)]);
    const said = mapping.map(([value, origin]) => `${value} as ${origin ?? 'Not known'}`).join(', ');
    evidence.push({ ...originOf(originField), kind: 'structure', reason: `${originField} is named for how the memory was made, and its values map by their words to the trait's (${said}): how it was made (origin). A value that maps to none reads "Not known".` });
    semantics = { [originField]: { semantic_type: 'remembered.origin', token_mapping: 'tokenMap(text.body.*)', ui_hints: {
      enumLabels: Object.fromEntries(mapping.filter(([, origin]) => origin).map(([value, origin]) => [value, originLabels[origin!] ?? origin!])),
      valueLabels: { '': 'Not known', ...Object.fromEntries(mapping.filter(([, origin]) => !origin).map(([value]) => [value, 'Not known'])) },
    } } };
  }
  if (made) evidence.push({ ...originOf(made), kind: 'name', reason: `${made} is a boolean named for a memory made rather than said: a memory, not a message. It is not how it was made, which ${originField ? `${originField} holds` : 'reads "Not known"'}.` });
  if (replacement) {
    // A declared self-reference is proposed as Supersedable too (G3); the team accepts the one that fits.
    bindings.replaced_by_id = replacement;
    evidence.push({ ...originOf(replacement), kind: 'name', reason: `${replacement} is named for the memory that replaced this one (replaced_by_id).` });
  }
  const agent = single.find(edge => edge.target !== self && actorRecord(edge.target) && !claimed.includes(edge.via))?.via
    ?? names.find(field => KEEPER.test(word(field)) && ['string', 'uuid'].includes(typeOf(fields[field])) && !claimed.includes(field));
  if (agent) { bindings.kept_by_id = agent; claimed.push(agent); evidence.push({ ...originOf(agent), kind: 'name', reason: `${agent} names the agent whose memory it is (kept_by_id).` }); }
  const expires = names.find(field => EXPIRES.test(word(field)) && typeOf(fields[field]) === 'datetime');
  if (expires) { bindings.expires_at = expires; evidence.push({ ...originOf(expires), kind: 'name', reason: `${expires} is a date-time named for when the memory expires (expires_at).` }); }
  // Bindings are filled by name after this: a same-named field of another type, or one already bound to another of the
  // trait's fields, is left unbound here, so the proposal composes.
  for (const [field, type] of Object.entries(traitTypes)) {
    if (Object.hasOwn(bindings, field) || !fields[field] || field === 'origin' && !originField) continue;
    if (typeOf(fields[field]) !== type.replace(/\?$/, '') || Object.values(bindings).includes(field)) bindings[field] = null;
  }
  return { trait: { name: 'Remembered', parameters: {}, fieldBindings: bindings }, evidence, claimed, ...(semantics ? { semantics, mapping } : {}) };
}
