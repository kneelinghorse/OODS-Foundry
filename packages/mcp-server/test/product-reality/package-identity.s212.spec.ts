/** A public package must identify its public source and feedback route, never its private repository. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
const root = path.resolve(import.meta.dirname, '../../../..');
const scratches: string[] = [];
afterEach(() => { for (const dir of scratches.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
async function fixture() {
  const { checkPackageManifest } = await import(path.join(root, 'scripts/runtime/npm-package.mjs'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's212-package-identity-')); scratches.push(dir);
  for (const file of ['package.json', 'packages/foundry/package.json', 'configs/product/name.json', 'configs/license/holder.json', 'packages/foundry/quickstart/team-components/mappings.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  const manifest = read('packages/foundry/package.json');
  return { dir, manifest, check: () => { fs.writeFileSync(path.join(dir, 'packages/foundry/package.json'), JSON.stringify(manifest)); return checkPackageManifest(dir); } };
}
describe('candidate identity (s212 m04)', () => {
  it('accepts the canonical release/contact and retained package contract', async () => {
    const { check } = await fixture(); expect(check()).toMatchObject({ version: read('package.json').version, name: '@oods/foundry', homepage: 'https://oods-foundry.com/', bugs: { url: 'https://github.com/kneelinghorse/OODS-Foundry/issues' }, repository: { type: 'git', url: 'git+https://github.com/kneelinghorse/OODS-Foundry.git', directory: 'packages/foundry' } });
  });
  it('refuses a package that lost the checked mapping example', async () => {
    const { dir, check } = await fixture();
    fs.unlinkSync(path.join(dir, 'packages/foundry/quickstart/team-components/mappings.json'));
    expect(check).toThrow('the batch mapping example ships beside Harbor components');
  });
  it('allows public source and feedback links without admitting private or lookalike repositories', async () => {
    const { packageContentFindings } = await import(path.join(root, 'scripts/runtime/package-contents.mjs'));
    const links = (text: string) => packageContentFindings([{ path: 'README.md', bytes: Buffer.from(text) }], { contact: 'support@example.com', ownerName: 'Maintainer' }).filter((finding: { rule: string }) => finding.rule === 'owner-link');
    expect(links('https://github.com/kneelinghorse/OODS-Foundry/issues')).toEqual([]);
    expect(links('git+https://github.com/kneelinghorse/OODS-Foundry.git')).toEqual([]);
    expect(links('https://github.com/kneelinghorse/oods-foundry-claude-plugin.git')).toEqual([]);
    expect(links('https://github.com/kneelinghorse/OODS-Forge')).toHaveLength(1);
    expect(links('https://github.com/kneelinghorse/OODS-Foundry-private')).toHaveLength(1);
    expect(links('https://github.com/kneelinghorse/OODS-Foundry.git-private')).toHaveLength(1);
  });
  it.each(['homepage', 'contact', 'private-repository', 'version', 'keyword', 'license', 'install-key', 'shipping-allowlist'])('refuses a %s mutation before packing', async mutation => {
    const { manifest, check } = await fixture();
    if (mutation === 'homepage') manifest.homepage = 'https://private.invalid/repository';
    if (mutation === 'contact') manifest.bugs = { email: 'wrong@example.invalid' };
    if (mutation === 'private-repository') manifest.repository = 'private:implementation';
    if (mutation === 'version') manifest.version = '0.2.0';
    if (mutation === 'keyword') manifest.keywords = manifest.keywords.filter((value: string) => value !== 'chart-accessibility');
    if (mutation === 'license') manifest.license = 'MIT';
    if (mutation === 'install-key') manifest.bin = { forge: 'bin/oods-foundry.js' };
    if (mutation === 'shipping-allowlist') manifest.files.push('cmos/');
    expect(check).toThrow();
  });
  it('expands OODS once and binds every README asset to this candidate version', () => {
    const text = fs.readFileSync(path.join(root, 'packages/foundry/README.md'), 'utf8');
    expect(text.match(/object-oriented design system/g)).toHaveLength(1);
    const urls = text.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/[^)\s]+/g)!;
    expect(urls.length).toBeGreaterThan(3);
    expect(urls.every(url => url.startsWith(`https://cdn.jsdelivr.net/npm/@oods/foundry@${read('package.json').version}/`))).toBe(true);
  });
});

describe('schema hosting packet reference checks', () => {
  it('accepts a local closure and rejects dangling, external and malformed schemas without fetching', async () => {
    const { checkSchema } = await import(path.join(root, 'scripts/product-reality/s212-schema-packet.mjs'));
    const valid = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: { value: { $ref: '#/definitions/value' } }, definitions: { value: { type: 'number' } } };
    expect(checkSchema(valid)).toHaveLength(1);
    expect(() => checkSchema({ ...valid, definitions: {} })).toThrow(/Unresolved local reference/);
    expect(() => checkSchema({ $ref: 'https://unresolved.invalid/schema' })).toThrow(/Unresolved external/);
    expect(() => checkSchema({ type: 7 })).toThrow();
  });
});
