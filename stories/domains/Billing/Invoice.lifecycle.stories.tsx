/**
 * Invoice Lifecycle Stories
 * 
 * Demonstrates the 5-state invoice lifecycle with transitions
 * and visual representation of state machines.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  InvoiceStateMachine,
  type InvoiceState,
  isCollectible,
  isFinalized,
} from '../../../src/domain/billing/states';
import {
  getStateLabel,
  getStateSeverity,
  getAvailableInvoiceActions,
  canVoidInvoice,
} from '../../../src/utils/billing/state-guards';

interface InvoiceLifecycleProps {
  state: InvoiceState;
}

/**
 * Visual representation of invoice lifecycle
 */
const InvoiceLifecycle: React.FC<InvoiceLifecycleProps> = ({ state }) => {
  const severity = getStateSeverity(state);
  const label = getStateLabel(state);
  const actions = getAvailableInvoiceActions(state);
  const validTransitions = InvoiceStateMachine.getValidTransitions(state);

  const severityColorMap: Record<typeof severity, string> = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '600px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>
          Current State
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${severityColorMap[severity]}`}>
            {label}
          </span>
          <div style={{ fontSize: '0.875rem', color: 'var(--sys-color-text-secondary)' }}>
            {isCollectible(state) && '💵 Collectible'}
            {isFinalized(state) && '✓ Finalized'}
            {!isFinalized(state) && '📝 Editable'}
            {canVoidInvoice(state) && ' • Can Void'}
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>
            Available Actions
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {actions.map((action) => (
              <div
                key={action}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--sys-color-surface-secondary)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      {validTransitions.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>
            Valid Transitions
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {validTransitions.map((event) => {
              const description = InvoiceStateMachine.getTransitionDescription(state, event);
              return (
                <li
                  key={event}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--sys-color-surface-tertiary)',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                  }}
                >
                  <code style={{ fontWeight: 600 }}>{event}</code>
                  {description && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--sys-color-text-secondary)', marginTop: '0.25rem' }}>
                      {description}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {validTransitions.length === 0 && (
        <div style={{ padding: '1rem', background: 'var(--sys-color-surface-tertiary)', borderRadius: '4px' }}>
          <em style={{ color: 'var(--sys-color-text-secondary)' }}>
            No transitions available from this state
          </em>
        </div>
      )}
    </div>
  );
};

const meta: Meta<typeof InvoiceLifecycle> = {
  title: 'Domains/Billing/Invoice Lifecycle',
  component: InvoiceLifecycle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
## Invoice State Machine (5-state model)

The canonical invoice lifecycle models the journey from draft through payment or void:

### States

- **draft**: Uncommitted invoice, still editable
- **posted**: Finalized and sent to customer
- **paid**: Fully paid and closed
- **past_due**: Overdue with outstanding balance
- **void**: Cancelled or voided

### Transition Rules

1. **Draft → Posted**: Finalize and send invoice
2. **Posted → Paid**: Invoice paid in full
3. **Posted → Past Due**: Invoice becomes overdue
4. **Past Due → Paid**: Overdue invoice paid
5. **Any → Void**: Invoice can be voided from most states (except paid/void)

### Business Logic

- Only **draft** invoices are editable
- **Posted** and **past_due** invoices are collectible
- **Paid** and **void** invoices are terminal
- Voiding requires invoice not be paid or already void
        `,
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: [
        'draft',
        'posted',
        'paid',
        'past_due',
        'void',
      ] as InvoiceState[],
      description: 'Current invoice state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceLifecycle>;

/**
 * Draft invoice - uncommitted, editable
 */
export const Draft: Story = {
  name: 'Detail – Draft state review',
  args: {
    state: 'draft',
  },
};

/**
 * Posted invoice - finalized and sent
 */
export const Posted: Story = {
  name: 'List – Posted status summary',
  args: {
    state: 'posted',
  },
};

/**
 * Paid invoice - fully paid
 */
export const Paid: Story = {
  args: {
    state: 'paid',
  },
};

/**
 * Past due invoice - overdue
 */
export const PastDue: Story = {
  name: 'Timeline – Past due escalation',
  args: {
    state: 'past_due',
  },
};

/**
 * Void invoice - cancelled
 */
export const Void: Story = {
  name: 'Form – Void authorization',
  args: {
    state: 'void',
  },
};

/**
 * All states overview - demonstrates full lifecycle
 */
export const AllStates: Story = {
  render: () => {
    const allStates: InvoiceState[] = [
      'draft',
      'posted',
      'paid',
      'past_due',
      'void',
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {allStates.map((state) => (
          <div key={state} style={{ border: '1px solid var(--sys-color-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <InvoiceLifecycle state={state} />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * State transition flow diagram
 */
export const TransitionFlow: Story = {
  render: () => {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '800px' }}>
        <h3 style={{ marginBottom: '1rem' }}>Invoice Lifecycle Flow</h3>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            padding: '1rem',
            background: 'var(--sys-color-surface-secondary)',
            borderRadius: '8px',
            whiteSpace: 'pre',
          }}
        >
          {`
┌──────────┐
│  draft   │ ◄─── Editable
└────┬─────┘
     │ finalize
     ▼
┌──────────┐
│ posted   │ ◄─── Collectible
└────┬─────┘
     │
     ├─────────────┐
     │             │
     │ mark_paid   │ mark_overdue
     ▼             ▼
┌──────────┐  ┌──────────┐
│   paid   │  │ past_due │ ◄─── Collectible
└──────────┘  └────┬─────┘
                   │
                   │ payment_received
                   └─────────►

     ┌─────────────┼─────────────┐
     │             │             │
     │ void_       │ void_       │ void_
     │ invoice     │ invoice     │ invoice
     ▼             ▼             ▼
              ┌──────────┐
              │   void   │
              └──────────┘
          `}
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--sys-color-text-secondary)' }}>
          <strong>Legend:</strong> Arrows show valid state transitions triggered by events.
          Most states (except paid and void) can transition to void state.
        </div>
      </div>
    );
  },
};
