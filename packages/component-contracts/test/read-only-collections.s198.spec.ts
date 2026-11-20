import { describe, expect, it } from 'vitest';
import { formatReadOnlyValue } from '../src/date-time.js';

describe('read-only collection summaries stay truthful without dumping object internals', () => {
  it('uses an exact authored value label only for display and otherwise keeps the field formatter', () => {
    const labels = { '0': 'No discount', 'false': 'Declined', 'null': 'Recorded as null' };
    expect(formatReadOnlyValue(0, 'number', false, 'percent', labels)).toBe('No discount');
    expect(formatReadOnlyValue(10, 'number', false, 'percent', labels)).toBe('10%');
    expect(formatReadOnlyValue(false, 'boolean', false, undefined, labels)).toBe('Declined');
    expect(formatReadOnlyValue(null, 'string', false, undefined, labels)).toBe('Not recorded');
  });

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
