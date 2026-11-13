/**
 * s222-m03 (#2502 ruling 14): the field contract the public objects' authored samples add to the Sprint 188 baseline
 * schemas. Each object names every reference and owner its samples set (a new string field holding the name, bound as
 * the reference's displayLabelField) and marks the field that summarises a record under its name in lists (text.summary;
 * Transaction adds its statement description for that, and Usage marks its meter as its label so the new customer name
 * cannot outrank it as the record's title). Nothing else in
 * a baseline field changes; the historical-contract specs hold every other key to the baseline exactly.
 */
export const S222_ADDED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Organization: ['owner_name'],
  Relationship: ['source_name', 'target_name', 'owner_name'],
  Transaction: ['user_name', 'organization_name', 'description'],
  Article: ['author_name'],
  Plan: ['owner_name'],
  // s223-m01 (#2527 ruling 4): Usage's samples are billed in their subscription's currency, so Usage declares one.
  Usage: ['customer_name', 'currency'],
};

/** The semantic type each changed field now declares (object, then field). */
const SEMANTIC_TYPES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  User: { description: 'text.summary' },
  Organization: { description: 'text.summary' },
  Product: { description: 'text.summary' },
  Relationship: { description: 'text.summary', source_id: 'graph.relationship.source_id', target_id: 'graph.relationship.target_id' },
  Article: { description: 'text.summary' },
  Media: { description: 'text.summary' },
  Subscription: { customer_name: 'text.summary' },
  Invoice: { billing_contact_name: 'text.summary' },
  Plan: { product_family: 'text.summary' },
  Usage: { meter_name: 'text.label' },
};

/** The field holding the name each reference now shows (object, then reference field). */
const REFERENCE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Organization: { owner_id: 'owner_name' },
  Relationship: { owner_id: 'owner_name', source_id: 'source_name', target_id: 'target_name' },
  Transaction: { user_id: 'user_name', organization_id: 'organization_name' },
  Article: { author_id: 'author_name' },
  Plan: { owner_id: 'owner_name' },
};

/** A Sprint 188 baseline field as the s222 samples declare it: the baseline plus its new semantic type and label field. */
export function s222Field<T extends Record<string, unknown>>(object: string, name: string, original: T): T {
  const semanticType = SEMANTIC_TYPES[object]?.[name];
  const displayLabelField = REFERENCE_LABELS[object]?.[name];
  return { ...original, ...(semanticType ? { semanticType } : {}), ...(displayLabelField ? { displayLabelField } : {}) };
}

/**
 * s244-m01 (#2832): Stateful's state_history documents the optional names every recorded change can carry (who acted,
 * who it acted for, who approved it). It is the one change this sprint makes to a Sprint 188 baseline field: the text
 * below is appended to the field's description, and every other key is held to the baseline exactly.
 */
export const S244_STATE_HISTORY_NAMES = '\nEvery recorded change can name who acted, who it acted for and who approved it. All optional,\nfollowing Relationship\'s source_id/source_name pattern; only a *_name names a party, and an entry that names\nno one renders as it always has:\n  - actor_name: string (who acted, as shown: "Billing Agent")\n  - actor_kind: string (person, agent or system: the Actor trait\'s kinds)\n  - on_behalf_of_name / on_behalf_of_id: string (the person or organization it acted for)\n  - approved_by_name / approved_by_id: string (who approved the change, when someone did)\nStatusTimeline then reads "Billing Agent for Tidewater Co-op \u00b7 approved by Ruth Adeyemi".\n';

/** s244-m01 (#2833): Authable's membership names a user or any other actor, exactly one of the two. */
const S244_MEMBERSHIP = {
  before: 'SaaS membership triple (user_id, organization_id, role_id) with UNIQUE constraint (TABLE 4).',
  after: 'SaaS membership triple (member, organization_id, role_id) with UNIQUE constraint (TABLE 4). The member is a user (user_id) or any other actor (actor_id with actor_kind, such as an agent), exactly one of the two.',
};

/** s244-m01 (#2834): Relationship's type gains delegation, a grant from the person or organization acted for to the actor. */
const S244_RELATIONSHIP_TYPE = {
  before: 'Semantic type describing the edge between the source and target.',
  after: 'Semantic type describing the edge between the source and target; a delegation is a grant from the person or organization acted for (the source) to the actor acting for them (the target).',
};

