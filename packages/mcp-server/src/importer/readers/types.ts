import type { ReportEntry } from '../hub.js';
import type { Document, MapValue, Origin } from '../source.js';

export type ReaderResult = { value: MapValue; origins: Record<string, Origin>; report: ReportEntry[] };
export type Reader = (documents: Document[]) => ReaderResult;
