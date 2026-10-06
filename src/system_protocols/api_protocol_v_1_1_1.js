/*
 * API Protocol — v1.1.1 (stand‑alone)
 * Lightweight, manifest‑first contract format + helpers
 *
 * Design goals
 * - Remain self‑contained (no external protocol wiring)
 * - Keep the surface area small, orthogonal, and useful in practice
 * - Add only critical refinements: validator registry, typed auth & errors,
 *   rate limits, lifecycle, pagination/long‑running hints, diff hashing,
 *   and a tidy selector/query language.
 */

/** @typedef {import('crypto').Hash} NodeHash */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, local)
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} SignatureEnvelope
 * @property {'identity-access.signing.v1'} spec
 * @property {string} protected
 * @property {string} payload
 * @property {{alg:'sha-256', value:string}} hash
 * @property {string} signature
 * @property {{alg:'EdDSA'|'ES256', kid:string, typ:string, canonical:string, digest:string, iat:string, exp?:string, [key:string]:any}} [header]
 */

/** Canonicalize JSON for stable hashing */
function jsonCanon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => jsonCanon(v)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jsonCanon(value[k])).join(',') + '}';
}

/** Stable SHA‑256 hash of any JSON‑serializable value */
function hash(value) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(jsonCanon(value)).digest('hex');
}

/** Deep get via dot‑path (e.g., 'interface.endpoints.0.method') */
function dget(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
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

// ————————————————————————————————————————————————————————————————
// Minimal manifest schema (shape only – not a validator library)
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} APIManifest
 * @property {string} [version]          Protocol version (e.g., "v1.1", "v2.0")
 * @property {Object} service            Basic identity
 * @property {string} service.name
 * @property {string} [service.version]  Semver string for the API manifest
 * @property {Object} [capabilities]     High‑level purposes or domains
 * @property {Object} interface          Request/response surface
 * @property {('none'|'apiKey'|'oauth2'|'hmac')} [interface.authentication.type]
 * @property {('header'|'query'|'cookie')} [interface.authentication.in]
 * @property {string[]} [interface.authentication.scopes]
 * @property {{
 *   method: string,
 *   path: string,
 *   summary?: string,
 *   params?: Array<{name:string,in:'path'|'query'|'header'|'cookie',required?:boolean, schema?:any}>,
 *   request?: {contentType?: string, schema?: any},
 *   responses?: Array<{status:number, schema?: any, description?: string}>,
 *   errors?: Array<{code:string,http?:number,retriable?:boolean,docs?:string}>,
 *   pagination?: {style:'cursor'|'page', params?:{cursor?:string, limit?:string, page?:string}},
 *   long_running?: {pattern:'polling'|'webhook'|'sse', status_endpoint?:string}
 * }[]} interface.endpoints
 * @property {Object} [operations]
 * @property {{scope:'tenant'|'user'|'ip'|'global',limit:number,window:string,burst?:number}[]} [operations.rate_limits]
 * @property {Object} [context]          Loose metadata for discovery (domain, team, tier, region, etc.)
 * @property {Object} [validation]       JSON Schemas or pointers; optional hashes auto‑filled
 * @property {Object<string,any>} [validation.schemas]
 * @property {Object<string,string>} [validation.schema_hashes]
 * @property {Object} [quality]          Lightweight signals (coverage, tests, status url)
 * @property {Object} [metadata]         Freeform extras
 * @property {{status:'ga'|'beta'|'deprecated', sunset_at?:string}} [metadata.lifecycle]
 * @property {Object} [relationships]    Declared neighbors (remain descriptive, not executable)
 * @property {string[]} [relationships.dependencies]
 * @property {string[]} [relationships.consumers]
 * @property {string[]} [relationships.complements]
 * @property {Object} [rules]            Optional rules (e.g., endpoint constraints)
 * @property {SignatureEnvelope} [sig]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry (tiny, pluggable, local)
// ————————————————————————————————————————————————————————————————

const Validators = new Map();

