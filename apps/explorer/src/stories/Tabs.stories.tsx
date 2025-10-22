import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from '../components/Tabs';
import '../styles/index.css';
import '../styles/overlays.css';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Primitives/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Tabs>;

export const Primary: Story = {
  render: () => (
    <Tabs
      ariaLabel="Plan sections"
      tabs={[
        { id: 'overview', label: 'Overview', panel: <div>Overview content</div> },
        { id: 'details', label: 'Details', panel: <div>Detailed information</div> },
        { id: 'activity', label: 'Activity', disabled: true, panel: <div>Activity feed</div> },
      ]}
      defaultValue="overview"
    />
  ),
};
