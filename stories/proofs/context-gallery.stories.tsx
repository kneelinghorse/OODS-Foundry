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

interface DomainGalleryEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly object: RenderObjectProps<any>['object'];
  readonly data: any;
}

const contextClassName: Record<ViewContext, string> = {
  detail: 'explorer-view context-detail detail-view',
  list: 'explorer-view context-list list-view',
  form: 'explorer-view context-form form-view',
  timeline: 'explorer-view context-timeline timeline-view',
  card: 'explorer-view context-card card-view',
  inline: 'explorer-view context-inline inline-view',
};

const contextLabel: Record<ViewContext, string> = {
  detail: 'Detail',
  list: 'List',
  form: 'Form',
  timeline: 'Timeline',
  card: 'Card',
  inline: 'Inline',
};

const contexts: ViewContext[] = ['detail', 'list', 'form', 'timeline', 'card', 'inline'];

const domains: readonly DomainGalleryEntry[] = [
  {
    id: 'subscription',
    title: 'Subscription',
    description: 'Usage-based SaaS plan with lifecycle and state traits.',
    object: SubscriptionObject,
    data: billingSubscription as SubscriptionRecord,
  },
  {
    id: 'invoice',
    title: 'Invoice',
    description: 'Billing artefact with payable, refundable, and timestamp traits.',
    object: InvoiceObject,
    data: billingInvoice as InvoiceRecord,
  },
  {
    id: 'user',
    title: 'User',
    description: 'Identity record with tagging, state, and activity metadata.',
    object: UserObject,
    data: activeUser as UserRecord,
  },
] as const;

const galleryLayout: CSSProperties = {
  display: 'grid',
  gap: 'var(--view-card-gap)',
  alignItems: 'start',
};

const domainSectionLayout: CSSProperties = {
  display: 'grid',
  gap: 'var(--view-card-gap)',
};

const contextGridLayout: CSSProperties = {
  display: 'grid',
  gap: 'var(--view-card-gap)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(var(--view-rail-width-min-standard), 1fr))',
  alignItems: 'start',
};

const cellLayout: CSSProperties = {
  display: 'grid',
  gap: 'var(--view-gap-inline)',
  alignContent: 'start',
};

const headingReset: CSSProperties = { margin: 0 };
const descriptionReset: CSSProperties = { margin: 0, color: 'var(--cmp-text-muted)' };

function buildRenderArgs(entry: DomainGalleryEntry, context: ViewContext): RenderObjectProps<any> {
  return {
    object: entry.object,
    context,
    data: entry.data,
    className: contextClassName[context],
  };
}

const ContextRenderObject = RenderObject as FC<RenderObjectProps<any>>;

const ContextGallery: FC = () => (
  <div style={galleryLayout}>
    {domains.map((domain) => {
      const domainHeadingId = `${domain.id}-heading`;
      return (
        <section key={domain.id} style={domainSectionLayout} aria-labelledby={domainHeadingId}>
          <header style={cellLayout}>
            <h2 id={domainHeadingId} style={headingReset}>
              {domain.title}
            </h2>
            <p style={descriptionReset}>{domain.description}</p>
          </header>

          <div style={contextGridLayout} role="list">
            {contexts.map((context) => {
              const contextHeadingId = `${domain.id}-${context}-title`;
              const args = buildRenderArgs(domain, context);
              return (
                <article
                  key={context}
                  style={cellLayout}
                  aria-labelledby={contextHeadingId}
                  role="listitem"
                >
                  <h3 id={contextHeadingId} style={headingReset}>
                    {contextLabel[context]} Context
                  </h3>
                  <ContextRenderObject {...args} />
                </article>
              );
            })}
          </div>
        </section>
      );
    })}
  </div>
);

const meta = {
  title: 'Contexts/Domain Context Gallery',
  component: ContextGallery,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: false },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'landmark-one-main', enabled: true },
        ],
      },
    },
    docs: {
      description: {
        component:
          'Grid of canonical contexts rendered for subscription, invoice, and user objects to verify token-driven styling across modes.',
      },
    },
  },
  tags: ['proof', 'contexts', 'vrt-critical'],
} satisfies Meta<typeof ContextGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => <ContextGallery />,
  parameters: {
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};
