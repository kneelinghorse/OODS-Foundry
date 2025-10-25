/* c8 ignore start */
import type { Meta, StoryObj } from '@storybook/react';
import '../../styles/globals.css';
import { Select } from '../../components/base/Select.js';

const meta: Meta<typeof Select> = {
  title: 'Components/Primitives/Select',
  component: Select,
  args: {
    id: 'plan',
    label: 'Plan',
    children: [
      <option key="placeholder" value="">
        Choose a plan
      </option>,
      <option key="starter" value="starter">
        Starter
      </option>,
      <option key="growth" value="growth">
        Growth
      </option>,
      <option key="enterprise" value="enterprise">
        Enterprise
      </option>,
    ],
  },
  parameters: {
    layout: 'centered',
    chromatic: { disableSnapshot: true },
  },
  argTypes: {
    density: {
      control: { type: 'inline-radio' },
      options: ['comfortable', 'compact'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: (args) => <Select {...args} />,
};

export const ValidationStates: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Select
        id="select-info"
        label="Environment"
        defaultValue="staging"
        validation={{ state: 'info', message: 'Use staging for internal previews.' }}
      >
        <option value="production">Production</option>
        <option value="staging">Staging</option>
        <option value="development">Development</option>
      </Select>
      <Select
        id="select-success"
        label="Status"
        defaultValue="active"
        validation={{ state: 'success', message: 'Status synced with the billing system.' }}
      >
        <option value="active">Active</option>
        <option value="trialing">Trialing</option>
        <option value="terminated">Terminated</option>
      </Select>
      <Select
        id="select-error"
        label="Status"
        defaultValue=""
        validation={{ state: 'error', message: 'Select a status before continuing.' }}
        required
      >
        <option value="">Select a status</option>
        <option value="active">Active</option>
        <option value="trialing">Trialing</option>
        <option value="terminated">Terminated</option>
      </Select>
    </div>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const DensityVariants: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Select id="select-density-comfortable" label="Density" density="comfortable" defaultValue="comfortable">
        <option value="comfortable">Comfortable</option>
        <option value="compact">Compact</option>
      </Select>
      <Select id="select-density-compact" label="Density" density="compact" defaultValue="compact">
        <option value="comfortable">Comfortable</option>
        <option value="compact">Compact</option>
      </Select>
    </div>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
  },
};

/* c8 ignore end */
