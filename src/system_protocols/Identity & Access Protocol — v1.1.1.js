/*
 * Identity & Access Protocol — v1.1.1 (stand-alone)
 * Minimal, self-describing IAM manifest + helpers (AuthN, AuthZ, governance)
 *
 * Goals
 * - Mirror family ergonomics: manifest + validate + query + diff + generate
 * - Keep it tiny; add essentials only: factors, roles/permissions, governance, lifecycle
 * - Zero dependencies; no external wiring
 *
 * Cross-protocol hooks (optional helpers):
 * - API scopes ⇄ roles/permissions
 * - Data PII ⇄ required permissions
 * - Workflow human steps ⇄ role requirements
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(value){
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(jsonCanon).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + jsonCanon(value[k])).join(',') + '}';
}

function dget(obj, path){
  if (!path) return obj;
  const p = String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj; for (const k of p){ if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

function dset(obj, path, val){
  const parts = String(path).split('.');
  let cur = obj; while (parts.length > 1){ const k = parts.shift(); if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; }
  cur[parts[0]] = val;
}

const clone = x => JSON.parse(JSON.stringify(x));
const isURN = s => typeof s==='string' && /^urn:proto:(api|data|event|ui|workflow|infra|device|ai|iam|metric|integration|testing|docs|obs|config|release|agent):[a-zA-Z0-9._-]+@[\d.]+(#[^#\s]+)?$/.test(s);

function hash(value){
  const str = jsonCanon(value);
  let h = BigInt('0xcbf29ce484222325');
  const p = BigInt('0x100000001b3');
  for (let i=0;i<str.length;i++){ h ^= BigInt(str.charCodeAt(i)); h = (h * p) & BigInt('0xFFFFFFFFFFFFFFFF'); }
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

const SignatureEnvelopeSpec = Object.freeze({
  id: 'identity-access.signing.v1',
  canonicalization: 'RFC8785-JCS',
  digest: 'sha-256',
  algorithms: ['EdDSA', 'ES256'],
  fields: {
    protected: 'base64url header JSON',
    payload: 'base64url canonical JSON payload',
    signature: 'base64url signature bytes',
    hash: {
      alg: 'sha-256',
      value: 'base64url digest',
    },
    header: 'decoded header (optional convenience copy)',
  },
  policy: {
    requireKeyId: true,
    requireIssuedAt: true,
    allowExpiry: true,
  },
});

function isSignatureEnvelope(value){
  if (!value || typeof value !== 'object') return false;
  if (value.spec !== SignatureEnvelopeSpec.id) return false;
  if (typeof value.protected !== 'string' || typeof value.payload !== 'string' || typeof value.signature !== 'string') return false;
  if (!value.hash || value.hash.alg !== SignatureEnvelopeSpec.digest || typeof value.hash.value !== 'string') return false;
  const header = value.header || {};
  if (header && typeof header === 'object'){
    if (header.alg && !SignatureEnvelopeSpec.algorithms.includes(header.alg)) return false;
    if (header.kid && typeof header.kid !== 'string') return false;
  }
  return true;
}

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} IdentityManifest
 * @property {Object} identity
 * @property {string} identity.id                       // stable principal id
 * @property {'human'|'service'|'device'} identity.type
 * @property {{status:'active'|'suspended'|'revoked'|'expired', sunset_at?:string}} [identity.lifecycle]
 * @property {Object} [profile]                         // optional descriptive info (email, name, dept)
 * @property {Object} [authn]
 * @property {Array<{factor:'password'|'otp'|'key'|'federated', required?:boolean, meta?:Object}>} [authn.factors]
 * @property {{provider?:'saml'|'oidc', issuer?:string, client_id?:string}} [authn.federation]
 * @property {Object} [authz]
 * @property {string[]} [authz.roles]                   // direct role assignments
 * @property {Object<string,string[]>} [authz.permissions] // roleName -> ['perm:string', ...]
 * @property {{inherits?:Object<string,string[]>}} [authz.roles_graph] // roleName -> parents[]
 * @property {Object} [policies]
 * @property {{classification?:'internal'|'confidential'|'pii', rotation_days?:number}} [policies.governance]
 * @property {{mfa_required?:boolean, min_factors?:number}} [policies.authn]
 * @property {Object} [relationships]
 * @property {string[]} [relationships.groups]          // group ids (external directory)
 * @property {string[]} [relationships.trusts]          // trusted principals/tenants
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 * @property {SignatureEnvelope} [sig]
 */

