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
 * s248-m01: Stateful's state_history also documents the optional grant pointer and name a recorded change can carry
 * (grant_id, grant_name), after Sprint 247's task paragraph. Every other key is held to the baseline exactly.
 */
export const S248_STATE_HISTORY_GRANT = '\nA change made under a grant, the standing yes an actor acts under for a person or organization, can also say\nwhich grant it was. Both optional; the id stays in the record\'s data, a pointer and not a link, and an entry\nwithout them renders as it always has:\n  - grant_id: string (the Grant record the change was made under)\n  - grant_name: string (the grant, as shown: "Resend returned transfers")\nStatusTimeline names the grant after any approval and before the task: "Billing Agent for Tidewater Co-op \u00b7\ngrant: Resend returned transfers".\n';

/** s248-m02: Relationship's delegation type is the link alone; a grant with its terms is a Grant record. */
const S248_RELATIONSHIP_TYPE = {
  before: S244_RELATIONSHIP_TYPE.after,
  after: 'Semantic type describing the edge between the source and target; a delegation is the link alone, from the person or organization acted for (the source) to the actor acting for them (the target), and a grant with its terms is a Grant record.',
};

/**
 * A baseline field as Sprint 248 declares it: Sprint 247's, with state_history's description gaining the grant paragraph
 * (m01) and Relationship's delegation type describing the link alone (m02).
 */
export function s248Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s247Field(object, name, field);
  if (name === 'state_history' && typeof declared.description === 'string') return { ...declared, description: declared.description + S248_STATE_HISTORY_GRANT };
  if (object === 'Relationship' && name === 'relationship_type' && declared.description === S248_RELATIONSHIP_TYPE.before) return { ...declared, description: S248_RELATIONSHIP_TYPE.after };
  return declared;
}

/**
 * s249-m03 (Interface 18): allowed_transitions says a generated StatusSelector reads the declared order (the current
 * state and the moves it allows), where it said the selector offered every state. Every other key is held exactly.
 */
const S249_ALLOWED_TRANSITIONS = {
  before: S247_ALLOWED_TRANSITIONS.after,
  after: 'Materialized list of the next states the product allows from the current status, written\nby the product from the transitionRules parameter. When transitionRules is null (open model),\nthis contains all states except the current one. The detail page\'s StatusTimeline lists it\nwhen the record holds it. A generated StatusSelector reads transitionRules instead: it offers the\ncurrent state and the moves the order allows (every state where no order is declared).\n',
};

/**
 * s249-m04 (Interface 13): User's timezone no longer says screens render in it; they show UTC and say so. s249-m05 (the
 * fresh read): and a date-time input does not say its zone yet.
 */
const S249_USER_TIMEZONE = {
  before: 'Preferred timezone applied when rendering timestamps.',
  after: "The person's preferred time zone, kept for your product. Screens show times in UTC, and a shown date-time says so; a date-time input does not yet.",
};

/** s250-m04 (next step 1887, item 1): a date-time input's label says UTC, so User's timezone description says so. */
const S250_USER_TIMEZONE = {
  before: S249_USER_TIMEZONE.after,
  after: "The person's preferred time zone, kept for your product. Screens show times in UTC, and a shown date-time says so, as a date-time input's label does.",
};

/**
 * A baseline field as Sprint 249 declares it: Sprint 248's, with allowed_transitions' revised description (m03) and User's
 * timezone description (m04).
 */
export function s249Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s248Field(object, name, field);
  if (name === 'allowed_transitions' && declared.description === S249_ALLOWED_TRANSITIONS.before) return { ...declared, description: S249_ALLOWED_TRANSITIONS.after };
  if (object === 'User' && name === 'timezone' && declared.description === S249_USER_TIMEZONE.before) return { ...declared, description: S249_USER_TIMEZONE.after };
  return declared;
}

/** A baseline field as Sprint 250 declares it: Sprint 249's, with User's timezone description saying the input's label says UTC. */
export function s250Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s249Field(object, name, field);
  if (object === 'User' && name === 'timezone' && declared.description === S250_USER_TIMEZONE.before) return { ...declared, description: S250_USER_TIMEZONE.after };
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

/** Sprint 251 shows the authored region abbreviations on Organization screens. */
export function s251Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s250Field(object, name, field);
  if (object === 'Organization' && name === 'data_residency') {
    return { ...declared, semanticType: 'organization.data_residency', enumLabels: { us: 'US', eu: 'EU', apac: 'APAC', latam: 'LATAM' } };
  }
  return declared;
}

/** The account tier groups subscriptions; each linked subscription supplies its own plan. */
export function s254Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s251Field(object, name, field);
  if (object === 'Organization' && name === 'plan_tier' && declared.description === 'Billing plan currently assigned to the organization.') {
    return { ...declared, displayLabel: 'Account tier',
      description: "The account's tier, coarser than its plan: free with no paid plan, growth on a paid plan below Enterprise, enterprise on Enterprise. Its subscriptions name the plan." };
  }
  return declared;
}

/** s255-m03 (settled 15 e): Organization's billing status describes itself in words for the people who read it on the form. */
export function s255Field<T extends Record<string, unknown>>(object: string, name: string, field: T): T {
  const declared = s254Field(object, name, field);
  if (object === 'Organization' && name === 'billing_status' && typeof declared.description === 'string' && declared.description.startsWith('Coarse account-level financial standing used by the billing subsystem.')) {
    return { ...declared, description: "The account's standing with billing, coarser than a subscription's status: good standing, past due, unpaid or suspended. Each subscription keeps its own status." };
  }
  return declared;
}
