import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Form',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    docs: {
      description: {
        story:
          'Form profile applies `--view-columns-two-column-guidance` to create an asymmetric layout that prioritises the main column while keeping supportive guidance in view.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'form'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Form: Story = {
  name: 'Form Profile',
  args: buildViewArgs('form'),
};
