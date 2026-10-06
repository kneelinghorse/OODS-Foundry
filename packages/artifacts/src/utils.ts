import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function sha256File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return sha256(data);
}

function sortObject(value: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const entry = (value as Record<string, unknown>)[key];
    sorted[key] = canonicalizeValue(entry);
  }
  return sorted;
}

function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry));
  if (typeof value === 'object') return sortObject(value as Record<string, unknown>);
  return value;
}

export function canonicalize(value: unknown): string {
  const normalized = canonicalizeValue(value);
  return JSON.stringify(normalized);
}

export function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

export function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}
