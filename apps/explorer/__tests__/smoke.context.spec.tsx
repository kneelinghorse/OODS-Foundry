/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import ListPage from '../src/pages/ListPage';
import DetailPage from '../src/pages/DetailPage';
import FormPage from '../src/pages/FormPage';
import TimelinePage from '../src/pages/TimelinePage';
import { getStatusStyle } from '../src/components/StatusChip';
import { contrastRatio } from '../../../tools/a11y/contrast.js';

describe('explorer context smoke test', () => {
  it('renders list and detail pages with contextual shells and status chips', () => {
    render(<ListPage />);

    const listShell = screen.getByTestId('list-page');
    expect(listShell).toHaveClass('context-list');
    expect(listShell).toHaveAttribute('data-context', 'list');

    const listStatuses = listShell.querySelectorAll('.status-chip');
    expect(listStatuses.length).toBeGreaterThanOrEqual(6);

    cleanup();

    render(<DetailPage />);
    const detailShell = screen.getByTestId('detail-page');
    expect(detailShell).toHaveClass('context-detail');
    expect(detailShell).toHaveAttribute('data-context', 'detail');

    const detailStatuses = detailShell.querySelectorAll('.status-chip');
    expect(detailStatuses.length).toBeGreaterThanOrEqual(3);
  });

  const expectNoAxeViolations = async (element: ReactElement, testId: string, context: string) => {
    const { container, getByTestId, unmount } = render(element);
    const shell = getByTestId(testId);
    expect(shell).toHaveAttribute('data-context', context);

    const results = await axe.run(container);
    const violationMessages = results.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} → nodes: ${violation.nodes
            .map((node) => node.target.join(' '))
            .join(', ')}`
      )
      .join('\n');

    expect(results.violations, violationMessages || undefined).toHaveLength(0);
    unmount();
  };

  it('renders form and timeline contexts without axe violations', async () => {
    await expectNoAxeViolations(<FormPage />, 'form-page', 'form');
    await expectNoAxeViolations(<TimelinePage />, 'timeline-page', 'timeline');
  });

  it('maps enums to token-backed colors that maintain AA contrast', () => {
    const samples = [
      getStatusStyle('subscription', 'active'),
      getStatusStyle('subscription', 'past_due'),
      getStatusStyle('invoice', 'paid'),
      getStatusStyle('invoice', 'past_due')
    ];

    for (const sample of samples) {
      const foreground = sample.foreground.value;
      const background = sample.background.value;

      expect(foreground, `Missing foreground for ${sample.domain}:${sample.status}`).toBeTruthy();
      expect(background, `Missing background for ${sample.domain}:${sample.status}`).toBeTruthy();

      const ratio = contrastRatio(foreground as string, background as string);
      expect(ratio + Number.EPSILON).toBeGreaterThanOrEqual(4.5);
    }
  });
});
