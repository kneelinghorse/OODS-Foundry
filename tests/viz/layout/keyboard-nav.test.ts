import { describe, expect, it, vi } from 'vitest';
import { handleGridNavigationEvent } from '../../../src/viz/layout/keyboard-nav.js';

function createEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  };
}

describe('handleGridNavigationEvent', () => {
  it('moves focus left/right and clamps to bounds', () => {
    const focusAt = vi.fn();
    const config = { columns: 2, totalItems: 4, focusAt };
    const event = createEvent('ArrowRight');
    const next = handleGridNavigationEvent(event, 0, config);

    expect(next).toBe(1);
    expect(focusAt).toHaveBeenCalledWith(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('wraps when loop is enabled', () => {
    const focusAt = vi.fn();
    const config = { columns: 2, totalItems: 4, focusAt, loop: true };
    const event = createEvent('ArrowLeft');
    const next = handleGridNavigationEvent(event, 0, config);

    expect(next).toBe(3);
    expect(focusAt).toHaveBeenCalledWith(3);
  });

  it('ignores non-movement keys', () => {
    const focusAt = vi.fn();
    const config = { columns: 2, totalItems: 4, focusAt };
    const event = createEvent('Enter');
    const next = handleGridNavigationEvent(event, 0, config);

    expect(next).toBeUndefined();
    expect(focusAt).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
