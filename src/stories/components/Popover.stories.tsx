import type { Meta, StoryObj } from '@storybook/react';
import '../../styles/globals.css';
import { Popover } from '../../components/Popover/Popover';
import { TextField } from '../../components/base/TextField';

const meta: Meta<typeof Popover> = {
  title: 'Components/Overlays/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Popover title="Profile" trigger={<button type="button">Open popover</button>}>
      <TextField id="profile-name" label="Name" placeholder="Edit name" />
    </Popover>
  ),
};
