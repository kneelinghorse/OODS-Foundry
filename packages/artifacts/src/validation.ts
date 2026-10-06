import AjvCtor, { type ErrorObject } from 'ajv';
import addFormatsImport from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BundleIndexDocument, DiagnosticsDocument, TranscriptDocument } from './types.js';

const AjvClass: any = (AjvCtor as any).default ?? AjvCtor;
const ajv: any = new AjvClass({ allErrors: true, strict: false, allowUnionTypes: true });
const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;
addFormats(ajv);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transcriptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'transcript.schema.json'), 'utf8'));
const bundleIndexSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'bundle-index.schema.json'), 'utf8'));
const diagnosticsSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'diagnostics.schema.json'), 'utf8'));

const validateTranscriptInternal = ajv.compile(transcriptSchema) as (input: TranscriptDocument) => boolean;
const validateBundleIndexInternal = ajv.compile(bundleIndexSchema) as (input: BundleIndexDocument) => boolean;
const validateDiagnosticsInternal = ajv.compile(diagnosticsSchema) as (input: DiagnosticsDocument) => boolean;

function formatErrors(errors?: ErrorObject[] | null): string {
  if (!errors?.length) return 'unknown validation error';
  return errors
    .map((err) => {
      const path = err.instancePath || err.schemaPath;
      return `${path} ${err.message ?? 'invalid'}`;
    })
    .join('; ');
}

export function validateTranscript(doc: TranscriptDocument): { ok: true } | { ok: false; errors: string } {
  const valid = validateTranscriptInternal(doc);
  if (valid) return { ok: true };
  const errors = (validateTranscriptInternal as any).errors as ErrorObject[] | null | undefined;
  return { ok: false, errors: formatErrors(errors) };
}

export function validateBundleIndex(doc: BundleIndexDocument): { ok: true } | { ok: false; errors: string } {
  const valid = validateBundleIndexInternal(doc);
  if (valid) return { ok: true };
  const errors = (validateBundleIndexInternal as any).errors as ErrorObject[] | null | undefined;
  return { ok: false, errors: formatErrors(errors) };
}

export function validateDiagnostics(doc: DiagnosticsDocument): { ok: true } | { ok: false; errors: string } {
  const valid = validateDiagnosticsInternal(doc);
  if (valid) return { ok: true };
  const errors = (validateDiagnosticsInternal as any).errors as ErrorObject[] | null | undefined;
  return { ok: false, errors: formatErrors(errors) };
}
