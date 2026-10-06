/*
 * Analytics & Metrics Protocol — v1.1.1 (stand-alone)
 * Minimal, self-describing metric manifest + helpers (OLTP/OLAP/stream friendly)
 *
 * Goals
 * - Mirror the family ergonomics: manifest + validate + query + diff + generate
 * - Keep it tiny; add only essentials: sources, windows, aggregations, quality & governance
 * - Zero dependencies; no external wiring
 *
 * Cross-protocol link points (via URNs):
 * - Data fields (datasets/columns), Event payload fields, Device telemetry, API endpoints, UI props
 *
 * Example URNs:
 *   urn:proto:data:billing.transactions@1.1.1#amount
 *   urn:proto:event:payment.completed@1.1.1#payload.amount
 *   urn:proto:device:sensor-1@1.1.1#cap.temperature
 *   urn:proto:api:billing@1.1.1#/v1/invoices.amount
 *   urn:proto:ui:CheckoutButton@1.2.0#props.clicks
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(value){
  if (value===null || typeof value!=='object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(jsonCanon).join(',')+']';
  const k = Object.keys(value).sort();
  return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(value[x])).join(',')+'}';
}
function dget(obj,path){
  if(!path) return obj;
  const p = String(path).replace(/\[(\d+)\]/g,'.$1').split('.');
  let cur=obj; for(const k of p){ if(cur==null) return undefined; cur=cur[k]; }
  return cur;
}
function dset(obj,path,val){
  const parts = String(path).split('.');
  let cur=obj; while(parts.length>1){ const k=parts.shift(); if(!(k in cur) || typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; }
  cur[parts[0]]=val;
}
const clone = x => JSON.parse(JSON.stringify(x));
function hash(value){
  const str = jsonCanon(value);
  let h = BigInt('0xcbf29ce484222325');
  const p = BigInt('0x100000001b3');
  for(let i=0;i<str.length;i++){ h ^= BigInt(str.charCodeAt(i)); h = (h*p) & BigInt('0xFFFFFFFFFFFFFFFF'); }
  return 'fnv1a64-'+h.toString(16).padStart(16,'0');
}
const isURN = s => typeof s==='string' && /^urn:proto:[a-z]+:[a-zA-Z0-9._-]+@[\d.]+(#.+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} MetricManifest
 * @property {Object} metric
 * @property {string} metric.id                    // stable id (for lineage)
 * @property {string} metric.name                  // human-readable name
 * @property {string} [metric.version]             // manifest version (semver)
 * @property {'counter'|'gauge'|'histogram'|'summary'|'rate'|'ratio'|'derived'} metric.kind
 * @property {string} [metric.unit]                // UCUM-style or freeform (e.g., 'ms','usd','count')
 * @property {string} [metric.description]
 *
 * @property {Object} source
 * @property {Array<{urn:string, alias?:string}>} source.fields // link to Data/Event/Device/API/UI via URNs
 * @property {string} [source.filter_expression]  // JS-like or SQL-like expression (doc-only)
 *
 * @property {Object} [transform]
 * @property {string} [transform.expression]      // derived formula (e.g., "(sum(rev)-sum(cost))/sum(cost)")
 * @property {('none'|'zscore'|'ewma')} [transform.normalization]
 *
 * @property {Object} aggregation
 * @property {'sum'|'count'|'avg'|'min'|'max'|'p50'|'p90'|'p95'|'p99'|'distinct_count'} aggregation.op
 * @property {string[]} [aggregation.dimensions]  // e.g., ['country','plan','device_type']
 * @property {Array<{name:string, expression?:string}>} [aggregation.computed_dimensions]
 *
 * @property {Object} window
 * @property {'point'|'tumbling'|'sliding'|'session'} window.type
 * @property {string} [window.size]               // e.g., '1m'|'5m'|'1h' (not for 'point')
 * @property {string} [window.step]               // for sliding (<= size)
 * @property {string} [window.session_gap]        // for session windows
 * @property {'event_time'|'processing_time'} [window.time_base]
 *
 * @property {Object} quality
 * @property {number} [quality.min_samples]       // min events per window
 * @property {number} [quality.max_cardinality]   // dimension budget guardrail
 * @property {string} [quality.freshness_sla]     // e.g., '2m'|'5m'|'1h'
 *
 * @property {Object} governance
 * @property {{classification?:'internal'|'confidential'|'pii', legal_basis?:'gdpr'|'ccpa'|'hipaa'|'other'}} [governance.policy]
 *
 * @property {Object} relationships
 * @property {string[]} [relationships.produces_events]  // event URNs published when metric breaches thresholds
 * @property {string[]} [relationships.consumes_events]  // event URNs that feed this metric
 * @property {string[]} [relationships.downstream_metrics] // derived metrics dependent on this one (by URN/id)
 *
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 * @property {Object} [metadata.thresholds]       // e.g., {warn: 'p95>250', crit: 'rate>10/s'}
 */

