/**
 * s255-m04 (settled 14, G5 and G6): the importer proposes Remembered for a team's own memory store, from three facts
 * together: a person (a reference to a person's record, which binds even when its key is a uuid, for this trait only, or a
 * string field named as a person's id), the free text a memory says, and one signal that it is a memory (a field named for
 * how it was made whose values map to the trait's, a boolean named for a memory made rather than said, or a key named for
 * the memory that replaced it). It grades medium, as Mandate does; a person held only as a named string binds no higher.
 * - Mem0's published record (user_id as a string, memory, synthesized, replaced_by) gets a proposal; how it was made is
 *   the trait's own field and reads "Not known".
 * - A team's own Postgres table (a person reference, a text column, an origin enum and a superseded_by key) gets one;
 *   its origin values read as the trait's words where they map, by the labels acceptance writes.
 * - Microsoft's published record (a scope, no person, no signal and no created time) gets none, and a chat table (a
 *   person and text, no signal) gets none. A store of files has no schema to import.
 * After acceptance each composes the trait and renders list, detail and card.
 */
import { vi } from 'vitest';

vi.setConfig({ testTimeout: 300_000 });

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { draftSource, type Proposal } from '../../src/importer/draft.js';
import { memoryOrigin } from '../../src/importer/proposals.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';

