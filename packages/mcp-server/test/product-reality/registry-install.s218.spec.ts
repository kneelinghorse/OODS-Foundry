import { expect, it } from 'vitest';
import { registryInstallProof } from '../../../../scripts/product-reality/s218-registry-provenance.js';

const expected = [{ name: '@oods/tokens', version: '0.3.0', integrity: 'sha512-approved-release-bytes' }];
const entry = () => ({ version: '0.3.0', resolved: 'https://registry.npmjs.org/@oods/tokens/-/tokens-0.3.0.tgz', integrity: expected[0]!.integrity });
const lock = (value: Record<string, unknown>) => ({ packages: { 'node_modules/@oods/tokens': value } });

it('accepts only the exact approved version and integrity installed from public npm', () => {
  expect(registryInstallProof(lock(entry()), expected)).toEqual([{ ...expected[0], resolved: entry().resolved }]);
});

it.each([
  ['local tarball', { resolved: 'file:../oods-tokens-0.3.0.tgz' }, /public npm/],
  ['private mirror', { resolved: 'https://mirror.example/@oods/tokens/-/tokens-0.3.0.tgz' }, /public npm/],
  ['wrong package at the public host', { resolved: 'https://registry.npmjs.org/@oods/foundry/-/foundry-0.3.0.tgz' }, /identity differs/],
  ['older installed release', { version: '0.2.0' }, /version differs/],
  ['different bytes under the right version', { integrity: 'sha512-other-bytes' }, /integrity differs/],
  ['workspace link', { link: true }, /linked package/],
] as const)('rejects %s instead of claiming a registry-only pass', (_name, change, message) => {
  expect(() => registryInstallProof(lock({ ...entry(), ...change }), expected)).toThrow(message);
});

it('requires each requested package so a partial installation cannot claim the release set', () => {
  expect(() => registryInstallProof({ packages: {} }, expected)).toThrow(/missing registry package/);
});
