/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../apps/playground/src/App';

const { healthCheck, runPipeline, runTool, runMapApply } = vi.hoisted(() => ({
  healthCheck: vi.fn(),
  runPipeline: vi.fn(),
  runTool: vi.fn(),
  runMapApply: vi.fn(),
}));

vi.mock('../../apps/playground/src/bridge-client', async () => {
  const actual = await vi.importActual<typeof import('../../apps/playground/src/bridge-client')>(
    '../../apps/playground/src/bridge-client',
  );
  return {
    ...actual,
    healthCheck,
    runPipeline,
    runTool,
    runMapApply,
  };
});

function buildApplied(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    objectId: `applied-${index}`,
    name: `Applied ${index}`,
    action: 'create' as const,
    confidence: 0.92,
    recommendedOodsTraits: ['Stateful', 'Labelled'],
    mappingId: `map-${index}`,
    reason: 'Synthetic applied entry for playground smoke coverage.',
    persisted: false,
  }));
}

function buildQueued(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    objectId: `queued-${index}`,
    name: `Queued ${index}`,
    action: 'create' as const,
    confidence: 0.61,
    threshold: 0.75,
    queueReason: 'below_confidence' as const,
    recommendedOodsTraits: ['Stateful', 'Labelled'],
    reason: 'Synthetic queued entry for playground smoke coverage.',
  }));
}

const linearResult = {
  applied: buildApplied(80),
  skipped: [],
  queued: buildQueued(13),
  conflicted: [],
  errors: [],
  diff: {
    create: 80,
    patch: 0,
    skip: 0,
    conflict: 0,
    queued: 13,
    changedFields: [],
    addedTraits: [],
    removedTraits: [],
  },
  conflictArtifactPath: '.oods/conflicts/linear.json',
  etag: 'linear-etag',
};

const stripeResult = {
  applied: buildApplied(170),
  skipped: [],
  queued: buildQueued(25),
  conflicted: [],
  errors: [],
  diff: {
    create: 170,
    patch: 0,
    skip: 0,
    conflict: 0,
    queued: 25,
    changedFields: [],
    addedTraits: [],
    removedTraits: [],
  },
  conflictArtifactPath: '.oods/conflicts/stripe.json',
  etag: 'stripe-etag',
};

const syntheticPatchResult = {
  applied: [
    {
      objectId: 'obj-command-menu',
      name: 'Command Menu Trigger',
      action: 'create' as const,
      confidence: 0.94,
      recommendedOodsTraits: ['Stateful', 'Labelled'],
      mappingId: 'linear-command-menu-trigger',
      reason: 'Synthetic create entry.',
      persisted: false,
    },
    {
      objectId: 'obj-issue-row',
      name: 'Issue Row',
      action: 'patch' as const,
      confidence: 0.88,
      recommendedOodsTraits: ['Listable', 'Sortable'],
      existingMapId: 'linear-issue-row',
      mappingId: 'linear-issue-row',
      reason: 'Synthetic patch entry.',
      persisted: false,
      diff: {
        added_traits: ['Sortable'],
        removed_traits: [],
        changed_fields: [
          {
            field: 'oodsTraits',
            from: ['Listable'],
            to: ['Listable', 'Sortable'],
          },
        ],
      },
    },
  ],
  skipped: [
    {
      objectId: 'obj-billing-plan-card',
      name: 'Billing Plan Card',
      action: 'skip' as const,
      confidence: 0.97,
      recommendedOodsTraits: ['Priceable', 'Stateful'],
      existingMapId: 'linear-billing-plan-card',
      mappingId: 'linear-billing-plan-card',
      reason: 'Synthetic skip entry.',
      persisted: false,
    },
  ],
  queued: buildQueued(1),
  conflicted: [
    {
      objectId: 'obj-workspace-switcher',
      name: 'Workspace Switcher',
      action: 'conflict' as const,
      confidence: 0.82,
      existingMapId: 'linear-workspace-switcher',
      reason: 'Synthetic conflict entry.',
    },
  ],
  errors: [],
  diff: {
    create: 1,
    patch: 1,
    skip: 1,
    conflict: 1,
    queued: 1,
    changedFields: ['oodsTraits'],
    addedTraits: ['Sortable'],
    removedTraits: [],
  },
  conflictArtifactPath: '.oods/conflicts/synthetic.json',
  etag: 'synthetic-etag',
};

describe('playground app', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');

    healthCheck.mockResolvedValue({ ok: true });
    runPipeline.mockResolvedValue({
      ok: true,
      tool: 'pipeline',
      mode: 'dry-run',
      result: null,
    });
    runTool.mockResolvedValue({
      ok: true,
      tool: 'schema_save',
      mode: 'dry-run',
      result: {},
    });
    runMapApply.mockImplementation((reportPath: string) =>
      Promise.resolve({
        ok: true,
        tool: 'map_apply',
        mode: 'dry-run',
        result: reportPath.includes('reconciliation-report-v1.0.0')
          ? syntheticPatchResult
          : reportPath.includes('reconciliation-report-v1.1.0')
            ? syntheticPatchResult
            : reportPath.includes('stripe-reconciliation-s43-validation')
              ? stripeResult
              : linearResult,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the compose view by default with the existing starter flow', async () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Compose' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Type an intent to see a live preview')).toBeTruthy();

    await waitFor(() => expect(healthCheck).toHaveBeenCalled());
  });

  it('switches to the Stage1 mode and reloads when the fixture changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Stage1' }));

    expect(await screen.findByText('Reconciliation dry-run against live Stage1 captures')).toBeTruthy();

    await waitFor(() =>
      expect(runMapApply).toHaveBeenCalledWith(expect.stringContaining('linear-reconciliation-s43-validation'), 0.75),
    );
    expect(await screen.findByText('https://linear.app/')).toBeTruthy();
    expect(
      await screen.findByText(/80 applied, 13 queued at minConfidence 0\.75/),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Stripe (v1.1.0)' }));

    await waitFor(() =>
      expect(runMapApply).toHaveBeenCalledWith(expect.stringContaining('stripe-reconciliation-s43-validation'), 0.75),
    );
    expect(await screen.findByText('https://stripe.com/')).toBeTruthy();
    expect(
      await screen.findByText(/170 applied, 25 queued at minConfidence 0\.75/),
    ).toBeTruthy();
  });
});
