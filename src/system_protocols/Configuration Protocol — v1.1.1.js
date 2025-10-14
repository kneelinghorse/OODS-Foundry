/*
 * Configuration Protocol — v1.1.1 (stand-alone)
 * Minimal, self-describing configuration manifest + helpers
 *
 * Goals
 * - Mirror the protocol family: manifest + validate + query + diff + generate
 * - Keep it tiny; add essentials only: environments, dynamic providers, overrides, URN links
 * - Zero dependencies; no external wiring
 *
 * v1.1.1 highlights
 * - URN-based cross-links to API/Data/Event/UI/Workflow/Infra/etc.
 * - Async resolve() with dynamic providers (KV/Secrets/Feature Flags)
 * - Typed validators for dynamic sources + providers + secrets
 * - Normalize+diff with breaking/significant hints
 * - Generators: .env, K8s ConfigMap/Secret, Terraform tfvars
 * - Simulation helper for safe rollout planning
 */

// ————————————————————————————————————————————————————————————————
// Utilities (shared across the suite)
// ————————————————————————————————————————————————————————————————
function jsonCanon(v){ if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(jsonCanon).join(',')+']';
  const k=Object.keys(v).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(v[x])).join(',')+'}'; }
function dget(o,p){ if(!p) return o; const parts=String(p).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=o; for(const k of parts){ if(cur==null) return; cur=cur[k]; } return cur; }
function dset(o,p,v){ const parts=String(p).split('.'); let cur=o; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=v; }
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(v){ const s=jsonCanon(v); let h=BigInt('0xcbf29ce484222325'); const p=BigInt('0x100000001b3'); for(let i=0;i<s.length;i++){ h^=BigInt(s.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }
const isURN=s=>typeof s==='string' && /^urn:proto:[a-z]+:[a-zA-Z0-9._-]+@[\d.]+(#[^#\s]+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} ConfigManifest
 *
 * @property {Object} config
 * @property {string} config.id
 * @property {string} [config.version]           // semver for this manifest
 * @property {{status:'draft'|'active'|'deprecated'}} [config.lifecycle]
 *
 * @property {Object} environments               // named envs (dev/stage/prod…)
 * @property {Object<string,{ inherits?:string, selectors?:Object<string,string> }>} environments.map
 *
 * @property {Object} settings
 * @property {Object<string, any | {dynamic_source:'kv'|'secret'|'flag', path:string, default?:any, required?:boolean}>} settings.values
 * @property {{masked?:string[]}} [settings.secrets]   // keys that must be redacted in outputs
 *
 * @property {Object} [providers]                 // dynamic providers configuration
 * @property {{kv?:Object, secret?:Object, flag?:Object}} [providers.clients]
 *
 * @property {Object} [overrides]                 // per-env or selector overlays
 * @property {Object<string, Object<string,any>>} [overrides.by_env] // { 'prod': { 'LIMIT': 100 } }
 *
 * @property {Object} [governance]
 * @property {{classification?:'internal'|'confidential'|'pii'}} [governance.policy]
 *
 * @property {Object} [links]                     // URN cross-links to configured systems
 * @property {string[]} [links.targets]           // e.g., [ 'urn:proto:api:billing@1.1.1#/v1/invoices' ]
 *
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry (pluggable)
// ————————————————————————————————————————————————————————————————
const Validators = new Map();
function registerValidator(name, fn){ Validators.set(name, fn); }
function runValidators(m, selected=[]){
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = names.map(n => ({ name:n, ...(Validators.get(n)?.(m)||{ ok:true }) }));
  return { ok: results.every(r=>r.ok), results };
}

// Built-ins
registerValidator('core.shape', (m)=>{
  const issues=[];
  if(!m?.config?.id) issues.push({path:'config.id', msg:'config.id required', level:'error'});
  if(!m?.settings || typeof m.settings.values !== 'object') issues.push({path:'settings.values', msg:'settings.values required', level:'error'});
  if(!m?.environments?.map || typeof m.environments.map !== 'object') issues.push({path:'environments.map', msg:'environments.map required', level:'error'});
  return { ok: issues.length===0, issues };
});

registerValidator('links.urns', (m)=>{
  const issues=[]; for(const [i,u] of (m?.links?.targets||[]).entries()) if(!isURN(u)) issues.push({path:`links.targets[${i}]`, msg:'invalid URN', level:'error'});
  return { ok: issues.length===0, issues };
});

registerValidator('settings.dynamic_sources', (m)=>{
  const issues=[];
  for(const [k,v] of Object.entries(m?.settings?.values||{})){
    if(v && typeof v==='object' && 'dynamic_source' in v){
      if(!['kv','secret','flag'].includes(v.dynamic_source)) issues.push({path:`settings.values.${k}.dynamic_source`, msg:'must be kv|secret|flag', level:'error'});
      if(!v.path) issues.push({path:`settings.values.${k}.path`, msg:'path required', level:'error'});
    }
  }
  return { ok: issues.length===0, issues };
});

registerValidator('providers.supported', (m)=>{
  const issues=[];
  const c=m?.providers?.clients||{};
  for(const k of Object.keys(c)) if(!['kv','secret','flag'].includes(k)) issues.push({path:`providers.clients.${k}`, msg:'unsupported provider', level:'warn'});
  return { ok: issues.length===0, issues };
});

registerValidator('governance.pii_policy', (m)=>{
  const issues=[];
  const piiKeys = new Set(m?.settings?.secrets?.masked||[]);
  if(piiKeys.size && m?.governance?.policy?.classification!=='pii'){
    issues.push({ path:'governance.policy.classification', msg:'masked secrets present → classification should be "pii"', level:'warn' });
  }
  return { ok: issues.length===0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath,op,...rest] = String(expr).split(':');
  const rhs = rest.join(':'); if(!rawPath||!op) return false;
  if(rawPath==='links.targets' && op==='contains') return (manifest.links?.targets||[]).some(u=>u.includes(rhs));
  if(rawPath==='settings.values' && op==='contains') return Object.keys(manifest.settings?.values||{}).some(k=>k.includes(rhs));
  const lhs = dget(manifest, rawPath.replace(/\[(\d+)\]/g, '.$1'));
  switch(op){
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
  const n=clone(m||{});
  n.settings_hash   = hash(n.settings||{});
  n.environ_hash    = hash(n.environments||{});
  n.providers_hash  = hash(n.providers||{});
  n.links_hash      = hash(n.links||{});
  n.gov_hash        = hash(n.governance||{});
  return n;
}
function diff(a,b){
  const A=normalize(a), B=normalize(b); const changes=[];
  (function walk(p,va,vb){
    if(JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj=v=>v&&typeof v==='object';
    if(!isObj(va)||!isObj(vb)){ changes.push({ path:p, from:va, to:vb }); return; }
    const keys=new Set([...Object.keys(va||{}),...Object.keys(vb||{})]); for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]);
  })('',A,B);
  const breaking=[], significant=[];
  for(const c of changes){
    if(c.path==='settings_hash') breaking.push({ ...c, reason:'settings changed' });
    if(c.path==='environ_hash') significant.push({ ...c, reason:'environment map changed' });
    if(c.path==='providers_hash') significant.push({ ...c, reason:'providers changed' });
    if(c.path==='links_hash') significant.push({ ...c, reason:'cross-links changed' });
    if(c.path==='gov_hash') significant.push({ ...c, reason:'governance changed' });
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Resolution (env vars + dynamic providers)
// ————————————————————————————————————————————————————————————————
/**
 * Resolve a manifest into concrete values.
 * @param {ConfigManifest} manifest
 * @param {Object} envVars               // e.g., process.env snapshot
 * @param {{kv?:{get:(p:string)=>Promise<any>}, secret?:{get:(p:string)=>Promise<any>}, flag?:{get:(p:string)=>Promise<any>}}} dynamicProviderClient
 */
async function resolveEnvironment(manifest, envVars={}, dynamicProviderClient=null){
  const resolved = clone(manifest);

  // 1) Apply static env overrides
  const envName = envVars['APP_ENV'] || envVars['NODE_ENV'] || null;
  if(envName && resolved.overrides?.by_env?.[envName]){
    Object.assign(resolved.settings.values, resolved.overrides.by_env[envName]);
  }

  // 2) Interpolate ${ENV_VAR} tokens inside string values
  for(const [k,val] of Object.entries(resolved.settings?.values||{})){
    if(typeof val==='string') resolved.settings.values[k]=val.replace(/\$\{([A-Z0-9_]+)\}/g, (_,n)=> envVars[n] ?? '');
  }

  // 3) Fetch dynamic values (kv/secret/flag) — v1.1 behavior preserved, formalized
  if(dynamicProviderClient){
    for(const [k,val] of Object.entries(resolved.settings.values||{})){
      if(val && typeof val==='object' && val.dynamic_source){
        const client = dynamicProviderClient[val.dynamic_source];
        const dflt   = ('default' in val) ? val.default : undefined;
        if(!client?.get) { resolved.settings.values[k] = dflt; continue; }
        try {
          const got = await client.get(val.path);
          resolved.settings.values[k] = (got==null ? dflt : got);
          if(got==null && val.required===true) throw new Error(`Required dynamic key missing: ${val.path}`);
        } catch(e){
          // Fallback to default if present; else keep unresolved
          resolved.settings.values[k] = dflt;
        }
      }
    }
  }

  return resolved;
}

// ————————————————————————————————————————————————————————————————
// Generators (.env / K8s / Terraform)
// ————————————————————————————————————————————————————————————————
function generateDotEnv(manifest, { redact=true } = {}){
  const mask = new Set(manifest.settings?.secrets?.masked||[]);
  const kv=[];
  for(const [k,v] of Object.entries(manifest.settings?.values||{})){
    const val = (redact && mask.has(k)) ? '***' : (typeof v==='object' ? JSON.stringify(v) : String(v));
    kv.push(`${k}=${val}`);
  }
  return kv.join('\n')+'\n';
}

function generateK8sConfigMap(manifest, name='app-config'){
  const data={}; for(const [k,v] of Object.entries(manifest.settings?.values||{})) data[k]=typeof v==='object'?JSON.stringify(v):String(v);
  return {
    apiVersion:'v1', kind:'ConfigMap', metadata:{ name }, data
  };
}

function generateK8sSecret(manifest, name='app-secrets'){
  const mask = new Set(manifest.settings?.secrets?.masked||[]);
  const data={}; for(const [k,v] of Object.entries(manifest.settings?.values||{})) if(mask.has(k)) data[k]=Buffer.from(String(v??'')).toString('base64');
  return {
    apiVersion:'v1', kind:'Secret', type:'Opaque', metadata:{ name }, data
  };
}

function generateTerraformTfvars(manifest){
  const obj={}; for(const [k,v] of Object.entries(manifest.settings?.values||{})) obj[k]=v;
  return JSON.stringify(obj, null, 2);
}

// ————————————————————————————————————————————————————————————————
// Simulation (what-if) — rollout safety
// ————————————————————————————————————————————————————————————————
function simulateConfigurationChange(currentManifest, newManifest, context={}){
  const cur = createConfigProtocol(currentManifest).set('overrides.by_env.'+(context.env||''), context.overrides||{}).manifest();
  const nxt = createConfigProtocol(newManifest).set('overrides.by_env.'+(context.env||''), context.overrides||{}).manifest();
  const difference = diff(cur, nxt);
  const steps = []; // tiny placeholder “plan”
  if(difference.breaking.length) steps.push('-- REVIEW: Breaking setting signature changed');
  if(difference.significant.length) steps.push('-- NOTICE: Non-breaking changes present');
  return {
    summary: `Simulation complete. ${difference.changes.length} changes; breaking=${difference.breaking.length}; significant=${difference.significant.length}.`,
    is_safe_to_apply: difference.breaking.length===0,
    breaking_changes: difference.breaking,
    significant_changes: difference.significant,
    migration_plan: steps
  };
}

// ————————————————————————————————————————————————————————————————
// Catalog (multi-config helper)
// ————————————————————————————————————————————————————————————————
function createConfigCatalog(protocols=[]){
  const items=protocols; const asManifests=()=>items.map(p=>p.manifest());
  function find(expr){ return items.filter(p=>p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m=>({ id:m.config?.id, ...runValidators(m,names) })); }
  function findByEnvironment(env){ return items.filter(p=>p.manifest().overrides?.by_env?.[env]); }
  function findConfigFor(urn){ return items.filter(p => (p.manifest().links?.targets||[]).includes(urn)); }
  return Object.freeze({ items, find, validateAll, findByEnvironment, findConfigFor });
}

// ————————————————————————————————————————————————————————————————
// Protocol factory
// ————————————————————————————————————————————————————————————————
function createConfigProtocol(manifestInput={}){
  const manifest=normalize(manifestInput);
  return Object.freeze({
    manifest:()=>clone(manifest),
    validate:(names=[])=>runValidators(manifest,names),
    match:(expr)=>query(manifest,expr),
    diff:(other)=>diff(manifest, other?.manifest?other.manifest():other),

    // resolution & generators
    resolve:(envVars, dynamicProviderClient)=>resolveEnvironment(manifest, envVars, dynamicProviderClient),
    generateDotEnv: (opts)=>generateDotEnv(manifest, opts),
    generateK8sConfigMap: (name)=>generateK8sConfigMap(manifest, name),
    generateK8sSecret: (name)=>generateK8sSecret(manifest, name),
    generateTerraformTfvars: ()=>generateTerraformTfvars(manifest),

    // simulation
    simulateChange:(next,ctx)=>simulateConfigurationChange(manifest, next?.manifest? next.manifest(): next, ctx),

    // mutation
    set:(path,val)=>{ const m=clone(manifest); dset(m,path,val); return createConfigProtocol(m); }
  });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
module.exports = {
  createConfigProtocol,
  createConfigCatalog,
  registerValidator,
  Validators,
  // low-level helpers
  query, normalize, diff,
  resolveEnvironment,
  generateDotEnv, generateK8sConfigMap, generateK8sSecret, generateTerraformTfvars,
  simulateConfigurationChange,
};
