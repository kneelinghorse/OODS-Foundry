/**
 * s255-m04 (settled 8): a related row's line prints a field's declared words for its values, never the stored code, and
 * its words for no value where the record holds none. So a memory listed on its person's page reads "How it was made:
 * Said by the person it is about", or "How it was made: Not known" where the product does not say, as its own list does.
 * A field without declared words prints its value as before, and a value an except hides stays hidden.
 */
import { describe, expect, it } from 'vitest';
import { resolveRelatedListRows, type RelatedList, type RelatedObject } from '../src/related-lists.js';

const person: RelatedObject = { name: 'User', key: 'user_id', titleField: 'name' };
const ruth = { user_id: 'u1', name: 'Ruth Adeyemi' };
const memory = (id: string, extra: Record<string, unknown>) => ({ memory_id: id, name: `Memory ${id}`, status: 'active', about_id: 'u1', kept_by_name: 'Billing Agent', ...extra });
const origin = { told: 'Said by the person it is about', inferred: 'Concluded, not said by the person', '': 'Not known' };
const target = (records: Array<Record<string, unknown>>, labelled = true): Record<string, RelatedObject> => ({
  Memory: { name: 'Memory', key: 'memory_id', titleField: 'name', records, ...(labelled ? { valueLabels: { origin } } : {}) },
});
const lines = (list: RelatedList, objects: Record<string, RelatedObject>) => resolveRelatedListRows(list, person, ruth, objects).rows.map(row => row.line);

describe('a related row prints the words a field declares for its values', () => {
  const plain: RelatedList = { id: 'kept', label: 'What is kept about {name}', sources: [{ from: 'Memory', via: 'about_id', row: { line: ['origin', 'kept_by_name'] } }] } as RelatedList;
  const captioned: RelatedList = { ...plain, sources: [{ from: 'Memory', via: 'about_id', row: { line: [{ field: 'origin', says: 'How it was made' }, { field: 'kept_by_name', says: 'Kept by' }] } }] } as RelatedList;
  const records = [memory('m1', { origin: 'told' }), memory('m2', { origin: 'inferred' }), memory('m3', {})];

  it('prints the label of a stored value, and the words for no value where the record holds none', () => {
    expect(lines(plain, target(records))).toEqual([
      ['Said by the person it is about', 'Billing Agent'], ['Concluded, not said by the person', 'Billing Agent'], ['Not known', 'Billing Agent'],
    ]);
  });

  it('captions the label as it captions a value', () => {
    expect(lines(captioned, target(records))).toEqual([
      ['How it was made: Said by the person it is about', 'Kept by: Billing Agent'],
      ['How it was made: Concluded, not said by the person', 'Kept by: Billing Agent'],
      ['How it was made: Not known', 'Kept by: Billing Agent'],
    ]);
  });

  it('prints the stored value, and nothing for no value, where the field declares no words', () => {
    expect(lines(captioned, target(records, false))).toEqual([
      ['How it was made: told', 'Kept by: Billing Agent'], ['How it was made: inferred', 'Kept by: Billing Agent'], ['Kept by: Billing Agent'],
    ]);
  });

  it('keeps a value an except hides hidden, and labels the rest', () => {
    const except: RelatedList = { ...plain, sources: [{ from: 'Memory', via: 'about_id', row: { line: [{ field: 'origin', except: 'inferred' }] } }] } as RelatedList;
    expect(lines(except, target(records))).toEqual([['Said by the person it is about'], [], []]);
  });
});
