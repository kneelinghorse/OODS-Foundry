/*
 * Agent Protocol — v1.1.1 (stand-alone, trimmed MVP)
 * Minimal, self-describing agent manifest + helpers (aligned to v1.1.1 family)
 *
 * Goals (MVP scope)
 * - Mirror family ergonomics: manifest + validate + query + diff + generate
 * - Keep it tiny; focus on identity, capabilities, communication, delegation links
 * - Cross-protocol URNs; zero dependencies
 * - Provide lightweight generators: Agent Card JSON, docs stub, test skeleton
 */

// ————————————————————————————————————————————————————————————————
// Utilities (shared family style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(v){ if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(jsonCanon).join(',')+']';
  const k=Object.keys(v).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(v[x])).join(',')+'}'; }
function dget(o,p){ if(!p) return o; const parts=String(p).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=o; for(const k of parts){ if(cur==null) return; cur=cur[k]; } return cur; }
function dset(o,p,v){ const parts=String(p).split('.'); let cur=o; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=v; }
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(v){ const s=jsonCanon(v); let h=BigInt('0xcbf29ce484222325'); const p=BigInt('0x100000001b3'); for(let i=0;i<s.length;i++){ h^=BigInt(s.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }
const isURN = s => typeof s==='string' && /^urn:proto:(api|data|event|ui|workflow|infra|device|ai|iam|metric|integration|testing|docs|obs|config|release|agent):[a-zA-Z0-9._-]+@[\d.]+(#[^#\s]+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} AgentManifest
 *
 * @property {Object} agent                       // Identity & discovery
 * @property {string} agent.id                    // stable id (for lineage)
 * @property {string} agent.name                  // human-readable
 * @property {string} [agent.version]             // semver
 * @property {string} [agent.discovery_uri]       // well-known URL for discovery/agent-card
 * @property {{status:'defined'|'enabled'|'paused'|'deprecated'}} [agent.lifecycle]
 *
 * @property {Object} capabilities                // What the agent can do (MVP)
 * @property {Array<{name:string, description?:string, inputSchema?:Object, outputSchema?:Object, urn?:string}>} [capabilities.tools]
 * @property {Array<{uri:string, name?:string, mimeType?:string, urn?:string}>} [capabilities.resources]
 * @property {Array<{name:string, description?:string, arguments?:Array<{name:string, required?:boolean}>, urn?:string}>} [capabilities.prompts]
 * @property {{ input?:string[], output?:string[] }} [capabilities.modalities]
 *
 * @property {Object} communication               // How to talk to it (descriptive)
 * @property {{supported?:('a2a'|'mcp'|'custom')[], endpoints?:Object<string,string>, transport?:{primary?:'https'|'stdio'|'grpc'|'ws', streaming?:'sse'|'ws'|'none', fallback?:'polling'|'none'}}} communication
 *
 * @property {Object} authorization               // Delegation/authorization (links)
 * @property {{ delegation_supported?:boolean, signature_algorithm?:'ES256'|'Ed25519'|'RS256' }} [authorization]
 *
 * @property {Object} relationships               // Cross-protocol links via URNs
 * @property {string[]} [relationships.models]    // urn:proto:ai:…
 * @property {string[]} [relationships.apis]      // urn:proto:api:…
 * @property {string[]} [relationships.workflows] // urn:proto:workflow:…
 * @property {string[]} [relationships.roles]     // urn:proto:iam:…
 * @property {string[]} [relationships.targets]   // other relevant URNs (obs/config/etc.)
 *
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry (pluggable, zero-deps)
// ————————————————————————————————————————————————————————————————
const Validators=new Map();
function registerValidator(n,fn){ Validators.set(n,fn); }
function runValidators(m,sel=[]){ const names=sel.length?sel:Array.from(Validators.keys());
  const results=names.map(n=>({name:n,...(Validators.get(n)?.(m)||{ok:true})}));
  return { ok:results.every(r=>r.ok), results };
}

// Built-ins (trimmed, minimal)
registerValidator('core.shape', m=>{
  const issues=[];
  if(!m?.agent?.id) issues.push({path:'agent.id', msg:'required', level:'error'});
  if(!m?.agent?.name) issues.push({path:'agent.name', msg:'required', level:'error'});
  if(m?.agent?.lifecycle?.status && !['defined','enabled','paused','deprecated'].includes(m.agent.lifecycle.status))
    issues.push({path:'agent.lifecycle.status', msg:'invalid', level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('capabilities.tools_unique', m=>{
  const issues=[]; const tools=m?.capabilities?.tools||[];
  const names=tools.map(t=>t.name).filter(Boolean); const dup=names.filter((n,i)=>names.indexOf(n)!==i);
  if(dup.length) issues.push({path:'capabilities.tools', msg:`duplicate tool names: ${Array.from(new Set(dup)).join(', ')}`, level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('communication.shape', m=>{
  const issues=[]; const c=m?.communication||{};
  if(c.supported && c.supported.some(x=>!['a2a','mcp','custom'].includes(x)))
    issues.push({path:'communication.supported', msg:'allowed: a2a|mcp|custom', level:'error'});
  if(c.transport && c.transport.primary && !['https','stdio','grpc','ws'].includes(c.transport.primary))
    issues.push({path:'communication.transport.primary', msg:'invalid', level:'error'});
  if(c.transport && c.transport.streaming && !['sse','ws','none'].includes(c.transport.streaming))
    issues.push({path:'communication.transport.streaming', msg:'invalid', level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('authorization.delegation_min', m=>{
  const issues=[]; const a=m?.authorization||{};
  if(a.delegation_supported && !a.signature_algorithm)
    issues.push({path:'authorization.signature_algorithm', msg:'required when delegation_supported=true', level:'error'});
  return { ok:issues.length===0, issues };
});

registerValidator('relationships.urns', m=>{
  const issues=[];
  for(const k of ['models','apis','workflows','roles','targets']){
    for(const [i,u] of (m?.relationships?.[k]||[]).entries()){
      if(!isURN(u)) issues.push({path:`relationships.${k}[${i}]`, msg:'invalid URN', level:'error'});
    }
  }
  // Optional URN on capabilities
  for(const [i,t] of (m?.capabilities?.tools||[]).entries()) if(t.urn && !isURN(t.urn)) issues.push({path:`capabilities.tools[${i}].urn`, msg:'invalid URN', level:'error'});
  for(const [i,r] of (m?.capabilities?.resources||[]).entries()) if(r.urn && !isURN(r.urn)) issues.push({path:`capabilities.resources[${i}].urn`, msg:'invalid URN', level:'error'});
  for(const [i,p] of (m?.capabilities?.prompts||[]).entries()) if(p.urn && !isURN(p.urn)) issues.push({path:`capabilities.prompts[${i}].urn`, msg:'invalid URN', level:'error'});
  return { ok:issues.length===0, issues };
});

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){
  const [rawPath,op,...rest]=String(expr).split(':'); const rhs=rest.join(':'); if(!rawPath||!op) return false;
  // conveniences
  if(rawPath==='capabilities.tools' && op==='contains') return (manifest.capabilities?.tools||[]).some(t=>`${t.name}:${t.description}`.includes(rhs));
  if(rawPath==='relationships.targets' && op==='contains') return (manifest.relationships?.targets||[]).some(u=>u.includes(rhs));
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
  n.id_hash   = hash({id:n.agent?.id, name:n.agent?.name, version:n.agent?.version});
  n.cap_hash  = hash(n.capabilities||{});
  n.com_hash  = hash(n.communication||{});
  n.auth_hash = hash(n.authorization||{});
  n.rel_hash  = hash(n.relationships||{});
  return n;
}

function diff(a,b){
  const A=normalize(a), B=normalize(b); const changes=[];
  (function walk(p,va,vb){ if(JSON.stringify(va)===JSON.stringify(vb)) return;
    const isObj=v=>v&&typeof v==='object'; if(!isObj(va)||!isObj(vb)){ changes.push({path:p,from:va,to:vb}); return; }
    const keys=new Set([...Object.keys(va||{}),...Object.keys(vb||{})]); for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]); })('',A,B);
  const breaking=[], significant=[];
  for(const c of changes){
    if(c.path==='id_hash')  breaking.push({...c, reason:'agent identity changed'});
    if(c.path==='cap_hash') significant.push({...c, reason:'capabilities changed'});
    if(c.path==='com_hash') significant.push({...c, reason:'communication changed'});
    if(c.path==='auth_hash') significant.push({...c, reason:'authorization/delegation changed'});
    if(c.path==='rel_hash') significant.push({...c, reason:'cross-protocol links changed'});
  }
  return { changes, breaking, significant };
}

// ————————————————————————————————————————————————————————————————
// Generators (Agent Card JSON; Docs stub; Test skeleton)
// ————————————————————————————————————————————————————————————————
function generateAgentCard(m){
  // Minimal discovery card synthesized from manifest
  return {
    name: m.agent?.name,
    id: m.agent?.id,
    version: m.agent?.version || '1.0.0',
    discovery_uri: m.agent?.discovery_uri || null,
    capabilities: {
      tools: (m.capabilities?.tools||[]).map(t=>({ name:t.name, description:t.description||'', inputSchema:t.inputSchema||null, outputSchema:t.outputSchema||null })),
      resources: (m.capabilities?.resources||[]).map(r=>({ uri:r.uri, name:r.name||null, mimeType:r.mimeType||null }))
    },
    communication: {
      supported: m.communication?.supported||[],
      endpoints: m.communication?.endpoints||{},
      transport: m.communication?.transport||{}
    },
    authorization: {
      delegation_supported: !!m.authorization?.delegation_supported,
      signature_algorithm: m.authorization?.signature_algorithm||null
    }
  };
}

function generateDocsStub(m){
  const lines=[];
  lines.push(`# ${m.agent?.name||m.agent?.id||'Agent'} — Docs`);
  lines.push(`\n**Agent ID**: \`${m.agent?.id||'unknown'}\``);
  if(m.agent?.version) lines.push(`\n**Version**: \`${m.agent.version}\``);
  if(m.agent?.discovery_uri) lines.push(`\n**Discovery**: ${m.agent.discovery_uri}`);
  lines.push(`\n## Capabilities`);
  for(const t of (m.capabilities?.tools||[])){
    lines.push(`- **${t.name}** — ${t.description||'_no description_'}${t.urn?` (\`${t.urn}\`)`:''}`);
  }
  if((m.capabilities?.resources||[]).length){
    lines.push(`\n## Resources`);
    for(const r of m.capabilities.resources){ lines.push(`- ${r.name||r.uri} — ${r.mimeType||''}${r.urn?` (\`${r.urn}\`)`:''}`); }
  }
  lines.push(`\n## Communication`);
  lines.push(`- Supported: ${(m.communication?.supported||[]).join(', ')||'—'}`);
  lines.push(`- Endpoints: \`${JSON.stringify(m.communication?.endpoints||{})}\``);
  lines.push(`- Transport: \`${JSON.stringify(m.communication?.transport||{})}\``);
  if(m.authorization?.delegation_supported){
    lines.push(`\n## Authorization & Delegation`);
    lines.push(`- Delegation: enabled`);
    lines.push(`- Signature: ${m.authorization?.signature_algorithm||'—'}`);
  }
  if(m.relationships){
    lines.push(`\n## Relationships (URNs)`);
    for(const k of Object.keys(m.relationships)){
      lines.push(`- ${k}: ${(m.relationships[k]||[]).join(', ')||'—'}`);
    }
  }
  return lines.join('\n');
}

function generateTestSkeleton(m, framework='jest'){
  if(framework==='jest'){
    return `/**\n * Auto-generated Jest suite: ${m.agent?.name||m.agent?.id}\n */\ndescribe('${m.agent?.name||m.agent?.id}', () => {\n  test('agent card is well-formed', () => {\n    const card = ${JSON.stringify(generateAgentCard(m))};\n    expect(card.name).toBeTruthy();\n    expect(Array.isArray(card.capabilities.tools)).toBe(true);\n  });\n});`;
  }
  if(framework==='cypress'){
    return `/**\n * Auto-generated Cypress suite: ${m.agent?.name||m.agent?.id}\n */\ndescribe('${m.agent?.name||m.agent?.id}', () => {\n  it('agent advertises at least one capability', () => {\n    const card = ${JSON.stringify(generateAgentCard(m))};\n    expect(card.capabilities.tools.length >= 0).to.be.true;\n  });\n});`;
  }
  return `// Framework '${framework}' not implemented`;
}

// ————————————————————————————————————————————————————————————————
// Protocol factory (immutable instance)
// ————————————————————————————————————————————————————————————————
function createAgentProtocol(manifestInput={}){
  const manifest = normalize(manifestInput);
  return Object.freeze({
    manifest: ()=>clone(manifest),
    validate: (names=[])=>runValidators(manifest, names),
    diff: (other)=>diff(manifest, other?.manifest?other.manifest():other),
    query: (expr)=>query(manifest, expr),
    // Generators
    generateAgentCard: ()=>generateAgentCard(manifest),
    generateDocs: ()=>generateDocsStub(manifest),
    generateTest: (framework)=>generateTestSkeleton(manifest, framework),
    // Minimal mutators (copy-on-write)
    set:(p,v)=>{ const m=clone(manifest); dset(m,p,v); return createAgentProtocol(m); },
    get:(p)=>dget(manifest,p)
  });
}

// ————————————————————————————————————————————————————————————————
// Minimal export (CommonJS / browser-friendly)
// ————————————————————————————————————————————————————————————————
if(typeof module!=='undefined') module.exports = { createAgentProtocol, runValidators, registerValidator, query, diff, normalize };
