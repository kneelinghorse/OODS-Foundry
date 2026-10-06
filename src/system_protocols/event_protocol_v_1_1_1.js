/*
 * Event Protocol — v1.1.1 (stand‑alone)
 * Minimal, self‑describing event manifest + helpers
 *
 * Goals
 * - Mirror API/Data protocol ergonomics (manifest + validate + query + diff + generate)
 * - Keep it tiny; add only essentials: compatibility, lifecycle, delivery hints, PII governance
 * - Zero dependencies; no external wiring
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————

/** Canonicalize JSON for stable hashing */
function jsonCanon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => jsonCanon(v)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jsonCanon(value[k])).join(',') + '}';
}

/** Deep get via dot‑path (supports [index]) */
function dget(obj, path) {
  if (!path) return obj;
  const p = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const k of p) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

/** Deep set via dot‑path */
function dset(obj, path, val) {
  const parts = String(path).split('.');
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

/** Stable 64‑bit FNV‑1a hash (hex) of any JSON‑serializable value */
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
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} EventManifest
 * @property {string} [version]             Protocol version (e.g., "v1.1", "v2.0")
 * @property {Object} event
 * @property {string} event.name            // e.g., 'payment.completed'
 * @property {string} [event.version]       // e.g., '1.1.0'
 * @property {{status:'active'|'deprecated', sunset_at?:string}} [event.lifecycle]
 * @property {Object} [semantics]           // human intent
 * @property {string} [semantics.purpose]
 * @property {Object} [schema]
 * @property {('json-schema'|'custom')} [schema.format]
 * @property {Object} [schema.payload]      // JSON Schema (properties, required, ...)
 * @property {Array<{name:string,type?:string,required?:boolean,pii?:boolean,description?:string}>} [schema.fields] // optional flat map for convenience
 * @property {{ policy?: 'backward'|'forward'|'full'|'none', compatible_versions?: string[] }} [schema.compatibility]
 * @property {Object} [delivery]
 * @property {{transport?:'kafka'|'sns'|'sqs'|'webhook'|'sse'|'ws', topic?:string, guarantees?:'at-least-once'|'exactly-once'|'best-effort', retry_policy?:'exponential'|'linear'|'none', dlq?:string}} [delivery.contract]
 * @property {Object} [governance]
 * @property {{classification?: 'internal'|'confidential'|'pii', legal_basis?: 'gdpr'|'ccpa'|'hipaa'|'other'}} [governance.policy]
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 * @property {SignatureEnvelope} [sig]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry
// ————————————————————————————————————————————————————————————————

const Validators = new Map();
function registerValidator(name, fn) { Validators.set(name, fn); }
function runValidators(manifest, selected = []) {
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = [];
  for (const n of names) results.push({ name: n, ...(Validators.get(n)?.(manifest) || { ok: true }) });
  return { ok: results.every(r => r.ok), results };
}

// — Helpers: field extraction (supports schema.fields or JSON Schema w/ x-pii) —
function extractFields(m) {
  if (Array.isArray(m?.schema?.fields)) return m.schema.fields.map(f => ({ name: f.name, pii: !!f.pii, required: !!f.required }));
  const props = m?.schema?.payload?.properties || {}; const req = new Set(m?.schema?.payload?.required || []);
  return Object.keys(props).map(name => ({ name, pii: !!props[name]['x-pii'], required: req.has(name) }));
}

// Built-ins
registerValidator('core.shape', (m) => {
  const issues = [];
  if (!m?.event?.name) issues.push({ path: 'event.name', msg: 'event.name is required', level: 'error' });
  const hasFields = Array.isArray(m?.schema?.fields) ? m.schema.fields.length > 0 : !!m?.schema?.payload;
  if (!hasFields) issues.push({ path: 'schema', msg: 'schema.payload (JSON Schema) or schema.fields[] required', level: 'error' });
  const lc = m?.event?.lifecycle; if (lc && !['active','deprecated'].includes(lc.status)) issues.push({ path: 'event.lifecycle.status', msg: 'status must be active|deprecated', level: 'error' });
  const pol = m?.schema?.compatibility?.policy; if (pol && !['backward','forward','full','none'].includes(pol)) issues.push({ path: 'schema.compatibility.policy', msg: 'invalid compatibility policy', level: 'error' });
  return { ok: issues.length === 0, issues };
});

