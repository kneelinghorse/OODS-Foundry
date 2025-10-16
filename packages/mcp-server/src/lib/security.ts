import fs from 'node:fs';
import path from 'node:path';
import { loadPolicyDoc, type PolicyDoc } from '../security/policy.js';

export type Redactions = {
  strings?: string[];
  paths?: string[];
};

export type Policy = PolicyDoc;

export function loadPolicy(): Policy {
  return loadPolicyDoc();
}

export function loadRedactions(): Redactions {
  const p = new URL('../security/redactions.json', import.meta.url);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw) as Redactions;
}

export function todayDir(base: string): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const dir = path.join(base, `${y}-${m}-${day}`);
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

export function withinAllowed(base: string, candidate: string): boolean {
  const rel = path.relative(base, candidate);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function createRunDirectory(base: string, tool: string): { runDir: string; runRelative: string; runId: string } {
  const dateDir = todayDir(base);
  const toolDir = path.join(dateDir, tool);
  fs.mkdirSync(toolDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeStamp = stamp.endsWith('Z') ? stamp : `${stamp}Z`;
  let runDir = path.join(toolDir, safeStamp);
  let attempt = 0;
  while (fs.existsSync(runDir)) {
    attempt += 1;
    runDir = path.join(toolDir, `${safeStamp}-${attempt}`);
  }
  if (!withinAllowed(base, runDir)) {
    throw new Error(`Path not allowed: ${runDir}`);
  }
  fs.mkdirSync(runDir, { recursive: true });
  const relative = path.relative(base, runDir).split(path.sep).join('/');
  return { runDir, runRelative: relative, runId: relative };
}
