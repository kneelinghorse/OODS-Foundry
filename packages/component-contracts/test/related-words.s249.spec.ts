/**
 * s249-m05 (the fresh read): the words the related-list core writes. Rows past the first five are counted as not shown
 * (never "in your product", which names nowhere a person can go); a row read at its subject's end names that subject
 * ("When the grant ended: …", never "At its end", which reads as the row's own end); and every page's note says in plain
 * words which records the lists show, without a builder's "lists declared here".
 */
import { describe, expect, it } from 'vitest';
import { resolveRelatedListRows, type RelatedList, type RelatedObject } from '../src/related-lists.js';

const subject: RelatedObject = { name: 'Grant', key: 'id', titleField: 'name', noun: { one: 'grant', other: 'grants' }, order: { active: ['revoked'], revoked: [] } };
const grant = { id: 'g1', name: 'Northwind replies', status: 'revoked', state_history: [
  { from: null, to: 'active', at: '2026-10-01T09:00:00Z' },
  { from: 'active', to: 'revoked', at: '2026-10-08T16:00:00Z' },
] };
const tasks = Array.from({ length: 7 }, (_, index) => ({
  id: `t${index + 1}`, name: `Task ${index + 1}`, status: 'needs_input',
  state_history: [{ from: null, to: 'needs_input', at: '2026-10-06T14:00:00Z', grant_id: 'g1' }],
}));
const objects: Record<string, RelatedObject> = { Task: { name: 'Task', key: 'id', titleField: 'name', order: { needs_input: ['done'], done: [] }, records: tasks } };

describe('the words the related-list core writes', () => {
  const list: RelatedList = { id: 'under-way', label: 'Still under way', finality: ['not_final', 'not_known'], sources: [{ from: 'Task', via: 'state_history[].grant_id' }] } as RelatedList;
  const resolved = resolveRelatedListRows(list, subject, grant, objects);

  it.each(['Kestrel Print Co.', 'Who?', 'Welcome!', 'A $& Co.'])('keeps the name %s and ends its sentence just once', name => {
    const result = resolveRelatedListRows({ ...list, empty: 'No grants for {name}.' }, subject, { ...grant, name }, {});
    expect(result.empty).toBe('No grants for ' + name);
  });

  it('adds a sentence stop when the name has none', () => {
    expect(resolveRelatedListRows({ ...list, empty: 'No grants for {name}.' }, subject, grant, {}).empty).toBe('No grants for Northwind replies.');
  });

  it('uses the related object’s authored words in both the badge and its history at the grant’s end', () => {
    const target = { ...objects.Task!, statusLabels: { needs_input: 'Awaiting QA' } };
    const row = resolveRelatedListRows(list, subject, grant, { Task: target }).rows[0]!;
    expect(row.stateLabel).toBe('Awaiting QA');
    expect(row.atEndText).toBe('When the grant ended: Awaiting QA. Now: Awaiting QA.');
  });

  it('counts the rows past the first five as not shown', () => {
    expect(resolved.rows).toHaveLength(7);
    expect(resolved.more).toBe('2 more not shown');
  });

  it('reads a row at its subject\'s end in words that name the subject', () => {
    expect(resolved.rows[0]!.atEndText).toBe('When the grant ended: needs input. Now: needs input.');
  });

  it('says once which records the lists show', () => {
    expect(resolved.cannotSee).toBe('These lists show only records here that name Northwind replies by id; records that name Northwind replies only in words, or that another product keeps, are not listed.');
  });
});
