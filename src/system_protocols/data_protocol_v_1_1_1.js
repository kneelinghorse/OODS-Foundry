/*
 * Data Protocol — v1.1.1 (stand‑alone)
 * Minimal, self‑describing dataset manifest + helpers
 *
 * Goals
 * - Keep surface area tiny; deliver immediate catalog/search/diff/migration utility
 * - No external wiring; zero dependencies
 * - Add only essential fields + crisp validators
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, local)
// ————————————————————————————————————————————————————————————————

/** Canonicalize JSON for stable hashing */
function jsonCanon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => jsonCanon(v)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jsonCanon(value[k])).join(',') + '}';
}

/** Deep get via dot‑path (supports [index] → .index) */
function dget(obj, path) {
  if (!path) return obj;
  const p = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const k of p) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/** Deep set via dot‑path */
function dset(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  while (parts.length > 1) {
    const k = parts.shift();
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[0]] = val;
}

/** Tiny clone */
const clone = x => JSON.parse(JSON.stringify(x));

/**
 * Stable 64‑bit FNV‑1a hash of any JSON‑serializable value (hex string).
 * No deps; good enough to detect schema changes without collisions in practice.
 */
function hash(value) {
  const str = jsonCanon(value);
  let h = BigInt('0xcbf29ce484222325');
  const p = BigInt('0x100000001b3');
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * p) & BigInt('0xFFFFFFFFFFFFFFFF');
  }
  return 'fnv1a64-' + h.toString(16).padStart(16, '0');
}

/**
 * @typedef {Object} SignatureEnvelope
 * @property {'identity-access.signing.v1'} spec
 * @property {string} protected
 * @property {string} payload
 * @property {{alg:'sha-256', value:string}} hash
 * @property {string} signature
 * @property {{alg:'EdDSA'|'ES256', kid:string, typ:string, canonical:string, digest:string, iat:string, exp?:string, [key:string]:any}} [header]
 */

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc only)
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} DataManifest
 * @property {string} [version]          Protocol version (e.g., "v1.1", "v2.0")
 * @property {Object} dataset
 * @property {string} dataset.name
 * @property {('fact-table'|'dimension'|'file'|'stream'|'view'|'unknown')} [dataset.type]
 * @property {{status:'active'|'deprecated', sunset_at?:string}} [dataset.lifecycle]
 * @property {Object} [schema]
 * @property {string|string[]} [schema.primary_key]
 * @property {Object<string,{type:string, required?:boolean, pii?:boolean, description?:string}>} [schema.fields]
 * @property {{ unique?: string[], foreign_keys?: Array<{field:string, ref:string}>, partition?: {field:string, type?:'daily'|'hourly'|'monthly'}}} [schema.keys]
 * @property {Object} [lineage]
 * @property {Array<{type:string,id:string}>} [lineage.sources]
 * @property {Array<{type:string,id:string}>} [lineage.consumers]
 * @property {Object} [operations]
 * @property {{ schedule?: 'hourly'|'daily'|'cron', expected_by?: string }} [operations.refresh]
 * @property {string} [operations.retention]
 * @property {Object} [governance]
 * @property {{classification?: 'internal'|'confidential'|'pii', legal_basis?: 'gdpr'|'ccpa'|'hipaa'|'other'}} [governance.policy]
 * @property {{ region?: string, vendor?: string, encrypted_at_rest?: boolean }} [governance.storage_residency]
 * @property {Object} [quality]
 * @property {string} [quality.freshness_ts]
 * @property {number} [quality.row_count_estimate]
 * @property {Object<string,number>} [quality.null_rate]
 * @property {Object} [catalog]
 * @property {string} [catalog.owner]
 * @property {string[]} [catalog.tags]
 * @property {SignatureEnvelope} [sig]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry (local, pluggable)
// ————————————————————————————————————————————————————————————————

const Validators = new Map();

/** Register a named validator. */
function registerValidator(name, fn) { Validators.set(name, fn); }

function runValidators(manifest, selected = []) {
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = [];
  for (const n of names) {
    const r = Validators.get(n)?.(manifest) || { ok: true };
    results.push({ name: n, ...r });
  }
  const ok = results.every(r => r.ok);
  return { ok, results };
}

