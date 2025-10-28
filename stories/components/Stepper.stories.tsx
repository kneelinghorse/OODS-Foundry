/**
 * @file Stepper component stories
 */

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stepper } from '~/src/components/stepper/Stepper';
import type { StepDescriptor } from '~/src/components/stepper/types';

const meta: Meta = {
  title: 'Components/Progression/Stepper',
};
export default meta;

type Story = StoryObj;

// ============================================================================
// Basic Stepper Stories
// ============================================================================

export const HorizontalLinear: Story = {
  name: 'Horizontal - Linear (Sequential)',
  render: () => {
    const steps: StepDescriptor[] = [
      { id: '1', label: 'Account Information', status: 'completed' },
      { id: '2', label: 'Billing Details', status: 'current' },
      { id: '3', label: 'Review & Confirm', status: 'incomplete' },
      { id: '4', label: 'Complete', status: 'incomplete' },
    ];

    return (
      <div style={{ padding: 24 }}>
        <Stepper
          steps={steps}
          activeStepId="2"
          orientation="horizontal"
          isLinear={true}
        />
        <p style={{ marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          Linear mode: Users can only navigate to completed or current steps
        </p>
      </div>
    );
  },
};

export const HorizontalNonLinear: Story = {
  name: 'Horizontal - Non-Linear',
  render: () => {
    const [activeId, setActiveId] = useState('2');

    const steps: StepDescriptor[] = [
      { id: '1', label: 'Select Plan', status: activeId === '1' ? 'current' : 'completed' },
      { id: '2', label: 'Add Payment', status: activeId === '2' ? 'current' : 'incomplete' },
      { id: '3', label: 'Configure Settings', status: activeId === '3' ? 'current' : 'incomplete', isOptional: true },
      { id: '4', label: 'Review', status: activeId === '4' ? 'current' : 'incomplete' },
    ];

    return (
      <div style={{ padding: 24 }}>
        <Stepper
          steps={steps}
          activeStepId={activeId}
          orientation="horizontal"
          isLinear={false}
          onStepClick={(id) => {
            console.log('Navigate to step:', id);
            setActiveId(id);
          }}
        />
        <p style={{ marginTop: 24, fontSize: 14, color: '#6b7280' }}>
          Non-linear mode: Click any step to navigate (step 3 is optional)
        </p>
        <div style={{ marginTop: 16, fontSize: 14 }}>
          <strong>Current step:</strong> {activeId}
        </div>
      </div>
    );
  },
};

export const VerticalOrientation: Story = {
  name: 'Vertical Orientation',
  render: () => {
    const steps: StepDescriptor[] = [
      { id: '1', label: 'Create Account', description: 'Enter your email and password', status: 'completed' },
      { id: '2', label: 'Verify Email', description: 'Check your inbox for verification link', status: 'current' },
      { id: '3', label: 'Add Profile Details', description: 'Tell us more about yourself', status: 'incomplete' },
      { id: '4', label: 'Set Preferences', description: 'Customize your experience', status: 'incomplete', isOptional: true },
    ];

    return (
      <div style={{ padding: 24, maxWidth: 500 }}>
        <Stepper
          steps={steps}
          activeStepId="2"
          orientation="vertical"
          isLinear={true}
        />
      </div>
    );
  },
};

// ============================================================================
// Step Status Demonstrations
// ============================================================================

export const AllStepStatuses: Story = {
  name: 'All Step Statuses',
  render: () => {
    const steps: StepDescriptor[] = [
      { id: '1', label: 'Completed Step', status: 'completed' },
      { id: '2', label: 'Current Step', status: 'current' },
      { id: '3', label: 'Error Step', status: 'error', description: 'Invalid payment method' },
      { id: '4', label: 'Incomplete Step', status: 'incomplete' },
      { id: '5', label: 'Disabled Step', status: 'disabled', isDisabled: true },
      { id: '6', label: 'Optional Step', status: 'optional', isOptional: true },
    ];

    return (
      <div style={{ padding: 24, maxWidth: 600 }}>
        <Stepper
          steps={steps}
          activeStepId="2"
          orientation="vertical"
          isLinear={false}
        />
        <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Status Reference:</h3>
          <ul style={{ fontSize: 14, color: '#6b7280', marginBottom: 0 }}>
            <li><strong>Completed:</strong> Step finished successfully</li>
            <li><strong>Current:</strong> Active step user is on</li>
            <li><strong>Error:</strong> Step has validation errors</li>
            <li><strong>Incomplete:</strong> Future step not yet started</li>
            <li><strong>Disabled:</strong> Step is not accessible</li>
            <li><strong>Optional:</strong> Step can be skipped</li>
          </ul>
        </div>
      </div>
    );
  },
};

// ============================================================================
// Interactive Workflow Example
// ============================================================================

export const InteractiveWorkflow: Story = {
  name: 'Interactive Workflow Demo',
  render: () => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [hasError, setHasError] = useState(false);

    const stepData = [
      { id: '1', label: 'Choose Package', description: 'Select your subscription tier' },
      { id: '2', label: 'Payment Method', description: 'Add credit card or PayPal' },
      { id: '3', label: 'Billing Address', description: 'Enter shipping information' },
      { id: '4', label: 'Review Order', description: 'Confirm your purchase' },
    ];

    const steps: StepDescriptor[] = stepData.map((data, index) => {
      let status: StepDescriptor['status'] = 'incomplete';

      if (index < currentStepIndex) {
        status = completedSteps.has(index) ? 'completed' : 'incomplete';
      } else if (index === currentStepIndex) {
        status = hasError ? 'error' : 'current';
      }

      return { ...data, status };
    });

    const handleNext = () => {
      setCompletedSteps((prev) => new Set(prev).add(currentStepIndex));
      setCurrentStepIndex((prev) => Math.min(prev + 1, stepData.length - 1));
      setHasError(false);
    };

    const handleBack = () => {
      setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
      setHasError(false);
    };

    const handleSimulateError = () => {
      setHasError(true);
    };

    return (
      <div style={{ padding: 24 }}>
        <Stepper
          steps={steps}
          activeStepId={stepData[currentStepIndex].id}
          orientation="horizontal"
          isLinear={true}
        />

        <div style={{ marginTop: 32, padding: 24, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0, fontSize: 18 }}>
            Step {currentStepIndex + 1}: {stepData[currentStepIndex].label}
          </h3>
          <p style={{ color: '#6b7280' }}>{stepData[currentStepIndex].description}</p>

          {hasError && (
            <div style={{ padding: 12, backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16 }}>
              ⚠ Please fix the errors before continuing
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                backgroundColor: '#fff',
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStepIndex === 0 ? 0.5 : 1,
              }}
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={currentStepIndex === stepData.length - 1 || hasError}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#fff',
                cursor: currentStepIndex === stepData.length - 1 || hasError ? 'not-allowed' : 'pointer',
                opacity: currentStepIndex === stepData.length - 1 || hasError ? 0.5 : 1,
              }}
            >
              {currentStepIndex === stepData.length - 1 ? 'Complete' : 'Next'}
            </button>
            <button
              onClick={handleSimulateError}
              disabled={hasError}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #dc2626',
                backgroundColor: '#fff',
                color: '#dc2626',
                cursor: hasError ? 'not-allowed' : 'pointer',
                opacity: hasError ? 0.5 : 1,
              }}
            >
              Simulate Error
            </button>
          </div>
        </div>
      </div>
    );
  },
};