registerValidator('governance.pii_policy', (m) => {
  const issues = [];
  const anyPII = extractFields(m).some(f => f.pii);
  if (anyPII) {
    if (m?.governance?.policy?.classification !== 'pii') issues.push({ path: 'governance.policy.classification', msg: 'PII fields present → classification should be "pii"', level: 'warn' });
    if (m?.delivery?.contract?.dlq == null && (m?.delivery?.contract?.guarantees !== 'best-effort')) {
      issues.push({ path: 'delivery.contract.dlq', msg: 'PII events with retries should declare a DLQ', level: 'warn' });
    }
  }
  return { ok: issues.length === 0, issues };
});

registerValidator('delivery.contract', (m) => {
  const issues = [];
  const g = m?.delivery?.contract?.guarantees;
  if (g && !['at-least-once','exactly-once','best-effort'].includes(g)) issues.push({ path: 'delivery.contract.guarantees', msg: 'invalid guarantees', level: 'error' });
  return { ok: issues.length === 0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————

function query(manifest, expr) {
  const [rawPath, op, ...rest] = String(expr).split(':');
  const rhs = rest.join(':');
  if (!rawPath || !op) return false;

  // Convenience: schema.fields contains <name>
  if (rawPath === 'schema.fields' && op === 'contains') return extractFields(manifest).some(f => f.name.includes(rhs));
  // Convenience: schema.pii contains <name>
  if (rawPath === 'schema.pii' && op === 'contains') return extractFields(manifest).some(f => f.pii && f.name.includes(rhs));

  const lhs = dget(manifest, rawPath.replace(/\[(\d+)\]/g, '.$1'));
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
// Normalize (auto-hash schema + field hashes)
// ————————————————————————————————————————————————————————————————

function normalize(manifest) {
  const m = clone(manifest || {});
  // compute hashes used by diff/compat
  const fields = extractFields(m);
  m.schema_hash = hash(m.schema || {});
  m.field_hashes = Object.fromEntries(fields.map(f => [f.name, hash(f)]));
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

  const breaking = [];
  for (const c of changes) {
    if (c.path === 'schema_hash') breaking.push({ ...c, reason: 'schema changed' });
    if (c.path.startsWith('delivery.contract.guarantees')) breaking.push({ ...c, reason: 'delivery guarantees changed' });
    if (c.path === 'event.lifecycle.status' && dget(a,'event.lifecycle.status')==='active' && dget(b,'event.lifecycle.status')==='deprecated') breaking.push({ ...c, reason: 'lifecycle downgrade' });
    if (c.path.startsWith('schema.compatibility.')) {
      breaking.push({ ...c, reason: 'compatibility contract changed' });
    }
  }
  const significant = changes.filter(c => c.path.startsWith('metadata.') || c.path.startsWith('delivery.contract.') || c.path.startsWith('semantics.'));
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Compatibility check (simple policy)
// ————————————————————————————————————————————————————————————————

function cmpSemver(a, b) { // returns -1,0,1 (best-effort)
  const pa = String(a||'0').split('.').map(Number), pb = String(b||'0').split('.').map(Number);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){ const x=pa[i]||0, y=pb[i]||0; if (x<y) return -1; if (x>y) return 1; }
  return 0;
}

function checkCompatibility(producerManifest, consumerExpectation) {
  const nameOk = producerManifest?.event?.name === consumerExpectation?.eventName;
  if (!nameOk) return { compatible: false, reason: 'event name mismatch' };

  const policy = producerManifest?.schema?.compatibility?.policy || 'backward';
  const listed = producerManifest?.schema?.compatibility?.compatible_versions || [];
  const pv = producerManifest?.event?.version || '0';
  const cv = consumerExpectation?.version || '0';

  if (listed.includes(cv)) return { compatible: true, reason: 'explicitly listed version' };

  if (policy === 'none') return { compatible: false, reason: 'compatibility policy: none' };
  if (policy === 'backward') return { compatible: cmpSemver(cv, pv) <= 0, reason: `consumer<=producer? (${cv}<=${pv})` };
  if (policy === 'forward') return { compatible: cmpSemver(cv, pv) >= 0, reason: `consumer>=producer? (${cv}>=${pv})` };
  if (policy === 'full') return { compatible: true, reason: 'full compatibility' };
  return { compatible: false, reason: 'unknown policy' };
}

// ————————————————————————————————————————————————————————————————
// Generators
// ————————————————————————————————————————————————————————————————

function generateConsumerSkeleton(manifest, language = 'javascript') {
  const piiFields = extractFields(manifest).filter(f => f.pii).map(f => f.name);
  const eventName = String(manifest?.event?.name || 'event');
  const safeName = eventName.replace(/[._-]/g, ' ').replace(/(?:^|\s)([a-z])/g, (_,c)=>c.toUpperCase()).replace(/\s+/g,'');
  const version = manifest?.event?.version || '1.0.0';
  const policy = manifest?.schema?.compatibility?.policy || 'backward';

  return `/**\n * Auto-generated consumer for: ${eventName}\n * Purpose: ${manifest?.semantics?.purpose || ''}\n * Version: ${version} (compat: ${policy})\n * PII fields: [${piiFields.join(', ')}]\n */\nexport async function handle${safeName}(event) {\n  const { payload, metadata } = event;\n  console.log('Handling ${eventName}', metadata?.eventId);\n  // TODO: validate payload against JSON Schema or field map\n  // TODO: implement business logic\n  // TODO: ack/nack per transport semantics\n}`;
}

function generateTestScenarios(manifest) {
  const tests = [];
  tests.push({ name: `schema: ${manifest.event?.name}`, kind: 'schema', expect: { hash: normalize(manifest).schema_hash } });
  const g = manifest.delivery?.contract?.guarantees;
  if (g && g !== 'best-effort') tests.push({ name: 'delivery: retryable', kind: 'delivery', expect: { dlq: !!manifest.delivery?.contract?.dlq } });
  return tests;
}

// ————————————————————————————————————————————————————————————————
// Workflow (Saga) — clarified shape
// ————————————————————————————————————————————————————————————————

/**
 * @typedef {Object} WorkflowManifest
 * @property {Object} workflow
 * @property {string} workflow.name
 * @property {string} [workflow.purpose]
 * @property {string} workflow.trigger_event
 * @property {Object} sla
 * @property {string} sla.timeout
 * @property {string} [sla.on_timeout_event]
 * @property {Array<{consumes:string, service:string, produces?:string[]}>} steps
 * @property {Array<{on:string, compensation_event:string}>} [compensation]
 */

function createWorkflowManifest(manifest) {
  const m = clone(manifest||{});
  return Object.freeze({
    manifest: () => clone(m),
    getTriggerEvent: () => m?.workflow?.trigger_event,
    getTerminalEvents: () => {
      const prod = new Set((m?.steps||[]).flatMap(s => s.produces||[]));
      const cons = new Set((m?.steps||[]).map(s => s.consumes));
      return [...prod].filter(e => !cons.has(e));
    },
    generateVisualFlow: () => {
      const lines = ['graph TD', '  subgraph Workflow: ' + (m?.workflow?.name||'unnamed')];
      for (const step of (m?.steps||[])) {
        const eNode = step.consumes.replace(/\./g,'_') + '[' + step.consumes + ']';
        const sNode = step.service.replace(/\W/g,'_') + '((' + step.service + '))';
        lines.push(`  ${eNode} -- handled by --> ${sNode}`);
        for (const p of (step.produces||[])) {
          const pNode = p.replace(/\./g,'_') + '[' + p + ']';
          lines.push(`  ${sNode} -- publishes --> ${pNode}`);
        }
      }
      lines.push('  end');
      return lines.join('\n');
    }
  });
}

// ————————————————————————————————————————————————————————————————
// Protocol + Catalog factories
// ————————————————————————————————————————————————————————————————

function createEventProtocol(manifestInput = {}) {
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: () => clone(manifest),
    validate: (names=[]) => runValidators(manifest, names),
    match: (expr) => query(manifest, expr),
    diff: (other) => diff(manifest, other),
    checkCompatibility: (consumer) => checkCompatibility(manifest, consumer),
    generateConsumerSkeleton: (language) => generateConsumerSkeleton(manifest, language),
    generateTestScenarios: () => generateTestScenarios(manifest),
    set: (path, value) => { const m = clone(manifest); dset(m, path, value); return createEventProtocol(m); },
  });
}

function createEventCatalog(protocols = []) {
  const items = protocols;
  const asManifests = () => items.map(p => p.manifest());
  function find(expr) { return items.filter(p => p.match(expr)); }

  // crude flow linkage: event name → services that consume/produce it (from workflows)
  function analyzeFlow(workflows = []) {
    const map = new Map(); // event -> {consumers:Set, producers:Set}
    const ensure = (k) => { if (!map.has(k)) map.set(k, { consumers:new Set(), producers:new Set() }); return map.get(k); };
    for (const w of workflows) {
      const wm = w.manifest ? w.manifest() : w; // accept raw manifest or wrapper
      for (const s of (wm?.steps||[])) {
        ensure(s.consumes).consumers.add(s.service);
        for (const p of (s.produces||[])) ensure(p).producers.add(s.service);
      }
    }
    const out = []; for (const [evt, v] of map.entries()) out.push({ event: evt, consumers: [...v.consumers], producers: [...v.producers] });
    return out;
  }

  return Object.freeze({ items, find, analyzeFlow, validateAll: (names=[]) => asManifests().map(m => ({ name: m.event?.name, ...runValidators(m, names) })) });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————

module.exports = {
  createEventProtocol,
  createEventCatalog,
  createWorkflowManifest,
  registerValidator,
  Validators,
  checkCompatibility,
};

// ————————————————————————————————————————————————————————————————
// Example (commented)
// ————————————————————————————————————————————————————————————————
/*
const paymentCompleted = createEventProtocol({
  event: { name: 'payment.completed', version: '1.1.0', lifecycle: { status: 'active' } },
  semantics: { purpose: 'Record a successful payment and trigger fulfillment' },
  schema: {
    format: 'json-schema',
    payload: {
      type: 'object',
      required: ['payment_id','user_id','amount'],
      properties: {
        payment_id: { type: 'string' },
        user_id: { type: 'string' },
        amount: { type: 'number' },
        email: { type: 'string', 'x-pii': true }
      }
    },
    compatibility: { policy: 'backward', compatible_versions: ['1.0.0','1.1.0'] }
  },
  delivery: { contract: { transport: 'kafka', topic: 'billing.payments', guarantees: 'at-least-once', retry_policy: 'exponential', dlq: 'billing.payments.dlq' } },
  governance: { policy: { classification: 'pii', legal_basis: 'gdpr' } },
  metadata: { owner: 'billing-team', tags: ['billing','payments'] }
});

console.log(paymentCompleted.validate());
console.log(paymentCompleted.match('schema.pii:contains:email'));
console.log(paymentCompleted.generateConsumerSkeleton());
const consumer = { eventName: 'payment.completed', version: '1.0.0' };
console.log(paymentCompleted.checkCompatibility(consumer));
*/
