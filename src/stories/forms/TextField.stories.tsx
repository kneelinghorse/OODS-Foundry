/* c8 ignore start */
import type { Meta, StoryObj } from '@storybook/react';
import '../../styles/globals.css';
import { TextField } from '../../components/base/TextField.js';
import { Select } from '../../components/base/Select.js';
import { Checkbox } from '../../components/base/Checkbox.js';
import { Button } from '../../components/base/Button.js';

const meta: Meta<typeof TextField> = {
  title: 'Components/Primitives/Text Field',
  component: TextField,
  args: {
    id: 'email',
    label: 'Email address',
    placeholder: 'name@example.com',
    description: 'We use this to notify you about account changes.',
    required: true,
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

type Story = StoryObj<typeof TextField>;

export const Default: Story = {
  render: (args) => <TextField {...args} />,
};

export const ValidationStates: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <TextField
        id="text-field-info"
        label="Account email"
        placeholder="billing@example.com"
        description="Receive billing alerts in your inbox."
        validation={{ state: 'info', message: 'We only send important changes.' }}
      />
      <TextField
        id="text-field-success"
        label="Notification email"
        placeholder="alerts@example.com"
        validation={{ state: 'success', message: 'Looks great – we will start sending updates.' }}
      />
      <TextField
        id="text-field-error"
        label="Backup email"
        placeholder="alt@example.com"
        validation={{ state: 'error', message: 'Enter a valid email address.' }}
        required
      />
    </div>
  ),
  parameters: {
    chromatic: { disableSnapshot: false },
    layout: 'padded',
    vrt: { tags: ['vrt-critical'] },
  },
  tags: ['vrt-critical'],
};

export const DensityVariants: Story = {
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <TextField
        id="text-field-comfortable"
        label="Workspace name"
        placeholder="Acme Corp"
        description="Shown on invoices and notifications."
        density="comfortable"
      />
      <TextField
        id="text-field-compact"
        label="Workspace name"
        placeholder="Acme Corp"
        description="Compact spacing for dense forms."
        density="compact"
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: false },
  },
};

export const FormExample: Story = {
  render: () => (
    <form className="flex w-full max-w-lg flex-col gap-6" data-testid="form-example">
      <TextField
        id="form-email"
        label="Email address"
        placeholder="billing@example.com"
        description="We send receipts and incident updates to this address."
        validation={{ state: 'info', message: 'Use a monitored inbox for critical alerts.' }}
        required
      />
      <Select
        id="form-plan"
        label="Plan"
        defaultValue="growth"
        description="Choose the plan to provision for the organization."
        validation={{ state: 'success', message: 'Plan synced with provisioning defaults.' }}
        required
      >
        <option value="starter">Starter</option>
        <option value="growth">Growth</option>
        <option value="scale">Scale</option>
      </Select>
      <Checkbox
        id="form-compliance"
        label="Agree to billing policies"
        description="Acknowledges dunning procedures and incident communication cadence."
        validation={{ state: 'error', message: 'Policies must be acknowledged before continuing.' }}
        required
      />
      <Button intent="neutral" type="submit" data-testid="form-submit">
        Save changes
      </Button>
    </form>
  ),
  parameters: {
    layout: 'padded',
    chromatic: { disableSnapshot: true },
  },
};

/* c8 ignore end */
