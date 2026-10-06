import assert from 'node:assert/strict';

export type RegistryPackage = { name: string; version: string; integrity: string };

/** A local tarball or ancestor install cannot stand in for an outsider's registry install. */
export function registryInstallProof(lock: any, expected: RegistryPackage[]) {
  return expected.map(({ name, version, integrity }) => {
    const entry = lock.packages?.[`node_modules/${name}`];
    assert(entry && !entry.link, `${name}: missing registry package or linked package`);
    assert.equal(entry.version, version, `${name}: installed version differs`);
    const url = new URL(entry.resolved);
    assert.equal(url.origin, 'https://registry.npmjs.org', `${name}: must resolve from public npm`);
    assert.equal(decodeURIComponent(url.pathname), `/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, `${name}: registry tarball identity differs`);
    assert.equal(url.search + url.hash + url.username + url.password, '', `${name}: unexpected registry URL credentials or suffix`);
    assert.equal(entry.integrity, integrity, `${name}: installed integrity differs from approved bytes`);
    return { name, version, resolved: entry.resolved, integrity: entry.integrity };
  });
}
