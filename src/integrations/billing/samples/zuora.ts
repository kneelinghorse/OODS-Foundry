/**
 * Zuora sample payloads used for billing translation demos.
 *
 * Provides representative objects from Zuora's subscription and invoice APIs.
 */

export const zuoraSamples = {
  subscription: {
    Id: 'zuora-sub-123',
    Status: 'Active',
    AccountId: 'zuora-acct-456',
    Name: 'Enterprise Subscription',
    TermStartDate: '2024-01-01',
    TermEndDate: '2024-12-31',
    CreatedDate: '2024-01-01T00:00:00Z',
    UpdatedDate: '2024-01-01T00:00:00Z',
    AutoRenew: 'true',
    RatePlans: [
      {
        ProductRatePlanId: 'rp-123',
        ProductRatePlanName: 'Enterprise Plan',
        RatePlanCharges: [
          {
            Id: 'rpc-456',
            Price: 299.0,
            Currency: 'USD',
            BillingPeriod: 'Annual',
          },
        ],
      },
    ],
  },
  invoice: {
    Id: 'zuora-inv-123',
    AccountId: 'zuora-acct-456',
    Status: 'Posted',
    InvoiceNumber: 'ZU-001',
    InvoiceDate: '2024-01-01',
    DueDate: '2024-01-31',
    Amount: 299.0,
    Balance: 299.0,
    Currency: 'USD',
    TaxAmount: 29.0,
    CreatedDate: '2024-01-01T00:00:00Z',
    UpdatedDate: '2024-01-01T00:00:00Z',
    InvoiceItems: [
      {
        Id: 'ii-789',
        ServiceStartDate: '2024-01-01',
        Quantity: 1,
        ChargeAmount: 270.0,
        UnitPrice: 270.0,
        ProductName: 'Enterprise Plan',
      },
    ],
    InvoiceURL: 'https://zuora.com/invoice/123',
  },
} as const;

export type ZuoraSamples = typeof zuoraSamples;

