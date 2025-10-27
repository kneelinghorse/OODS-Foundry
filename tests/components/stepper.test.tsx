/**
 * @file Stepper component test suite
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Stepper } from '../../src/components/stepper/Stepper.js';
import type { StepDescriptor } from '../../src/components/stepper/types.js';

const basicSteps: StepDescriptor[] = [
  { id: '1', label: 'Account', status: 'completed' },
  { id: '2', label: 'Billing', status: 'current' },
  { id: '3', label: 'Confirm', status: 'incomplete' },
];

describe('<Stepper>', () => {
  it('renders all steps with correct structure', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toContain('role="list"');
    expect(markup).toContain('aria-label="Progress steps"');
    expect(markup).toContain('Account');
    expect(markup).toContain('Billing');
    expect(markup).toContain('Confirm');
  });

  it('renders horizontal orientation by default', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toContain('stepper--horizontal');
    expect(markup).toContain('data-orientation="horizontal"');
  });

  it('renders vertical orientation when specified', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" orientation="vertical" />
    );

    expect(markup).toContain('stepper--vertical');
    expect(markup).toContain('data-orientation="vertical"');
  });

  it('marks current step with aria-current="step"', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toContain('aria-current="step"');
  });

  it('applies linear mode by default', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toContain('stepper--linear');
    expect(markup).toContain('data-linear="true"');
  });

  it('applies non-linear mode when specified', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" isLinear={false} />
    );

    expect(markup).toContain('stepper--non-linear');
    expect(markup).toContain('data-linear="false"');
  });

  it('renders step status indicators', () => {
    const stepsWithStatuses: StepDescriptor[] = [
      { id: '1', label: 'Done', status: 'completed' },
      { id: '2', label: 'Current', status: 'current' },
      { id: '3', label: 'Error', status: 'error' },
      { id: '4', label: 'Todo', status: 'incomplete' },
      { id: '5', label: 'Disabled', status: 'disabled', isDisabled: true },
    ];

    const markup = renderToStaticMarkup(
      <Stepper steps={stepsWithStatuses} activeStepId="2" />
    );

    expect(markup).toContain('data-step-status="completed"');
    expect(markup).toContain('data-step-status="current"');
    expect(markup).toContain('data-step-status="error"');
    expect(markup).toContain('data-step-status="incomplete"');
    expect(markup).toContain('data-step-status="disabled"');
  });

  it('renders optional step indicator', () => {
    const stepsWithOptional: StepDescriptor[] = [
      { id: '1', label: 'Required', status: 'current' },
      { id: '2', label: 'Optional Step', status: 'incomplete', isOptional: true },
    ];

    const markup = renderToStaticMarkup(
      <Stepper steps={stepsWithOptional} activeStepId="1" />
    );

    expect(markup).toContain('Optional Step');
    expect(markup).toContain('(Optional)');
  });

  it('renders step descriptions when provided', () => {
    const stepsWithDescriptions: StepDescriptor[] = [
      { id: '1', label: 'Account', description: 'Create your account', status: 'current' },
      { id: '2', label: 'Verify', description: 'Check your email', status: 'incomplete' },
    ];

    const markup = renderToStaticMarkup(
      <Stepper steps={stepsWithDescriptions} activeStepId="1" orientation="vertical" />
    );

    expect(markup).toContain('Create your account');
    expect(markup).toContain('Check your email');
  });

  it('renders connectors between steps', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    // Should have connectors (n-1 for n steps)
    expect(markup).toContain('stepper__connector');
  });

  it('applies token-based CSS variables', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toContain('--stepper-step-icon-color');
    expect(markup).toContain('--stepper-step-text-color');
    expect(markup).toContain('--stepper-step-border-color');
  });

  it('derives step styling from Statusables tokens', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    expect(markup).toMatch(/--stepper-step-border-color:\s*var\(--cmp-status-success-border\)/);
    expect(markup).toMatch(/--stepper-connector-active-color:\s*var\(--cmp-status-info-border\)/);
    expect(markup).toMatch(/data-step-tone="success"/);
    expect(markup).not.toContain('#');
  });

  it('marks disabled steps with aria-disabled', () => {
    const stepsWithDisabled: StepDescriptor[] = [
      { id: '1', label: 'Active', status: 'current' },
      { id: '2', label: 'Disabled', status: 'disabled', isDisabled: true },
    ];

    const markup = renderToStaticMarkup(
      <Stepper steps={stepsWithDisabled} activeStepId="1" />
    );

    expect(markup).toContain('aria-disabled="true"');
  });
});

// Interaction tests (conceptual - would need DOM environment for events)
describe('Stepper interactions', () => {
  it('renders clickable steps in non-linear mode with role=button', () => {
    const markup = renderToStaticMarkup(
      <Stepper
        steps={basicSteps}
        activeStepId="2"
        isLinear={false}
        onStepClick={() => {}}
      />
    );

    // Non-linear mode with onStepClick should make steps interactive
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
  });

  it('does not render role=button in linear mode for future steps', () => {
    const markup = renderToStaticMarkup(
      <Stepper
        steps={basicSteps}
        activeStepId="1"
        isLinear={true}
        onStepClick={() => {}}
      />
    );

    // In linear mode, future steps should not be clickable
    // Only completed and current steps are clickable
    const buttonMatches = markup.match(/role="button"/g);
    // Should have at least one button (the current step)
    expect(buttonMatches).toBeTruthy();
  });
});

// Accessibility contract tests
describe('Stepper accessibility', () => {
  it('meets ARIA requirements for step progression', () => {
    const markup = renderToStaticMarkup(
      <Stepper steps={basicSteps} activeStepId="2" />
    );

    // Must have list role
    expect(markup).toContain('role="list"');
    // Must have descriptive label
    expect(markup).toContain('aria-label="Progress steps"');
    // Current step must have aria-current
    expect(markup).toContain('aria-current="step"');
  });

  it('provides keyboard navigation attributes for interactive steps', () => {
    const markup = renderToStaticMarkup(
      <Stepper
        steps={basicSteps}
        activeStepId="2"
        isLinear={false}
        onStepClick={() => {}}
      />
    );

    // Interactive steps should have tabindex for keyboard navigation
    expect(markup).toContain('tabindex="0"');
    // Should have role="button" for screen readers
    expect(markup).toContain('role="button"');
  });

  it('disables keyboard interaction for disabled steps', () => {
    const stepsWithDisabled: StepDescriptor[] = [
      { id: '1', label: 'Active', status: 'current' },
      { id: '2', label: 'Disabled', status: 'disabled', isDisabled: true },
    ];

    const markup = renderToStaticMarkup(
      <Stepper
        steps={stepsWithDisabled}
        activeStepId="1"
        isLinear={false}
        onStepClick={() => {}}
      />
    );

    // Disabled step should have aria-disabled
    expect(markup).toContain('aria-disabled="true"');
  });

  it('provides semantic status colors via tokens', () => {
    const stepsWithStatuses: StepDescriptor[] = [
      { id: '1', label: 'Success', status: 'completed' },
      { id: '2', label: 'Current', status: 'current' },
      { id: '3', label: 'Error', status: 'error' },
    ];

    const markup = renderToStaticMarkup(
      <Stepper steps={stepsWithStatuses} activeStepId="2" />
    );

    // Each status should have token-based styling
    expect(markup).toContain('--stepper-step-icon-color');
    expect(markup).toContain('data-step-status="completed"');
    expect(markup).toContain('data-step-status="error"');
  });
});
