/*
 * Documentation Protocol — v1.1.1 (stand-alone)
 * Minimal, self-describing documentation manifest + helpers
 *
 * Goals
 * - Mirror family ergonomics: manifest + validate + query + diff + generate
 * - Zero dependencies; add only essentials for structure, freshness, audience views
 * - Cross-protocol URNs so docs can bind to API/Data/Event/UI/Workflow/Infra
 *
 * Notes
 * - v1.1.1 consolidates v1.1.0 additions (interactive examples, audience targeting,
 *   maintenance/freshness check) and aligns with suite hashing/diff/query patterns.
 */

// ————————————————————————————————————————————————————————————————
// Utilities (shared style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(v){ if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(jsonCanon).join(',')+']';
  const k=Object.keys(v).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(v[x])).join(',')+'}'; }
function dget(o,p){ if(!p) return o; const parts=String(p).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=o; for(const k of parts){ if(cur==null) return; cur=cur[k]; } return cur; }
function dset(o,p,v){ const parts=String(p).split('.'); let cur=o; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=v; }
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(v){ const s=jsonCanon(v); let h=BigInt('0xcbf29ce484222325'); const p=BigInt('0x100000001b3'); for(let i=0;i<s.length;i++){ h^=BigInt(s.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }
const isURN = s => typeof s==='string' && /^urn:proto:(api|data|event|ui|workflow|infra|device|ai|iam|metric|integration|testing|docs|agent):[a-zA-Z0-9._-]+@[\d.]+(#[^#\s]+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} DocsManifest
 *
 * @property {Object} documentation
 * @property {string} documentation.id
 * @property {string} documentation.title
 * @property {'md'|'mdx'|'html'|'rst'} [documentation.format]
 * @property {{status:'draft'|'published'|'deprecated', created_at?:string, updated_at?:string}} [documentation.lifecycle]
 *
 * @property {Object} [links]                           // Cross-protocol anchors (URNs)
 * @property {string[]} [links.targets]                 // binds to protocol items (API/Data/Event/UI/...)
 *
 * @property {Object} [structure]
 * @property {Array<{ id:string, title:string, href?:string, audience?:string[], children?:Array<any> }>} [structure.navigation]
 * @property {Array<{ id:string, title:string, body?:string, audience?:string[], anchors?:string[] }>} [structure.sections]
 *
 * @property {Object} [content]
 * @property {{ provider?:'codesandbox'|'stackblitz', source_files?:string[] }} [content.examples.interactive_config]
 * @property {{ [slug:string]: { title:string, body:string } }} [content.pages]
 *
 * @property {Object} [quality]
 * @property {{ coverage?:number, missing_sections?:string[] }} [quality.docs_health]
 * @property {{ page_ratings?:Object<string,number>, unhelpful_votes?:number }} [quality.feedback_summary]
 *
 * @property {Object} [maintenance]
 * @property {{ enabled?:boolean, source_code_path?:string, last_code_change_at?:string }} [maintenance.freshness_check]
 *
 * @property {Object} [governance]
 * @property {{classification?:'internal'|'external', review_cycle_days?:number}} [governance.policy]
 *
 * @property {Object} [metadata]                        // free-form tags/owner
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

// Built-ins
registerValidator('core.shape', (m)=>{
  const issues=[];
  if(!m?.documentation?.id) issues.push({path:'documentation.id', msg:'required', level:'error'});
  if(!m?.documentation?.title) issues.push({path:'documentation.title', msg:'required', level:'error'});
  if(m?.documentation?.format && !['md','mdx','html','rst'].includes(m.documentation.format))
    issues.push({path:'documentation.format', msg:'invalid format', level:'error'});
  // minimal structure
  if(!Array.isArray(m?.structure?.navigation) && !Array.isArray(m?.structure?.sections))
    issues.push({path:'structure', msg:'navigation or sections required', level:'warn'});
  return { ok: issues.length===0, issues };
});

registerValidator('links.urns', (m)=>{
  const issues=[];
  for(const [i,u] of (m?.links?.targets||[]).entries()){
    if(!isURN(u)) issues.push({path:`links.targets[${i}]`, msg:'invalid URN', level:'error'});
  }
  return { ok: issues.length===0, issues };
});

registerValidator('quality.health', (m)=>{
  const issues=[];
  const cov=m?.quality?.docs_health?.coverage;
  if(cov!=null && !(cov>=0 && cov<=100)) issues.push({path:'quality.docs_health.coverage', msg:'0..100', level:'error'});
  return { ok: issues.length===0, issues };
});

registerValidator('maintenance.freshness', (m)=>{
  const issues=[];
  const fc=m?.maintenance?.freshness_check;
  if(fc?.enabled && !fc?.source_code_path) issues.push({path:'maintenance.freshness_check.source_code_path', msg:'required when enabled', level:'error'});
  return { ok: issues.length===0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath,op,...rest]=String(expr).split(':');
  const rhs=rest.join(':'); if(!rawPath||!op) return false;
  // conveniences
  if(rawPath==='structure.navigation' && op==='contains') return (manifest.structure?.navigation||[]).some(n=>String(n.title||'').includes(rhs));
  if(rawPath==='links.targets' && op==='contains') return (manifest.links?.targets||[]).some(u=>u.includes(rhs));
  const lhs=dget(manifest, rawPath.replace(/\[(\d+)\]/g, '.$1'));
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
  n.nav_hash   = hash(n.structure?.navigation||[]);
  n.sec_hash   = hash(n.structure?.sections||[]);
  n.links_hash = hash(n.links?.targets||[]);
  n.qc_hash    = hash(n.quality||{});
  n.gov_hash   = hash(n.governance||{});
  n.meta_hash  = hash(n.metadata||{});
  return n;
}

function diff(a,b){
  const A=normalize(a), B=normalize(b);
  const changes=[];
  (function walk(p,va,vb){
    if(JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj=v=>v&&typeof v==='object';
    if(!isObj(va)||!isObj(vb)){ changes.push({path:p,from:va,to:vb}); return; }
    const keys=new Set([...Object.keys(va||{}),...Object.keys(vb||{})]);
    for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]);
  })('',A,B);
  const breaking=[], significant=[];
  for(const c of changes){
    if(c.path==='sec_hash') significant.push({...c,reason:'sections changed'});
    if(c.path==='nav_hash') significant.push({...c,reason:'nav changed'});
    if(c.path==='links_hash') significant.push({...c,reason:'linked targets changed'});
    if(c.path==='qc_hash') significant.push({...c,reason:'quality/feedback changed'});
    if(c.path==='gov_hash') significant.push({...c,reason:'governance changed'});
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Generators (skeletons, stubs, visuals)
// ————————————————————————————————————————————————————————————————
function generateDocsSkeleton(manifest){
  const m=manifest;
  const fmt=m.documentation?.format||'md';
  let out=`# ${m.documentation?.title||m.documentation?.id||'Documentation'}\n\n`;
  out+=`> Doc ID: \`${m.documentation?.id||'unknown'}\`  \n\n`;

  if(m.structure?.navigation){
    out+=`## Navigation\n`;
    const walk=(nodes,depth=0)=>{
      for(const n of (nodes||[])){
        out+=`${'  '.repeat(depth)}- ${n.title}${n.href?` — _${n.href}_`:''}\n`;
        if(n.children) walk(n.children, depth+1);
      }
    }; walk(m.structure.navigation);
    out+='\n';
  }

  if(m.content?.examples?.interactive_config){
    const cfg=m.content.examples.interactive_config;
    out+=`## Interactive Examples\nProvider: \`${cfg.provider||'codesandbox'}\`\n`;
    if(cfg.source_files && cfg.source_files.length){
      out+=`Files:\n${cfg.source_files.map(f=>`- \`${f}\``).join('\n')}\n`;
    }
    out+='\n';
  }

  if(Array.isArray(m.structure?.sections) && m.structure.sections.length){
    out+=`## Sections\n`;
    for(const s of m.structure.sections){
      out+=`\n### ${s.title}\n\n${s.body||'_TBD_'}\n`;
    }
  }

  return out;
}

// Generate nav graph (Mermaid)
function generateMermaidNav(manifest){
  const lines=['graph TD','  subgraph Docs'];
  const id=s=>String(s||'').replace(/[^a-zA-Z0-9_]/g,'_');
  const root=id(manifest.documentation?.id||'docs');
  lines.push(`  ${root}[[${manifest.documentation?.title||'docs'}]]`);
  const walk=(nodes,parent)=>{
    for(const n of (nodes||[])){
      const nid=id(n.id||n.title);
      lines.push(`  ${parent} --> ${nid}[${n.title}]`);
      if(n.children) walk(n.children,nid);
    }
  };
  walk(manifest.structure?.navigation||[], root);
  lines.push('  end'); return lines.join('\n');
}

// Generate stubs from protocol URNs (lightweight)
function generateProtocolStubs(manifest, registry){
  const stubs=[];
  for(const u of (manifest.links?.targets||[])){
    const item = registry?.get?.(u);
    if(!item) { stubs.push({ urn:u, title:'(unresolved)', body:'TBD' }); continue; }
    // naive title/body extraction
    const title = item?.service?.name || item?.dataset?.name || item?.event?.name || item?.workflow?.id || item?.component?.name || item?.model?.name || 'Item';
    stubs.push({ urn:u, title:String(title), body:'Describe usage, parameters, examples…' });
  }
  return stubs;
}

// ————————————————————————————————————————————————————————————————
// Maintenance / quality helpers
// ————————————————————————————————————————————————————————————————
function findOutdated(manifest, daysThreshold=30){
  const out=[]; const now=Date.now();
  const lc = manifest.documentation?.lifecycle || {};
  const updatedAt = lc.updated_at ? new Date(lc.updated_at) : null;

  // freshness window
  if(updatedAt && (now - updatedAt.getTime())/86400000 > daysThreshold){
    out.push({ section:'*', status:'stale', reason:`Last updated > ${daysThreshold}d`, last_doc_update: lc.updated_at });
  }

  // smarter check: compare last code change vs last doc update
  const fc = manifest.maintenance?.freshness_check;
  if(fc?.enabled && fc.last_code_change_at){
    const codeTs = new Date(fc.last_code_change_at);
    const docTs  = updatedAt || new Date(0);
    if(codeTs > docTs){
      out.push({
        section:'*',
        status:'potentially_stale',
        reason:`Source at '${fc.source_code_path||''}' changed after docs`,
        last_code_change: fc.last_code_change_at,
        last_doc_update: lc.updated_at || null
      });
    }
  }

  return out;
}

function analyzeCoverage(manifest){
  const navCount=(function count(nodes){ return (nodes||[]).reduce((acc,n)=>acc+1+count(n.children||[]),0); })(manifest.structure?.navigation||[]);
  const secCount=(manifest.structure?.sections||[]).length;
  const cov = navCount>0 ? Math.min(100, Math.round((secCount/navCount)*100)) : (secCount?100:0);
  return { navCount, secCount, estimated_coverage: cov };
}

// ————————————————————————————————————————————————————————————————
// Protocol + Catalog factories
// ————————————————————————————————————————————————————————————————
function createDocsProtocol(manifestInput={}){
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: ()=>clone(manifest),
    validate: (names=[])=>runValidators(manifest,names),
    match: (expr)=>query(manifest,expr),
    diff: (other)=>diff(manifest, other?.manifest?other.manifest():other),

    // generators
    generateDocsSkeleton: ()=>generateDocsSkeleton(manifest),
    generateMermaidNav: ()=>generateMermaidNav(manifest),
    generateProtocolStubs: (registry)=>generateProtocolStubs(manifest, registry),

    // maintenance / quality
    findOutdated: (daysThreshold)=>findOutdated(manifest, daysThreshold),
    analyzeCoverage: ()=>analyzeCoverage(manifest),

    // mutation
    set: (path,val)=>{ const m=clone(manifest); dset(m,path,val); return createDocsProtocol(m); }
  });
}

function createDocsCatalog(protocols=[]){
  const items=protocols; const asManifests=()=>items.map(p=>p.manifest());
  function find(expr){ return items.filter(p=>p.match(expr)); }
  function validateAll(names=[]) { return asManifests().map(m=>({ id:m.documentation?.id, ...runValidators(m,names) })); }
  function freshnessReport(days=30){ return asManifests().map(m=>({ id:m.documentation?.id, stale: findOutdated(m,days) })); }
  return Object.freeze({ items, find, validateAll, freshnessReport });
}

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
module.exports = {
  createDocsProtocol,
  createDocsCatalog,
  registerValidator,
  Validators,
  // low-level helpers (optional)
  query, normalize, diff,
  generateDocsSkeleton, generateMermaidNav, generateProtocolStubs,
  findOutdated, analyzeCoverage,
};
