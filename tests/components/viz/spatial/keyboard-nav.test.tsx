/**
 * Keyboard navigation utilities tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { setupKeyboardNav, handleArrowKeys } from '../../../../src/components/viz/spatial/utils/keyboard-nav-utils.js';

function NavHarness({ featureIds }: { featureIds: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoomEvent, setZoomEvent] = useState<string | null>(null);
  const [panEvent, setPanEvent] = useState<string | null>(null);

  useEffect(() => {
    return setupKeyboardNav(containerRef, featureIds, {
      getCurrentFeatureId: () => focused,
      onFocus: setFocused,
      onSelect: setSelected,
      onClear: () => setSelected(null),
      onZoomIn: () => setZoomEvent('in'),
      onZoomOut: () => setZoomEvent('out'),
      onPan: (direction) => setPanEvent(direction),
    });
  }, [featureIds, focused]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-focused={focused ?? ''}
      data-selected={selected ?? ''}
      data-zoom={zoomEvent ?? ''}
      data-pan={panEvent ?? ''}
    />
  );
}

describe('keyboard-nav-utils', () => {
  it('cycles focus with arrow keys and selects with Enter', () => {
    const { container } = render(<NavHarness featureIds={['a', 'b', 'c']} />);
    const target = container.firstElementChild as HTMLElement;
    target.focus();

    fireEvent.keyDown(target, { key: 'ArrowRight' });
    expect(target.dataset.focused).toBe('a');

    fireEvent.keyDown(target, { key: 'ArrowRight' });
    expect(target.dataset.focused).toBe('b');

    fireEvent.keyDown(target, { key: 'Enter' });
    expect(target.dataset.selected).toBe('b');

    fireEvent.keyDown(target, { key: 'Escape' });
    expect(target.dataset.selected).toBe('');
  });

  it('handles zoom and pan keys', () => {
    const { container } = render(<NavHarness featureIds={['x']} />);
    const target = container.firstElementChild as HTMLElement;
    target.focus();

    fireEvent.keyDown(target, { key: '+' });
    expect(target.dataset.zoom).toBe('in');

    fireEvent.keyDown(target, { key: '-' });
    expect(target.dataset.zoom).toBe('out');

    fireEvent.keyDown(target, { key: 'ArrowLeft' });
    expect(target.dataset.pan).toBe('left');
  });

  it('handleArrowKeys cycles list', () => {
    const next = handleArrowKeys(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 'b', ['a', 'b', 'c']);
    expect(next).toBe('c');
    const wrap = handleArrowKeys(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), 'a', ['a', 'b', 'c']);
    expect(wrap).toBe('c');
  });
});
