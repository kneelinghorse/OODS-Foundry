/**
 * s255-m01 (R4, settled 12): PostgreSQL reads a key written REFERENCES t, with no column, as a key to t's primary key.
 * The grammar Foundry bundles rejects it, and before this sprint the whole statement was dropped: a hand-written migration
 * lost its table, every list into and out of it, and the later files blamed an "absent" table (a team's hand-written
 * portal migrations). These tests hold that every shorthand form PostgreSQL accepts drafts its table with the key resolved
 * to the target's declared primary key (never a column named id by guess), that each form PostgreSQL rejects is reported
 * at its key with the field kept, and that nothing which parses today is read differently.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { parse } from 'pgsql-ast-parser';
import { canonical } from '../../src/importer/source.js';
import { sqlStatements } from '../../src/importer/readers/sql.js';
import { handle as importObjects, readHandle } from '../../src/tools/object.import.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';
import { loadObject } from '../../src/objects/object-loader.js';

let folder: string;
beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-shorthand-')); });
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));
const sql = (content: string) => draftSource({ content, format: 'sql' });
const write = (name: string, content: string) => { const file = path.join(folder, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const jobs = 'CREATE TABLE portal_jobs (id uuid PRIMARY KEY, title text NOT NULL);\n';
const approvals = (key: string, extra = '') => `CREATE TABLE portal_job_approvals (id uuid PRIMARY KEY, ${key}, decision text${extra});`;
const draft = (result: ReturnType<typeof sql>, name: string) => result.drafts.find(item => item.name === name);
const keys = (result: ReturnType<typeof sql>, name: string) => result.hub.$defs[name]['x-import-foreign-keys'] ?? [];
const reasons = (result: ReturnType<typeof sql>) => result.report.map(entry => entry.reason);
/** Both tables drafted, the relationship declared and the hub key naming the column the list joins on. */
function resolvedTo(result: ReturnType<typeof sql>, referenced: string, source = 'PortalJobApprovals', target = 'PortalJobs', via = 'job_id') {
  expect(result.drafts.map(item => item.name).sort()).toEqual([source, target].sort());
  expect(draft(result, source)!.definition.relationships).toContainEqual(expect.objectContaining({ target, via, cardinality: 'many-to-one' }));
  expect(keys(result, source)).toContainEqual(expect.objectContaining({ via, referenced }));
  expect(draft(result, target)!.lists?.map(item => item.list.sources[0])).toContainEqual(expect.objectContaining({ from: source, via }));
  expect(reasons(result).some(reason => /SQL syntax not mapped/.test(reason))).toBe(false);
}

