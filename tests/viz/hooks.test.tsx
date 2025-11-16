// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHighlight } from '../../src/viz/hooks/useHighlight.js';
import { useTooltip } from '../../src/viz/hooks/useTooltip.js';
import { useFilter } from '../../src/viz/hooks/useFilter.js';
import { useBrush } from '../../src/viz/hooks/useBrush.js';
import { useZoom } from '../../src/viz/hooks/useZoom.js';

describe('viz hooks', () => {
  it('creates highlight interaction with sensible defaults', () => {
    const { result, rerender } = renderHook(({ fields }) => useHighlight({ fields }), {
      initialProps: { fields: ['region'] },
    });

    expect(result.current.rule.bindTo).toBe('visual');
    expect(result.current.rule.property).toBe('fillOpacity');
    expect(result.current.select.fields).toEqual(['region']);

    const first = result.current;
    rerender({ fields: ['region'] });
    expect(result.current).toBe(first);
  });

  it('creates tooltip interaction with custom trigger', () => {
    const { result } = renderHook(() => useTooltip({ fields: ['region', 'mrr'], trigger: 'focus', id: 'custom-tooltip' }));

    expect(result.current.id).toBe('custom-tooltip');
    expect(result.current.select.on).toBe('focus');
    expect(result.current.rule.bindTo).toBe('tooltip');
    expect(result.current.rule.fields).toEqual(['region', 'mrr']);
  });

  it('creates filter interaction with interval encodings', () => {
    const { result } = renderHook(() => useFilter({ encodings: ['x'], event: 'drag' }));

    expect(result.current.rule.bindTo).toBe('filter');
    expect(result.current.select.type).toBe('interval');
    expect(result.current.select.encodings).toEqual(['x']);
  });

  it('creates brush interaction spanning both axes', () => {
    const { result } = renderHook(() => useBrush({ encodings: ['x', 'y'] }));

    expect(result.current.select.encodings).toEqual(['x', 'y']);
    expect(result.current.rule.bindTo).toBe('filter');
  });

  it('binds zoom interactions to scales', () => {
    const { result } = renderHook(() => useZoom({ encodings: ['x'], event: 'wheel' }));

    expect(result.current.rule.bindTo).toBe('zoom');
    expect(result.current.select.bind).toBe('scales');
    expect(result.current.select.encodings).toEqual(['x']);
  });
});
