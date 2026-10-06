#!/usr/bin/env tsx
/**
 * Canonical-enum convergence lint (deterministic slice — s127-m03).
 *
 * The ONE uniform enum surface in the repo where two hand-maintained sources must
 * stay byte-identical is the viz trait family: every `traits/viz/<name>.trait.ts`
 * declares parameters carrying `validation.enum`, mirrored 1:1 in
 * `schemas/traits/<name>.parameters.schema.json` (`properties.<name>.enum`). This lint
 * asserts those two agree — same members, same ORDER — in BOTH directions, so a value
 * added, removed, or reordered on one side without the other fails CI deterministically.
 *
 * Scope is deliberately the viz traits only. Billing/status enums
 * (`Organization.billing_status`, the saas-billing token map) have NO schema mirror, so
 * they are NOT covered here — they stay enforced by the s127-m01 convergence guard test
 * (`tests/domain/billing/state-set-convergence.spec.ts`) plus the manual
 * `cmos/foundational-docs/enum-convergence-checklist.md`.
 *
 * Pre-existing, intentionally-tolerated divergences live in
 * `scripts/lint/enum-convergence.baseline.json` (entry-granular, line-independent — the
 * `tools/token-lint/baseline.json` pattern). A NEW divergence not in the baseline still
 * fails the gate.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TRAITS_DIR = path.join(ROOT, 'traits', 'viz');
const SCHEMA_DIR = path.join(ROOT, 'schemas', 'traits');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'lint', 'enum-convergence.baseline.json');

const RULE_ID = 'enum-convergence/trait-schema-mirror';

interface TraitParameter {
  name: string;
  validation?: { enum?: readonly unknown[] };
}
interface TraitModule {
  default?: { parameters?: readonly TraitParameter[] };
}
interface SchemaMirror {
  properties?: Record<string, { enum?: unknown[] }>;
}
interface Violation {
  ruleId: string;
  file: string;
  location: string;
  reason: string;
}
interface BaselineEntry {
  ruleId: string;
  file: string;
  location: string;
}

function entryKey(ruleId: string, file: string, location: string): string {
  return `${ruleId}\u0000${file}\u0000${location}`;
}

function loadBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as { entries?: BaselineEntry[] };
  return new Set((raw.entries ?? []).map((e) => entryKey(e.ruleId, e.file, e.location)));
}

function vizTraitFiles(): string[] {
  return readdirSync(TRAITS_DIR)
    .filter((file) => file.endsWith('.trait.ts'))
    .sort();
}

async function collectViolations(): Promise<Violation[]> {
  const violations: Violation[] = [];

  for (const fileName of vizTraitFiles()) {
    const base = fileName.replace(/\.trait\.ts$/, '');
    const traitRel = path.posix.join('traits', 'viz', fileName);
    const mirrorRel = path.posix.join('schemas', 'traits', `${base}.parameters.schema.json`);
    const mirrorAbs = path.join(SCHEMA_DIR, `${base}.parameters.schema.json`);

    if (!existsSync(mirrorAbs)) {
      violations.push({
        ruleId: RULE_ID,
        file: traitRel,
        location: '(file)',
        reason: `viz trait has no parameters schema mirror at ${mirrorRel}`,
      });
      continue;
    }

    const traitMod = (await import(
      pathToFileURL(path.join(TRAITS_DIR, fileName)).href
    )) as TraitModule;
    const parameters = traitMod.default?.parameters ?? [];
    const mirror = JSON.parse(readFileSync(mirrorAbs, 'utf8')) as SchemaMirror;
    const mirrorProps = mirror.properties ?? {};

    const traitEnums = new Map<string, readonly unknown[]>();
    for (const param of parameters) {
      if (param?.validation?.enum) traitEnums.set(param.name, param.validation.enum);
    }
    const mirrorEnums = new Map<string, unknown[]>();
    for (const [name, prop] of Object.entries(mirrorProps)) {
      if (prop?.enum) mirrorEnums.set(name, prop.enum);
    }

    const names = [...new Set<string>([...traitEnums.keys(), ...mirrorEnums.keys()])].sort();
    for (const name of names) {
      const traitEnum = traitEnums.get(name);
      const mirrorEnum = mirrorEnums.get(name);

      if (!traitEnum) {
        violations.push({
          ruleId: RULE_ID,
          file: mirrorRel,
          location: name,
          reason: `schema mirror declares enum for "${name}" but the trait parameter has none.`,
        });
        continue;
      }
      if (!mirrorEnum) {
        violations.push({
          ruleId: RULE_ID,
          file: traitRel,
          location: name,
          reason: `trait parameter "${name}" declares validation.enum but the schema mirror has none.`,
        });
        continue;
      }
      if (JSON.stringify(traitEnum) !== JSON.stringify(mirrorEnum)) {
        violations.push({
          ruleId: RULE_ID,
          file: mirrorRel,
          location: name,
          reason: `enum mismatch for "${name}": trait ${JSON.stringify(traitEnum)} vs mirror ${JSON.stringify(mirrorEnum)} (must be byte-identical, order included).`,
        });
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const baseline = loadBaseline();
  const all = await collectViolations();
  const active = all.filter((v) => !baseline.has(entryKey(v.ruleId, v.file, v.location)));
  const baselinedCount = all.length - active.length;
  const pairCount = vizTraitFiles().length;

  if (active.length > 0) {
    console.error('✖ Enum convergence lint failed (viz trait ↔ schema mirror divergence):');
    for (const violation of active) {
      console.error(`  • ${violation.file} [${violation.location}]: ${violation.reason}`);
    }
    if (baselinedCount > 0) {
      console.error(`  (${baselinedCount} pre-existing divergence(s) tolerated via baseline.)`);
    }
    process.exitCode = 1;
    return;
  }

  const suffix =
    baselinedCount > 0
      ? `, ${baselinedCount} pre-existing divergence(s) baselined).`
      : ').';
  console.log(`✔︎ Enum convergence lint passed (${pairCount} viz trait↔schema mirror pairs checked${suffix}`);
}

main().catch((error) => {
  console.error('✖ Enum convergence lint failed with an unexpected error.');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
