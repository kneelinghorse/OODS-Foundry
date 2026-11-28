/**
 * s255-m01 (G3, R3 §5.2 run D): a team's memory table keeps superseded_by, a key to its own kind naming the memory that
 * replaced this one. The importer proposed it as a category tree (Classifiable, an adjacency hierarchy). A reference to
 * the record's own kind named for what replaced it, or what it replaces, is now a replacement pointer: Supersedable,
 * bound where the key is text, and never a taxonomy. Any other self-reference is read as before.
 */
import { expect, it } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';

// R3 run D's table, written for that pass as a team might keep memories in Postgres (not any product's schema), trimmed.
const memories = (key = 'uuid', column = 'superseded_by') => `CREATE TYPE memory_state AS ENUM ('active', 'superseded', 'forgotten');
CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE memories (
  id ${key} PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  state memory_state NOT NULL DEFAULT 'active',
  ${column} ${key} REFERENCES memories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);`;
const proposals = (content: string) => draftSource({ content, format: 'sql' }).drafts.find(item => item.name === 'Memories')!.proposals;

it("proposes run D's superseded_by as a replacement pointer, not a category tree", () => {
  const found = proposals(memories());
  expect(found.map(item => item.trait.name)).not.toContain('Classifiable');
  const lineage = found.find(item => item.trait.name === 'Supersedable')!;
  expect(lineage).toMatchObject({ grade: 'medium', valid: true, trait: { parameters: { states: ['active', 'superseded'], initialState: 'active', recordedDirection: 'forward' } } });
  // Supersedable keeps the pointer as text, so a uuid key is named but not bound, and the proposal stays valid.
  expect(lineage.trait.fieldBindings?.superseded_by).toBeNull();
  expect(lineage.evidence).toEqual([expect.objectContaining({ pointer: '/statements/2/columns/4', kind: 'structure', reason: "superseded_by references Memories, this record's own kind, and is named for the record that replaced this one: a replacement pointer (superseded_by), not a category tree; confirm before accepting. It is not held as text, so it is not bound." })]);
  // The record's own state is still its lifecycle.
  expect(found.find(item => item.trait.name === 'Stateful')!.trait.fieldBindings?.status).toBe('state');
});

it('binds a text pointer, reads replaced_by the same way, and supersedes or replaces as the backward pointer', () => {
  const forward = proposals(memories('text', 'replaced_by')).find(item => item.trait.name === 'Supersedable')!;
  expect(forward).toMatchObject({ valid: true, trait: { fieldBindings: expect.objectContaining({ superseded_by: 'replaced_by' }), parameters: { recordedDirection: 'forward' } } });
  for (const column of ['supersedes', 'replaces_id']) {
    const backward = proposals(memories('text', column)).find(item => item.trait.name === 'Supersedable')!;
    expect(backward, column).toMatchObject({ valid: true, trait: { fieldBindings: expect.objectContaining({ supersedes: column }), parameters: { recordedDirection: 'backward' } } });
    expect(proposals(memories('text', column)).map(item => item.trait.name), column).not.toContain('Classifiable');
  }
});

it('still offers a category tree for any other self-reference', () => {
  const found = proposals(memories('uuid', 'parent_id'));
  expect(found.map(item => item.trait.name)).toContain('Classifiable');
  expect(found.map(item => item.trait.name)).not.toContain('Supersedable');
});
