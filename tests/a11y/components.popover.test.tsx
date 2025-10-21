import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Popover } from '../../src/components/Popover/Popover';

describe('Popover (a11y/jsdom)', () => {
  it('toggles open/close on trigger click', async () => {
    render(
      <Popover title="Menu" trigger={<button>Open</button>}>
        <div>Body</div>
      </Popover>
    );
    const btn = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(btn);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
