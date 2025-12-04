import { type CSSProperties, type FC, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RenderObject } from '~/src/components/RenderObject';
import type { RenderObjectProps } from '~/src/components/RenderObject';
import { SubscriptionObject } from '~/src/objects/subscription/object';
import type { SubscriptionRecord } from '~/src/objects/subscription/types';
import { InvoiceObject } from '~/src/objects/invoice/object';
import type { InvoiceRecord } from '~/src/objects/invoice/types';
import { UserObject } from '~/src/objects/user/object';
import type { UserRecord } from '~/src/objects/user/types';
import billingSubscription from '~/fixtures/billing/subscription.json';
import billingInvoice from '~/fixtures/billing/invoice.json';
import activeUser from '~/src/fixtures/user/active.json';

import '~/apps/explorer/src/styles/index.css';

type ViewContext = RenderObjectProps<SubscriptionRecord>['context'];

interface ObjectEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly object: RenderObjectProps<unknown>['object'];
  readonly data: unknown;
}

const contextClassName: Record<ViewContext, string> = {
  detail: 'explorer-view context-detail detail-view',
  list: 'explorer-view context-list list-view',
  form: 'explorer-view context-form form-view',
  timeline: 'explorer-view context-timeline timeline-view',
  card: 'explorer-view context-card card-view',
  inline: 'explorer-view context-inline inline-view',
};

const contextDescriptions: Record<ViewContext, string> = {
  detail: 'Full page view with all fields, actions, and supporting panels',
  list: 'Compact row suitable for tables and lists with inline status',
  form: 'Editable view optimized for data entry and updates',
  timeline: 'Activity-focused view showing state history and events',
  card: 'Summary card for dashboards and grid layouts',
  inline: 'Minimal inline reference for embedding in text or compact spaces',
};

const objects: readonly ObjectEntry[] = [
  {
    id: 'user',
    label: 'User',
    description: 'Identity record with status, tags, and activity history',
    object: UserObject,
    data: activeUser as UserRecord,
  },
  {
    id: 'subscription',
    label: 'Subscription',
    description: 'Billing subscription with lifecycle state and payment status',
    object: SubscriptionObject,
    data: billingSubscription as SubscriptionRecord,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    description: 'Billing artifact with line items and collection state',
    object: InvoiceObject,
    data: billingInvoice as InvoiceRecord,
  },
] as const;

const pageContainer: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  padding: '1.5rem',
  maxWidth: '1400px',
  margin: '0 auto',
};

const headerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  borderBottom: '1px solid var(--sys-border-default)',
  paddingBottom: '1.5rem',
};

const objectSelector: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const selectorButton = (isActive: boolean): CSSProperties => ({
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: '2px solid',
  borderColor: isActive ? '#2563eb' : '#e2e8f0',
  backgroundColor: isActive ? '#2563eb' : '#ffffff',
  color: isActive ? '#ffffff' : '#1e293b',
  cursor: 'pointer',
  fontWeight: isActive ? 600 : 400,
  fontSize: '0.875rem',
  transition: 'all 0.15s ease',
});

const contextSection: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const contextHeader: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const contextLabel: CSSProperties = {
  fontSize: 'var(--sys-font-size-lg)',
  fontWeight: 600,
  color: 'var(--sys-text-default)',
  margin: 0,
  textTransform: 'capitalize',
};

const contextDescription: CSSProperties = {
  fontSize: 'var(--sys-font-size-sm)',
  color: 'var(--cmp-text-muted)',
  margin: 0,
};

const renderContainer: CSSProperties = {
  border: '1px solid var(--sys-border-default)',
  borderRadius: 'var(--sys-radius-lg)',
  backgroundColor: 'var(--sys-surface-subtle)',
  padding: '1rem',
  overflow: 'auto',
};

const ContextRenderObject = RenderObject as FC<RenderObjectProps<unknown>>;

const allContexts: readonly ViewContext[] = ['detail', 'list', 'card', 'timeline', 'form', 'inline'];

/**
 * Object × Context Explorer
 *
 * Demonstrates the core OODS value proposition: the same object definition
 * renders appropriately for different view contexts.
 *
 * Two-axis exploration:
 * - Object switcher: User / Subscription / Invoice
 * - Context switcher: Detail / List / Card / Timeline / Form / Inline
 */
const ObjectContextExplorer: FC = () => {
  const [selectedObjectId, setSelectedObjectId] = useState<string>('user');
  const [selectedContext, setSelectedContext] = useState<ViewContext>('detail');
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? objects[0];

  return (
    <div style={pageContainer}>
      <header style={headerStyles}>
        <h1 style={{ margin: 0, fontSize: 'var(--sys-font-size-2xl)', fontWeight: 700 }}>
          Object × Context Explorer
        </h1>
        <p style={{ margin: 0, color: 'var(--cmp-text-muted)', maxWidth: '65ch' }}>
          Select an object and a view context to see how the same data renders differently.
          Each context optimizes layout and visible information for its use case.
        </p>

        <div style={{ marginTop: '1rem' }}>
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: 'var(--sys-font-size-sm)',
              fontWeight: 500,
            }}
          >
            Select Object:
          </p>
          <div style={objectSelector}>
            {objects.map((obj) => (
              <button
                key={obj.id}
                type="button"
                style={selectorButton(obj.id === selectedObjectId)}
                onClick={() => setSelectedObjectId(obj.id)}
              >
                {obj.label}
              </button>
            ))}
          </div>
          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: 'var(--sys-font-size-sm)',
              color: 'var(--cmp-text-muted)',
            }}
          >
            {selectedObject.description}
          </p>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: 'var(--sys-font-size-sm)',
              fontWeight: 500,
            }}
          >
            Select Context:
          </p>
          <div style={objectSelector}>
            {allContexts.map((ctx) => (
              <button
                key={ctx}
                type="button"
                style={selectorButton(ctx === selectedContext)}
                onClick={() => setSelectedContext(ctx)}
              >
                {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
              </button>
            ))}
          </div>
          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: 'var(--sys-font-size-sm)',
              color: 'var(--cmp-text-muted)',
            }}
          >
            {contextDescriptions[selectedContext]}
          </p>
        </div>
      </header>

      <section style={contextSection}>
        <div style={contextHeader}>
          <h2 style={contextLabel}>
            {selectedObject.label} — {selectedContext.charAt(0).toUpperCase() + selectedContext.slice(1)} Context
          </h2>
        </div>
        <div style={renderContainer}>
          <ContextRenderObject
            object={selectedObject.object}
            context={selectedContext}
            data={selectedObject.data}
            className={contextClassName[selectedContext]}
          />
        </div>
      </section>
    </div>
  );
};

const meta = {
  title: 'Objects/Object Explorer/Context Demo',
  component: ObjectContextExplorer,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: false },
    docs: {
      description: {
        component:
          'Two-axis exploration of the OODS rendering system. Select any object (User, Subscription, Invoice) and any view context (Detail, List, Card, Timeline, Form, Inline) to see how the same data adapts its presentation. This demonstrates the core OODS value proposition: define once, render appropriately everywhere.',
      },
    },
  },
  tags: ['hero', 'objects', 'contexts'],
} satisfies Meta<typeof ObjectContextExplorer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ObjectContextExplorer />,
  parameters: {
    vrt: { tags: ['vrt-critical'] },
  },
};