/**
 * @typedef {Object} DelegationManifest
 * @property {Object} delegation
 * @property {string} delegation.delegator_agent_urn    // URN of delegating agent
 * @property {string} delegation.delegate_agent_urn     // URN of delegate agent
 * @property {string[]} delegation.scopes               // delegated scopes/permissions
 * @property {number} delegation.max_depth              // max delegation chain depth (security: ≤5)
 * @property {string} [delegation.expires_at]           // ISO8601 expiration timestamp
 * @property {{revoke_on_error?:boolean}} [delegation.constraints] // additional constraints
 */

// ————————————————————————————————————————————————————————————————
// Validator registry
// ————————————————————————————————————————————————————————————————
const Validators = new Map();
function registerValidator(name, fn){ Validators.set(name, fn); }
function runValidators(manifest, selected=[]){
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = names.map(n => ({ name:n, ...(Validators.get(n)?.(manifest) || { ok:true }) }));
  return { ok: results.every(r=>r.ok), results };
}

// Built-ins
registerValidator('core.shape', (m)=>{
  const issues=[];
  if (!m?.identity?.id) issues.push({ path:'identity.id', msg:'identity.id required', level:'error' });
  if (!m?.identity?.type || !['human','service','device'].includes(m.identity.type))
    issues.push({ path:'identity.type', msg:'identity.type must be human|service|device', level:'error' });
  return { ok: issues.length===0, issues };
});

registerValidator('lifecycle.status', (m)=>{
  const s = m?.identity?.lifecycle?.status; const issues=[];
  if (s && !['active','suspended','revoked','expired'].includes(s))
    issues.push({ path:'identity.lifecycle.status', msg:'status must be active|suspended|revoked|expired', level:'error' });
  return { ok: issues.length===0, issues };
});

registerValidator('authn.factors', (m)=>{
  const issues=[]; const f = m?.authn?.factors || [];
  const min = m?.policies?.authn?.min_factors || (m?.policies?.authn?.mfa_required ? 2 : 1);
  if (f.length < 1) issues.push({ path:'authn.factors', msg:'at least one factor required', level:'error' });
  if (f.length < min) issues.push({ path:'authn.factors', msg:`requires >= ${min} factors`, level:'warn' });
  // basic federation sanity if federated listed
  if (f.some(x=>x.factor==='federated')){
    const fed = m?.authn?.federation||{};
    if (!fed.provider || !fed.issuer) issues.push({ path:'authn.federation', msg:'federation provider/issuer required for federated factor', level:'error' });
  }
  return { ok: issues.length===0, issues };
});

registerValidator('authz.roles_permissions', (m)=>{
  const issues=[]; const roles = new Set(m?.authz?.roles||[]);
  const perms = m?.authz?.permissions||{};
  // permissions map sanity
  for (const [role, list] of Object.entries(perms)){
    if (!Array.isArray(list)) issues.push({ path:`authz.permissions.${role}`, msg:'permissions must be string[]', level:'error' });
  }
  // graph acyclicity (naive)
  const inherits = m?.authz?.roles_graph?.inherits||{};
  const seen=new Set(), stack=new Set();
  function dfs(r){
    if (stack.has(r)) return true;
    if (seen.has(r)) return false;
    seen.add(r); stack.add(r);
    for (const p of (inherits[r]||[])) if (dfs(p)) return true;
    stack.delete(r); return false;
  }
  for (const r of Object.keys(inherits)){ if (dfs(r)) { issues.push({ path:`authz.roles_graph.inherits.${r}`, msg:'circular role inheritance', level:'error' }); break; } }
  // warn if roles reference unknown permission arrays
  for (const r of roles){ if (!(r in perms)) issues.push({ path:`authz.permissions.${r}`, msg:`missing permissions list for role '${r}'`, level:'warn' }); }
  return { ok: issues.length===0, issues };
});