describe('every shorthand form PostgreSQL accepts drafts its table, with its key resolved to the declared primary key', () => {
  const forms: Record<string, string> = {
    'column-level (A2)': jobs + approvals('job_id uuid NOT NULL REFERENCES portal_jobs'),
    'ON DELETE CASCADE (A3)': jobs + approvals('job_id uuid REFERENCES portal_jobs ON DELETE CASCADE'),
    'ON UPDATE CASCADE (A4)': jobs + approvals('job_id uuid REFERENCES portal_jobs ON UPDATE CASCADE'),
    'ON DELETE SET NULL ON UPDATE NO ACTION (A5)': jobs + approvals('job_id uuid REFERENCES portal_jobs ON DELETE SET NULL ON UPDATE NO ACTION'),
    'MATCH FULL (A6)': jobs + approvals('job_id uuid REFERENCES portal_jobs MATCH FULL'),
    'DEFERRABLE INITIALLY DEFERRED (A7)': jobs + approvals('job_id uuid REFERENCES portal_jobs DEFERRABLE INITIALLY DEFERRED'),
    'a named constraint (A11)': jobs + approvals('job_id uuid CONSTRAINT approvals_job_fk REFERENCES portal_jobs'),
    'lower case (A12)': jobs + approvals('job_id uuid references portal_jobs'),
    'a quoted name (A13)': jobs + approvals('job_id uuid REFERENCES "portal_jobs"'),
    'table-level FOREIGN KEY (B2)': jobs + approvals('job_id uuid', ', FOREIGN KEY (job_id) REFERENCES portal_jobs'),
    'a named table-level key with ON DELETE (B3)': jobs + approvals('job_id uuid', ', CONSTRAINT approvals_job_fk FOREIGN KEY (job_id) REFERENCES portal_jobs ON DELETE CASCADE'),
    'ALTER … ADD CONSTRAINT (C2)': jobs + approvals('job_id uuid') + ' ALTER TABLE portal_job_approvals ADD CONSTRAINT approvals_job_fk FOREIGN KEY (job_id) REFERENCES portal_jobs;',
    'ALTER … ADD FOREIGN KEY (C3)': jobs + approvals('job_id uuid') + ' ALTER TABLE portal_job_approvals ADD FOREIGN KEY (job_id) REFERENCES portal_jobs;',
    'ALTER … ADD COLUMN … REFERENCES (C4)': jobs + 'CREATE TABLE portal_job_approvals (id uuid PRIMARY KEY, decision text); ALTER TABLE portal_job_approvals ADD COLUMN job_id uuid REFERENCES portal_jobs;',
    'public.t (D2)': jobs + approvals('job_id uuid REFERENCES public.portal_jobs'),
  };
  for (const [name, content] of Object.entries(forms)) it(name, () => {
    const result = sql(content);
    resolvedTo(result, 'id');
    expect(Object.keys(draft(result, 'PortalJobApprovals')!.definition.schema).sort()).toEqual(['decision', 'id', 'job_id']);
    expect(reasons(result)).toContain('Shorthand REFERENCES portal_jobs resolved to portal_jobs(id), its declared primary key.');
  });
  it('another schema (D3) resolves to that schema\'s table', () => {
    const result = sql('CREATE TABLE app.portal_jobs (id uuid PRIMARY KEY, title text); ' + approvals('job_id uuid REFERENCES app.portal_jobs'));
    resolvedTo(result, 'id', 'PortalJobApprovals', 'AppPortalJobs');
  });
  it('a self-referencing table drafts on its own, with its self list (I1), where before it drafted nothing', () => {
    const result = sql('CREATE TABLE portal_jobs (id uuid PRIMARY KEY, parent_id uuid REFERENCES portal_jobs, title text);');
    expect(result.drafts.map(item => item.name)).toEqual(['PortalJobs']);
    expect(draft(result, 'PortalJobs')!.definition.relationships).toEqual([expect.objectContaining({ target: 'PortalJobs', via: 'parent_id' })]);
    expect(keys(result, 'PortalJobs')).toEqual([expect.objectContaining({ via: 'parent_id', referenced: 'id' })]);
    expect(draft(result, 'PortalJobs')!.lists).toHaveLength(1);
  });
});

describe('the key is the target\'s declared primary key, never a column guessed as its key', () => {
  it('a primary key not named id (G2)', () => resolvedTo(sql('CREATE TABLE portal_jobs (job_code text PRIMARY KEY, title text); ' + approvals('job_code text REFERENCES portal_jobs')), 'job_code', 'PortalJobApprovals', 'PortalJobs', 'job_code'));
  it('beside a UNIQUE id decoy (G3)', () => {
    const result = sql('CREATE TABLE portal_jobs (job_code text PRIMARY KEY, id uuid UNIQUE, title text); ' + approvals('job_code text REFERENCES portal_jobs'));
    resolvedTo(result, 'job_code', 'PortalJobApprovals', 'PortalJobs', 'job_code');
    const [list] = draft(result, 'PortalJobs')!.lists!;
    expect(list.evidence[0].reason).toBe('PortalJobApprovals.job_code declares a key to PortalJobs.job_code.');
  });
  it('a primary key added by an earlier ALTER (G4)', () => resolvedTo(sql('CREATE TABLE portal_jobs (job_code text NOT NULL, title text); ALTER TABLE portal_jobs ADD CONSTRAINT portal_jobs_pkey PRIMARY KEY (job_code); ' + approvals('job_code text REFERENCES portal_jobs')), 'job_code', 'PortalJobApprovals', 'PortalJobs', 'job_code'));
  it('a key column renamed after the reference (G6) resolves to its new name', () => resolvedTo(sql('CREATE TABLE portal_jobs (job_code text PRIMARY KEY, title text); ' + approvals('job_code text REFERENCES portal_jobs') + ' ALTER TABLE portal_jobs RENAME COLUMN job_code TO job_uid;'), 'job_uid', 'PortalJobApprovals', 'PortalJobs', 'job_code'));
  it('a two-column primary key (F2) resolves to both columns, in order, and keeps the composite rule; both tables draft', () => {
    const result = sql('CREATE TABLE shifts (site_code text, shift_no int, PRIMARY KEY (site_code, shift_no)); CREATE TABLE shift_notes (id uuid PRIMARY KEY, site_code text, shift_no int, FOREIGN KEY (site_code, shift_no) REFERENCES shifts);');
    expect(result.drafts.map(item => item.name).sort()).toEqual(['ShiftNotes', 'Shifts']);
    expect(reasons(result)).toEqual(expect.arrayContaining(['Shorthand REFERENCES shifts resolved to shifts(site_code, shift_no), its declared primary key.', 'Composite foreign key retained in source; a scalar picker cannot express a tuple.']));
    expect(draft(result, 'ShiftNotes')!.definition.relationships ?? []).toEqual([]);
  });
});