/** Register a named validator.
 * @param {string} name
 * @param {(manifest: APIManifest) => {ok:boolean, issues?:Array<{path?:string, msg:string, level?:'error'|'warn'}>}} fn
 */
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
  if (!m?.service?.name) issues.push({ path: 'service.name', msg: 'service.name is required', level: 'error' });
  if (!m?.interface?.endpoints || !Array.isArray(m.interface.endpoints) || m.interface.endpoints.length === 0) {
    issues.push({ path: 'interface.endpoints', msg: 'at least one endpoint required', level: 'error' });
  }
  // Typed auth sanity
  const a = m?.interface?.authentication;
  if (a && !['none','apiKey','oauth2','hmac'].includes(a.type)) {
    issues.push({ path: 'interface.authentication.type', msg: 'invalid auth.type', level: 'error' });
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('errors.minimal', (m) => {
  const issues = [];
  for (const [i, ep] of (m.interface?.endpoints||[]).entries()) {
    if (!ep.errors) continue;
    for (const [j, e] of ep.errors.entries()) {
      if (!e.code) issues.push({ path: `interface.endpoints.${i}.errors.${j}.code`, msg: 'error.code required', level: 'error' });
    }
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('ops.rates', (m) => {
  const issues = [];
  for (const [i, rl] of (m.operations?.rate_limits||[]).entries()) {
    if (!['tenant','user','ip','global'].includes(rl.scope)) issues.push({ path: `operations.rate_limits.${i}.scope`, msg: 'invalid scope', level: 'error' });
    if (!(rl.limit > 0)) issues.push({ path: `operations.rate_limits.${i}.limit`, msg: 'limit must be > 0', level: 'error' });
    if (!rl.window) issues.push({ path: `operations.rate_limits.${i}.window`, msg: 'window required', level: 'error' });
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('lifecycle', (m) => {
  const lc = m?.metadata?.lifecycle; if (!lc) return { ok: true };
  const ok = ['ga','beta','deprecated'].includes(lc.status);
  return ok ? { ok } : { ok, issues: [{ path: 'metadata.lifecycle.status', msg: 'status must be ga|beta|deprecated', level: 'error' }] };
});

// ————————————————————————————————————————————————————————————————
// Selector/Query (tiny language)
// ————————————————————————————————————————————————————————————————

/**
 * Supports expressions like:
 *  - 'service.name:contains:billing'
 *  - 'interface.endpoints.0.method:=:GET'
 *  - 'operations.rate_limits[0].limit:>:1000'
 *  - 'context.domain:=:ai'
 * Operators: :=: (equals), contains, >, <, >=, <=
 */
function query(manifest, expr) {
  const parts = expr.split(':');
  if (parts.length < 3) return false;
  const path = parts[0];
  const op = parts[1];
  const rhs = parts.slice(2).join(':');
  const lhs = dget(manifest, path.replace(/\[(\d+)\]/g, '.$1'));
  switch (op) {
    case ':=:': return String(lhs) === rhs;
    case 'contains': return String(lhs||'').includes(rhs);
    case '>': return Number(lhs) > Number(rhs);
    case '<': return Number(lhs) < Number(rhs);
    case '>=': return Number(lhs) >= Number(rhs);
    case '<=': return Number(lhs) <= Number(rhs);
    default: return false;
  }
}

// ————————————————————————————————————————————————————————————————
// Diff (structural + semantic hints)
// ————————————————————————————————————————————————————————————————

function normalize(manifest) {
  const m = clone(manifest);
  // auto‑hash schemas if present
  if (m.validation?.schemas) {
    m.validation.schema_hashes = {};
    for (const [k, v] of Object.entries(m.validation.schemas)) {
      m.validation.schema_hashes[k] = hash(v);
    }
  }
  return m;
}

function diff(a, b) {
  const A = normalize(a); const B = normalize(b);
  const changes = [];

  function walk(pa, va, vb) {
    if (JSON.stringify(va) === JSON.stringify(vb)) return;
    if (typeof va !== 'object' || typeof vb !== 'object' || va === null || vb === null) {
      changes.push({ path: pa, from: va, to: vb });
      return;
    }
    const keys = new Set([ ...Object.keys(va||{}), ...Object.keys(vb||{}) ]);
    for (const k of keys) walk(pa ? pa + '.' + k : k, va?.[k], vb?.[k]);
  }

  walk('', A, B);

  // breaking‑change heuristics (small but useful)
  const breaking = [];
  for (const c of changes) {
    if (c.path.startsWith('interface.authentication.type')) breaking.push({reason:'auth type changed', ...c});
    if (c.path.includes('.method') || c.path.includes('.path')) breaking.push({reason:'endpoint signature changed', ...c});
    if (c.path.startsWith('validation.schema_hashes.')) breaking.push({reason:'schema changed', ...c});
    if (c.path.startsWith('metadata.lifecycle.status') && dget(a,'metadata.lifecycle.status')==='ga' && dget(b,'metadata.lifecycle.status')!=='ga') {
      breaking.push({reason:'lifecycle downgrade', ...c});
    }
  }

  return { changes, breaking };
}

// ————————————————————————————————————————————————————————————————
// Tests (generate minimal reachability & contract probes)
// ————————————————————————————————————————————————————————————————

function generateTests(manifest) {
  const tests = [];
  for (const ep of (manifest.interface?.endpoints||[])) {
    const name = (ep.summary || `${ep.method} ${ep.path}`).trim();
    // reachability smoke
    tests.push({
      name: `reach: ${name}`,
      kind: 'http',
      request: { method: ep.method, path: ep.path },
      expect: { status: (ep.responses?.[0]?.status)||200 }
    });
    // auth probe if any
    if (manifest.interface?.authentication?.type && manifest.interface.authentication.type!=='none') {
      tests.push({
        name: `auth‑probe: ${name}`,
        kind: 'auth',
        request: { method: ep.method, path: ep.path },
        expect: { not_status: 401 }
      });
    }
    // pagination helpers
    if (ep.pagination?.style) {
      tests.push({ name: `pagination: ${name}`, kind: 'pagination', request: { method: ep.method, path: ep.path } });
    }
    // long‑running pattern
    if (ep.long_running?.pattern === 'polling' && ep.long_running.status_endpoint) {
      tests.push({ name: `lro: ${name}`, kind: 'lro-poll', request: { method: 'GET', path: ep.long_running.status_endpoint } });
    }
  }
  return tests;
}

// ————————————————————————————————————————————————————————————————
// SDK (minimal template: fetch‑based, pluggable auth & errors)
// ————————————————————————————————————————————————————————————————

function generateClientSDK(manifest, { moduleName = 'ApiClient' } = {}) {
  const a = manifest.interface?.authentication?.type || 'none';
  const sdk = [];
  sdk.push(`export class ${moduleName} {`);
  sdk.push(`  constructor(baseUrl, opts = {}) { this.baseUrl = baseUrl; this.opts = opts; }`);
  // auth injector
  sdk.push(`  _headers() { const h = {...(this.opts.headers||{})};`);
  if (a === 'apiKey') sdk.push(`    if (this.opts.apiKey) h['Authorization'] = 'Bearer ' + this.opts.apiKey;`);
  if (a === 'oauth2') sdk.push(`    if (this.opts.token) h['Authorization'] = 'Bearer ' + this.opts.token;`);
  if (a === 'hmac') sdk.push(`    if (this.opts.sign) Object.assign(h, this.opts.sign());`);
  sdk.push(`    return h; }`);

  for (const ep of (manifest.interface?.endpoints||[])) {
    const methodName = (ep.summary||'').replace(/[^a-zA-Z0-9]+/g,'_').toLowerCase() ||
      (ep.path.replace(/\{([^}]+)\}/g, 'by_$1').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase());
    const pathTempl = ep.path;
    sdk.push(`  async ${methodName}(params = {}, body) {`);
    sdk.push(`    let p = '${pathTempl}'.replace(/\{([^}]+)\}/g, (_,k) => encodeURIComponent(params[k]));`);
    sdk.push(`    const q = new URLSearchParams();`);
    sdk.push(`    ${(ep.params||[]).filter(x=>x.in==='query').map(x=>`if (params['${x.name}']!=null) q.set('${x.name}', String(params['${x.name}']));`).join('\n    ')}`);
    sdk.push(`    const url = this.baseUrl + p + (q.toString() ? ('?' + q.toString()) : '');`);
    sdk.push(`    const res = await fetch(url, { method: '${ep.method}', headers: this._headers(), body: ${ep.request?.schema ? 'JSON.stringify(body)' : 'undefined'} });`);
    // Typed error handling if declared
    if (ep.errors && ep.errors.length) {
      sdk.push(`    if (!res.ok) { const txt = await res.text(); throw { name:'ApiError', status: res.status, body: txt, known: ${JSON.stringify(ep.errors.map(e=>({code:e.code,http:e.http||0})))} }; }`);
    } else {
      sdk.push(`    if (!res.ok) { const txt = await res.text(); throw { name:'ApiError', status: res.status, body: txt }; }`);
    }
    sdk.push(`    const ct = res.headers.get('content-type')||''; return ct.includes('application/json') ? res.json() : res.text();`);
    sdk.push(`  }`);
  }

  sdk.push(`}`);
  return sdk.join('\n');
}

// ————————————————————————————————————————————————————————————————
// Public factory
// ————————————————————————————————————————————————————————————————

function createAPIProtocol(manifestInput = {}) {
  // Shallow normalize + schema hashes
  const manifest = normalize(manifestInput);
  return Object.freeze({
    /** Return a cloned manifest */
    manifest: () => clone(manifest),

    /** Run named or all validators */
    validate: (names=[]) => runValidators(manifest, names),

    /** Simple selection by expression */
    match: (expr) => query(manifest, expr),

    /** Compute diff vs. another manifest */
    diff: (other) => diff(manifest, other),

    /** Generate minimal, useful tests */
    generateTests: () => generateTests(manifest),

    /** Emit a tiny fetch‑based client SDK (string) */
    generateClientSDK: (opts) => generateClientSDK(manifest, opts),

    /** Update a value by path, returning a new protocol instance */
    set: (path, value) => {
      const m = clone(manifest); dset(m, path, value); return createAPIProtocol(m);
    },
  });
}

// ————————————————————————————————————————————————————————————————
// Catalog factory for MCP discovery
// ————————————————————————————————————————————————————————————————
function createAPICatalog(protocols = []) {
  const items = protocols;
  function asManifests() { return items.map(p => p.manifest()); }
  function find(expr) { return items.filter(p => p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m => ({ id: m.api?.id, ...runValidators(m, names) })); }
  return Object.freeze({ items, find, validateAll });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————

export {
  createAPIProtocol,
  createAPICatalog,
  registerValidator,
  Validators,
  hash
};

// ————————————————————————————————————————————————————————————————
// Example (commented)
// ————————————————————————————————————————————————————————————————
/*
const m = {
  service: { name: 'billing', version: '1.2.0' },
  interface: {
    authentication: { type: 'oauth2', scopes: ['read:invoices'] },
    endpoints: [
      {
        method: 'GET', path: '/v1/invoices', summary: 'listInvoices',
        params: [{name:'limit', in:'query', schema:{type:'integer'}}],
        responses: [{status:200, schema:{type:'array'}}],
        errors: [{code:'RATE_LIMITED', http:429, retriable:true}],
        pagination: { style:'cursor', params:{ cursor:'cursor', limit:'limit' } },
      }
    ]
  },
  operations: { rate_limits: [{ scope:'user', limit: 1000, window:'1m' }] },
  metadata: { lifecycle: { status: 'ga' } },
  validation: { schemas: { Invoice: { type:'object', properties:{ id:{type:'string'} } } } },
};

const api = createAPIProtocol(m);
console.log(api.validate());
console.log(api.generateTests());
console.log(api.generateClientSDK({ moduleName: 'BillingClient' }));
*/
