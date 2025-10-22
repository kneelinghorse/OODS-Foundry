import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Inline',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    layout: 'padded',
    docs: {
      description: {
        story:
          'Inline profile collapses to a minimal single-column footprint, leaning on `--view-gap-inline` for compact spacing.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'inline'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  name: 'Inline Profile',
  args: buildViewArgs('inline'),
};
