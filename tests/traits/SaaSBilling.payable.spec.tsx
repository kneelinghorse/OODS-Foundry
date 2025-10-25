// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/traits/Statusable/contrib/statusable-contributions.js', () => ({
  registerStatusableContributions: vi.fn(),
}));
vi.mock('../../src/traits/Actionable/contrib/actionable-contributions.js', () => ({
  registerActionableContributions: vi.fn(),
}));
vi.mock('../../src/traits/Auditable/contrib/auditable-contributions.js', () => ({
  registerAuditableContributions: vi.fn(),
}));

import { registerStatusableContributions } from '../../src/traits/Statusable/contrib/statusable-contributions.js';
import { registerActionableContributions } from '../../src/traits/Actionable/contrib/actionable-contributions.js';
import { registerAuditableContributions } from '../../src/traits/Auditable/contrib/auditable-contributions.js';
import type { InvoicePayableViewData } from '../../src/objects/invoice/types.js';
import { createInvoicePayableTraitAdapter } from '../../src/traits/SaaSBilling/Payable/view.js';

const baseData: InvoicePayableViewData = Object.freeze({
  invoice_id: 'inv-123',
  invoice_number: 'INV-123',
  provider: 'stripe',
  issued_at: '2024-12-01T00:00:00Z',
  total_minor: 32500,
  currency: 'USD',
});

const richData: InvoicePayableViewData = {
  ...baseData,
  subscription_id: 'sub-42',
  provider_invoice_id: 'stripe-987',
  provider_status: 'processing',
  status_note: 'Awaiting confirmation',
  due_at: '2024-12-15T00:00:00Z',
  paid_at: null,
  balance_minor: 12500,
  payment_terms: 'net 30',
  collection_state: 'escalated',
  last_reminder_at: '2024-12-10T13:45:00Z',
  aging_bucket_days: 7,
  memo: 'Annual renewal',
  billing_contact_name: 'Jane Doe',
  billing_contact_email: 'jane@example.test',
  collection_owner: 'Alex Smith',
  collection_owner_email: 'alex@example.test',
  tax_minor: 2500,
  discount_minor: 1200,
  subtotal_minor: 30000,
  line_items: [
    {
      id: 'li-1',
      description: 'Pro Plan',
      product_code: 'pro-plan',
      plan_interval: 'monthly',
      quantity: 2,
      unit_amount_minor: 15000,
      amount_minor: 30000,
    },
  ],
  attachments: null,
  portal_url: 'https://billing.example.test/invoices/inv-123',
  dunning_step: 'final',
  payment_source: 'card',
  risk_segment: 'medium',
  health_score: 78,
  collection_channels: ['email', 'sms'],
  status: 'open',
};

const fallbackData: InvoicePayableViewData = {
  ...baseData,
  issued_at: '' as unknown as string,
  due_at: null as unknown as string | null,
  total_minor: null as unknown as number,
  balance_minor: null,
  last_reminder_at: null,
  aging_bucket_days: null,
  memo: null,
  billing_contact_name: null,
  billing_contact_email: null,
  collection_channels: [],
  line_items: [],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('Invoice payable trait view', () => {
  it('registers shared contributions and returns prioritized extensions', () => {
    const adapter = createInvoicePayableTraitAdapter({
      traitId: 'CustomPayable',
      contexts: ['detail', 'timeline'],
      headerPriority: 12,
      summaryPriority: 22,
      lineItemsPriority: 32,
      contextPanelPriority: 42,
    });

    expect(registerStatusableContributions).toHaveBeenCalledWith({
      traitId: 'CustomPayable',
      options: expect.objectContaining({
        statusDomain: 'invoice',
        summaryTitle: 'Collections summary',
      }),
      contexts: ['detail', 'timeline'],
    });
    expect(registerActionableContributions).toHaveBeenCalledWith({
      traitId: 'CustomPayable',
      contexts: ['detail', 'timeline'],
    });
    expect(registerAuditableContributions).toHaveBeenCalledWith('CustomPayable');

    const extensions = adapter.view?.() ?? [];
    expect(extensions).toHaveLength(4);
    expect(extensions.map((ext) => [ext.id, ext.priority])).toEqual([
      ['billing:invoice:page-header', 12],
      ['billing:invoice:summary', 22],
      ['billing:invoice:line-items', 32],
      ['billing:invoice:collections-notes', 42],
    ]);
  });

  it('renders page header metadata and summary metrics when data is present', () => {
    const adapter = createInvoicePayableTraitAdapter();
    const [header, summary] = adapter.view?.() ?? [];

    const headerView = header?.render({ data: richData } as any);
    const summaryView = summary?.render({ data: richData } as any);

    const headerResult = render(<>{headerView}</>);
    expect(headerResult.container.textContent).toContain('Invoice INV-123');
    expect(headerResult.container.textContent).toContain('Stripe');
    expect(headerResult.container.textContent).toContain('Open balance');

    const summaryResult = render(<>{summaryView}</>);
    expect(summaryResult.container.textContent).toContain('Collections overview');
    expect(summaryResult.container.textContent).toContain('Billing contact');
    expect(summaryResult.container.textContent).toContain('Provider status');
  });

  it('falls back to placeholder copy when metrics and line items are missing', () => {
    const adapter = createInvoicePayableTraitAdapter();
    const [, summary, lineItems] = adapter.view?.() ?? [];

    const summaryFallback = summary?.render({ data: fallbackData } as any);
    const lineItemFallback = lineItems?.render({ data: fallbackData } as any);

    const summaryResult = render(<>{summaryFallback}</>);
    expect(summaryResult.container.textContent).toContain(
      'Collections metadata will populate once the invoice is issued.'
    );

    const lineItemResult = render(<>{lineItemFallback}</>);
    expect(lineItemResult.container.textContent).toContain(
      'Line items will surface after the provider finalizes the invoice.'
    );
  });

  it('renders detailed line items and context panel content', () => {
    const adapter = createInvoicePayableTraitAdapter();
    const [, , lineItems, contextPanel] = adapter.view?.() ?? [];

    const lineItemsView = lineItems?.render({ data: richData } as any);
    const contextView = contextPanel?.render({ data: richData } as any);

    const lineItemsResult = render(<>{lineItemsView}</>);
    expect(lineItemsResult.container.textContent).toContain('Pro Plan');
    expect(lineItemsResult.container.textContent).toContain('Unit price');
    expect(lineItemsResult.container.textContent).toContain('$150.00');

    const contextResult = render(<>{contextView}</>);
    expect(contextResult.container.textContent).toContain('Playbook context');
    expect(contextResult.container.textContent).toContain('Open invoice portal');
    expect(contextResult.container.textContent).toContain('Collection channels');
  });
});
