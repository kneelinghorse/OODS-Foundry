/* @vitest-environment jsdom */

/**
 * @file EmptyState component tests
 * @module tests/components/empty-state
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { EmptyState } from '../../src/components/empty-state/EmptyState.js';
import type { EmptyStateProps } from '../../src/components/empty-state/EmptyState.js';

expect.extend({ toHaveNoViolations });

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  });
});

const BASE_PROPS: EmptyStateProps = {
  headline: 'Workspace empty',
  body: 'Create your first record to start seeing data here.',
};

function renderEmptyState(props: Partial<EmptyStateProps> = {}) {
  return render(<EmptyState {...BASE_PROPS} {...props} />);
}

describe('EmptyState', () => {
  describe('structure', () => {
    it('renders headline with default h2 level', () => {
      renderEmptyState();
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(BASE_PROPS.headline);
    });

    it('honours the headlineLevel prop', () => {
      renderEmptyState({ headlineLevel: 'h3' });
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading.tagName.toLowerCase()).toBe('h3');
    });

    it('renders body when provided and omits it when undefined', () => {
      const { rerender, container } = renderEmptyState();
      expect(screen.getByText(BASE_PROPS.body as string)).toBeInTheDocument();

      rerender(<EmptyState {...BASE_PROPS} body={undefined} />);
      expect(container.querySelector('.empty-state__body')).not.toBeInTheDocument();
    });
  });

  describe('slots', () => {
    it('renders the illustration slot as aria-hidden', () => {
      const illustration = <svg data-testid="hero" aria-hidden focusable="false" />;
      const { container } = renderEmptyState({ illustration });
      const illustrationContainer = container.querySelector('.empty-state__illustration');

      expect(screen.getByTestId('hero')).toBeInTheDocument();
      expect(illustrationContainer).toHaveAttribute('aria-hidden');
    });

    it('renders provided icons and hides them from assistive tech', () => {
      const icon = <svg data-testid="status-icon" aria-hidden focusable="false" />;
      const { container } = renderEmptyState({ icon });
      const iconContainer = container.querySelector('.empty-state__icon');

      expect(screen.getByTestId('status-icon')).toBeInTheDocument();
      expect(iconContainer).toHaveAttribute('aria-hidden');
    });
  });

  describe('actions', () => {
    it('omits the actions container when no actions are provided', () => {
      const { container } = renderEmptyState();
      expect(container.querySelector('.empty-state__actions')).not.toBeInTheDocument();
    });

    it('renders primary and secondary actions in order', () => {
      const { container } = renderEmptyState({
        primaryAction: <button type="button">Primary</button>,
        secondaryAction: <button type="button">Secondary</button>,
      });

      const actions = container.querySelector('.empty-state__actions');
      expect(actions).toBeInTheDocument();

      const buttons = within(actions as HTMLElement).getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent('Primary');
      expect(buttons[1]).toHaveTextContent('Secondary');
    });

    it('appends custom actions content after slot buttons', () => {
      const { container } = renderEmptyState({
        primaryAction: <button type="button">Create</button>,
        actions: <a href="#" data-testid="support-link">Need help?</a>,
      });

      const actions = container.querySelector('.empty-state__actions');
      expect(actions).toBeInTheDocument();

      const actionChildren = Array.from((actions as HTMLElement).children);
      expect(actionChildren[actionChildren.length - 1]).toContainElement(
        screen.getByTestId('support-link')
      );
    });
  });

  describe('tone and tokens', () => {
    it('applies Statusables tokens for success intent', () => {
      const { container } = renderEmptyState({ intent: 'success' });
      const root = container.firstElementChild as HTMLElement;

      expect(root.dataset.intent).toBe('success');
      expect(root.dataset.tone).toBe('success');
      expect(root.style.getPropertyValue('--empty-state-icon-background')).toBe(
        'var(--cmp-status-success-surface)'
      );
      expect(root.style.getPropertyValue('--empty-state-icon-foreground')).toBe(
        'var(--cmp-status-success-text)'
      );
    });

    it('derives tone and icon from Statusables registry when status is provided', () => {
      const { container } = renderEmptyState({ status: 'trialing', domain: 'subscription' });
      const root = container.firstElementChild as HTMLElement;
      const iconContainer = container.querySelector('.empty-state__icon');

      expect(root.dataset.status).toBe('trialing');
      expect(root.dataset.statusDomain).toBe('subscription');
      expect(root.dataset.tone).toBe('accent');
      expect(iconContainer).toHaveTextContent('★');
      expect(root.style.getPropertyValue('--empty-state-icon-background')).toBe(
        'var(--cmp-status-accent-surface)'
      );
      expect(root.style.getPropertyValue('--empty-state-icon-foreground')).toBe(
        'var(--cmp-status-accent-text)'
      );
    });
  });

  describe('accessibility', () => {
    it('passes axe audit for a fully composed state', async () => {
      const illustration = <svg aria-hidden focusable="false" role="presentation" />;
      const { container } = renderEmptyState({
        illustration,
        intent: 'info',
        primaryAction: <button type="button">Primary action</button>,
        secondaryAction: <button type="button">Secondary action</button>,
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('snapshot', () => {
    it('matches snapshot for a configured empty state', () => {
      const illustration = <svg aria-hidden focusable="false" role="presentation" />;
      const { container } = renderEmptyState({
        illustration,
        intent: 'warning',
        headlineLevel: 'h3',
        primaryAction: <button type="button">Retry</button>,
        secondaryAction: <button type="button">Contact support</button>,
      });

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
