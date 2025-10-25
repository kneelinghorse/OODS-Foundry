// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { InvoiceRefundableViewData } from '../../src/objects/invoice/types.js';
import { createInvoiceRefundableTraitAdapter } from '../../src/traits/SaaSBilling/Refundable/view.js';

const fullRefundData: InvoiceRefundableViewData = {
  refundable_until: '2024-12-20T00:00:00Z',
  refund_policy_url: 'https://billing.example.test/policy',
  total_refunded_minor: 5600,
  credit_memo_balance_minor: 3200,
  credit_memo_type: 'courtesy',
  last_refund_at: '2024-11-30T09:30:00Z',
  requires_manager_approval: true,
  notes: 'Customer requested manual override after outage.',
  currency: 'USD',
};

const minimalRefundData: InvoiceRefundableViewData = {};

describe('Invoice refundable trait view', () => {
  it('renders refund readiness summary with rich data', () => {
    const adapter = createInvoiceRefundableTraitAdapter({
      traitId: 'RefundableCustom',
      summaryPriority: 60,
      contextPriority: 40,
    });

    const [summary, panel] = adapter.view?.() ?? [];
    expect(summary?.priority).toBe(60);
    expect(panel?.priority).toBe(40);

    const summaryResult = render(<>{summary?.render({ data: fullRefundData } as any)}</>);
    expect(summaryResult.container.textContent).toContain('Refund readiness');
    expect(summaryResult.container.textContent).toContain('Manager approval required');
    expect(summaryResult.container.textContent).toContain('Refund window');
    expect(summaryResult.container.textContent).toContain('Credit memo balance');
    expect(summaryResult.container.textContent).toContain('Credit memo type');

    const panelResult = render(<>{panel?.render({ data: fullRefundData } as any)}</>);
    expect(panelResult.container.textContent).toContain('Refund policy');
    expect(panelResult.container.textContent).toContain('View policy');
    expect(panelResult.container.textContent).toContain('Customer requested manual override');
  });

  it('falls back to defaults when refund metadata is missing', () => {
    const adapter = createInvoiceRefundableTraitAdapter();
    const [summary, panel] = adapter.view?.() ?? [];

    const summaryResult = render(<>{summary?.render({ data: minimalRefundData } as any)}</>);
    expect(summaryResult.container.textContent).toContain('Policy governed');
    expect(summaryResult.container.textContent).toContain('No refunds issued');
    expect(summaryResult.container.textContent).toContain('$0.00');

    const panelResult = render(<>{panel?.render({ data: minimalRefundData } as any)}</>);
    expect(panelResult.container.textContent).toContain('Policy link unavailable');
  });
});