/** The four sources, with where each comes from (test/fixtures/importer/remembered-sources.s255.json). */
type Source = { name: string; content: string; cite: string };
const SOURCES = (JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/importer/remembered-sources.s255.json'), 'utf8')) as { sources: Record<'mem0' | 'postgres' | 'microsoft' | 'files', Source> }).sources;
const source = (key: keyof typeof SOURCES) => ({ name: SOURCES[key].name, content: SOURCES[key].content });

const remembered = (proposals: Proposal[]) => proposals.find(proposal => proposal.trait.name === 'Remembered');
const draftOf = (result: ReturnType<typeof draftSource>, name: string) => result.drafts.find(item => item.name === name)!;

describe('how a memory was made, read from a source\'s own value by its words', () => {
  it('maps a value whose words name one of the five, and nothing where they name none or two', () => {
    expect(['user_stated', 'assistant_inferred', 'admin_added', 'imported', 'told', 'synthesized', 'added_by_someone_else'].map(memoryOrigin))
      .toEqual(['told', 'inferred', 'added_by_someone_else', 'imported', 'told', 'combined', 'added_by_someone_else']);
    expect(['user_added', 'chat', 'procedural', 'user_profile', 3, null].map(memoryOrigin)).toEqual([undefined, undefined, undefined, 'told', undefined, undefined]);
  });
});

describe('the importer proposes Remembered where a source holds a person, the words and one signal', () => {
  it('on Mem0\'s published record: the user id as a named string, the memory, and its synthesized flag and replacement key', () => {
    const result = draftSource(source('mem0'));
    const proposal = remembered(draftOf(result, 'GetV1MemoriesMemoryIdResponse').proposals)!;
    expect(proposal).toMatchObject({ grade: 'medium', valid: true });
    expect(Object.fromEntries(Object.entries(proposal.trait.fieldBindings!).filter(([, bound]) => bound !== null))).toEqual({
      about_id: 'user_id', words: 'memory', replaced_by_id: 'replaced_by', kept_by_id: 'agent_id',
    });
    // How it was made is left out of the bindings, so the trait keeps its own field, which the source never fills.
    expect(proposal.trait.fieldBindings).not.toHaveProperty('origin');
    // A date is not a date-time: Mem0's expiration_date is left unbound, and so is every seat the record lacks.
    expect(proposal.trait.fieldBindings).toMatchObject({ expires_at: null, about_name: null, made_by_id: null, grant_id: null });
    // So are what removing it would leave and what remains: they always show, and read "Not reported" (s255-m05).
    expect(proposal.trait.fieldBindings).not.toHaveProperty('removing_leaves');
    expect(proposal.trait.fieldBindings).not.toHaveProperty('remains');
    expect(proposal.evidence.map(item => item.reason)).toEqual([
      'user_id is named for a person\'s id: who the memory is about (about_id). It is held as a string, not a reference, so this proposal grades no higher than medium.',
      'memory is free text named for what the memory says (words).',
      'synthesized is a boolean named for a memory made rather than said: a memory, not a message. It is not how it was made, which reads "Not known".',
      'replaced_by is named for the memory that replaced this one (replaced_by_id).',
      'agent_id names the agent whose memory it is (kept_by_id).',
    ]);
    expect(proposal.semantics).toBeUndefined();
    expect(proposal.effects).toMatch(/The source does not say how a memory was made, so how it was made reads "Not known"\. It does not say what removing a memory would leave or what remains once it is removed, so those read "Not reported"\.$/);
    // replaced_by is a plain string, no declared reference, so it is not read as Supersedable (G3 reads declared keys).
    expect(draftOf(result, 'GetV1MemoriesMemoryIdResponse').proposals.some(item => item.trait.name === 'Supersedable')).toBe(false);
  });

  it('on a team\'s Postgres table: the person by a uuid reference, the content, its origin labelled by its words, and its keys', () => {
    const result = draftSource(source('postgres'));
    const memories = draftOf(result, 'Memories');
    const proposal = remembered(memories.proposals)!;
    expect(proposal).toMatchObject({ grade: 'medium', valid: true });
    expect(Object.fromEntries(Object.entries(proposal.trait.fieldBindings!).filter(([, bound]) => bound !== null))).toEqual({
      about_id: 'user_id', words: 'content', origin: 'origin', replaced_by_id: 'superseded_by', kept_by_id: 'agent_id', expires_at: 'expires_at',
    });
    expect(proposal.evidence[0]!.reason).toBe('user_id references Users, a person\'s record: who the memory is about (about_id).');
    expect(proposal.evidence[2]!.reason).toBe('origin is named for how the memory was made, and its values map by their words to the trait\'s (user_stated as told, assistant_inferred as inferred, admin_added as added_by_someone_else, imported as imported): how it was made (origin). A value that maps to none reads "Not known".');
    expect(proposal.semantics).toEqual({ origin: { semantic_type: 'remembered.origin', token_mapping: 'tokenMap(text.body.*)', ui_hints: {
      enumLabels: { user_stated: 'Said by the person it is about', assistant_inferred: 'Concluded, not said by the person', admin_added: 'Added by someone else', imported: 'Copied in from another store' },
      valueLabels: { '': 'Not known' },
    } } });
    expect(proposal.effects).toContain('Acceptance also labels origin\'s values as how a memory was made: user_stated reads "Said by the person it is about"');
    // The person and the agent are not guessed again as an owner; the replacement key is still read as a replacement
    // pointer (G3), never a category tree, so the team accepts Remembered's binding or Supersedable's.
    expect(memories.proposals.map(item => item.trait.name).sort()).toEqual(['Remembered', 'Stateful', 'Supersedable', 'Timestampable']);
    // A chat table has a person and text but no signal of a memory; conversations and the event log have no text.
    for (const name of ['Messages', 'Conversations', 'MemoryEvents', 'Users', 'Agents']) expect(remembered(draftOf(result, name).proposals), name).toBeUndefined();
  });

  it('on Microsoft\'s published record: none, for it holds no person, no created time and no signal; its scope is not a person', () => {
    const result = draftSource(source('microsoft'));
    const item = draftOf(result, 'MemoryItem');
    expect(Object.keys(item.definition.schema).sort()).toEqual(['content', 'kind', 'memory_id', 'scope', 'updated_at']);
    expect(remembered(item.proposals)).toBeUndefined();
  });

  it('on a store of files: nothing to import, so no proposal', () => {
    expect(() => draftSource(source('files'))).toThrow();
  });

  // s255-m05 (the fresh read): a key named supersedes or replaces names the memory this one replaced, the other way from
  // the trait's replaced_by_id, so it is never bound as what replaced it and is no signal of its own.
  it('reads a key named supersedes or replaces as pointing back: never what replaced it, and no signal', () => {
    const store = (key: string, origin: boolean) => ({ name: 'memory.sql', content: [
      'CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL);',
      ...(origin ? ["CREATE TYPE memory_origin AS ENUM ('user_stated', 'assistant_inferred');"] : []),
      `CREATE TABLE memories (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users (id), content text NOT NULL,${origin ? ' origin memory_origin NOT NULL,' : ''} ${key} uuid REFERENCES memories (id), created_at timestamptz NOT NULL);`,
    ].join('\n') });
    for (const key of ['supersedes', 'supersedes_id', 'replaces', 'replaces_id']) {
      expect(remembered(draftOf(draftSource(store(key, false)), 'Memories').proposals), key).toBeUndefined();
      const proposal = remembered(draftOf(draftSource(store(key, true)), 'Memories').proposals)!;
      expect(proposal, key).toMatchObject({ grade: 'medium', valid: true });
      expect(proposal.trait.fieldBindings!.replaced_by_id ?? null, key).toBeNull();
      expect(Object.values(proposal.trait.fieldBindings!), key).not.toContain(key);
    }
    for (const key of ['replaced_by', 'superseded_by_id']) {
      expect(remembered(draftOf(draftSource(store(key, false)), 'Memories').proposals)!.trait.fieldBindings!.replaced_by_id, key).toBe(key);
    }
  });
});

describe('acceptance', () => {
  let work: string;
  const keys = ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'OODS_FOUNDRY_HOME', 'MCP_SCHEMA_STORE_ROOT'];
  beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 's255-remembered-')); for (const key of keys) process.env[key] = path.join(work, key); fs.mkdirSync(process.env.OODS_OBJECTS_DIR!, { recursive: true }); reloadDefinitions(); });
  afterEach(() => { for (const key of keys) delete process.env[key]; reloadDefinitions(); fs.rmSync(work, { recursive: true, force: true }); });
  const accept = async (source: { content: string; name: string }, chosen: string[]) => {
    const staged = await importObjects({ action: 'draft', source } as never) as any;
    const drafts = JSON.parse(fs.readFileSync(path.join(staged.directory, 'import.json'), 'utf8')).drafts as Array<{ name: string; proposals: Proposal[] }>;
    const objects = drafts.map(item => ({ name: item.name, proposals: item.proposals.filter(p => p.valid && chosen.includes(p.trait.name)).map(p => p.id) }));
    return importObjects({ action: 'apply', importId: staged.importId, objects, overwrite: true, confirmShipped: objects.map(item => item.name) } as never) as Promise<any>;
  };
  const html = async (object: string, context: string) => {
    const result = await pipeline({ object, context, framework: 'html', options: { skipValidation: true } } as never) as { status?: string; render?: { html?: string }; errors?: unknown; error?: unknown };
    expect(result.render?.html, `${object}/${context}: ${JSON.stringify(result).slice(0, 600)}`).toBeTruthy();
    return String(result.render?.html ?? '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  };

  it('composes Mem0\'s accepted record in list, detail and card, reading "Not known" for how it was made', async () => {
    await accept(source('mem0'), ['Remembered', 'Timestampable']);
    for (const context of ['list', 'detail', 'card']) {
      const text = await html('GetV1MemoriesMemoryIdResponse', context);
      expect(text, context).toMatch(/How it was made\s+Not known|Not known\s+How it was made/);
      // No row reads one of the five: the list's filter offers them as choices, and every record reads "Not known".
      expect(text, context).not.toMatch(/How it was made:? (Said by the person|Concluded|Made from other|Copied in|Added by someone)/);
      // The store says nothing of what removing a memory would leave, and its page says so.
      if (context === 'detail') expect(text, context).toMatch(/Removing it would leave\s+Not reported/);
    }
  });

  it('composes the Postgres store\'s accepted record, reading its origin values in the trait\'s words', async () => {
    const applied = await accept(source('postgres'), ['Remembered', 'Stateful', 'Timestampable']);
    expect(applied.applied.map((item: { name: string }) => item.name)).toContain('Memories');
    // A memory is shown, never edited, in OODS Foundry: the accepted record composes no form (so no Edit, Delete or
    // workflow), and shows on a card.
    const contexts = applied.applied.find((item: { name: string }) => item.name === 'Memories').contexts as string[];
    expect(contexts).toContain('card');
    expect(contexts).not.toContain('form');
    const definition = fs.readFileSync(path.join(process.env.OODS_OBJECTS_DIR!, 'Memories.object.yaml'), 'utf8');
    expect(definition).toContain('assistant_inferred: Concluded, not said by the person');
    for (const context of ['list', 'detail', 'card']) {
      const text = await html('Memories', context);
      expect(text, context).toMatch(/How it was made/);
      expect(text, context).toMatch(/Said by the person it is about|Concluded, not said by the person|Added by someone else|Copied in from another store/);
      expect(text, context).not.toMatch(/\b(user_stated|assistant_inferred|admin_added)\b/);
      expect(text, context).not.toMatch(/\b(Edit|Delete)\b/);
    }
    // The store's own removed state, forgotten, is read as the removal: its row shows no words.
    const list = await html('Memories', 'list');
    expect(list).toMatch(/Forgotten/);
    expect(list).not.toMatch(/Forgotten What it says/);
  });
});
