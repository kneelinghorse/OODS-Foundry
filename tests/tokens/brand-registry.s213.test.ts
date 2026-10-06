/**
 * s213-m04 — the brand registry: a brand is its folder, `src/tokens/brands/<id>/{base,dark,hc}.json`.
 *
 * Before this mission Forge's brands were A and B because about fifty product and build files said so, and a brand
 * also needed a hand-written alias file. A team could not add a brand without editing Forge. These tests hold the
 * rule that replaced that: the token build reads the brands folder, refuses (naming why) any folder that is not a
 * usable brand, and generates the alias file from the brand's own files, so three files are a whole brand.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import StyleDictionary from 'style-dictionary';

const require = createRequire(import.meta.url);
const registry = require('../../packages/tokens/scripts/brand-registry.cjs') as {
  BRANDS_DIR: string; ALIASES_DIR: string; BRAND_FILES: readonly string[]; BRAND_ID: RegExp; DEFAULT_BRAND: string;
  readBrandRegistry: (root?: string) => readonly string[];
  brandAliasDocument: (id: string) => Record<string, unknown>;
  writeBrandAliases: (brands: readonly string[], root?: string) => string;
};
const config = require('../../packages/tokens/style-dictionary.config.cjs') as {
  oodsScoping: { BRANDS: readonly string[]; SHARED_SOURCE: readonly string[]; BRAND_SCOPES: ReadonlyArray<{ brand: string; theme: string }>; DEFAULT_SCOPE: { brand: string; theme: string } };
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TOKENS_PKG = path.join(REPO_ROOT, 'packages', 'tokens');
const FIXTURE_C = path.join(__dirname, 'fixtures', 'brand-C');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** A token package root holding the given brand folders; `files` maps a brand to its file texts. */
function sandbox(brands: Record<string, Record<string, string>>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-brand-registry-'));
  for (const [id, files] of Object.entries(brands)) {
    fs.mkdirSync(path.join(root, registry.BRANDS_DIR, id), { recursive: true });
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(root, registry.BRANDS_DIR, id, `${file}.json`), text);
  }
  return root;
}
const shipped = (id: string) => Object.fromEntries(registry.BRAND_FILES.map(file => [file, fs.readFileSync(path.join(TOKENS_PKG, registry.BRANDS_DIR, id, `${file}.json`), 'utf8')]));
const fixtureC = () => Object.fromEntries(registry.BRAND_FILES.map(file => [file, fs.readFileSync(path.join(FIXTURE_C, `${file}.json`), 'utf8')]));
/** A brand's files with every `color.brand.<from>` renamed, the way a careless copy of a folder looks. */
const renamed = (files: Record<string, string>, from: string, to: string) => Object.fromEntries(Object.entries(files).map(([file, text]) => {
  const document = JSON.parse(text);
  document.color.brand = { [to]: document.color.brand[from] };
  return [file, JSON.stringify(document)];
}));

