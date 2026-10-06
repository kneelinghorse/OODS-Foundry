import { describe, expect, it } from 'vitest';
import { formatDeclaredNumber, formatReadOnlyValue } from '../src/date-time.js';

// s223-m01 (#2527 ruling 4): Usage read "86420" and "12.5". A number reads as a person writes it only when its field
// declares how (ui_hints.format); an undeclared number, such as a year or a score, keeps the digits it was stored with.
describe('declared number formats read as people write them', () => {
  it('groups a quantity and keeps a percent with its sign', () => {
    expect(formatReadOnlyValue(86420, 'integer', false, 'quantity')).toBe('86,420');
    expect(formatReadOnlyValue(12.5, 'number', false, 'percent')).toBe('12.5%');
    expect(formatReadOnlyValue(-41, 'number', false, 'percent')).toBe('-41%');
    expect(formatReadOnlyValue(0, 'number', false, 'percent')).toBe('0%');
  });
  it('changes nothing for an undeclared number or a missing value', () => {
    expect(formatReadOnlyValue(2026, 'integer')).toBe('2026');
    expect(formatReadOnlyValue(86420, 'integer')).toBe('86420');
    expect(formatReadOnlyValue(null, 'integer', false, 'quantity')).toBe('Not recorded');
    expect(formatDeclaredNumber('not a number', 'quantity')).toBeUndefined();
  });
});