describe('order and files: resolved against the final schema, across files', () => {
  it('a target in an earlier file (X2), and a key added by a later file (X3)', () => {
    write('001_jobs.sql', jobs);
    write('002_approvals.sql', approvals('job_id uuid NOT NULL REFERENCES portal_jobs'));
    resolvedTo(draftSource({ path: folder }), 'id');
    write('002_approvals.sql', approvals('job_id uuid NOT NULL'));
    write('003_fk.sql', 'ALTER TABLE portal_job_approvals ADD CONSTRAINT approvals_job_fk FOREIGN KEY (job_id) REFERENCES portal_jobs;');
    resolvedTo(draftSource({ path: folder }), 'id');
  });
  it('a team\'s three migration files (X4): 3 drafts, 2 lists, the later column, and no "absent" line', () => {
    write('001_jobs.sql', jobs);
    write('002_approvals.sql', approvals('job_id uuid NOT NULL REFERENCES portal_jobs'));
    write('003_discounts.sql', 'CREATE TABLE portal_job_discounts (id uuid PRIMARY KEY, approval_id uuid REFERENCES portal_job_approvals(id), amount numeric); ALTER TABLE portal_job_approvals ADD COLUMN discount_note text;');
    const result = draftSource({ path: folder });
    expect(result.drafts.map(item => item.name).sort()).toEqual(['PortalJobApprovals', 'PortalJobDiscounts', 'PortalJobs']);
    expect(result.drafts.reduce((sum, item) => sum + (item.lists?.length ?? 0), 0)).toBe(2);
    expect(draft(result, 'PortalJobApprovals')!.definition.schema).toHaveProperty('discount_note');
    expect(reasons(result).filter(reason => /absent/.test(reason))).toEqual([]);
  });
  it('a target declared later in the file (E2) resolves as an explicit key does, and says PostgreSQL would reject the order', () => {
    const result = sql(approvals('job_id uuid REFERENCES portal_jobs') + ' ' + jobs);
    resolvedTo(result, 'id');
    expect(result.report).toContainEqual(expect.objectContaining({ outcome: 'mapped', reason: expect.stringContaining('The primary key of portal_jobs is declared only after this key; PostgreSQL resolves the key when its statement runs, so it would reject it in this order') }));
  });
  it('a primary key added only after the reference (G5) does the same', () => {
    const result = sql('CREATE TABLE portal_jobs (job_code text NOT NULL, title text); ' + approvals('job_code text REFERENCES portal_jobs') + ' ALTER TABLE portal_jobs ADD PRIMARY KEY (job_code);');
    resolvedTo(result, 'job_code', 'PortalJobApprovals', 'PortalJobs', 'job_code');
    expect(reasons(result).some(reason => reason.includes('declared only after this key'))).toBe(true);
  });
});