registerValidator('governance.pii_policy', (m)=>{
  const issues=[];
  // heuristic: permissions containing 'pii:' or ':pii' imply PII access
  const anyPII = Object.values(m?.authz?.permissions||{}).flat().some(p => /(^|\b)pii[:.]/i.test(p) || /[:.]pii($|\b)/i.test(p));
  if (anyPII && m?.policies?.governance?.classification !== 'pii')
    issues.push({ path:'policies.governance.classification', msg:'PII permissions present → classification should be "pii"', level:'warn' });
  return { ok: issues.length===0, issues };
});

registerValidator('signature.envelope', (m)=>{
  if (!m?.sig) return { ok:true, issues:[] };
  if (isSignatureEnvelope(m.sig)) return { ok:true, issues:[] };
  return {
    ok: false,
    issues: [{ path:'sig', msg:`signature must conform to ${SignatureEnvelopeSpec.id}`, level:'error' }],
  };
});

registerValidator('delegation.core', m => {
  const issues = [];
  // Skip if not a DelegationManifest
  if (!m?.delegation) return { ok: true };

  // Validate delegator URN
  if (!m.delegation.delegator_agent_urn || !isURN(m.delegation.delegator_agent_urn)) {
    issues.push({ path: 'delegation.delegator_agent_urn', msg: 'invalid agent URN', level: 'error' });
  }

  // Validate delegate URN
  if (!m.delegation.delegate_agent_urn || !isURN(m.delegation.delegate_agent_urn)) {
    issues.push({ path: 'delegation.delegate_agent_urn', msg: 'invalid agent URN', level: 'error' });
  }

  // Validate scopes array
  if (!Array.isArray(m.delegation.scopes) || m.delegation.scopes.length === 0) {
    issues.push({ path: 'delegation.scopes', msg: 'scopes must be non-empty array', level: 'error' });
  }

  // Validate max_depth constraint (security: enforce ≤5)
  if (typeof m.delegation.max_depth !== 'number') {
    issues.push({ path: 'delegation.max_depth', msg: 'max_depth must be a number', level: 'error' });
  } else if (m.delegation.max_depth < 1) {
    issues.push({ path: 'delegation.max_depth', msg: 'max_depth must be ≥1', level: 'error' });
  } else if (m.delegation.max_depth > 5) {
    issues.push({ path: 'delegation.max_depth', msg: 'delegation depth >5 increases security risk', level: 'error' });
  }

  // Validate expires_at if present
  if (m.delegation.expires_at) {
    const parsed = new Date(m.delegation.expires_at);
    if (isNaN(parsed.getTime())) {
      issues.push({ path: 'delegation.expires_at', msg: 'must be valid ISO8601 timestamp', level: 'error' });
    }
  }

  return { ok: issues.length === 0, issues };
});

// ————————————————————————————————————————————————————————————————
// Helpers: role expansion & permission resolution
// ————————————————————————————————————————————————————————————————
function expandRoles(manifest){
  const inherits = manifest?.authz?.roles_graph?.inherits || {};
  const cache = new Map();
  function expand(role){
    if (cache.has(role)) return cache.get(role);
    const set = new Set([role]);
    for (const p of (inherits[role]||[])){ for (const r of expand(p)) set.add(r); }
    cache.set(role, set);
    return set;
  }
  return { expand };
}

function effectivePermissions(manifest){
  const roles = new Set(manifest?.authz?.roles || []);
  const { expand } = expandRoles(manifest);
  const permsByRole = manifest?.authz?.permissions || {};
  const out = new Set();
  for (const r of roles){
    for (const rr of expand(r)) for (const p of (permsByRole[rr]||[])) out.add(p);
  }
  return [...out].sort();
}

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath, op, ...rest] = String(expr).split(':');
  const rhs = rest.join(':'); if (!rawPath || !op) return false;

  // convenience: roles/permissions contain
  if (rawPath==='authz.roles' && op==='contains') return (manifest.authz?.roles||[]).some(r=>r.includes(rhs));
  if (rawPath==='authz.permissions' && op==='contains'){
    const perms = manifest.authz?.permissions || {};
    return Object.values(perms).some(list => (list||[]).some(p => String(p).includes(rhs)));
  }

  const lhs = dget(manifest, rawPath.replace(/\[(\d+)\]/g, '.$1'));
  switch (op){
    case ':=:': return String(lhs)===rhs;
    case 'contains': return String(lhs??'').includes(rhs);
    case '>': return Number(lhs)>Number(rhs);
    case '<': return Number(lhs)<Number(rhs);
    case '>=': return Number(lhs)>=Number(rhs);
    case '<=': return Number(lhs)<=Number(rhs);
    default: return false;
  }
}

