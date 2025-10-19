/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Toast } from '../../src/components/base/Toast.js';

describe('OODS.Toast', () => {
  it('exposes a polite live region when open', () => {
    const { getByRole } = render(
      <Toast open status="trialing" domain="subscription" title="Trial in progress" />
    );

    const toast = getByRole('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.dataset.state).toBe('open');
    expect(toast.textContent).toContain('Trial in progress');
  });

  it('invokes onOpenChange when Escape is pressed', () => {
    const handleOpenChange = vi.fn();
    const { getByRole } = render(
      <Toast open onOpenChange={handleOpenChange} title="Processing" tone="critical" />
    );

    const toast = getByRole('status');
    fireEvent.keyDown(toast, { key: 'Escape' });
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('auto-dismisses after the configured timeout', () => {
    vi.useFakeTimers();
    try {
      const handleOpenChange = vi.fn();
      render(
        <Toast
          open
          onOpenChange={handleOpenChange}
          autoDismissAfter={1200}
          title="Saved"
          tone="success"
        />
      );

      vi.advanceTimersByTime(1200);
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
