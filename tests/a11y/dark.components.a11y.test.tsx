/* @vitest-environment jsdom */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';

// OODS components
import { Button } from '../../src/components/base/Button.js';
import { Badge } from '../../src/components/base/Badge.js';
import { Banner } from '../../src/components/base/Banner.js';
import { PageHeader } from '../../src/components/page/PageHeader.js';

// Explorer components (used as additional coverage targets)
import { Input } from '../../apps/explorer/src/components/Input';

afterEach(() => {
  cleanup();
});

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  // Stub canvas.getContext for axe color-contrast checks under jsdom
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  });

  // Simulate Dark theme for Tailwind/vars by toggling the root class
  document.documentElement.classList.add('dark');
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: originalCanvasGetContext,
  });
  document.documentElement.classList.remove('dark');
});

async function expectNoAxeViolations(element: ReactElement) {
  const { container, unmount } = render(element);
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
}

describe('Accessibility | Dark theme smoke (components)', () => {
  it('Button (dark) passes axe checks', async () => {
    await expectNoAxeViolations(<Button intent="success">Create</Button>);
  });

  it('Badge (dark) passes axe checks', async () => {
    await expectNoAxeViolations(<Badge tone="warning">Draft</Badge>);
  });

  it('Banner (dark) passes axe checks', async () => {
    await expectNoAxeViolations(
      <Banner title="Heads up" description="Something noteworthy here." tone="info" />
    );
  });

  it('Input (dark) passes axe checks', async () => {
    await expectNoAxeViolations(<Input label="Label" defaultValue="Value" />);
  });

  it(
    'PageHeader (dark) passes axe checks',
    async () => {
      await expectNoAxeViolations(
        <PageHeader
          title="Acme, Inc."
          subtitle="Customer account"
          badges={[
            { id: 'status-active', label: 'Active', tone: 'success' },
            { id: 'status-risk', label: 'Risk', tone: 'critical' },
          ]}
          actions={[
            { id: 'primary', label: 'Edit', intent: 'success' },
            { id: 'secondary', label: 'Disable', intent: 'danger' },
          ]}
          metadata={<span>Last updated 2 days ago</span>}
        />,
      );
    },
    /**
     * Axe runs significantly slower once V8 coverage instrumentation is enabled,
     * so give the PageHeader scenario extra time when the coverage suite executes.
     */
    15000,
  );
});
