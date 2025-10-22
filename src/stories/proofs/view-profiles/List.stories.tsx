import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/List',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    docs: {
      description: {
        story:
          'List profile uses the narrow rail token `--view-columns-two-column-narrow` to maintain filter/tooling density without overwhelming the main grid.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'list'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {
  name: 'List Profile',
  args: buildViewArgs('list'),
};