// ————————————————————————————————————————————————————————————————
// Normalize + Diff (structural + heuristics)
// ————————————————————————————————————————————————————————————————
function normalize(m){
  const n = clone(m||{});
  n.roles_hash = hash(n.authz?.roles||[]);
  n.perms_hash = hash(n.authz?.permissions||{});
  n.factors_hash = hash(n.authn?.factors||[]);
  n.policy_hash = hash(n.policies||{});
  n.effective_perms = effectivePermissions(n); // materialize for diff heuristics
  n.effective_perms_hash = hash(n.effective_perms);
  return n;
}

function diff(a,b){
  const A=normalize(a), B=normalize(b);
  const changes=[];
  (function walk(p,va,vb){
    if (JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj = v => v && typeof v === 'object';
    if (!isObj(va) || !isObj(vb)){ changes.push({ path:p, from:va, to:vb }); return; }
    const keys = new Set([...Object.keys(va||{}), ...Object.keys(vb||{})]);
    for (const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]);
  })('', A, B);

  const breaking=[], significant=[];
  // lifecycle downgrade
  if (dget(a,'identity.lifecycle.status')==='active' && ['suspended','revoked','expired'].includes(dget(b,'identity.lifecycle.status')))
    breaking.push({ path:'identity.lifecycle.status', from:dget(a,'identity.lifecycle.status'), to:dget(b,'identity.lifecycle.status'), reason:'lifecycle downgrade' });
  // fewer factors (weakening AuthN)
  if ((a?.authn?.factors||[]).length > (b?.authn?.factors||[]).length)
    significant.push({ path:'authn.factors', reason:'authentication factors reduced' });
  // permission loss (AuthZ regression)
  const before = new Set(A.effective_perms); const after = new Set(B.effective_perms);
  for (const p of before) if (!after.has(p)) breaking.push({ path:'authz.permissions', reason:`permission removed: ${p}` });
  // hashes
  for (const c of changes){
    if (c.path==='roles_hash' || c.path==='perms_hash') significant.push({ ...c, reason:'role/permission signature changed' });
    if (c.path==='effective_perms_hash') breaking.push({ ...c, reason:'effective permissions changed' });
    if (c.path==='policy_hash') significant.push({ ...c, reason:'policy changed' });
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Generators
// ————————————————————————————————————————————————————————————————
function generatePolicy(manifest, { style='rbac' } = {}){
  const subj = { id: manifest.identity?.id, type: manifest.identity?.type };
  const roles = manifest.authz?.roles || [];
  const perms = effectivePermissions(manifest);
  // simple policy doc
  return {
    version: '1.0',
    style,
    subject: subj,
    roles,
    permissions: perms,
    governance: manifest.policies?.governance || {},
  };
}

// Mermaid graph: Identities → Roles → Permissions
function generateVisualMap(manifests){
  const lines = ['graph TD', '  subgraph IAM'];
  const ensureId = s => s.replace(/[^a-zA-Z0-9_]/g,'_');
  for (const m of manifests){
    const id = ensureId(m.identity?.id||'id');
    lines.push(`  ${id}([${m.identity?.id||'id'}])`);
    for (const r of (m.authz?.roles||[])){
      const rid = ensureId(`${m.identity?.id}_${r}`);
      const rnode = ensureId(`role_${r}`);
      lines.push(`  ${rnode}[[${r}]]`);
      lines.push(`  ${id} --> ${rnode}`);
      for (const p of (m.authz?.permissions?.[r]||[])){
        const pnode = ensureId(`perm_${p}`);
        lines.push(`  ${pnode}[/"${p}"/]`);
        lines.push(`  ${rnode} --> ${pnode}`);
      }
    }
  }
  lines.push('  end');
  return lines.join('\n');
}

function generateAuditTests(manifest, requiredPerms=[]){
  const have = new Set(effectivePermissions(manifest));
  return requiredPerms.map(p => ({
    name: `perm:${p}`,
    kind: 'access',
    expect: { allowed: have.has(p) }
  }));
}

// ————————————————————————————————————————————————————————————————
// Cross-protocol helpers (optional)
// ————————————————————————————————————————————————————————————————
/**
 * Map API interface scopes to required IAM permissions and warn on gaps.
 * @param {Object} apiManifest  // API Protocol manifest
 * @param {(scope:string)=>string} scopeToPerm  // mapper from scope->perm
 * @returns {{ok:boolean, issues:Array<{msg:string, level:'warn'|'error'}>}}
 */
function crossValidateWithAPI(identityManifest, apiManifest, scopeToPerm=(s)=>`scope:${s}`){
  const issues=[];
  const scopes = apiManifest?.interface?.authentication?.scopes || []; // per API Protocol:contentReference[oaicite:5]{index=5}
  const have = new Set(effectivePermissions(identityManifest));
  for (const s of scopes){
    const perm = scopeToPerm(s);
    if (!have.has(perm)) issues.push({ msg:`missing permission for API scope '${s}' → expected '${perm}'`, level:'warn' });
  }
  return { ok: issues.length===0, issues };
}

/**
 * Require explicit PII permissions when Data manifests include PII fields.
 * @param {Object} dataManifest  // Data Protocol manifest
 * @param {{read?:string, write?:string}} mapping
 */
function crossValidateWithData(identityManifest, dataManifest, mapping={ read:'pii:read', write:'pii:write' }){
  const issues=[];
  const fields = Object.values(dataManifest?.schema?.fields||{}); // Data Protocol
  const anyPII = fields.some(f => f?.pii===true);
  if (!anyPII) return { ok:true, issues };
  const have = new Set(effectivePermissions(identityManifest));
  if (!have.has(mapping.read)) issues.push({ msg:`dataset has PII → missing '${mapping.read}'`, level:'warn' });
  return { ok: issues.length===0, issues };
}

/**
 * Ensure workflow human steps are performed by identities with required roles.
 * @param {Object} workflowManifest // Workflow Protocol manifest:contentReference[oaicite:7]{index=7}
 * @param {(step)=>string[]} roleSelector // return roles required for a given human step
 */
function crossValidateWithWorkflow(identityManifest, workflowManifest, roleSelector=(s)=>['support']){
  const issues=[];
  const steps = workflowManifest?.steps||[];
  const roles = new Set(identityManifest?.authz?.roles||[]);
  for (const s of steps){
    if (s.type==='human'){
      const required = roleSelector(s)||[];
      const ok = required.some(r => roles.has(r));
      if (!ok) issues.push({ msg:`human step '${s.id}' requires one of [${required.join(', ')}]`, level:'warn' });
    }
  }
  return { ok: issues.length===0, issues };
}

// ————————————————————————————————————————————————————————————————
// Protocol + Catalog factories
// ————————————————————————————————————————————————————————————————
function createIdentityProtocol(manifestInput={}){
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: ()=>clone(manifest),
    validate: (names=[])=>runValidators(manifest,names),
    match: (expr)=>query(manifest,expr),
    diff: (other)=>diff(manifest, other?.manifest? other.manifest(): other),
    generatePolicy: (opts)=>generatePolicy(manifest,opts),
    generateVisualMap: ()=>generateVisualMap([manifest]),
    generateAuditTests: (requiredPerms)=>generateAuditTests(manifest, requiredPerms),
    // cross-protocol probes
    crossValidateWithAPI: (apiManifest, scopeToPerm)=>crossValidateWithAPI(manifest, apiManifest, scopeToPerm),
    crossValidateWithData: (dataManifest, mapping)=>crossValidateWithData(manifest, dataManifest, mapping),
    crossValidateWithWorkflow: (workflowManifest, roleSelector)=>crossValidateWithWorkflow(manifest, workflowManifest, roleSelector),
    set: (path,val)=>{ const m=clone(manifest); dset(m,path,val); return createIdentityProtocol(m); },
  });
}

