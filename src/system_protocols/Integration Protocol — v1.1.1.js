/*
 * Integration Protocol — v1.1.1 (stand-alone)
 * Minimal, self-describing integration manifest + helpers
 *
 * Goals
 * - Mirror family ergonomics: manifest + validate + query + diff + generate
 * - Keep it tiny; add essentials only: endpoints, mappings, schedule/stream, retries, governance
 * - Zero dependencies; no external wiring
 *
 * Cross-protocol linkage via URNs:
 * - API endpoints (producer/consumer)   → urn:proto:api:service@x.y.z#/path
 * - Data datasets/fields                → urn:proto:data:dataset@x.y.z#field
 * - Events (topics/payload props)       → urn:proto:event:name@x.y.z#payload.foo
 * - Workflows (invoked/observed)        → urn:proto:workflow:id@x.y.z
 * - UI/Components (emitting/receiving)  → urn:proto:ui:Component@x.y.z#props.bar
 * - Infra host (where runners live)     → urn:proto:infra:resource@x.y.z
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(v){ if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(jsonCanon).join(',')+']';
  const k=Object.keys(v).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(v[x])).join(',')+'}'; }
function dget(o,p){ if(!p) return o; const parts=String(p).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=o; for(const k of parts){ if(cur==null) return; cur=cur[k]; } return cur; }
function dset(o,p,v){ const parts=String(p).split('.'); let cur=o; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=v; }
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(v){ const s=jsonCanon(v); let h=BigInt('0xcbf29ce484222325'); const p=BigInt('0x100000001b3'); for(let i=0;i<s.length;i++){ h^=BigInt(s.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }
const isURN = s => typeof s==='string' && /^urn:proto:[a-z]+:[a-zA-Z0-9._-]+@[\d.]+(#[^#\s]+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} IntegrationManifest
 * @property {Object} integration
 * @property {string} integration.id
 * @property {string} integration.name
 * @property {'pull'|'push'|'bidirectional'} integration.direction
 * @property {'batch'|'stream'} integration.mode
 * @property {{status:'defined'|'enabled'|'paused'|'deprecated'}} [integration.lifecycle]
 *
 * @property {Object} source               // where data/events/requests originate
 * @property {{api?:string,event?:string,data?:string,ui?:string}} source.kind_urns
 * @property {Array<{urn:string, alias?:string}>} [source.fields]
 * @property {string} [source.filter_expression]     // optional (doc-only)
 *
 * @property {Object} destination          // where data/events/requests go
 * @property {{api?:string,event?:string,data?:string,ui?:string}} destination.kind_urns
 * @property {Array<{urn:string, alias?:string}>} [destination.fields]
 *
 * @property {Object} mapping              // field/shape mapping & transforms
 * @property {Array<{from:string,to:string,transform?:string,required?:boolean}>} mapping.rules
 * @property {{dedupe_key?:string, idempotency?:'none'|'key'|'hash'}} [mapping.ingestion]
 * @property {Object} [agentMapping]       // agent-specific mapping conveniences
 *
 * @property {Object} transport            // how it runs
 * @property {{schedule?:'cron'|'hourly'|'daily'|'none', expression?:string}} [transport.batch]
 * @property {{broker?:'kafka'|'pubsub'|'sqs'|'webhook', topic?:string, consumer_group?:string}} [transport.stream]
 * @property {{retries?:number, backoff?:'none'|'linear'|'exponential', dlq?:string}} [transport.reliability]
 * @property {{timeout?:string, rate_limit?:string}} [transport.sla]  // e.g., '30s', '1000/m'
 *
 * @property {Object} governance
 * @property {{classification?:'internal'|'confidential'|'pii', encryption?:'none'|'in-transit'|'end-to-end'}} [governance.policy]
 *
 * @property {Object} relationships
 * @property {string[]} [relationships.invokes_workflows]    // URNs
 * @property {string[]} [relationships.observes_workflows]   // URNs
 * @property {string[]} [relationships.infra_hosts]          // URNs of infra where runner lives
 *
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry (pluggable, zero-deps)
// ————————————————————————————————————————————————————————————————
const Validators = new Map();
function registerValidator(name, fn){ Validators.set(name, fn); }
function runValidators(manifest, selected=[]){
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = names.map(n => ({ name:n, ...(Validators.get(n)?.(manifest)||{ok:true}) }));
  return { ok: results.every(r=>r.ok), results };
}

// Built-ins — aligned to your suite’s style
registerValidator('core.shape',(m)=>{
  const issues=[];
  if(!m?.integration?.id) issues.push({path:'integration.id', msg:'required', level:'error'});
  if(!m?.integration?.name) issues.push({path:'integration.name', msg:'required', level:'error'});
  if(!['pull','push','bidirectional'].includes(m?.integration?.direction)) issues.push({path:'integration.direction', msg:'invalid', level:'error'});
  if(!['batch','stream'].includes(m?.integration?.mode)) issues.push({path:'integration.mode', msg:'invalid', level:'error'});
  // minimal endpoints
  if(!m?.source?.kind_urns || !Object.values(m.source.kind_urns||{}).some(Boolean))
    issues.push({path:'source.kind_urns', msg:'at least one source URN required', level:'error'});
  if(!m?.destination?.kind_urns || !Object.values(m.destination.kind_urns||{}).some(Boolean))
    issues.push({path:'destination.kind_urns', msg:'at least one destination URN required', level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('urn.formats',(m)=>{
  const issues=[];
  function checkURNDict(dict, base){
    for(const [k,v] of Object.entries(dict||{})){
      if(v && !isURN(v)) issues.push({path:`${base}.${k}`, msg:'invalid URN', level:'error'});
    }
  }
  checkURNDict(m?.source?.kind_urns, 'source.kind_urns');
  checkURNDict(m?.destination?.kind_urns, 'destination.kind_urns');
  for(const arrPath of ['source.fields','destination.fields']){
    for(const [i,f] of (dget(m,arrPath)||[]).entries()){
      if(!isURN(f.urn)) issues.push({path:`${arrPath}[${i}].urn`, msg:'invalid field URN', level:'error'});
    }
  }
  for(const [i,u] of (m?.relationships?.infra_hosts||[]).entries()){
    if(!isURN(u)) issues.push({path:`relationships.infra_hosts[${i}]`, msg:'invalid URN', level:'error'});
  }
  return { ok:issues.length===0, issues };
});

// mapping sanity (presence, required flags)
registerValidator('mapping.rules',(m)=>{
  const issues=[]; const rules=m?.mapping?.rules||[];
  if(rules.length===0) issues.push({path:'mapping.rules', msg:'at least one mapping rule required', level:'error'});
  for(const [i,r] of rules.entries()){
    if(!r.from || !r.to) issues.push({path:`mapping.rules[${i}]`, msg:'from/to required', level:'error'});
  }
  return { ok:issues.length===0, issues };
});

// transport sanity: schedule/stream config + retry shape
registerValidator('transport.config',(m)=>{
  const issues=[]; const t=m?.transport||{};
  if(m.integration?.mode==='batch'){
    const b=t.batch||{}; if((b.schedule && !['cron','hourly','daily','none'].includes(b.schedule))) issues.push({path:'transport.batch.schedule', msg:'invalid schedule', level:'error'});
    if(b.schedule==='cron' && !b.expression) issues.push({path:'transport.batch.expression', msg:'cron expression required', level:'error'});
  }
  if(m.integration?.mode==='stream'){
    const s=t.stream||{}; if(!s.broker) issues.push({path:'transport.stream.broker', msg:'broker required', level:'error'});
  }
  const r=t.reliability||{}; if(r.retries!=null && r.retries<0) issues.push({path:'transport.reliability.retries', msg:'non-negative', level:'error'});
  if(r.backoff && !['none','linear','exponential'].includes(r.backoff)) issues.push({path:'transport.reliability.backoff', msg:'invalid', level:'error'});
  return { ok:issues.length===0, issues };
});

// governance parity w/ Data & Event protocols
registerValidator('governance.pii_policy',(m)=>{
  const issues=[];
  const anyPIIish = [...(m?.source?.fields||[]), ...(m?.destination?.fields||[])]
    .some(f=>/#(email|ssn|address|phone|user_id)\b/i.test(f.urn||''));
  if(anyPIIish && m?.governance?.policy?.classification!=='pii')
    issues.push({path:'governance.policy.classification', msg:'PII-like fields present → classification should be "pii"', level:'warn'});
  return { ok:issues.length===0, issues };
});

registerValidator('mapping.agent', m=>{
  const issues=[]; const am=m?.agentMapping; if(!am) return {ok:true};
  if(am.conversationContext && typeof am.conversationContext.enabled!=='boolean')
    issues.push({path:'agentMapping.conversationContext.enabled', msg:'boolean required', level:'error'});
  return { ok:issues.length===0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) — mirrors family
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath,op,...rest]=String(expr).split(':'); const rhs=rest.join(':'); if(!rawPath||!op) return false;
  // conveniences
  if(rawPath==='source.fields' && op==='contains') return (manifest.source?.fields||[]).some(f=>f.urn.includes(rhs));
  if(rawPath==='destination.fields' && op==='contains') return (manifest.destination?.fields||[]).some(f=>f.urn.includes(rhs));
  if(rawPath==='mapping.rules' && op==='contains') return (manifest.mapping?.rules||[]).some(r=>`${r.from}->${r.to}`.includes(rhs));
  const lhs=dget(manifest,rawPath.replace(/\[(\d+)\]/g,'.$1'));
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
  n.contract_hash = hash({
    dir:n.integration?.direction, mode:n.integration?.mode,
    src:n.source?.kind_urns, dst:n.destination?.kind_urns
  });
  n.mapping_hash  = hash(n.mapping||{});
  n.transport_hash= hash(n.transport||{});
  n.gov_hash      = hash(n.governance||{});
  return n;
}
function diff(a,b){
  const A=normalize(a), B=normalize(b); const changes=[];
  (function walk(p,va,vb){
    if(JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj=v=>v&&typeof v==='object';
    if(!isObj(va)||!isObj(vb)){ changes.push({path:p,from:va,to:vb}); return; }
    const keys=new Set([...Object.keys(va||{}),...Object.keys(vb||{})]); for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]);
  })('',A,B);
  const breaking=[], significant=[];
  for(const c of changes){
    if(c.path==='contract_hash') breaking.push({...c,reason:'endpoint contract changed'});
    if(c.path==='mapping_hash') significant.push({...c,reason:'mapping changed'});
    if(c.path==='transport_hash') significant.push({...c,reason:'schedule/stream/retries changed'});
    if(c.path==='gov_hash') significant.push({...c,reason:'governance changed'});
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Generators (docs/tests/visuals) — aligned with Event/Workflow style:contentReference[oaicite:11]{index=11}
// ————————————————————————————————————————————————————————————————
function generateMappingDoc(m){
  const rows = (m.mapping?.rules||[]).map(r=>`- ${r.from} → ${r.to}${r.transform?` (transform: ${r.transform})`:''}${r.required?' [required]':''}`);
  return `# Mapping for ${m.integration?.name}\n` + rows.join('\n');
}
function generateTestScenarios(m){
  const tests=[];
  // reachability/contract probes against API dest if present
  if(m.destination?.kind_urns?.api) tests.push({ name:'api:reachability', kind:'http', expect:{ ok:true } });
  // idempotency/dedupe hints
  if(m.mapping?.ingestion?.idempotency==='key') tests.push({ name:'idempotency:key', kind:'ingest', expect:{ no_duplicates:true } });
  return tests;
}
function generateMermaid(m){
  const lines=['graph TD','  subgraph Integration'];
  const id=s=>String(s||'').replace(/[^a-zA-Z0-9_]/g,'_');
  const me=id(m.integration?.id||'int');
  const src=Object.values(m.source?.kind_urns||{}).find(Boolean)||'source';
  const dst=Object.values(m.destination?.kind_urns||{}).find(Boolean)||'destination';
  lines.push(`  ${me}[[${m.integration?.name||'integration'}]]`);
  lines.push(`  "SRC: ${src}" --> ${me}`);
  lines.push(`  ${me} --> "DST: ${dst}"`);
  lines.push('  end'); return lines.join('\n');
}
function generateRunnerSkeleton(m){
  return `/** Minimal runner for: ${m.integration?.name}
   * NOTE: Replace with your job/consumer framework.
   */
