import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { withPage } from '~/.storybook/decorators/withPage';
import { RenderObject } from '../../components/RenderObject';
import type { RenderObjectProps } from '../../components/RenderObject';
import { SubscriptionObject } from '../../objects/subscription/object';
import type { SubscriptionRecord } from '../../objects/subscription/types';
import activeSubscription from '../../fixtures/subscription/active.json';
import pastDueSubscription from '../../fixtures/subscription/past_due.json';
import cancelAtPeriodEndSubscription from '../../fixtures/subscription/active_cancel_at_period_end.json';

type SubscriptionRenderProps = RenderObjectProps<SubscriptionRecord>;

const Active = activeSubscription as SubscriptionRecord;
const PastDue = pastDueSubscription as SubscriptionRecord;
const CancelAtPeriodEnd = cancelAtPeriodEndSubscription as SubscriptionRecord;

const SubscriptionRenderObject = RenderObject as FC<SubscriptionRenderProps>;
const renderStory = (args: SubscriptionRenderProps) => <SubscriptionRenderObject {...args} />;

const buildArgs = (context: SubscriptionRenderProps['context'], data: SubscriptionRecord) =>
  ({
    object: SubscriptionObject,
    context,
    data,
  }) satisfies SubscriptionRenderProps;

const meta: Meta<typeof SubscriptionRenderObject> = {
  title: 'Contexts/Subscription',
  component: SubscriptionRenderObject,
  decorators: [withPage()],
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

type Story = StoryObj<typeof SubscriptionRenderObject>;

export const ActiveDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', Active),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const ActiveList: Story = {
  render: renderStory,
  args: buildArgs('list', Active),
};

export const ActiveForm: Story = {
  render: renderStory,
  args: buildArgs('form', Active),
};

export const ActiveTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', Active),
};

export const ActiveCard: Story = {
  render: renderStory,
  args: buildArgs('card', Active),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const ActiveInline: Story = {
  render: renderStory,
  args: buildArgs('inline', Active),
};

export const PastDueDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', PastDue),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const PastDueList: Story = {
  render: renderStory,
  args: buildArgs('list', PastDue),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const PastDueForm: Story = {
  render: renderStory,
  args: buildArgs('form', PastDue),
};

export const PastDueTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', PastDue),
};

export const PastDueCard: Story = {
  render: renderStory,
  args: buildArgs('card', PastDue),
};

export const PastDueInline: Story = {
  render: renderStory,
  args: buildArgs('inline', PastDue),
};

export const CancelAtPeriodEndDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', CancelAtPeriodEnd),
};

export const CancelAtPeriodEndList: Story = {
  render: renderStory,
  args: buildArgs('list', CancelAtPeriodEnd),
};

export const CancelAtPeriodEndForm: Story = {
  render: renderStory,
  args: buildArgs('form', CancelAtPeriodEnd),
};

export const CancelAtPeriodEndTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', CancelAtPeriodEnd),
};

export const CancelAtPeriodEndCard: Story = {
  render: renderStory,
  args: buildArgs('card', CancelAtPeriodEnd),
};

export const CancelAtPeriodEndInline: Story = {
  render: renderStory,
  args: buildArgs('inline', CancelAtPeriodEnd),
};
