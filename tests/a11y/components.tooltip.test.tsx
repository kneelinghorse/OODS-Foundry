import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Tooltip } from '../../src/components/Tooltip';

describe('Tooltip (a11y/jsdom)', () => {
  it('shows tooltip on hover after delay and hides on leave', async () => {
    render(
      <Tooltip content="Info" delay={{ open: 0, close: 0 }}>
        <button>Target</button>
      </Tooltip>
    );
    const btn = screen.getByRole('button', { name: 'Target' });
    fireEvent.mouseEnter(btn);
    const tip = await screen.findByRole('tooltip');
    expect(tip && tip.textContent).toContain('Info');
    // explorer Tooltip sets data-open only when visible
    expect(tip.getAttribute('data-open')).toBe('true');
    fireEvent.mouseLeave(btn);
    await waitFor(() => {
      const t = screen.getByRole('tooltip', { hidden: true });
      expect(t.getAttribute('data-open')).toBeNull();
      expect(t.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
