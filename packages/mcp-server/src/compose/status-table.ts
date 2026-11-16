import { STATUS_DOMAINS } from '@oods/component-contracts';
import type { UiElement, UiSchema } from '../schemas/generated.js';

/**
 * s222-m03 (#2502 ruling 13): a status badge reads its tones from the table its field's semantics name. A field typed
 * billing.<domain>.status whose domain the status registry holds (a subscription's, an invoice's) reads that table; every
 * other status field reads the lifecycle table, so a User's "Active" is not described as a paid subscription and a
 * settled payment is not grey. A domain the schema already names stays.
 */
export function nameStatusTables(schema: UiSchema): void {
  const fields = schema.objectSchema ?? {};
  const walk = (node: UiElement): void => {
    const field = node.component === 'StatusBadge' ? node.props?.statusField ?? node.props?.field : undefined;
    if (typeof field === 'string' && fields[field] && node.props?.domain === undefined) {
      node.props = { ...node.props, domain: statusTableOf(fields[field]!.semanticType) };
    }
    node.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
}

/**
 * The table a status field's badge reads, from its semantic type: a billing.<domain>.status the status registry holds
 * names that table, and every other status field reads the lifecycle table. A related list's rows read their object's
 * table by the same rule (compose/related-records.ts), so a grant row's "Active" is not described as a paid subscription.
 */
export function statusTableOf(semanticType: string | undefined): string {
  const named = /^billing\.([a-z_]+)\.status$/.exec(semanticType ?? '')?.[1];
  return named && STATUS_DOMAINS.includes(named) ? named : 'lifecycle';
}
