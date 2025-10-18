import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PolicyRule = {
  tool: string; // exact name or "*"
  allow: string[]; // roles
  writes?: string[]; // path patterns (currently informational)
  readOnly?: boolean;
  timeoutMs?: number;
  ratePerMinute?: number;
  concurrency?: number;
};

export type PolicyLimits = {
  defaultTimeoutMs: number;
  concurrency: number; // default per-tool max concurrent executions
  ratePerMinute?: number; // default per-tool token bucket rate
};

export type PolicyDoc = {
  artifactsBase: string;
  roles: string[];
  rules: PolicyRule[];
  limits: PolicyLimits;
  redactions?: string[];
};

const POLICY_SRC_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const REPO_ROOT = path.resolve(POLICY_SRC_DIR, '..', '..', '..', '..');

function resolveArtifactsBase(base: string | undefined): string {
  const target = base && base.trim().length > 0 ? base.trim() : 'artifacts/current-state';
  return path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
}

let cached: PolicyDoc | null = null;

export function loadPolicyDoc(): PolicyDoc {
  if (cached) return cached;
  const p = new URL('./policy.json', import.meta.url);
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw) as PolicyDoc;
  cached = {
    ...parsed,
    artifactsBase: resolveArtifactsBase(parsed.artifactsBase),
  };
  return cached!;
}

export function ruleForTool(tool: string): PolicyRule | undefined {
  const policy = loadPolicyDoc();
  return policy.rules.find((r) => r.tool === tool) ?? policy.rules.find((r) => r.tool === '*');
}

export function isAllowed(tool: string, role: string): { allowed: boolean; rule?: PolicyRule } {
  const rule = ruleForTool(tool);
  if (!rule) return { allowed: false };
  const allowed = rule.allow.includes(role);
  return { allowed, rule };
}

function rateFor(tool: string): number {
  const { limits } = loadPolicyDoc();
  const rule = ruleForTool(tool);
  const fallback = Math.max(1, limits.ratePerMinute ?? 60);
  const configured = rule?.ratePerMinute;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return fallback;
}

function concurrencyFor(tool: string): number {
  const { limits } = loadPolicyDoc();
  const rule = ruleForTool(tool);
  const configured = rule?.concurrency;
  const fallback = Math.max(1, limits.concurrency);
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 1) {
    return Math.max(1, Math.floor(configured));
  }
  return fallback;
}

function timeoutFor(tool: string): number {
  const { limits } = loadPolicyDoc();
  const rule = ruleForTool(tool);
  const configured = rule?.timeoutMs;
  const fallback = Math.max(1000, limits.defaultTimeoutMs);
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 1000) {
    return Math.floor(configured);
  }
  return fallback;
}

// Simple per-tool concurrency and token bucket rate limiting
type Bucket = { tokens: number; capacity: number; refillPerMs: number; lastRefill: number };
const buckets = new Map<string, Bucket>();
const running = new Map<string, number>();

function getBucket(tool: string): Bucket {
  const rate = rateFor(tool);
  const now = Date.now();
  let bucket = buckets.get(tool);
  if (!bucket) {
    bucket = { tokens: rate, capacity: rate, refillPerMs: rate / 60000, lastRefill: now };
    buckets.set(tool, bucket);
    return bucket;
  }
  if (bucket.capacity !== rate) {
    const ratio = rate / (bucket.capacity || 1);
    bucket.capacity = rate;
    bucket.refillPerMs = rate / 60000;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens * ratio);
  }
  const delta = now - bucket.lastRefill;
  const refill = delta * bucket.refillPerMs;
  if (refill > 0) {
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  return bucket;
}

export function tryConsumeToken(tool: string): boolean {
  const bucket = getBucket(tool);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

export function tryAcquireSlot(tool: string): boolean {
  const max = concurrencyFor(tool);
  const current = running.get(tool) ?? 0;
  if (current >= max) return false;
  running.set(tool, current + 1);
  return true;
}

export function releaseSlot(tool: string) {
  const current = running.get(tool) ?? 0;
  running.set(tool, Math.max(0, current - 1));
}

export function timeoutMsFor(tool: string): number {
  return timeoutFor(tool);
}

export function artifactsBase(): string {
  return loadPolicyDoc().artifactsBase;
}
