import type { Meta, StoryObj } from '@storybook/react';
import {
  ViewProfileComponent,
  buildViewArgs,
  viewStoryParameters,
} from './shared';

const meta = {
  title: 'Explorer/Proofs/View Profiles/Forced Colors Detail',
  component: ViewProfileComponent,
  parameters: {
    ...viewStoryParameters,
    chromatic: {
      forcedColors: 'active',
    },
    docs: {
      description: {
        story:
          'Detail profile rendered with `forced-colors: active` to verify explicit borders and focus indicators surfaced by view tokens.',
      },
    },
  },
  tags: ['proof', 'view-profile', 'forced-colors'],
} satisfies Meta<typeof ViewProfileComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ForcedColorsDetail: Story = {
  name: 'Forced Colors - Detail',
  args: buildViewArgs('detail'),
};
