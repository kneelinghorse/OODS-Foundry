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
