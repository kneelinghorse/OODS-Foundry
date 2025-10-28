import type { Meta, StoryObj } from '@storybook/react';
import '../styles/index.css';
import '../styles/forms.css';
import { ValidationBanner } from '../components/ValidationBanner';
import { RequiredOptional } from '../components/RequiredOptional';
import { Input } from '../components/Input';
import { FieldGroup } from '../components/FieldGroup';
import { HelpText } from '../components/HelpText';
import { ErrorText } from '../components/ErrorText';
import { TextArea } from '../components/TextArea';

// This stub attaches the MDX docs page to a CSF module, aligning with
// how other stories are wired (<Meta of={...}/> pattern).
const meta: Meta = {
  title: 'Patterns/Form',
  parameters: {
    layout: 'centered',
    docs: { source: { state: 'hidden' } },
  },
};

export default meta;

type Story = StoryObj;

export const ValidationBannerDemo: Story = {
  name: 'ValidationBanner',
  parameters: { chromatic: { disableSnapshot: false }, vrt: { tags: ['vrt-critical'] } },
  tags: ['vrt-critical'],
  render: () => (
    <div className="context-form" data-context="form" style={{ display: 'grid', gap: '1rem', width: 'min(48rem, 100%)' }}>
      <ValidationBanner tone="critical" title="Submission blocked" description="Fix errors below and try again." />
      <ValidationBanner tone="warning" title="Please review" description="Double-check usage commitment and contacts." />
      <ValidationBanner tone="info" title="Heads up" description="Approver will receive an email summary." />
    </div>
  ),
};

export const RequiredOptionalDemo: Story = {
  name: 'Required / Optional Labeling',
  parameters: { chromatic: { disableSnapshot: false }, vrt: { tags: ['vrt-critical'] } },
  tags: ['vrt-critical'],
  render: () => (
    <div className="context-form" data-context="form" style={{ display: 'grid', gap: '1rem', width: 'min(34rem, 100%)' }}>
      <Input
        label={
          <>
            <span>Billing email</span> <RequiredOptional required />
          </>
        }
        supportingText="Use a corporate domain."
        placeholder="billing@acmeanalytics.com"
      />
      <Input
        label={
          <>
            <span>Purchase order</span> <RequiredOptional />
          </>
        }
        supportingText="Optional — attach if already issued."
        placeholder="PO-2024-10057"
      />
    </div>
  ),
};

export const HelpErrorTextDemo: Story = {
  name: 'Help vs Error Text',
  parameters: { chromatic: { disableSnapshot: false }, vrt: { tags: ['vrt-critical'] } },
  tags: ['vrt-critical'],
  render: () => (
    <div className="context-form" data-context="form" style={{ display: 'grid', gap: '1.25rem', width: 'min(42rem, 100%)' }}>
      <FieldGroup label="Plan selection" description="Pricing synchronizes with the catalog manifest.">
        <Input defaultValue="Scale • Annual" readOnly aria-label="Plan selection" />
        <HelpText>Changing plan updates renewal reminders automatically.</HelpText>
      </FieldGroup>

      <FieldGroup
        label="Usage commitment"
        required
        message="Commitment exceeds historical usage by 48%. Confirm with finance."
        messageTone="warning"
      >
        <Input defaultValue="150" suffix="%" aria-invalid aria-label="Usage commitment" />
      </FieldGroup>

      <FieldGroup label="Pilot considerations">
        <TextArea
          rows={4}
          placeholder="Document migration blockers, security reviews, or SLAs."
          aria-label="Pilot considerations"
        />
        <ErrorText tone="info">Notes are visible to all approvers.</ErrorText>
      </FieldGroup>
    </div>
  ),
};