// ————————————————————————————————————————————————————————————————
// Validator registry
// ————————————————————————————————————————————————————————————————
const Validators = new Map();
/** Register a named validator: (manifest)=>{ok, issues:[{path,msg,level}]} */
function registerValidator(name, fn){ Validators.set(name, fn); }
function runValidators(manifest, selected=[]){
  const names = selected.length ? selected : Array.from(Validators.keys());
  const results = names.map(n => ({ name:n, ...(Validators.get(n)?.(manifest)||{ok:true}) }));
  return { ok: results.every(r=>r.ok), results };
}

// Built-ins
registerValidator('core.shape', (m)=>{
  const issues=[];
  if(!m?.metric?.id) issues.push({path:'metric.id', msg:'metric.id required', level:'error'});
  if(!m?.metric?.name) issues.push({path:'metric.name', msg:'metric.name required', level:'error'});
  if(!m?.metric?.kind) issues.push({path:'metric.kind', msg:'metric.kind required', level:'error'});
  if(!Array.isArray(m?.source?.fields) || m.source.fields.length===0)
    issues.push({path:'source.fields', msg:'at least one source field URN required', level:'error'});
  for(const [i,f] of (m?.source?.fields||[]).entries()){
    if(!isURN(f.urn)) issues.push({path:`source.fields[${i}].urn`, msg:'invalid URN format', level:'error'});
  }
  // window sanity
  const w = m?.window||{};
  const allowed = new Set(['point','tumbling','sliding','session']);
  if(!allowed.has(w.type)) issues.push({path:'window.type', msg:'window.type must be point|tumbling|sliding|session', level:'error'});
  if((w.type==='tumbling' || w.type==='sliding') && !/^\d+\s?(ms|s|m|h|d)$/.test(w.size||'')) issues.push({path:'window.size', msg:'size like 500ms|5s|1m|1h|1d required', level:'error'});
  if(w.type==='sliding' && w.step && !/^\d+\s?(ms|s|m|h|d)$/.test(w.step)) issues.push({path:'window.step', msg:'invalid step', level:'error'});
  if(w.type==='session' && !/^\d+\s?(ms|s|m|h)$/.test(w.session_gap||'')) issues.push({path:'window.session_gap', msg:'session_gap required like 5m', level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('agg.compatibility', (m)=>{
  const issues=[];
  const k=m?.metric?.kind, op=m?.aggregation?.op;
  const okPairs = {
    counter: new Set(['sum','count','rate']),
    gauge: new Set(['avg','min','max','p50','p90','p95','p99']),
    histogram: new Set(['p50','p90','p95','p99','avg','min','max','count']),
    summary: new Set(['avg','min','max','count','p50','p90','p95','p99']),
    rate: new Set(['avg','max']),
    ratio: new Set(['avg','p50','p90']),
    derived: new Set(['sum','avg','min','max','count','p50','p90','p95','p99','distinct_count'])
  };
  if(!okPairs[k] || !okPairs[k].has(op)) issues.push({path:'aggregation.op', msg:`aggregation '${op}' incompatible with kind '${k}'`, level:'warn'});
  return { ok:issues.length===0, issues };
});

registerValidator('quality.cardinality', (m)=>{
  const issues=[];
  const dims = m?.aggregation?.dimensions||[];
  if ((m?.quality?.max_cardinality|0) > 0 && dims.length>0){
    // heuristic: warn if too many high-card dims declared (names that look like ids)
    const suspicious = dims.filter(d=>/id$|uuid$|session$|trace|span/i.test(d));
    if(suspicious.length) issues.push({path:'aggregation.dimensions', msg:`potential high-cardinality dims: ${suspicious.join(', ')}`, level:'warn'});
  }
  return { ok:issues.length===0, issues };
});

registerValidator('governance.pii_policy', (m)=>{
  const issues=[];
  // If source URN references PII fields (hint only: look for '#email' etc.)
  const anyPIIish = (m?.source?.fields||[]).some(f=>/#(email|ssn|address|phone|user_id)\b/i.test(f.urn));
  if (anyPIIish && m?.governance?.policy?.classification !== 'pii'){
    issues.push({path:'governance.policy.classification', msg:'PII-like source detected → classification should be "pii"', level:'warn'});
  }
  return { ok:issues.length===0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath,op,...rest] = String(expr).split(':');
  const rhs = rest.join(':'); if (!rawPath||!op) return false;
  if (rawPath==='source.fields' && op==='contains') return (manifest.source?.fields||[]).some(f=>f.urn.includes(rhs));
  if (rawPath==='aggregation.dimensions' && op==='contains') return (manifest.aggregation?.dimensions||[]).some(d=>d.includes(rhs));
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
  const n = clone(m||{});
  n.sig_hash = hash({
    id:n.metric?.id, kind:n.metric?.kind, unit:n.metric?.unit,
    src:(n.source?.fields||[]).map(f=>f.urn).sort(),
    agg:n.aggregation, win:n.window, expr:n.transform?.expression
  });
  n.src_hash = hash(n.source||{});
  n.agg_hash = hash(n.aggregation||{});
  n.win_hash = hash(n.window||{});
  n.qos_hash = hash(n.quality||{});
  n.gov_hash = hash(n.governance||{});
  return n;
}
function diff(a,b){
  const A=normalize(a), B=normalize(b);
  const changes=[];
  (function walk(p,va,vb){
    if(JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj = v => v && typeof v==='object';
    if(!isObj(va)||!isObj(vb)){ changes.push({path:p,from:va,to:vb}); return; }
    const keys = new Set([...Object.keys(va||{}), ...Object.keys(vb||{})]);
    for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]);
  })('',A,B);
  const breaking=[], significant=[];
  for (const c of changes){
    if (c.path==='sig_hash') breaking.push({...c, reason:'metric signature changed (kind/unit/src/agg/window/expression)'});
    if (c.path==='agg_hash') significant.push({...c, reason:'aggregation changed'});
    if (c.path==='win_hash') significant.push({...c, reason:'windowing changed'});
    if (c.path==='qos_hash') significant.push({...c, reason:'quality/SLA changed'});
    if (c.path==='gov_hash') significant.push({...c, reason:'governance policy changed'});
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Generators
// ————————————————————————————————————————————————————————————————

// 1) SQL generator (warehouse batch / streaming SQL)
function generateSQL(manifest, { table='events', timestamp='event_time' } = {}){
  const srcs = (manifest.source?.fields||[]).map(f=>f.alias||f.urn.split('#').pop());
  const dims = manifest.aggregation?.dimensions||[];
  const op = manifest.aggregation?.op||'sum';
  const selectAgg = (op)=>{
    const col = srcs[0] || 'value';
    const map = { sum:`SUM(${col})`, count:`COUNT(*)`, avg:`AVG(${col})`, min:`MIN(${col})`, max:`MAX(${col})`,
      p50:`APPROX_PERCENTILE(${col},0.5)`, p90:`APPROX_PERCENTILE(${col},0.9)`, p95:`APPROX_PERCENTILE(${col},0.95)`,
      p99:`APPROX_PERCENTILE(${col},0.99)`, distinct_count:`COUNT(DISTINCT ${col})` };
    return map[op]||`/* op '${op}' not implemented */`;
  };
  const w = manifest.window||{type:'tumbling',size:'5m',time_base:'event_time'};
  const bucket = (ts)=>`WINDOW_START`; // placeholder for engines that support window functions
  const dimList = dims.length? (', '+dims.join(', ')) : '';
  return `-- Auto-generated metric: ${manifest.metric?.name}
SELECT
  ${selectAgg(op)} AS value,
  ${timestamp} AS ts${dimList}
FROM ${table}
-- WHERE ${manifest.source?.filter_expression||'/* add filter*/'}
GROUP BY ${timestamp}${dimList};`;
}

// 2) Stream pseudo-engine (illustrative only)
function generateStreamProcessor(manifest){
  return `/**
 * Pseudocode stream processor for ${manifest.metric?.name}
 * Note: Replace with Flink/Spark/Kafka Streams as needed.
 */
function process(events){
  // windowing + agg elided; map events to fields & apply expression
  // emit {ts, dims..., value}
}`;
}

// 3) Test scenarios (data quality / SLA probes)
function generateTestScenarios(manifest){
  const tests=[];
  if (manifest.quality?.min_samples) tests.push({ name:'min_samples', kind:'dq', expect:{ min: manifest.quality.min_samples } });
  if (manifest.quality?.freshness_sla) tests.push({ name:'freshness', kind:'sla', expect:{ within: manifest.quality.freshness_sla } });
  return tests;
}

// 4) Mermaid lineage graph
function generateLineage(manifest){
  const lines=['graph TD','  subgraph Metric'];
  const id = (s)=>String(s||'').replace(/[^a-zA-Z0-9_]/g,'_');
  const me = id(manifest.metric?.id||manifest.metric?.name||'metric');
  lines.push(`  ${me}[[${manifest.metric?.name||'metric'}]]`);
  for(const f of (manifest.source?.fields||[])){
    const n = id(f.urn); lines.push(`  ${n}[${f.urn}] --> ${me}`);
  }
  lines.push('  end'); return lines.join('\n');
}

// ————————————————————————————————————————————————————————————————
// Cross-protocol helpers (optional, stay zero-deps; call with other manifests)
// ————————————————————————————————————————————————————————————————
function crossCheckWithData(metricManifest, dataManifest){
  const issues=[];
  // If any URN references a field not present in the supplied Data manifest, warn
  const fields = new Set(Object.keys(dataManifest?.schema?.fields||{}));
  for(const f of (metricManifest.source?.fields||[])){
    const frag = (f.urn.split('#')[1]||'').split('.')[0]; // crude col name
    if (frag && !fields.has(frag)) issues.push({msg:`Data field not found: ${frag}`, level:'warn'});
  }
  return { ok: issues.length===0, issues };
}
function crossCheckWithEvent(metricManifest, eventManifest){
  const issues=[];
  // If metric consumes an event, ensure payload exists
  const props = Object.keys(eventManifest?.schema?.payload?.properties||{});
  for(const f of (metricManifest.source?.fields||[])){
    if (f.urn.includes('proto:event:') && f.urn.includes('#')){
      const frag=f.urn.split('#')[1]; const key=frag.replace(/^payload\./,'');
      if (props.length && !props.includes(key)) issues.push({msg:`Event payload field not found: ${key}`, level:'warn'});
    }
  }
  return { ok: issues.length===0, issues };
}
function crossCheckWithWorkflow(metricManifest, workflowManifest){
  const issues=[];
  // Heuristic: if metric triggers alerts, ensure workflow listens to those events
  const produces = new Set(metricManifest?.relationships?.produces_events||[]);
  const consumes = new Set((workflowManifest?.steps||[]).flatMap(s=>s.consumes||[]));
  for (const e of produces) if (!consumes.has(e)) issues.push({msg:`Metric emits '${e}' but workflow does not consume it`, level:'warn'});
  return { ok: issues.length===0, issues };
}

// ————————————————————————————————————————————————————————————————
// Protocol + Catalog factories
// ————————————————————————————————————————————————————————————————
function createMetricProtocol(manifestInput={}){
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: ()=>clone(manifest),
    validate: (names=[])=>runValidators(manifest,names),
    match: (expr)=>query(manifest,expr),
    diff: (other)=>diff(manifest, other?.manifest? other.manifest(): other),
    // generators
    generateSQL: (opts)=>generateSQL(manifest,opts),
    generateStreamProcessor: ()=>generateStreamProcessor(manifest),
    generateTestScenarios: ()=>generateTestScenarios(manifest),
    generateLineage: ()=>generateLineage(manifest),
    // cross-checks
    crossCheckWithData: (dataManifest)=>crossCheckWithData(manifest,dataManifest),
    crossCheckWithEvent: (eventManifest)=>crossCheckWithEvent(manifest,eventManifest),
    crossCheckWithWorkflow: (workflowManifest)=>crossCheckWithWorkflow(manifest,workflowManifest),
    // mutation
    set: (path,val)=>{ const m=clone(manifest); dset(m,path,val); return createMetricProtocol(m); },
  });
}

function createMetricsCatalog(protocols=[]){
  const items=protocols; const asManifests=()=>items.map(p=>p.manifest());
  function find(expr){ return items.filter(p=>p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m=>({ id:m.metric?.id, ...runValidators(m,names) })); }
  function lineage(){ return asManifests().map(m=>({ id:m.metric?.id, sources:(m.source?.fields||[]).map(f=>f.urn) })); }
  function cardinalityBudget(){
    return asManifests().map(m=>({ id:m.metric?.id, dims:m.aggregation?.dimensions||[], max:m.quality?.max_cardinality||null }));
  }
  return Object.freeze({ items, find, validateAll, lineage, cardinalityBudget });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
module.exports = {
  createMetricProtocol,
  createMetricsCatalog,
  registerValidator,
  Validators,
  // low-level helpers
  generateSQL,
  generateStreamProcessor,
  generateTestScenarios,
  generateLineage,
  crossCheckWithData,
  crossCheckWithEvent,
  crossCheckWithWorkflow,
};