async function runOnce(fetchSrc, pushDst){
  // 1) fetch source (batch/stream adapter)
  const items = await fetchSrc();
  // 2) map/transform
  const out = items.map(x => {
    const o={};
    ${(m.mapping?.rules||[]).map(r=>`o['${r.to}'] = ${r.transform?`${r.transform.replace(/`/g,'\\`')}`:`x['${r.from}']`};`).join('\n    ')}
    return o;
  });
  // 3) push destination
  await pushDst(out);
}
module.exports = { runOnce };`;
}

// ————————————————————————————————————————————————————————————————
// Cross-protocol helpers (optional; zero-deps, pass the other manifests)
// ————————————————————————————————————————————————————————————————
function crossCheckWithAPI(integration, apiManifest){
  const issues=[];
  // If destination is API, warn if auth/scopes look unmet (heuristic)
  const hasApiDest = !!integration?.destination?.kind_urns?.api;
  if(hasApiDest && !(apiManifest?.interface?.endpoints||[]).length){
    issues.push({msg:'API manifest has no endpoints', level:'warn'});
  }
  return { ok: issues.length===0, issues };
}
function crossCheckWithData(integration, dataManifest){
  const issues=[];
  const fields = new Set(Object.keys(dataManifest?.schema?.fields||{})); // Data shape
  for(const r of (integration.mapping?.rules||[])){
    const fromFrag = (r.from.split('#')[1]||'').split('.')[0];
    const toFrag   = (r.to.split('#')[1]||'').split('.')[0];
    if(fromFrag && !fields.has(fromFrag)) issues.push({msg:`source field not found in data schema: ${fromFrag}`, level:'warn'});
    if(toFrag   && !fields.has(toFrag))   issues.push({msg:`destination field not found in data schema: ${toFrag}`, level:'warn'});
  }
  return { ok: issues.length===0, issues };
}
function crossCheckWithEvent(integration, eventManifest){
  const issues=[];
  // If using event payload fields, ensure they exist
  const props = Object.keys(eventManifest?.schema?.payload?.properties||{});
  for(const f of (integration.source?.fields||[])){
    if(f.urn.includes('proto:event:') && f.urn.includes('#')){
      const p=f.urn.split('#')[1].replace(/^payload\./,'');
      if(props.length && !props.includes(p)) issues.push({msg:`event payload field not found: ${p}`, level:'warn'});
    }
  }
  return { ok: issues.length===0, issues };
}

// ————————————————————————————————————————————————————————————————
// Protocol + Catalog factories
// ————————————————————————————————————————————————————————————————
function createIntegrationProtocol(manifestInput={}){
  const manifest=normalize(manifestInput);
  return Object.freeze({
    manifest:()=>clone(manifest),
    validate:(names=[])=>runValidators(manifest,names),
    match:(expr)=>query(manifest,expr),
    diff:(other)=>diff(manifest, other?.manifest? other.manifest(): other),
    // generators
    generateMappingDoc:()=>generateMappingDoc(manifest),
    generateTestScenarios:()=>generateTestScenarios(manifest),
    generateMermaid:()=>generateMermaid(manifest),
    generateRunnerSkeleton:()=>generateRunnerSkeleton(manifest),
    // cross-checks
    crossCheckWithAPI:(apiManifest)=>crossCheckWithAPI(manifest,apiManifest),
    crossCheckWithData:(dataManifest)=>crossCheckWithData(manifest,dataManifest),
    crossCheckWithEvent:(eventManifest)=>crossCheckWithEvent(manifest,eventManifest),
    // mutation
    set:(path,val)=>{ const m=clone(manifest); dset(m,path,val); return createIntegrationProtocol(m); }
  });
}

function createIntegrationCatalog(protocols=[]){
  const items=protocols; const asManifests=()=>items.map(p=>p.manifest());
  function find(expr){ return items.filter(p=>p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m=>({ id:m.integration?.id, ...runValidators(m,names) })); }
  function schedulePlan(){
    // naive: list batch cron jobs + stream brokers/topics
    return asManifests().map(m=>({
      id:m.integration?.id,
      mode:m.integration?.mode,
      cron:m.transport?.batch?.expression||null,
      stream:m.transport?.stream?.topic||null
    }));
  }
  return Object.freeze({ items, find, validateAll, schedulePlan });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
module.exports = {
  createIntegrationProtocol,
  createIntegrationCatalog,
  registerValidator,
  Validators,
  // low-level helpers
  query, normalize, diff,
  generateMappingDoc, generateTestScenarios, generateMermaid, generateRunnerSkeleton,
  crossCheckWithAPI, crossCheckWithData, crossCheckWithEvent,
};
