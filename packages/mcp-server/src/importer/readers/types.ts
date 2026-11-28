import type { ReportEntry } from '../hub.js';
import type { Document, MapValue, Origin } from '../source.js';

/** s255-m01: a table whose CREATE TABLE the reader could not parse, so it is not drafted; named in the draft reply. */
export type UnreadTable = { table: string; file: string; line: number; column?: number; reason: string };
export type ReaderResult = { value: MapValue; origins: Record<string, Origin>; report: ReportEntry[]; unread?: UnreadTable[] };
export type Reader = (documents: Document[]) => ReaderResult;
