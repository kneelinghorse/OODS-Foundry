import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RenderObject } from '~/src/components/RenderObject';
import type { RenderObjectProps } from '~/src/components/RenderObject';
import { InvoiceObject } from '~/src/objects/invoice/object';
import type { InvoiceRecord } from '~/src/objects/invoice/types';
import invoiceFixture from '~/fixtures/billing/invoice.json';

import '~/apps/explorer/src/styles/index.css';

type InvoiceRenderProps = RenderObjectProps<InvoiceRecord>;

type InvoiceContext = InvoiceRenderProps['context'];

const PastDueInvoice = invoiceFixture as InvoiceRecord;

const contextClassName: Partial<Record<InvoiceContext, string>> = {
  detail: 'explorer-view context-detail detail-view',
  list: 'explorer-view context-list list-view',
  form: 'explorer-view context-form form-view',
  timeline: 'explorer-view context-timeline timeline-view'
};

const InvoiceRenderObject = RenderObject as FC<InvoiceRenderProps>;
const renderStory = (args: InvoiceRenderProps) => <InvoiceRenderObject {...args} />;

const buildArgs = (context: InvoiceContext, data: InvoiceRecord) =>
  ({
    object: InvoiceObject,
    context,
    data,
    className: contextClassName[context]
  }) satisfies InvoiceRenderProps;

const meta = {
  title: 'Domains/Billing/Invoice',
  component: InvoiceRenderObject,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true }
  },
  tags: ['billing-domain']
} satisfies Meta<typeof InvoiceRenderObject>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PastDueDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', PastDueInvoice),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] }
  },
  tags: ['vrt-critical']
};

export const PastDueList: Story = {
  render: renderStory,
  args: buildArgs('list', PastDueInvoice),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] }
  },
  tags: ['vrt']
};

export const PastDueForm: Story = {
  render: renderStory,
  args: buildArgs('form', PastDueInvoice)
};

export const PastDueTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', PastDueInvoice),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] }
  },
  tags: ['vrt']
};
