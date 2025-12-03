import type { CSSProperties, FC } from 'react';
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

const matrixContexts: ViewContext[] = ['detail', 'list', 'card'];

const matrixObjects: readonly ObjectEntry[] = [
  {
    id: 'user',
    label: 'User',
    object: UserObject,
    data: activeUser as UserRecord,
  },
  {
    id: 'subscription',
    label: 'Subscription',
    object: SubscriptionObject,
    data: billingSubscription as SubscriptionRecord,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    object: InvoiceObject,
    data: billingInvoice as InvoiceRecord,
  },
] as const;

const matrixContainer: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto repeat(3, 1fr)',
  gridTemplateRows: 'auto repeat(3, auto)',
  gap: '1rem',
  padding: '1.5rem',
  backgroundColor: 'var(--sys-surface-default)',
  borderRadius: 'var(--sys-radius-lg)',
  overflow: 'auto',
};

const headerCell: CSSProperties = {
  fontWeight: 600,
  fontSize: 'var(--sys-font-size-sm)',
  color: 'var(--cmp-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const rowHeader: CSSProperties = {
  ...headerCell,
  justifyContent: 'flex-start',
  borderRight: '1px solid var(--sys-border-default)',
  paddingRight: '1rem',
  minWidth: '120px',
};

const objectCell: CSSProperties = {
  minWidth: '280px',
  padding: '0.5rem',
  backgroundColor: 'var(--sys-surface-subtle)',
  borderRadius: 'var(--sys-radius-md)',
  overflow: 'hidden',
};

const cornerCell: CSSProperties = {
  gridColumn: '1',
  gridRow: '1',
};

const ContextRenderObject = RenderObject as FC<RenderObjectProps<unknown>>;

const ObjectMatrix: FC = () => (
  <div>
    <header style={{ marginBottom: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--sys-font-size-2xl)', fontWeight: 700 }}>
        Object × Context Matrix
      </h1>
      <p style={{ margin: '0.5rem 0 0', color: 'var(--cmp-text-muted)', maxWidth: '60ch' }}>
        The same domain object renders differently based on context.
        Each row is a single object definition; each column is a different view context.
        This is the core OODS value proposition: define once, render everywhere.
      </p>
    </header>

    <div style={matrixContainer}>
      <div style={cornerCell} aria-hidden="true" />

      {matrixContexts.map((ctx) => (
        <div key={ctx} style={headerCell}>
          {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
        </div>
      ))}

      {matrixObjects.map((obj) => (
        <>
          <div key={`${obj.id}-label`} style={rowHeader}>
            {obj.label}
          </div>
          {matrixContexts.map((ctx) => (
            <div key={`${obj.id}-${ctx}`} style={objectCell}>
              <ContextRenderObject
                object={obj.object}
                context={ctx}
                data={obj.data}
                className={contextClassName[ctx]}
              />
            </div>
          ))}
        </>
      ))}
    </div>
  </div>
);

const meta = {
  title: 'Objects/Object Explorer/Matrix View',
  component: ObjectMatrix,
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
    docs: {
      description: {
        component:
          'A 3×3 matrix demonstrating how User, Subscription, and Invoice objects render across Detail, List, and Card contexts. This is the hero demo for OODS core value proposition.',
      },
    },
  },
  tags: ['hero', 'objects', 'contexts'],
} satisfies Meta<typeof ObjectMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ObjectMatrix />,
  parameters: {
    vrt: { tags: ['vrt-critical'] },
  },
};
