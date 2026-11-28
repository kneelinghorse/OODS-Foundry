/**
 * s255-m01 (R4 §3.4, settled 12): a table whose CREATE TABLE the SQL reader cannot parse is not drafted, and before this
 * sprint only one line in report.json said so, with a line number counted from the statement. The draft reply a person
 * sees now names every such table with its file, line and the parser's reason; a key or an ALTER aimed at it says it was
 * not read instead of blaming an absent table; and syntax reports give the line and column in the file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { draftSource } from '../../src/importer/draft.js';
import { handle as importObjects } from '../../src/tools/object.import.js';
import { reloadDefinitions } from '../../src/tools/object.register.js';

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tables-not-read-'));
  vi.stubEnv('OODS_FOUNDRY_HOME', path.join(folder, 'home'));
  reloadDefinitions();
});
afterEach(() => { vi.unstubAllEnvs(); reloadDefinitions(); fs.rmSync(folder, { recursive: true, force: true }); });
const write = (name: string, content: string) => { const file = path.join(folder, 'source', name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
// A table the grammar still cannot read (an EXCLUDE constraint, where it stops at USING), between two it can.
const migrations = () => {
  write('001_jobs.sql', 'CREATE TABLE portal_jobs (id uuid PRIMARY KEY, title text NOT NULL);\n');
  write('002_rooms.sql', '-- rooms are booked in ranges\nCREATE TABLE portal_rooms (\n  id uuid PRIMARY KEY,\n  booked tstzrange,\n  EXCLUDE USING gist (booked WITH &&)\n);\n');
  write('003_bookings.sql', 'CREATE TABLE portal_bookings (id uuid PRIMARY KEY, room_id uuid REFERENCES portal_rooms(id), job_id uuid REFERENCES portal_jobs);\nALTER TABLE portal_rooms ADD COLUMN label text;\nCREATE UNIQUE INDEX rooms_label ON portal_rooms (label);\n');
};

it('names every table it could not read in the draft reply, with the file line and the reason, and the reply keeps its contract', async () => {
  migrations();
  const summary = await importObjects({ action: 'draft', source: { path: path.join(folder, 'source') } });
  if (summary.action !== 'draft') throw Error('Expected draft');
  expect(summary.objects).toEqual(['PortalJobs', 'PortalBookings']);
  expect(summary.tablesNotRead).toEqual([{ table: 'portal_rooms', file: '002_rooms.sql', line: 5, column: 11, reason: 'Unexpected kw_using token: "using"' }]);
  expect(summary).not.toHaveProperty('tablesNotReadTruncated');
  for (const name of ['object.import', 'object.import.read']) {
    const validator = new Ajv2020({ strict: false }).compile(JSON.parse(fs.readFileSync(new URL(`../../src/schemas/${name}.output.json`, import.meta.url), 'utf8')));
    expect(validator(summary), JSON.stringify(validator.errors)).toBe(true);
  }
});

it('says a key, an ALTER or an index aimed at that table found it unread, not absent', () => {
  migrations();
  const result = draftSource({ path: path.join(folder, 'source') });
  const reasons = result.report.map(entry => entry.reason);
  const cause = 'portal_rooms was not read: its CREATE TABLE at 002_rooms.sql line 5 did not parse';
  expect(reasons).toEqual(expect.arrayContaining([`Foreign key target ${cause}.`, `ALTER target ${cause}.`, `Unique index target ${cause}.`]));
  expect(reasons.filter(reason => /absent/.test(reason))).toEqual([]);
  expect(result.report).toContainEqual(expect.objectContaining({ file: '002_rooms.sql', pointer: '/statements/0', outcome: 'unmapped',
    reason: 'SQL syntax not mapped at line 5, column 11: Unexpected kw_using token: "using". Statement retained in source; no SQL was executed. Table portal_rooms was not read.' }));
  // The shorthand key to portal_jobs, in the same file, still resolves.
  expect(result.drafts.find(draft => draft.name === 'PortalBookings')!.definition.relationships).toEqual([expect.objectContaining({ target: 'PortalJobs', via: 'job_id' })]);
});

it('counts the column from the line a statement shares with the one before it', () => {
  const result = draftSource({ content: 'CREATE TABLE a (id int PRIMARY KEY); CREATE TABLE b (id int, span tstzrange, EXCLUDE USING gist (span WITH &&));', format: 'sql' });
  expect(result.unread).toEqual([{ table: 'b', file: 'Inline.sql', line: 1, column: 86, reason: 'Unexpected kw_using token: "using"' }]);
  expect('CREATE TABLE a (id int PRIMARY KEY); CREATE TABLE b (id int, span tstzrange, EXCLUDE USING gist (span WITH &&));'.indexOf('USING') + 1).toBe(86);
});

it('leaves the key out when every table was read, and takes a table off the list once a later statement creates it', async () => {
  write('001_jobs.sql', 'CREATE TABLE portal_jobs (id uuid PRIMARY KEY, title text NOT NULL);\n');
  const read = await importObjects({ action: 'draft', source: { path: path.join(folder, 'source') } });
  expect(read).not.toHaveProperty('tablesNotRead');
  write('002_rooms.sql', 'CREATE TABLE portal_rooms (id uuid PRIMARY KEY, booked tstzrange, EXCLUDE USING gist (booked WITH &&));\n');
  write('003_rooms_again.sql', 'CREATE TABLE IF NOT EXISTS portal_rooms (id uuid PRIMARY KEY, booked tstzrange);\n');
  const result = draftSource({ path: path.join(folder, 'source') });
  expect(result.drafts.map(draft => draft.name)).toEqual(['PortalJobs', 'PortalRooms']);
  expect(result.unread).toBeUndefined();
});

it('names a quoted or schema-qualified table as the reader keys it, and only a CREATE TABLE as a table', () => {
  const result = draftSource({ content: 'CREATE TABLE "Rooms" (id int, span tstzrange, EXCLUDE USING gist (span WITH &&)); CREATE UNLOGGED TABLE IF NOT EXISTS app.Desks (id int, span tstzrange, EXCLUDE USING gist (span WITH &&)); CREATE TRIGGER t AFTER INSERT ON x FOR EACH ROW EXECUTE FUNCTION f();', format: 'sql' });
  expect(result.unread?.map(item => item.table)).toEqual(['Rooms', 'app.desks']);
});

it('gives a lexer error the same file line and column (cal.com\'s DEFAULT E\'\')', () => {
  const content = 'CREATE TABLE inputs (id int PRIMARY KEY);\n-- AlterTable\nALTER TABLE inputs ADD COLUMN placeholder TEXT NOT NULL DEFAULT E\'\';\n';
  const result = draftSource({ content, format: 'sql' });
  const column = content.split('\n')[2].indexOf("E''") + 1;
  expect(result.report).toContainEqual(expect.objectContaining({ pointer: '/statements/1', reason: `SQL syntax not mapped at line 3, column ${column}: Unexpected input (lexer error). Statement retained in source; no SQL was executed.` }));
});