describe('each form PostgreSQL rejects, or that cannot be resolved, is reported at its key, and the field is kept', () => {
  const kept = (result: ReturnType<typeof sql>, reason: string) => {
    const approval = draft(result, 'PortalJobApprovals')!;
    expect(approval.definition.schema).toHaveProperty('job_id');
    expect(approval.definition.relationships ?? []).toEqual([]);
    expect(result.drafts.flatMap(item => item.lists ?? [])).toEqual([]);
    expect(result.report).toContainEqual(expect.objectContaining({ pointer: '/statements/1/columns/1/constraints/0', outcome: 'unmapped', reason }));
  };
  const noKey = 'REFERENCES portal_jobs names no column and portal_jobs declares no primary key in this source; PostgreSQL rejects such a key ("there is no primary key for referenced table"). The field is kept without a relationship.';
  it('a target with no primary key (H2) is not joined on a unique id', () => kept(sql('CREATE TABLE portal_jobs (id uuid UNIQUE, title text); ' + approvals('job_id uuid REFERENCES portal_jobs')), noKey));
  it('a target with only a unique index (I2)', () => kept(sql('CREATE TABLE portal_jobs (id uuid, title text); ' + approvals('job_id uuid REFERENCES portal_jobs') + ' CREATE UNIQUE INDEX jobs_id ON portal_jobs (id);'), noKey));
  it('a target absent from the source (I3)', () => {
    const result = sql('CREATE TABLE portal_teams (id uuid PRIMARY KEY); ' + approvals('job_id uuid REFERENCES portal_jobs'));
    kept(result, 'Foreign key target portal_jobs is absent from this source; REFERENCES portal_jobs names no column, so it names the primary key of portal_jobs, which this source does not declare.');
  });
  it('one column to a two-column primary key (F3)', () => {
    const result = sql('CREATE TABLE shifts (site_code text, shift_no int, PRIMARY KEY (site_code, shift_no)); CREATE TABLE shift_notes (id uuid PRIMARY KEY, site_code text REFERENCES shifts);');
    expect(draft(result, 'ShiftNotes')!.definition.schema).toHaveProperty('site_code');
    expect(draft(result, 'ShiftNotes')!.definition.relationships ?? []).toEqual([]);
    expect(reasons(result)).toContain('REFERENCES shifts names no column, so it names the primary key of shifts (site_code, shift_no), which has 2 columns where this key has 1; PostgreSQL rejects it ("number of referencing and referenced columns for foreign key disagree"). The field is kept without a relationship.');
  });
});

describe('constraint timing on a key that names its column', () => {
  const timed: Record<string, [string, string]> = {
    'DEFERRABLE INITIALLY DEFERRED (A8)': [jobs + approvals('job_id uuid REFERENCES portal_jobs(id) DEFERRABLE INITIALLY DEFERRED'), 'DEFERRABLE, INITIALLY DEFERRED'],
    'NOT DEFERRABLE (A9)': [jobs + approvals('job_id uuid REFERENCES portal_jobs(id) NOT DEFERRABLE'), 'NOT DEFERRABLE'],
    'NOT VALID (C5)': [jobs + approvals('job_id uuid') + ' ALTER TABLE portal_job_approvals ADD CONSTRAINT approvals_job_fk FOREIGN KEY (job_id) REFERENCES portal_jobs(id) NOT VALID;', 'NOT VALID'],
  };
  for (const [name, [content, words]] of Object.entries(timed)) it(`${name} maps, with a note`, () => {
    const result = sql(content);
    resolvedTo(result, 'id');
    expect(reasons(result)).toContain(`Constraint timing (${words}) is retained in source; it does not change the object model.`);
  });
});

