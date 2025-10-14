import { RenderObject } from '../../components/RenderObject';
import type { RenderObjectProps } from '../../components/RenderObject';
import type { FC } from 'react';
import { createUserObjectSpec, UserObject } from '../../objects/user/object';
import type { UserRecord } from '../../objects/user/types';
import activeUserData from '../../fixtures/user/active.json';
import disabledUserData from '../../fixtures/user/disabled.json';

type UserRenderProps = RenderObjectProps<UserRecord>;

const activeUser = activeUserData as UserRecord;
const disabledUser = disabledUserData as UserRecord;

export default {
  title: 'User/RenderObject',
  component: RenderObject,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

const UserRenderObject = RenderObject as FC<UserRenderProps>;

const renderStory = (args: UserRenderProps) => <UserRenderObject {...args} />;

export const ActiveDetail = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'detail',
    data: activeUser,
  } as UserRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const ActiveList = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'list',
    data: activeUser,
  } as UserRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const ActiveForm = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'form',
    data: activeUser,
  } as UserRenderProps,
};

export const ActiveTimeline = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'timeline',
    data: activeUser,
  } as UserRenderProps,
};

export const DisabledDetail = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'detail',
    data: disabledUser,
  } as UserRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const DisabledCard = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'card',
    data: disabledUser,
  } as UserRenderProps,
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const DisabledInline = {
  render: renderStory,
  args: {
    object: UserObject,
    context: 'inline',
    data: disabledUser,
  } as UserRenderProps,
};

export const DisabledWithoutTaggable = {
  render: renderStory,
  args: {
    object: createUserObjectSpec({ includeTaggable: false }),
    context: 'detail',
    data: disabledUser,
  } as UserRenderProps,
};
