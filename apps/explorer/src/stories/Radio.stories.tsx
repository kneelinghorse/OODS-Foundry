import type { Meta, StoryObj } from '@storybook/react';
import { Radio, RadioGroup } from '../components/Radio';
import '../styles/index.css';
import '../styles/forms.css';

const meta: Meta<typeof Radio> = {
  title: 'Components/Primitives/Radio',
  component: Radio,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Radio>;

export const Primary: Story = {
  render: () => (
    <RadioGroup
      name="size"
      options={[
        { value: 's', label: 'Small' },
        { value: 'm', label: 'Medium' },
        { value: 'l', label: 'Large', disabled: true },
      ]}
      defaultValue="m"
    />
  ),
};