/**
 * A baseline field as Sprint 244 declares it: state_history's description gains the names paragraph, membership_records'
 * description names any actor as a member, and Relationship's relationship_type gains delegation; nothing else moves.
 */
export function s244Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  if (name === 'state_history' && typeof field.description === 'string') return { ...field, description: field.description + S244_STATE_HISTORY_NAMES };
  if (name === 'membership_records' && field.description === S244_MEMBERSHIP.before) return { ...field, description: S244_MEMBERSHIP.after };
  if (object === 'Relationship' && name === 'relationship_type' && field.description === S244_RELATIONSHIP_TYPE.before && Array.isArray(field.enum)) {
    return { ...field, description: S244_RELATIONSHIP_TYPE.after, enum: [...field.enum, 'delegation'] };
  }
  return field;
}

/**
 * s245-m01: Stateful's state_history also documents the optional approval pointer and level a recorded change can carry
 * (approval_id, approval_level). The paragraph below follows Sprint 244's; every other key is held to the baseline exactly.
 */
export const S245_STATE_HISTORY_APPROVAL = '\nA change someone approved can also say which approval it belongs to and what level of yes it was. Both\noptional; the id stays in the record\'s data, a pointer and not a link, and an entry without them renders as it\nalways has:\n  - approval_id: string (the Approval record the yes is kept in)\n  - approval_level: string (the level of yes, one of the levels the product declares: \"approval\")\nStatusTimeline then reads \"Billing Agent for Tidewater Co-op \u00b7 approved by Ruth Adeyemi (level: Approval)\".\n';

/** A baseline field as Sprint 245 declares it: Sprint 244's, with state_history's description gaining the approval paragraph. */
export function s245Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s244Field(object, name, field);
  return name === 'state_history' && typeof declared.description === 'string' ? { ...declared, description: declared.description + S245_STATE_HISTORY_APPROVAL } : declared;
}

/**
 * s247-m01: Stateful's state_history also documents the optional task pointer and name a recorded change can carry
 * (task_id, task_name), after Sprint 245's approval paragraph; and allowed_transitions says what reads it (the detail page's
 * StatusTimeline) and that a generated StatusSelector offers every state, where it said a selector disabled options and a
 * badge showed paths, which none does (next steps 1863 and 1866). Every other key is held to the baseline exactly.
 */
export const S247_STATE_HISTORY_TASK = '\nA change made as part of a task can also say which task it was. Both optional; the id stays in the record\'s\ndata, a pointer and not a link, and an entry without them renders as it always has:\n  - task_id: string (the Task record the change was made under)\n  - task_name: string (the task, as shown: "Get INV-2026-0155 paid")\nStatusTimeline then reads "\u2026 \u00b7 approved by Ruth Adeyemi (level: Approval) \u00b7 task: Get INV-2026-0155 paid".\n';
const S247_ALLOWED_TRANSITIONS = {
  before: 'Materialized list of valid next states from the current status, computed from the\ntransitionRules parameter. When transitionRules is null (open model), this contains\nall states except the current one. Used by StatusSelector to disable invalid options\nand by StatusBadge to indicate available paths.\n',
  after: 'Materialized list of the next states the product allows from the current status, written\nby the product from the transitionRules parameter. When transitionRules is null (open model),\nthis contains all states except the current one. The detail page\'s StatusTimeline lists it\nwhen the record holds it; a generated StatusSelector offers every state whatever it holds.\n',
};

/** A baseline field as Sprint 247 declares it: Sprint 245's, with the task paragraph and allowed_transitions' corrected description. */
export function s247Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s245Field(object, name, field);
  if (name === 'state_history' && typeof declared.description === 'string') return { ...declared, description: declared.description + S247_STATE_HISTORY_TASK };
  if (name === 'allowed_transitions' && declared.description === S247_ALLOWED_TRANSITIONS.before) return { ...declared, description: S247_ALLOWED_TRANSITIONS.after };
  return declared;
}

/**
 * s245-m02: Transaction and Article compose Approvable, whose two outcome fields join the composed schema after the
 * traits' fields and before the object's own. Both are read-only, so a form leaves them out. Every other key of every
 * baseline field is held to the baseline exactly.
 */
export function s245AddedFields(object: string, context: string): string[] {
  return ['Transaction', 'Article'].includes(object) && context !== 'form' ? ['approval_state', 'approval_summary'] : [];
}
