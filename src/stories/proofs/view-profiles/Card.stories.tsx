import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Card',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    layout: 'centered',
    docs: {
      description: {
        story:
          'Card profile constrains width using `--view-card-max-width` and removes internal surface chrome for embedded usage.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'card'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Card: Story = {
  name: 'Card Profile',
  args: buildViewArgs('card'),
};
