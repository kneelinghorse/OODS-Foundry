import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Sheet } from '../../src/components/Sheet/Sheet';

describe('Sheet (a11y smoke)', () => {
  it('exposes role=dialog and aria-modal', () => {
    render(
      <Sheet open onOpenChange={() => {}} anchor="right" size="md">
        <button>ok</button>
      </Sheet>
    );
    const dlg = screen.getByRole('dialog') as HTMLElement;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });
});
