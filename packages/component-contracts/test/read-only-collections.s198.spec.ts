import { describe, expect, it } from 'vitest';
import { formatReadOnlyValue } from '../src/date-time.js';

describe('read-only collection summaries stay truthful without dumping object internals', () => {
  it('states an actual record count instead of rendering [object Object]', () => {
    const memberships = [{ organizationId: 'org-1', roleId: 'role-1' }, { organizationId: 'org-2', roleId: 'role-2' }];
    const original = structuredClone(memberships);
    expect(formatReadOnlyValue(memberships, 'array')).toBe('2 records');
    expect(formatReadOnlyValue(memberships.slice(0, 1), 'array')).toBe('1 record');
    expect(memberships).toEqual(original);
  });
  it('keeps namespace names readable and distinguishes an empty collection from missing data', () => {
    expect(formatReadOnlyValue(['notifications', 'privacy'], 'array')).toBe('notifications, privacy');
    expect(formatReadOnlyValue([], 'array')).toBe('None recorded');
    expect(formatReadOnlyValue(undefined, 'array')).toBe('Not recorded');
  });
});
