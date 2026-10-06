import { describe, expect, it } from 'vitest';
import { reactBindingReads } from './react-binding-reads.js';
describe('React prop reads', () => {
  it('excludes text, attributes, type names and object keys while preserving real reads and computed keys', () => {
    const result = reactBindingReads('const typed: MissingType = value; return <div title="notes">notes <span>{typed}</span>{({label: actual})[key]}</div>;');
    for (const name of ['value', 'actual', 'key']) expect(result.has(name)).toBe(true);
    for (const name of ['notes', 'title', 'label', 'MissingType', 'typed']) expect(result.has(name)).toBe(false);
  });
  it('distinguishes a callback parameter from the same prop read outside its scope', () => {
    expect(reactBindingReads('return <>{rows.map(row => row.name)}</>;').has('row')).toBe(false);
    expect(reactBindingReads('return <>{rows.map(row => row.name)}{row}</>;').has('row')).toBe(true);
  });
  it('keeps a prop used in a default expression and in a shorthand object', () => {
    const result = reactBindingReads('const events = eventsFor({history}); return <>{events}</>;');
    expect(result.has('history')).toBe(true); expect(result.has('events')).toBe(false);
  });
});
