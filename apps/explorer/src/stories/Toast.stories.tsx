import type { Meta, StoryObj } from '@storybook/react';
import { Toast } from '../components/Toast';
import '../styles/index.css';
import '../styles/overlays.css';

const meta: Meta<typeof Toast> = {
  title: 'Explorer/Components/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj<typeof Toast>;

export const Primary: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '0.75rem', width: 'min(32rem, 100%)' }}>
      <Toast tone="info" title="Heads up">Something informative happened.</Toast>
      <Toast tone="success" title="Saved">Your changes have been saved.</Toast>
      <Toast tone="warning" title="Check this">There might be an issue to review.</Toast>
      <Toast tone="critical" title="Error">Action failed. Try again.</Toast>
      <Toast tone="neutral">Neutral notification without title.</Toast>
    </div>
  ),
};
