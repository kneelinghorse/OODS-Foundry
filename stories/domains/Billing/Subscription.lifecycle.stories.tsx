/**
 * Subscription Lifecycle Stories
 * 
 * Demonstrates the 7-state subscription lifecycle with transitions,
 * guards, and visual representation of state machines.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  SubscriptionStateMachine,
  type SubscriptionState,
  isRevenueGenerating,
  isTerminalState,
} from '../../../src/domain/billing/states';
import {
  getStateLabel,
  getStateSeverity,
  getAvailableSubscriptionActions,
} from '../../../src/utils/billing/state-guards';

interface SubscriptionLifecycleProps {
  state: SubscriptionState;
}

/**
 * Visual representation of subscription lifecycle
 */
const SubscriptionLifecycle: React.FC<SubscriptionLifecycleProps> = ({ state }) => {
  const severity = getStateSeverity(state);
  const label = getStateLabel(state);
  const actions = getAvailableSubscriptionActions(state);
  const validTransitions = SubscriptionStateMachine.getValidTransitions(state);

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
            {isRevenueGenerating(state) && '💰 Revenue Generating'}
            {isTerminalState(state) && '🔒 Terminal State'}
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
              const description = SubscriptionStateMachine.getTransitionDescription(state, event);
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

const meta: Meta<typeof SubscriptionLifecycle> = {
  title: 'Domains/Billing/Subscription Lifecycle',
  component: SubscriptionLifecycle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
## Subscription State Machine (7-state model)

The canonical subscription lifecycle models the full journey from future scheduling through termination:

### States

- **future**: Scheduled to start in the future
- **trialing**: In trial period (if configured)
- **active**: Active and current
- **paused**: Temporarily suspended
- **pending_cancellation**: Cancellation scheduled at period end
- **delinquent**: Past due with failed payments
- **terminated**: Permanently ended

### Transition Rules

1. **Future → Trialing/Active**: Depends on trial period configuration
2. **Trialing → Active**: Trial period ends successfully
3. **Active ↔ Paused**: Bidirectional pause/resume
4. **Active → Delinquent**: Payment failures trigger delinquency
5. **Delinquent → Active**: Successful payment clears delinquency
6. **Any → Terminated**: Immediate cancellation available from most states

### Guards

- Activation path (trialing vs active) uses trial period guard
- All transitions validated through state machine
        `,
      },
    },
  },
  argTypes: {
    state: {
      control: 'select',
      options: [
        'future',
        'trialing',
        'active',
        'paused',
        'pending_cancellation',
        'delinquent',
        'terminated',
      ] as SubscriptionState[],
      description: 'Current subscription state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SubscriptionLifecycle>;

/**
 * Future subscription - not yet started
 */
export const Future: Story = {
  name: 'Timeline – Scheduled activation',
  args: {
    state: 'future',
  },
};

/**
 * Trialing subscription - free trial active
 */
export const Trialing: Story = {
  name: 'Detail – Trial period status',
  args: {
    state: 'trialing',
  },
};

/**
 * Active subscription - revenue generating
 */
export const Active: Story = {
  name: 'List – Active subscriber snapshot',
  args: {
    state: 'active',
  },
};

/**
 * Paused subscription - temporarily suspended
 */
export const Paused: Story = {
  args: {
    state: 'paused',
  },
};

/**
 * Pending cancellation - scheduled to end at period end
 */
export const PendingCancellation: Story = {
  name: 'Form – Cancellation confirmation',
  args: {
    state: 'pending_cancellation',
  },
};

/**
 * Delinquent subscription - past due with failed payments
 */
export const Delinquent: Story = {
  args: {
    state: 'delinquent',
  },
};

/**
 * Terminated subscription - permanently ended
 */
export const Terminated: Story = {
  args: {
    state: 'terminated',
  },
};

/**
 * All states overview - demonstrates full lifecycle
 */
export const AllStates: Story = {
  render: () => {
    const allStates: SubscriptionState[] = [
      'future',
      'trialing',
      'active',
      'paused',
      'pending_cancellation',
      'delinquent',
      'terminated',
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {allStates.map((state) => (
          <div key={state} style={{ border: '1px solid var(--sys-color-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <SubscriptionLifecycle state={state} />
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
        <h3 style={{ marginBottom: '1rem' }}>Subscription Lifecycle Flow</h3>
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
│  future  │
└────┬─────┘
     │ activate
     ├──────────┐
     │          │
     │ (trial)  │ (no trial)
     ▼          ▼
┌──────────┐  ┌──────────┐
│ trialing │  │  active  │
└────┬─────┘  └────┬─────┘
     │             │
     │ trial_end   ├─────────────┐
     └─────────────►             │
                   │             │ pause
                   │             ▼
                   │        ┌──────────┐
                   │        │  paused  │
                   │        └────┬─────┘
                   │             │
                   │ resume      │
                   ◄─────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
     │ payment_    │ schedule_   │
     │ failed      │ cancel      │
     ▼             ▼             │
┌──────────┐  ┌──────────────────┐
│delinquent│  │pending_cancel    │
└────┬─────┘  └────┬─────────────┘
     │             │
     │ payment_    │ period_end
     │ succeeded   │
     │             │
     │             ▼
     │        ┌──────────┐
     └────────► terminated│◄─── cancel_immediately (from any)
              └──────────┘
          `}
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--sys-color-text-secondary)' }}>
          <strong>Legend:</strong> Arrows show valid state transitions triggered by events.
          Guards determine which activation path is taken (trialing vs active).
        </div>
      </div>
    );
  },
};
