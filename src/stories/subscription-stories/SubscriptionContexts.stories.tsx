import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
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

const contextClassName: Partial<Record<SubscriptionRenderProps['context'], string>> = {
  detail: 'explorer-view context-detail detail-view',
  list: 'explorer-view context-list list-view',
  form: 'explorer-view context-form form-view',
  timeline: 'explorer-view context-timeline timeline-view',
  card: 'explorer-view context-card card-view',
  inline: 'explorer-view context-inline inline-view',
};

const SubscriptionRenderObject = RenderObject as FC<SubscriptionRenderProps>;
const renderStory = (args: SubscriptionRenderProps) => <SubscriptionRenderObject {...args} />;

const buildArgs = (context: SubscriptionRenderProps['context'], data: SubscriptionRecord) =>
  ({
    object: SubscriptionObject,
    context,
    data,
    className: contextClassName[context],
  }) satisfies SubscriptionRenderProps;

const meta = {
  title: 'Domains/Subscription/Contexts',
  component: SubscriptionRenderObject,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  tags: ['hidden'],
} satisfies Meta<typeof SubscriptionRenderObject>;

export default meta;

type Story = StoryObj<typeof meta>;

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
    layout: 'centered',
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const ActiveInline: Story = {
  render: renderStory,
  args: buildArgs('inline', Active),
  parameters: {
    layout: 'centered',
  },
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
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const PastDueInline: Story = {
  render: renderStory,
  args: buildArgs('inline', PastDue),
  parameters: {
    layout: 'centered',
  },
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
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const CancelAtPeriodEndInline: Story = {
  render: renderStory,
  args: buildArgs('inline', CancelAtPeriodEnd),
  parameters: {
    layout: 'centered',
  },
};
