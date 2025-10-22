import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Timeline',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    docs: {
      description: {
        story:
          'Timeline profile switches to a single-column stream, consuming `--view-timeline-gap` and `--view-timeline-stream-gap` to stage chronological content.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'timeline'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Timeline: Story = {
  name: 'Timeline Profile',
  args: buildViewArgs('timeline'),
};
