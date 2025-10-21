import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Dialog } from '../../src/components/Dialog/Dialog';

describe('Dialog (a11y smoke)', () => {
  it('exposes role=dialog and aria-modal', () => {
    render(
      <Dialog open onOpenChange={() => {}} title="Title" description="Desc">
        <button>ok</button>
      </Dialog>
    );
    const dlg = screen.getByRole('dialog') as HTMLElement;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });
});
