import type { FC } from 'react';
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

export default {
  title: 'Subscription/RenderObject',
  component: RenderObject,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const ActiveDetail = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'detail',
    data: Active,
  } as SubscriptionRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const ActiveList = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'list',
    data: Active,
  } as SubscriptionRenderProps,
};

export const ActiveForm = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'form',
    data: Active,
  } as SubscriptionRenderProps,
};

export const ActiveTimeline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'timeline',
    data: Active,
  } as SubscriptionRenderProps,
};

export const ActiveCard = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'card',
    data: Active,
  } as SubscriptionRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const ActiveInline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'inline',
    data: Active,
  } as SubscriptionRenderProps,
};

export const PastDueDetail = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'detail',
    data: PastDue,
  } as SubscriptionRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const PastDueList = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'list',
    data: PastDue,
  } as SubscriptionRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const PastDueForm = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'form',
    data: PastDue,
  } as SubscriptionRenderProps,
};

export const PastDueTimeline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'timeline',
    data: PastDue,
  } as SubscriptionRenderProps,
};

export const PastDueCard = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'card',
    data: PastDue,
  } as SubscriptionRenderProps,
};

export const PastDueInline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'inline',
    data: PastDue,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndDetail = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'detail',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndList = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'list',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndForm = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'form',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndTimeline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'timeline',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndCard = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'card',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};

export const CancelAtPeriodEndInline = {
  render: renderStory,
  args: {
    object: SubscriptionObject,
    context: 'inline',
    data: CancelAtPeriodEnd,
  } as SubscriptionRenderProps,
};
