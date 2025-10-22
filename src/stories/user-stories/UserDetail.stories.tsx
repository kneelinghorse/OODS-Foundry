import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RenderObject } from '../../components/RenderObject';
import type { RenderObjectProps } from '../../components/RenderObject';
import { createUserObjectSpec, UserObject } from '../../objects/user/object';
import type { UserRecord } from '../../objects/user/types';
import activeUserData from '../../fixtures/user/active.json';
import disabledUserData from '../../fixtures/user/disabled.json';

type UserRenderProps = RenderObjectProps<UserRecord>;

const activeUser = activeUserData as UserRecord;
const disabledUser = disabledUserData as UserRecord;

const UserRenderObject = RenderObject as FC<UserRenderProps>;
const renderStory = (args: UserRenderProps) => <UserRenderObject {...args} />;

const buildArgs = (context: UserRenderProps['context'], data: UserRecord, objectOverride = UserObject) =>
  ({
    object: objectOverride,
    context,
    data,
  }) satisfies UserRenderProps;

const meta: Meta<typeof UserRenderObject> = {
  title: 'Domains/Users/Detail',
  component: UserRenderObject,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

type Story = StoryObj<typeof UserRenderObject>;

export const ActiveDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', activeUser),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const ActiveList: Story = {
  render: renderStory,
  args: buildArgs('list', activeUser),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const ActiveForm: Story = {
  render: renderStory,
  args: buildArgs('form', activeUser),
};

export const ActiveTimeline: Story = {
  render: renderStory,
  args: buildArgs('timeline', activeUser),
};

export const DisabledDetail: Story = {
  render: renderStory,
  args: buildArgs('detail', disabledUser),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const DisabledCard: Story = {
  render: renderStory,
  args: buildArgs('card', disabledUser),
  parameters: {
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt'] },
  },
  tags: ['vrt'],
};

export const DisabledInline: Story = {
  render: renderStory,
  args: buildArgs('inline', disabledUser),
};

export const DisabledWithoutTaggable: Story = {
  render: renderStory,
  args: buildArgs('detail', disabledUser, createUserObjectSpec({ includeTaggable: false })),
};
