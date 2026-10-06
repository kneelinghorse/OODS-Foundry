import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Detail',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    docs: {
      description: {
        story:
          'Detail profile renders a two-column structure that promotes context rail content via `--view-columns-two-column-standard`.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'detail'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Detail: Story = {
  name: 'Detail Profile',
  args: buildViewArgs('detail'),
};
