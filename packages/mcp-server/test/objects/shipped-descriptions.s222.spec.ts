/**
 * s222-m03 (#2502 ruling 15): shipped descriptions name no sprint, mission, decision or internal tool.
 *
 * Every object and trait definition under objects/, domains/ and traits/ ships in the package, and its descriptions
 * reach a team through object show, the live registry and generated apps (a field's description becomes form help
 * and a type comment). A description that says "Sprint 206", "s205-m02", "the m02 fit read", "#2292" or names CMOS,
 * Stage1 or Hive tells a team about the owner's process instead of about the object, so this fails on any.
 * It reads every `description` at any depth (object, field, parameter, changelog) in the YAML definitions and the
 * TypeScript trait twins.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../../..');
// The export scanner owns private project-name checks. These portable checks
// keep release jargon and integration branding out of object descriptions.
const RULES: Array<[string, RegExp]> = [
  ['sprint', /\bsprint[\s-]?\d+/i],
  ['sprint id', /\bs\d{3}(?:-m\d{2})?\b/],
  ['mission id', /\bm\d{2}\b/],
  ['decision number', /#\d{3,5}\b/],
  ['internal tool', /\b(?:cmos|stage\s?1|hive)\b/i],
];
const broken = (text: string) => RULES.filter(([, rule]) => rule.test(text)).map(([name]) => name);

const walk = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const definitions = ['objects', 'domains', 'traits'].flatMap(folder => walk(path.join(root, folder)))
  .filter(file => /\.(?:object|trait)\.ya?ml$|\.trait\.ts$/.test(file)).sort();

function descriptions(node: unknown, at: string, out: Array<[string, string]>): Array<[string, string]> {
  if (Array.isArray(node)) node.forEach((item, index) => descriptions(item, `${at}[${index}]`, out));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'description' && typeof value === 'string') out.push([`${at}.description`, value]);
      descriptions(value, `${at}.${key}`, out);
    }
  }
  return out;
}

async function load(file: string): Promise<unknown> {
  if (file.endsWith('.ts')) return ((await import(pathToFileURL(file).href)) as { default: unknown }).default;
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

describe('shipped object and trait descriptions (s222-m03)', () => {
  it('the rule catches each kind of reference, and passes the words the objects are about', () => {
    expect(broken('Read-only in OODS Foundry (Sprint 206).')).toEqual(['sprint']);
    expect(broken('Reads as a result first (s210-m01).')).toEqual(['sprint id', 'mission id']);
    expect(broken('stated in the m02 fit read')).toEqual(['mission id']);
    expect(broken('the state the capture recorded (#2292)')).toEqual(['decision number']);
    for (const name of ['CMOS', 'Stage1', "Hive's"]) expect(broken(`Born from ${name} records.`)).toEqual(['internal tool']);
    // A sprint, a mission and a colour are what some objects are about; only a reference to one of the owner's is refused.
    expect(broken('A bounded run of work with a stated focus and the missions that carried it; 1 is off-system (#545454).')).toEqual([]);
  });

  it('reads every definition file', () => {
    expect(definitions.filter(file => file.endsWith('.object.yaml'))).toHaveLength(16); // The twelve repository-only integration objects do not ship.
    expect(definitions.filter(file => file.endsWith('.ts')).length).toBeGreaterThan(30);
  });

  it('no shipped object or trait description names a sprint, mission, decision or internal tool', async () => {
    const found: string[] = [];
    for (const file of definitions) {
      for (const [at, text] of descriptions(await load(file), '', [])) {
        const rules = broken(text);
        if (rules.length) found.push(`${path.relative(root, file)} ${at} [${rules.join(', ')}]: ${text.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
