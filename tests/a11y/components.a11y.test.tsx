/* @vitest-environment jsdom */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { Button } from '../../src/components/base/Button.js';
import { Badge } from '../../src/components/base/Badge.js';
import { Banner } from '../../src/components/base/Banner.js';
import { PageHeader } from '../../src/components/page/PageHeader.js';

afterEach(() => {
  cleanup();
});

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: originalCanvasGetContext,
  });
});

async function expectNoAxeViolations(element: ReactElement) {
  const { container } = render(element);
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
}

describe('Accessibility | OODS primitives', () => {
  it('Button passes axe checks', async () => {
    await expectNoAxeViolations(<Button intent="success">Create</Button>);
  });

  it('Badge passes axe checks', async () => {
    await expectNoAxeViolations(<Badge tone="warning">Draft</Badge>);
  });

  it('Banner passes axe checks', async () => {
    await expectNoAxeViolations(<Banner status="trialing" domain="subscription" />);
  });
});

describe('Accessibility | Page primitives', () => {
  it('PageHeader composition is accessible', async () => {
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
      />
    );
  });
});