function createIdentityCatalog(protocols=[]){
  const items = protocols; const asManifests = () => items.map(p=>p.manifest());
  function find(expr){ return items.filter(p=>p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m=>({ id:m.identity?.id, ...runValidators(m,names) })); }
  function whoCan(perm){
    const matched = [];
    for (const p of items){
      const perms = effectivePermissions(p.manifest());
      if (perms.includes(perm)) matched.push(p);
    }
    return matched;
  }
  function generateVisualMapAll(){ return generateVisualMap(asManifests()); }
  return Object.freeze({ items, find, validateAll, whoCan, generateVisualMapAll });
}

// ————————————————————————————————————————————————————————————————
// Delegation helpers (v1.1.2 additions)
// ————————————————————————————————————————————————————————————————

/**
 * Creates a DelegationManifest for agent-to-agent authorization chains.
 * @param {string} delegatorUrn - URN of delegating agent
 * @param {string} delegateUrn - URN of delegate agent
 * @param {string[]} scopes - Array of delegated scopes/permissions
 * @param {number} maxDepth - Max delegation chain depth (1-5)
 * @param {Object} [options] - Optional parameters
 * @param {string} [options.expiresAt] - ISO8601 expiration timestamp
 * @param {Object} [options.constraints] - Additional constraints
 * @returns {DelegationManifest}
 */
