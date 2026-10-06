import { describe, expect, it } from 'vitest';
import { formatReferenceLabel } from '../src/date-time.js';
import { traitEventRows } from '../src/trait-recipes.js';

describe('s216 review wording stays honest without repeated state titles', () => {
  it('distinguishes an unresolved reference from an absent reference and a supplied name', () => {
    expect(formatReferenceLabel('org-1', undefined, 'Organization')).toBe('Organization reference not resolved');
    expect(formatReferenceLabel(undefined, undefined, 'Organization')).toBe('Organization unavailable');
    expect(formatReferenceLabel('org-1', 'Cedar', 'Organization')).toBe('Cedar');
  });
  it('does not append a transition that the authored title already says', () => {
    const events = traitEventRows('transition', { history: [
      { from: null, to: 'draft', title: 'Created · Draft', at: '2026-09-01T00:00:00Z' },
      { from: 'draft', to: 'active', title: 'Approved', at: '2026-09-02T00:00:00Z' },
    ] });
    expect(events.map(event => event.title)).toEqual(['Created · Draft', 'Approved · Draft → Active']);
  });
});
