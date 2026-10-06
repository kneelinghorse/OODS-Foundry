#!/usr/bin/env node
/** Copy existing schema bytes, inventory their URLs, and fail closed on absent contracts. No website writes. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { ownerFacts, packageContentFindings } from '../runtime/package-contents.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = 'https://oods-foundry.com';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
export const TOKEN_CONTRACTS = [
  { source: 'schemas/tailwind-tokens.v1.json', url: `${BASE}/schemas/tailwind-tokens.v1.json`, declaredBy: 'packages/tokens/scripts/build.mjs' },
  { source: 'schemas/high-contrast-map.v1.json', url: `${BASE}/schemas/high-contrast-map.v1.json`, declaredBy: 'packages/tokens/src/tokens/themes/high-contrast/map.json' },
];

export function checkSchema(document) {
  const refs = [];
  const visit = (value, pointer = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const at = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      if (key === '$ref') {
        assert(typeof child === 'string' && child.startsWith('#/'), `Unresolved external or named reference at ${at}: ${child}`);
        let target = document;
        for (const part of decodeURIComponent(child.slice(2)).split('/')) {
          const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
          assert(target && Object.hasOwn(target, key), `Unresolved local reference at ${at}: ${child}`);
          target = target[key];
        }
        refs.push({ pointer: at, reference: child, resolution: 'same-document', resolved: true });
      }
      visit(child, at);
    }
  };
  visit(document);
  // Validate draft-07 syntax and compile every reference without fetching schemas.
  // Formats are annotations here; this packet check does not execute instance validation.
  const ajv = new Ajv({ strict: false, validateFormats: false, logger: false });
  assert(ajv.validateSchema(document), JSON.stringify(ajv.errors));
  ajv.compile(document);
  return refs;
}

export function buildPacket({ publishedRoot, outDir, check = false }) {
  assert(publishedRoot && outDir, '--published-root and --out-dir are required');
  const sourceHead = json(path.join(publishedRoot, 'oods-foundry-runtime.manifest.json'));
  const currentVersion = json(path.join(ROOT, 'package.json')).version;
  const outputs = new Map();
  const names = fs.readdirSync(path.join(ROOT, 'schemas/viz')).filter(file => file.endsWith('.schema.json')).sort();
  const expectedNames = fs.readdirSync(path.join(publishedRoot, 'schemas/viz')).filter(file => file.endsWith('.schema.json')).sort();
  assert.deepEqual(names, expectedNames, 'published/current schema rosters differ; review the URL mapping explicitly');
  const schemas = [], unresolved = [], historicalAbsences = [];
  const sources = [...names.map(name => `schemas/viz/${name}`), ...TOKEN_CONTRACTS.map(row => row.source)];
  for (const [edition, root, packageVersion] of [['current', ROOT, currentVersion], ['published-0.2.0', publishedRoot, '0.2.0']]) {
    for (const source of sources) {
      const name = path.basename(source);
      const contract = TOKEN_CONTRACTS.find(row => row.source === source);
      if (!fs.existsSync(path.join(root, source))) {
        assert(contract, `Existing visualization schema is missing: ${source}`);
        const missing = { edition, packageVersion, ...contract, status: 'source-schema-absent', $id: null, $schema: null, sha256: null, mediaType: 'application/schema+json', referenceClosure: 'unavailable; no historical schema bytes existed' };
        (edition === 'current' ? unresolved : historicalAbsences).push(missing);
        continue;
      }
      const bytes = fs.readFileSync(path.join(root, source));
      const document = JSON.parse(bytes);
      const references = checkSchema(document);
      const servedPaths = [source];
      if (name === 'normalized-viz-spec.schema.json') servedPaths.push('viz-spec/v1');
      if (name === 'spatial-spec.schema.json') servedPaths.push('viz-spec/spatial/v1');
      for (const route of servedPaths) outputs.set(`${edition}/${route}`, bytes);
      const instanceIdentifiers = [];
      const identifiers = value => {
        if (!value || typeof value !== 'object') return;
        if (value.properties?.$schema?.const) instanceIdentifiers.push(value.properties.$schema.const);
        Object.values(value).forEach(identifiers);
      };
      identifiers(document);
      schemas.push({ edition, packageVersion, source, provenance: contract ? 'new-contract-authorized-by-decision-2329' : 'existing-schema-bytes-preserved', routes: servedPaths.map(route => ({ url: `${BASE}/${route}`, file: `${edition}/${route}`, mediaType: 'application/schema+json' })),
        $id: document.$id ?? null, $schema: document.$schema ?? null, instanceIdentifiers: [...new Set(instanceIdentifiers)],
        declaredVersion: document.properties?.version?.const ?? null, title: document.title ?? null,
        sha256: hash(bytes), byteLength: bytes.length, references, externalReferences: [] });
    }
  }
  const comparisons = sources.map(source => {
    const current = schemas.find(row => row.source === source && row.edition === 'current');
    const published = schemas.find(row => row.source === source && row.edition === 'published-0.2.0');
    return { source, currentSha256: current?.sha256 ?? null, published020Sha256: published?.sha256 ?? null,
      identical: !!current && !!published && current.sha256 === published.sha256,
      disposition: !published && current ? 'new-0.2.1-contract-at-existing-identifier' : 'existing-schema-byte-comparison' };
  });
  const instances = [
    { edition: 'current', root: ROOT, file: 'packages/tokens/dist/tailwind/tokens.json', schema: TOKEN_CONTRACTS[0].source },
    { edition: 'published-0.2.0', root: publishedRoot, file: 'packages/tokens/dist/tailwind/tokens.json', schema: TOKEN_CONTRACTS[0].source },
    { edition: 'current', root: ROOT, file: 'packages/tokens/src/tokens/themes/high-contrast/map.json', schema: TOKEN_CONTRACTS[1].source },
  ].map(({ edition, root, file, schema }) => {
    const bytes = fs.readFileSync(path.join(root, file));
    const ajv = new Ajv({ strict: true, validateFormats: false });
    const validate = ajv.compile(json(path.join(ROOT, schema)));
    assert(validate(JSON.parse(bytes)), `${edition}/${file}: ${JSON.stringify(validate.errors)}`);
    return { edition, file, sha256: hash(bytes), schema, validatesAgainstNewContract: true, qualification: 'Compatibility test of existing instance bytes; not evidence of a historical schema definition.' };
  });
  const findings = packageContentFindings([...outputs].map(([file, bytes]) => ({ path: file, bytes })), ownerFacts(ROOT));
  assert.equal(findings.length, 0, JSON.stringify(findings));
  const manifest = {
    mission: 's212-m04', builderSelfCertified: false, status: unresolved.length ? 'incomplete-missing-source-schemas' : 'ready-for-host-review',
    deploymentPerformed: false, coordinationSent: false,
    sourceIdentity: { currentPackageVersion: currentVersion, currentBaseHead: '3fab1b0a00237c0565c3677ee25369f4fdcbb2d7',
      publishedRuntimeCommit: sourceHead.commit, publishedRuntimePayloadTreeSha256: sourceHead.payloadTreeSha256,
      publishedRuntimeManifestSha256: hash(fs.readFileSync(path.join(publishedRoot, 'oods-foundry-runtime.manifest.json'))),
      publishedIdentityQualification: 'Retained 0.2.0 runtime from m01; registry and tarball integrity verification is assigned to m05.' },
    schemaVersionPolicy: 'Existing visualization schemas preserve identifiers, dialect, titles and all bytes. Two token contracts are newly authored for 0.2.1 under user authorization #2329 at already-emitted identifiers; no 0.2.0 definitions are invented. Package editions are distinct from schema versions; null means no top-level version declared.',
    referencePolicy: 'All discovered $ref values resolve to JSON Pointers in the same document. The draft-07 $schema URI identifies the standard dialect; Ajv uses its bundled meta-schema. No HTTP fetch or deploy occurs. Missing token contracts are not represented by permissive stub schemas.',
    schemas, comparisons, instances, unresolved, historicalAbsences,
    checks: { jsonParsed: schemas.length, draft07Compiled: schemas.length, localReferencesResolved: schemas.reduce((sum, row) => sum + row.references.length, 0), contentFindings: findings.length,
      missingCurrentContracts: unresolved.length, historicalAbsentContracts: historicalAbsences.length, instanceChecks: instances.length, complete: unresolved.length === 0 },
  };
  outputs.set('manifest.json', Buffer.from(serialize(manifest)));
  for (const [relative, bytes] of outputs) {
    const target = path.join(outDir, relative);
    if (check) assert(fs.existsSync(target) && fs.readFileSync(target).equals(bytes), `stale packet member: ${relative}`);
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), options = { check: argv.includes('--check') };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--check') continue;
    const key = { '--published-root': 'publishedRoot', '--out-dir': 'outDir' }[argv[index]];
    assert(key && argv[index + 1], `unknown or incomplete option ${argv[index]}`);
    options[key] = path.resolve(argv[++index]);
  }
  const result = buildPacket(options);
  console.log(serialize({ status: result.status, checks: result.checks, comparisons: result.comparisons }));
  // Producing an explicitly incomplete inventory is useful; completeness is never implied by a zero status.
  process.exitCode = result.checks.complete ? 0 : 2;
}
