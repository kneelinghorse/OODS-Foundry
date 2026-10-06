import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RenderObject } from '~/src/components/RenderObject';
import type { RenderObjectProps } from '~/src/components/RenderObject';
import { SubscriptionObject } from '~/src/objects/subscription/object';
import type { SubscriptionRecord } from '~/src/objects/subscription/types';
import billingSubscription from '~/fixtures/billing/subscription.json';

import '~/apps/explorer/src/styles/index.css';

type SubscriptionRenderProps = RenderObjectProps<SubscriptionRecord>;

const PastDueSubscription = billingSubscription as SubscriptionRecord;

const contextClassName: Partial<Record<SubscriptionRenderProps['context'], string>> = {
  detail: 'explorer-view context-detail detail-view',
  list: 'explorer-view context-list list-view',
  form: 'explorer-view context-form form-view',
  timeline: 'explorer-view context-timeline timeline-view'
};

const SubscriptionRenderObject = RenderObject as FC<SubscriptionRenderProps>;
const renderStory = (args: SubscriptionRenderProps) => <SubscriptionRenderObject {...args} />;

const buildArgs = (context: SubscriptionRenderProps['context'], data: SubscriptionRecord) =>
  ({
    object: SubscriptionObject,
    context,
    data,
    className: contextClassName[context]
  }) satisfies SubscriptionRenderProps;

const meta = {
  title: 'Domains/Billing/Subscription',
  component: SubscriptionRenderObject,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true }
  },
  tags: ['billing-domain']
} satisfies Meta<typeof SubscriptionRenderObject>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PastDueDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', PastDueSubscription),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] }
  },
  tags: ['vrt-critical']
};

export const PastDueList: Story = {
  render: renderStory,
  args: buildArgs('list', PastDueSubscription),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] }
  },
  tags: ['vrt']
};

export const PastDueForm: Story = {
  render: renderStory,
  args: buildArgs('form', PastDueSubscription)
};

export const PastDueTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', PastDueSubscription),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] }
  },
  tags: ['vrt']
};
