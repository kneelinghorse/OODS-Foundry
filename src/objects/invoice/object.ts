import type { ObjectSpec } from '../../types/render-context.js';
import { createTaggableTraitAdapter } from '../../traits/Taggable/view.js';
import { createTimestampableTraitAdapter } from '../../traits/Timestampable/view.js';
import {
  createInvoicePayableTraitAdapter,
  createInvoiceRefundableTraitAdapter,
} from '../../traits/SaaSBilling/index.js';
import type { InvoiceRecord } from './types.js';

export interface CreateInvoiceObjectOptions {
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
  readonly includeRefundable?: boolean;
  readonly includeTaggable?: boolean;
}

export type InvoiceObjectSpec = ObjectSpec<InvoiceRecord>;

export function createInvoiceObjectSpec(
  options: CreateInvoiceObjectOptions = {}
): InvoiceObjectSpec {
  const {
    id = 'object:Invoice',
    name = 'Invoice',
    version = '1.0.0',
    includeRefundable = true,
    includeTaggable = true,
  } = options;

  const traits = [
    createInvoicePayableTraitAdapter<InvoiceRecord>({
      traitId: 'SaaSBillingPayable',
      headerId: 'billing:invoice:page-header',
    }),
    createTimestampableTraitAdapter<InvoiceRecord>({
      traitId: 'lifecycle/Timestampable',
      headerId: 'billing:invoice:page-header',
    }),
  ];

  if (includeRefundable) {
    traits.push(
      createInvoiceRefundableTraitAdapter<InvoiceRecord>({
        traitId: 'SaaSBillingRefundable',
      })
    );
  }

  if (includeTaggable) {
    traits.push(
      createTaggableTraitAdapter<InvoiceRecord>({
        traitId: 'SaaSBillingTaggable',
        maxVisibleTags: 6,
      })
    );
  }

  return Object.freeze({
    id,
    name,
    version,
    traits,
    metadata: {
      category: 'billing',
      status: 'beta',
    },
  });
}

export const InvoiceObject = Object.freeze(createInvoiceObjectSpec());