// Built‑ins (minimal, practical)
registerValidator('core.shape', (m) => {
  const issues = [];
  if (!m?.dataset?.name) issues.push({ path: 'dataset.name', msg: 'dataset.name is required', level: 'error' });
  if (!m?.schema?.fields || typeof m.schema.fields !== 'object' || !Object.keys(m.schema.fields).length) {
    issues.push({ path: 'schema.fields', msg: 'at least one field required', level: 'error' });
  }
  const lc = m?.dataset?.lifecycle; if (lc && !['active','deprecated'].includes(lc.status)) {
    issues.push({ path: 'dataset.lifecycle.status', msg: 'status must be active|deprecated', level: 'error' });
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('schema.keys', (m) => {
  const issues = [];
  const pk = m?.schema?.primary_key;
  if (pk) {
    const fields = m.schema.fields || {};
    const pkArr = Array.isArray(pk) ? pk : [pk];
    for (const f of pkArr) if (!(f in fields)) issues.push({ path: 'schema.primary_key', msg: `primary key field missing: ${f}`, level: 'error' });
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('governance.pii_policy', (m) => {
  const issues = [];
  const anyPII = Object.values(m?.schema?.fields || {}).some(f => f.pii === true);
  if (anyPII) {
    const cls = m?.governance?.policy?.classification;
    if (cls !== 'pii') issues.push({ path: 'governance.policy.classification', msg: 'PII fields present → classification should be "pii"', level: 'warn' });
    if (m?.governance?.storage_residency?.encrypted_at_rest !== true) {
      issues.push({ path: 'governance.storage_residency.encrypted_at_rest', msg: 'PII datasets should be encrypted at rest', level: 'warn' });
    }
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('operations.refresh', (m) => {
  const r = m?.operations?.refresh; if (!r) return { ok: true };
  const issues = [];
  if (r.schedule && !['hourly','daily','cron'].includes(r.schedule)) issues.push({ path: 'operations.refresh.schedule', msg: 'schedule must be hourly|daily|cron', level: 'error' });
  // expected_by is informational; no strict check
  return { ok: issues.length === 0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (tiny): ':=:' 'contains' '>' '<' '>=' '<='
// Adds convenience for lineage/fields
// ————————————————————————————————————————————————————————————————

function query(manifest, expr) {
  const [rawPath, op, ...rest] = String(expr).split(':');
  const rhs = rest.join(':');
  if (!rawPath || !op) return false;

  // Convenience forms
  if (rawPath.startsWith('lineage.') && op === 'contains') {
    const arr = dget(manifest, rawPath);
    return Array.isArray(arr) && arr.some(x => (x?.id || '').includes(rhs));
  }
  if (rawPath === 'schema.fields' && op === 'contains') {
    const fields = manifest.schema?.fields || {};
    return Object.keys(fields).some(k => k.includes(rhs));
  }

  const lhs = dget(manifest, rawPath);
  switch (op) {
    case ':=:': return String(lhs) === rhs;
    case 'contains': return String(lhs ?? '').includes(rhs);
    case '>': return Number(lhs) > Number(rhs);
    case '<': return Number(lhs) < Number(rhs);
    case '>=': return Number(lhs) >= Number(rhs);
    case '<=': return Number(lhs) <= Number(rhs);
    default: return false;
  }
}

// ————————————————————————————————————————————————————————————————
// Normalize (auto‑compute schema_hashes)
// ————————————————————————————————————————————————————————————————

function normalize(manifest) {
  const m = clone(manifest || {});
  if (!m.schema) m.schema = {};
  if (!m.schema.fields) m.schema.fields = {};
  // hash per field and whole schema for integrity checks
  m.schema_hash = hash(m.schema);
  m.field_hashes = {};
  for (const [k, v] of Object.entries(m.schema.fields)) m.field_hashes[k] = hash(v);
  return m;
}

// ————————————————————————————————————————————————————————————————
// Diff (structural + semantic hints)
// ————————————————————————————————————————————————————————————————

function diff(a, b) {
  const A = normalize(a); const B = normalize(b);
  const changes = [];

  function walk(pa, va, vb) {
    if (JSON.stringify(va) === JSON.stringify(vb)) return;
    const isObj = v => v && typeof v === 'object';
    if (!isObj(va) || !isObj(vb)) { changes.push({ path: pa, from: va, to: vb }); return; }
    const keys = new Set([...Object.keys(va||{}), ...Object.keys(vb||{})]);
    for (const k of keys) walk(pa ? pa + '.' + k : k, va?.[k], vb?.[k]);
  }

  walk('', A, B);

  // breaking heuristics
  const breaking = [];
  for (const c of changes) {
    if (c.path === 'schema.primary_key') breaking.push({ ...c, reason: 'primary key changed' });
    if (c.path.startsWith('schema.fields.') && c.path.endsWith('.type')) breaking.push({ ...c, reason: 'column type changed' });
    if (c.path.startsWith('schema.fields.') && c.to === undefined) breaking.push({ ...c, reason: 'column dropped' });
    if (c.path.endsWith('.required')) breaking.push({ ...c, reason: 'required flag changed' });
    if (c.path.endsWith('.pii')) breaking.push({ ...c, reason: 'pii flag changed' });
    if (c.path === 'dataset.lifecycle.status' && dget(a, 'dataset.lifecycle.status') === 'active' && dget(b, 'dataset.lifecycle.status') === 'deprecated') {
      breaking.push({ ...c, reason: 'lifecycle downgrade' });
    }
    if (c.path === 'schema_hash') breaking.push({ ...c, reason: 'schema changed' });
  }

  const significant = changes.filter(c => c.path.startsWith('governance.') || c.path.startsWith('lineage.') || c.path.startsWith('operations.refresh'));
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Migration helper (tiny suggestions)
// ————————————————————————————————————————————————————————————————

function generateMigration(fromManifest, toManifest) {
  const d = diff(fromManifest, toManifest);
  const steps = [];
  for (const change of d.changes) {
    const p = change.path;
    // Field add/remove/modify
    if (p.startsWith('schema.fields.')) {
      const fieldName = p.split('.')[2];
      if (p.endsWith('.type')) steps.push(`ALTER COLUMN ${fieldName} TYPE ... /* from ${change.from} to ${change.to} */`);
      if (change.to === undefined) steps.push(`DROP COLUMN ${fieldName}`);
      if (change.from === undefined) steps.push(`ADD COLUMN ${fieldName} ${dget(toManifest, `schema.fields.${fieldName}.type`)}`);
      if (p.endsWith('.required') && change.to === true) steps.push(`-- BACKFILL: make '${fieldName}' NOT NULL (add default or backfill)`);
      if (p.endsWith('.pii') && change.to === true) steps.push(`-- POLICY: '${fieldName}' now PII; ensure masking/encryption policy`);
    }
    if (p === 'schema.primary_key') steps.push(`-- PRIMARY KEY changed (rebuild index / validate uniqueness)`);
  }
  return { steps, notes: d.breaking.map(b => `BREAKING: ${b.reason} @ ${b.path}`) };
}

// Additional generators
function generateSchema(manifest) {
  const fields = manifest.schema?.fields || {};
  const schema = {
    type: 'object',
    properties: {},
    required: []
  };
  
  for (const [name, field] of Object.entries(fields)) {
    schema.properties[name] = {
      type: field.type,
      description: field.description
    };
    if (field.required) {
      schema.required.push(name);
    }
  }
  
  return JSON.stringify(schema, null, 2);
}

function generateValidation(manifest) {
  const fields = manifest.schema?.fields || {};
  const validations = [];
  
  for (const [name, field] of Object.entries(fields)) {
    if (field.required) {
      validations.push(`if (!data.${name}) throw new Error('${name} is required');`);
    }
    if (field.type === 'string' && field.max_length) {
      validations.push(`if (data.${name} && data.${name}.length > ${field.max_length}) throw new Error('${name} exceeds max length');`);
    }
  }
  
  return `function validate(data) {\n  ${validations.join('\n  ')}\n  return true;\n}`;
}

function generateDocs(manifest) {
  const name = manifest.dataset?.name || 'Dataset';
  const fields = manifest.schema?.fields || {};
  
  let docs = `# ${name}\n\n`;
  docs += `**Description**: ${manifest.dataset?.description || 'No description'}\n\n`;
  docs += `## Schema\n\n`;
  docs += `| Field | Type | Required | Description |\n`;
  docs += `|-------|------|----------|-------------|\n`;
  
  for (const [name, field] of Object.entries(fields)) {
    docs += `| ${name} | ${field.type} | ${field.required ? 'Yes' : 'No'} | ${field.description || ''} |\n`;
  }
  
  return docs;
}

// ————————————————————————————————————————————————————————————————
// Protocol factory
// ————————————————————————————————————————————————————————————————

function createDataProtocol(manifestInput = {}) {
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: () => clone(manifest),
    validate: (names=[]) => runValidators(manifest, names),
    match: (expr) => query(manifest, expr),
    diff: (other) => diff(manifest, other),
    generateMigration: (other) => generateMigration(manifest, other),
    generateSchema: () => generateSchema(manifest),
    generateValidation: () => generateValidation(manifest),
    generateDocs: () => generateDocs(manifest),
    set: (path, value) => { const m = clone(manifest); dset(m, path, value); return createDataProtocol(m); },
  });
}

// ————————————————————————————————————————————————————————————————
// Catalog (optional helper for multiple manifests)
// ————————————————————————————————————————————————————————————————

function createDataCatalog(protocols = []) {
  const items = protocols;
  function asManifests() { return items.map(p => p.manifest()); }

  function validateAll(names=[]) { return asManifests().map(m => ({ name: m.dataset?.name, ...runValidators(m, names) })); }

  function find(expr) { return items.filter(p => p.match(expr)); }

  // detect simple lineage cycles by dataset.id (use dataset.name as id)
  function detectCycles() {
    const id = m => m.dataset?.name;
    const graph = new Map();
    for (const m of asManifests()) {
      const me = id(m); if (!me) continue;
      const outs = (m.lineage?.consumers || []).map(x => x.id).filter(Boolean);
      graph.set(me, outs);
    }
    const visited = new Set(), stack = new Set();
    const cycles = [];
    function dfs(node, path=[]) {
      if (stack.has(node)) { cycles.push([...path, node]); return; }
      if (visited.has(node)) return;
      visited.add(node); stack.add(node);
      for (const nxt of (graph.get(node) || [])) dfs(nxt, [...path, node]);
      stack.delete(node);
    }
    for (const n of graph.keys()) dfs(n, []);
    return cycles;
  }

  // Governance check: PII egress to external
  function piiEgressWarnings() {
    const warnings = [];
    const ms = asManifests();
    for (const m of ms) {
      const anyPII = Object.values(m.schema?.fields || {}).some(f => f.pii === true);
      if (!anyPII) continue;
      for (const c of (m.lineage?.consumers || [])) {
        if ((c.type||'').toLowerCase() === 'external') warnings.push({ dataset: m.dataset?.name, consumer: c.id, msg: 'PII dataset consumed externally' });
      }
    }
    return warnings;
  }

  return Object.freeze({
    items, find, validateAll, detectCycles, piiEgressWarnings,
  });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————

module.exports = {
  createDataProtocol,
  createDataCatalog,
  registerValidator,
  Validators,
};

// ————————————————————————————————————————————————————————————————
// Example (commented)
// ————————————————————————————————————————————————————————————————
/*
const userEvents = createDataProtocol({
  dataset: { name: 'user_events', type: 'fact-table', lifecycle: { status: 'active' } },
  schema: {
    primary_key: 'event_id',
    fields: {
      event_id: { type: 'string', required: true },
      user_id:  { type: 'string', required: true },
      email:    { type: 'string', pii: true },
      amount:   { type: 'number' },
      event_date: { type: 'date' },
    },
    keys: { unique: ['event_id'], foreign_keys: [{ field: 'user_id', ref: 'dim:users.id' }], partition: { field: 'event_date', type: 'daily' } }
  },
  lineage: { sources: [{ type: 'service', id: 'user-service' }], consumers: [{ type: 'model', id: 'churn-ml' }, { type: 'external', id: 'vendor-x' }] },
  operations: { refresh: { schedule: 'hourly', expected_by: '08:00Z' }, retention: '2-years' },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' }, storage_residency: { region: 'eu', vendor: 's3', encrypted_at_rest: true } },
  quality: { freshness_ts: '2025-09-28T08:15:00Z', row_count_estimate: 123456, null_rate: { email: 0.02 } },
  catalog: { owner: 'identity-team', tags: ['events','pii'] },
});

const next = userEvents.set('schema.fields.country', { type: 'string' }).set('schema.fields.email.required', true).manifest();
console.log(userEvents.diff(next));
console.log(generateMigration(userEvents.manifest(), next));

const catalog = createDataCatalog([userEvents]);
console.log('cycles:', catalog.detectCycles());
console.log('pii egress:', catalog.piiEgressWarnings());
*/