function createDelegationManifest(delegatorUrn, delegateUrn, scopes, maxDepth, options = {}) {
  return {
    delegation: {
      delegator_agent_urn: delegatorUrn,
      delegate_agent_urn: delegateUrn,
      scopes: scopes || [],
      max_depth: Math.min(maxDepth || 1, 5), // enforce security constraint
      ...(options.expiresAt && { expires_at: options.expiresAt }),
      ...(options.constraints && { constraints: options.constraints })
    }
  };
}

/**
 * Validates delegation chain depth and scope narrowing.
 * @param {DelegationManifest} parentDelegation - Parent delegation in chain
 * @param {DelegationManifest} childDelegation - Child delegation to validate
 * @returns {{ok: boolean, issues: Array}}
 */
function validateDelegationChain(parentDelegation, childDelegation) {
  const issues = [];

  // Validate depth constraint
  const parentDepth = parentDelegation?.delegation?.max_depth || 0;
  const childDepth = childDelegation?.delegation?.max_depth || 0;

  if (childDepth >= parentDepth) {
    issues.push({
      path: 'delegation.max_depth',
      msg: `child max_depth (${childDepth}) must be < parent max_depth (${parentDepth})`,
      level: 'error'
    });
  }

  // Validate scope narrowing (child scopes must be subset of parent scopes)
  const parentScopes = new Set(parentDelegation?.delegation?.scopes || []);
  const childScopes = childDelegation?.delegation?.scopes || [];

  for (const scope of childScopes) {
    if (!parentScopes.has(scope)) {
      issues.push({
        path: 'delegation.scopes',
        msg: `scope '${scope}' not permitted by parent delegation`,
        level: 'error'
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Checks if delegation has expired.
 * @param {DelegationManifest} delegation
 * @param {Date} [now] - Current time (defaults to Date.now())
 * @returns {boolean}
 */
function isDelegationExpired(delegation, now = new Date()) {
  if (!delegation?.delegation?.expires_at) return false;
  const expiresAt = new Date(delegation.delegation.expires_at);
  return now >= expiresAt;
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
export {
  SignatureEnvelopeSpec,
  isSignatureEnvelope,
  createIdentityProtocol,
  createIdentityCatalog,
  registerValidator,
  Validators,
  // low-level helpers for advanced users
  effectivePermissions,
  generatePolicy,
  generateVisualMap,
  generateAuditTests,
  crossValidateWithAPI,
  crossValidateWithData,
  crossValidateWithWorkflow,
  // v1.1.2 delegation additions
  createDelegationManifest,
  validateDelegationChain,
  isDelegationExpired,
};