describe('nothing that parses today is read differently', () => {
  it('explicit keys never take the second reading', () => {
    for (const content of [
      jobs + approvals('job_id uuid NOT NULL REFERENCES portal_jobs(id)'),
      jobs + approvals('job_id uuid REFERENCES portal_jobs(id) MATCH SIMPLE ON DELETE CASCADE'),
      jobs + approvals('job_id uuid', ', FOREIGN KEY (job_id) REFERENCES portal_jobs(id)'),
      jobs + approvals('job_id uuid') + ' ALTER TABLE ONLY public.portal_job_approvals ADD CONSTRAINT approvals_job_fk FOREIGN KEY (job_id) REFERENCES public.portal_jobs(id) ON UPDATE CASCADE ON DELETE RESTRICT;',
    ]) {
      const result = sql(content);
      resolvedTo(result, 'id');
      expect(reasons(result).filter(reason => /Shorthand|Constraint timing/.test(reason))).toEqual([]);
    }
  });
  it('REFERENCES inside a string, a comment, a function body, COMMENT ON or GRANT is never rewritten (J1, J2)', () => {
    const content = jobs + `CREATE TABLE portal_job_approvals (id uuid PRIMARY KEY, note text DEFAULT 'REFERENCES portal_jobs', -- REFERENCES portal_jobs
      job_id uuid REFERENCES portal_jobs /* REFERENCES portal_jobs */);
COMMENT ON COLUMN portal_job_approvals.note IS 'REFERENCES portal_jobs';
CREATE FUNCTION touch() RETURNS trigger AS $$ BEGIN PERFORM 'REFERENCES portal_jobs'; RETURN NEW; END $$ LANGUAGE plpgsql;
GRANT REFERENCES ON portal_jobs TO auditor;`;
    const result = sql(content);
    const approval = draft(result, 'PortalJobApprovals')!;
    expect(approval.definition.schema.note).toMatchObject({ default: 'REFERENCES portal_jobs', description: 'REFERENCES portal_jobs' });
    expect(reasons(result).filter(reason => /^Shorthand/.test(reason))).toEqual(['Shorthand REFERENCES portal_jobs resolved to portal_jobs(id), its declared primary key.']);
    expect(keys(result, 'PortalJobApprovals')).toEqual([expect.objectContaining({ via: 'job_id', referenced: 'id' })]);
  });
  it('a statement that still fails after the second reading reports its own first error, and drafting stays deterministic', () => {
    const content = jobs + 'CREATE TABLE portal_job_approvals (id uuid PRIMARY KEY, job_id uuid REFERENCES portal_jobs, shape geometry(Point, 4326) EXCLUDE);';
    const result = sql(content);
    const statement = sqlStatements(content)[1];
    let first = '';
    try { parse(statement); } catch (error) { first = (error as Error).message.split('\n')[0]; }
    expect(first).toMatch(/^Syntax error at line 2 col 91:/); // the shorthand, not the EXCLUDE the second reading stops at
    expect(result.drafts.map(item => item.name)).toEqual(['PortalJobs']);
    expect(result.report).toContainEqual(expect.objectContaining({ pointer: '/statements/1', outcome: 'unmapped', reason: 'SQL syntax not mapped at line 2, column 91: Unexpected comma token: ",". Statement retained in source; no SQL was executed. Table portal_job_approvals was not read.' }));
    expect(canonical(sql(content))).toBe(canonical(result));
  });
  // s255-m05 (the fresh read): the grammar asks the reader to file an issue upstream for a statement it reads two ways (cal.com's
  // 20230428142539 migration); the reply says what happened instead.
  it('a statement the grammar reads more than one way is reported in plain words, with no skull and no upstream link', () => {
    const content = 'CREATE TABLE portal_jobs (id uuid PRIMARY KEY, title text NOT NULL, kind text);\n\nDELETE FROM portal_jobs\n WHERE id not in (SELECT MIN(id) FROM portal_jobs GROUP BY title, kind);';
    const reason = reasons(sql(content)).find(item => /^SQL syntax not mapped/.test(item))!;
    expect(reason).toBe('SQL syntax not mapped at line 3: Ambiguous SQL syntax: the SQL reader found more than one way to read the statement. Statement retained in source; no SQL was executed.');
    expect(reasons(sql(content)).join(' ')).not.toMatch(/💀|file an issue|github\.com/);
  });
});

describe('a shorthand key reaches an accepted list through draft, show and apply', () => {
  beforeEach(() => {
    for (const [key, subdir] of Object.entries({ OODS_FOUNDRY_HOME: 'home', OODS_OBJECTS_DIR: 'objects', OODS_TRAITS_DIR: 'traits', MCP_SCHEMA_STORE_ROOT: 'store' })) vi.stubEnv(key, path.join(folder, subdir));
    reloadDefinitions();
  });
  afterEach(() => { vi.unstubAllEnvs(); reloadDefinitions(); });
  it('a team\'s portal jobs and approvals, every field present and the list accepted', async () => {
    const content = jobs + approvals('job_id uuid NOT NULL REFERENCES portal_jobs ON DELETE CASCADE', ', approver_email text NOT NULL, decided_at timestamptz');
    const summary = await importObjects({ action: 'draft', source: { format: 'sql', content } });
    if (summary.action !== 'draft') throw Error('Expected draft');
    expect(summary).toMatchObject({ objectCount: 2, proposalLists: 1 });
    const view = await readHandle({ action: 'show', importId: summary.importId, object: 'PortalJobs' });
    if (view.action !== 'show') throw Error('Expected show');
    const [proposal] = view.lists;
    expect(proposal).toMatchObject({ valid: true, evidence: [expect.objectContaining({ reason: 'PortalJobApprovals.job_id declares a key to PortalJobs.id.' })] });
    await importObjects({ action: 'apply', importId: summary.importId, objects: [{ name: 'PortalJobs', proposals: [proposal.id] }, { name: 'PortalJobApprovals' }] });
    expect(loadObject('PortalJobs').metadata.relatedLists).toEqual([proposal.list]);
    expect(Object.keys(loadObject('PortalJobApprovals').schema).sort()).toEqual(['approver_email', 'decided_at', 'decision', 'id', 'job_id']);
  });
});