describe('s213-m04 — the brand registry', () => {
  it('reads the shipped brands from the brands folder, and the build config takes its scopes from them', () => {
    expect(registry.readBrandRegistry()).toEqual(['A', 'B']);
    expect(config.oodsScoping.BRANDS).toEqual(['A', 'B']);
    expect(config.oodsScoping.BRAND_SCOPES.map(scope => `${scope.brand}/${scope.theme}`)).toEqual(['A/base', 'A/dark', 'A/hc', 'B/base', 'B/dark', 'B/hc']);
    expect(config.oodsScoping.DEFAULT_SCOPE).toEqual({ brand: 'A', theme: 'base' });
    expect(config.oodsScoping.SHARED_SOURCE.filter(pattern => pattern.startsWith('src/tokens/brands/'))).toEqual(['src/tokens/brands/A/base.json', 'src/tokens/brands/B/base.json']);
  });

  it('three files are a brand: the fixture brand C joins the registry with nothing else added', () => {
    const root = sandbox({ A: shipped('A'), B: shipped('B'), C: fixtureC() });
    try {
      expect(registry.readBrandRegistry(root)).toEqual(['A', 'B', 'C']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('refuses a folder that is not a usable brand, naming every problem instead of skipping it', () => {
    const root = sandbox({
      A: shipped('A'), B: shipped('B'),
      AcmeCorp: renamed(shipped('B'), 'B', 'AcmeCorp'),
      D: { base: shipped('B').base!, dark: shipped('B').dark! },
      E: shipped('A'),
    });
    try {
      expect(() => registry.readBrandRegistry(root)).toThrow(/AcmeCorp: a brand id is capitals then digits/);
      const message = (() => { try { registry.readBrandRegistry(root); return ''; } catch (error) { return (error as Error).message; } })();
      expect(message).toContain('src/tokens/brands/D: missing hc.json');
      expect(message).toContain("src/tokens/brands/E/base.json: declares color.brand.A; a brand's files declare only color.brand.E");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('refuses two brands whose ids differ only by case, where the file system can hold both', () => {
    const root = sandbox({ A: shipped('A'), C: fixtureC() });
    try {
      const lower = path.join(root, registry.BRANDS_DIR, 'c');
      if (fs.existsSync(lower)) {
        // A case-insensitive file system (macOS by default) cannot hold C and c apart: the folder is one brand.
        expect(registry.readBrandRegistry(root)).toEqual(['A', 'C']);
        return;
      }
      fs.mkdirSync(lower);
      for (const [file, text] of Object.entries(renamed(fixtureC(), 'C', 'c'))) fs.writeFileSync(path.join(lower, `${file}.json`), text);
      expect(() => registry.readBrandRegistry(root)).toThrow('src/tokens/brands/c: differs from src/tokens/brands/C only by case');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('refuses a brands folder without brand A, the default scope', () => {
    const root = sandbox({ B: shipped('B') });
    try {
      expect(() => registry.readBrandRegistry(root)).toThrow(/brands\/A: missing; brand A is the default scope/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('generates the alias files that were hand-written before, byte for byte', () => {
    // The sha256 of packages/tokens/src/tokens/aliases/brand-{A,B}.json as committed at 45d95aff2, when they were
    // written by hand. Reproducing them exactly is what keeps every token build output of A and B unchanged.
    const text = (id: string) => `${JSON.stringify(registry.brandAliasDocument(id), null, 2)}\n`;
    expect(sha256(text('A'))).toBe('f37e715dc5e3c2f316dd2e97859d9bf39ce4f710ba9c2b7e4ab6cac7fccc2586');
    expect(sha256(text('B'))).toBe('5255de8841f8d67c5e0c29117a69460b733c5a06ba872582286adb2ef3b8a647');
  });

  it('every generated alias points at a value the brand itself declares, so a new brand resolves', () => {
    for (const [id, base] of [['A', shipped('A').base], ['B', shipped('B').base], ['C', fixtureC().base]] as const) {
      const declared = JSON.parse(base!);
      const targets: string[] = [];
      const walk = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;
        const record = node as Record<string, unknown>;
        if (typeof record.$value === 'string') { targets.push(record.$value); return; }
        for (const [key, child] of Object.entries(record)) if (!key.startsWith('$')) walk(child);
      };
      walk(registry.brandAliasDocument(id));
      expect(targets).toHaveLength(20);
      for (const target of targets) {
        const reference = /^\{(.+)\}$/.exec(target)![1]!.split('.');
        expect(reference.slice(0, 3)).toEqual(['color', 'brand', id]);
        const value = reference.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], declared);
        expect((value as { $value?: unknown } | undefined)?.$value, `${id}: ${target}`).toBeDefined();
      }
    }
  });

  it("writes each brand's alias file and removes a gone brand's, leaving other files alone", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-brand-aliases-'));
    try {
      const directory = path.join(root, registry.ALIASES_DIR);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'brand-Z.json'), '{}');
      fs.writeFileSync(path.join(directory, 'README.md'), 'kept');
      registry.writeBrandAliases(['A', 'C'], root);
      expect(fs.readdirSync(directory).sort()).toEqual(['README.md', 'brand-A.json', 'brand-C.json']);
      expect(JSON.parse(fs.readFileSync(path.join(directory, 'brand-C.json'), 'utf8'))).toEqual(registry.brandAliasDocument('C'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it("every id the rule accepts keeps its shape through the token build's kebab-casing", () => {
    // Dashboards and the contrast rules name a brand's variables with the lower-cased id; the build kebab-cases the
    // token path. An id the two spell differently (AcmeCorp → acme-corp) would leave those readers on missing names.
    const kebab = (StyleDictionary as unknown as { hooks: { transforms: Record<string, { transform: (token: unknown, config: unknown) => string }> } })
      .hooks.transforms['name/kebab']!.transform;
    const alphabet = ['A', 'a', 'B', 'b', 'Z', 'z', '0', '9'];
    const candidates = new Set(['A', 'B', 'C', 'Acme', 'acme', 'ACME', 'AcmeCorp', 'A1', 'X9Y', 'aB', 'Brand7']);
    for (const first of ['A', 'b', 'Z']) for (const second of alphabet) for (const third of alphabet) for (const fourth of ['', ...alphabet]) candidates.add(first + second + third + fourth);
    const accepted = [...candidates].filter(id => registry.BRAND_ID.test(id));
    expect(accepted.length).toBeGreaterThan(500);
    for (const id of accepted) expect(kebab({ path: ['color', 'brand', id, 'surface'] }, {}), id).toBe(`color-brand-${id.toLowerCase()}-surface`);
    for (const refused of ['AcmeCorp', 'X9Y', 'aB', '1A', 'A-B', 'A_B', '']) expect(registry.BRAND_ID.test(refused), refused).toBe(false);
  });
});
