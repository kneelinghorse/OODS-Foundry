/*
 * Semantic Protocol — v3.2.0 (Final)
 * A synthesis of v3.1.0's suite ergonomics and v3.0.0's analytical engine.
 *
 * - Maintains suite-native structure: factory, validators, query, diff, docs.
 * - Re-introduces self-enriching manifests: automated calculation of intent,
 * criticality, confidence, and semantic vectors if not provided.
 * - Re-introduces rich protocol bindings (`requires`/`provides`) for deeper validation.
 * - Re-introduces the `createSemanticCatalog` for powerful system-wide analysis.
 */

// ————————————————————————————————————————————————————————————————
// Tiny shared utils (zero deps)
// ————————————————————————————————————————————————————————————————
const clone = x => JSON.parse(JSON.stringify(x));
function jsonCanon(v){ if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(jsonCanon).join(',')+']';
  const k=Object.keys(v).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(v[x])).join(',')+'}'; }
function hash(value){ const s=jsonCanon(value); let h=BigInt('0xcbf29ce484222325'), p=BigInt('0x100000001b3');
  for(let i=0;i<s.length;i++){ h^=BigInt(s.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }
function dget(o,p){ if(!p) return o; const parts=String(p).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=o; for(const k of parts){ if(cur==null) return; cur=cur[k]; } return cur; }
function dset(o,p,v){ const parts=String(p).split('.'); let cur=o; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=v; }
const isURN = s => typeof s==='string' && /^urn:proto:(api|api\.endpoint|data|event|ui|workflow|infra|device|ai|iam|metric|integration|testing|docs|obs|config|release|agent|semantic):[A-Za-z0-9_.\/-]+(@[\d.]+)?(#[^#\s]+)?$/.test(s);

// ————————————————————————————————————————————————————————————————
// Core: SemanticProtocolV32 — Analytical Engine + Suite Ergonomics
// ————————————————————————————————————————————————————————————————
class SemanticProtocolV32 {
  /**
   * Create a self-enriching semantic manifest.
   */
  createManifest(input={}){
    const m = clone(input);

    // 1. Standardize Identity & Governance (from v3.1.0)
    m.version = '3.2.0';
    if(!m.urn) m.urn = `urn:proto:semantic:${m.id || 'component'}@${m.version}`;
    m.governance = { piiHandling: false, businessImpact: 5, userVisibility: 0.5, ...m.governance };

    // 2. Self-Enrichment Engine (from v3.0.0)
    m.element = m.element || {};
    m.element.intent = m.element.intent || this._resolveIntent(m);
    m.element.criticality = m.element.criticality || this._calculateCriticality(m);

    m.semantics = m.semantics || {};
    m.semantics.precision = m.semantics.precision || {};
    m.semantics.precision.confidence = m.semantics.precision.confidence || this._calculateConfidence(m);
    
    m.semantics.features = m.semantics.features || {};
    m.semantics.features.vector = m.semantics.features.vector || this._generateSemanticVector(m);

    // 3. Rich Protocol Bindings (from v3.0.0, enhanced)
    m.context = m.context || {};
    m.context.protocolBindings = this._normalizeBindings(m.context.protocolBindings);
    
    // 4. Precompute Signature for efficient diffing (from v3.1.0)
    m.__sig = this.signature(m);
    return m;
  }

  /**
   * Deterministic signature for semantic diffing.
   */
  signature(m){
    const sig = {
      urn: m?.urn,
      element: { type: m?.element?.type, role: m?.element?.role, intent: m?.element?.intent, criticality: m?.element?.criticality },
      bindings: m?.context?.protocolBindings||{}, // Include rich bindings in signature
      governance: m?.governance||{}
    };
    return { hash: hash(sig), shape: sig };
  }

  // ——————————————————————————————————————————
  // Analytical Helpers (from v3.0.0)
  // ——————————————————————————————————————————
  _resolveIntent(m) {
    const purpose = (m.semantics?.purpose || '').toLowerCase();
    if (['create', 'add', 'submit'].some(k => purpose.includes(k))) return 'Create';
    if (['read', 'get', 'view', 'display'].some(k => purpose.includes(k))) return 'Read';
    if (['update', 'edit', 'save'].some(k => purpose.includes(k))) return 'Update';
    if (['delete', 'remove'].some(k => purpose.includes(k))) return 'Delete';
    if (['execute', 'trigger'].some(k => purpose.includes(k))) return 'Execute';
    return 'Generic';
  }

  _calculateCriticality(m) {
    const gov = m.governance || {};
    const impact = gov.businessImpact || 5;
    const visibility = gov.userVisibility || 0.5;
    const pii = gov.piiHandling ? 1.0 : 0.0;
    const blastRadius = Math.log1p((m.relationships?.dependents || []).length);
    const score = (impact * 0.4) + (visibility * 0.2) + (pii * 0.3) + (blastRadius * 0.1);
    return Math.round(Math.min(10, score)) / 10;
  }

  _calculateConfidence(m) {
    let logOdds = Math.log(0.4 / 0.6); // Prior
    const evidence = [
      { 'isPresent': !!m.semantics?.purpose, 'likelihood': 1.5 },
      { 'isPresent': !!m.context?.domain, 'likelihood': 1.2 },
      { 'isPresent': !!m.context?.flow && !!m.context?.step, 'likelihood': 1.3 },
      { 'isPresent': !!m.governance?.owner, 'likelihood': 1.1 },
    ];
    for (const item of evidence) if (item.isPresent) logOdds += Math.log(item.likelihood);
    return 1 / (1 + Math.exp(-logOdds));
  }
  
  _generateSemanticVector(m) {
    // In production, this would call an NLP service.
    // This simulation provides a deterministic vector for catalog features.
    const text = `${m.element?.type} ${m.semantics?.purpose} ${m.metadata?.description || ''}`.toLowerCase();
    const tokens = text.match(/\b(\w+)\b/g) || [];
    const vector = new Array(64).fill(0.0);
    if (tokens.length === 0) return vector;
    const bucketFor = (token) => {
      const hashed = hash(token);
      const hex = (hashed.split('-')[1] || hashed).replace(/[^0-9a-f]/gi, '');
      try {
        const value = BigInt(`0x${hex || '0'}`);
        return Number(value % 64n);
      } catch {
        return Math.abs(token.length % 64);
      }
    };
    for (const token of tokens) {
      const bucket = bucketFor(token);
      vector[bucket] = (vector[bucket] || 0) + 1.0;
    }
    const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? vector.map(v => v / mag) : vector;
  }
  
  _normalizeBindings(bindings = {}) {
    const norm = {};
    const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
    for (const key of ['api', 'event', 'workflow', 'data']) {
        const entries = bindings[key];
        const list = Array.isArray(entries) ? entries : (entries ? [entries] : []);
        norm[key] = list.map(b => ({
            urn: b?.urn,
            purpose: b?.purpose || undefined,
            requires: asArray(b?.requires),
            provides: asArray(b?.provides)
        }));
    }
    return norm;
  }

  // ——————————————————————————————————————————
  // Suite-Native Tooling (from v3.1.0)
  // ——————————————————————————————————————————
  constructor(){ this._validators = new Map(); this._registerBuiltIns(); }
  registerValidator(name, fn){ this._validators.set(name, fn); }
  validate(m, names=[]) { /* ... as in v3.1.0 ... */ const v = this._validators; const sel = names.length?names:Array.from(v.keys()); const res = sel.map(n=>({name:n,...(v.get(n)?.(m)||{ok:true})})); return {ok:res.every(r=>r.ok),results:res}; }
  query(m, expr){ /* ... as in v3.1.0 ... */ const [p,o,...r]=String(expr).split(':');const rhs=r.join(':'),lhs=dget(m,p.replace(/\[(\d+)\]/g,'.$1'));switch(o){case'contains':return JSON.stringify(lhs??'').includes(rhs);case'=':return String(lhs)===rhs;case'>':return Number(lhs)>Number(rhs);case'<':return Number(lhs)<Number(rhs);default:return false;} }
  diff(a, b){ /* ... as in v3.1.0 ... */ const sa=a?.__sig||this.signature(a),sb=b?.__sig||this.signature(b);if(sa.hash===sb.hash)return{changes:[],breaking:[],significant:[]};const changes=[{path:'*',from:sa.shape,to:sb.shape}],significant=[];if(jsonCanon(sa.shape.bindings)!==jsonCanon(sb.shape.bindings))significant.push({path:'bindings',reason:'Protocol bindings changed'});if(sa.shape.element?.intent!==sb.shape.element?.intent)significant.push({path:'element.intent',reason:'Intent changed'});return{changes,breaking:[],significant};}
  
  _registerBuiltIns(){
    this.registerValidator('core.shape', m=>{ const i=[];if(!isURN(m?.urn))i.push({p:'urn',msg:'required'});if(!m?.element?.type)i.push({p:'element.type',msg:'required'});return{ok:i.length==0,issues:i}; });
    this.registerValidator('bindings.urns', m=>{ const i=[],p=m?.context?.protocolBindings||{};for(const k of Object.keys(p)){for(const[idx,x]of(p[k]||[]).entries())if(!isURN(x.urn))i.push({p:`bindings.${k}[${idx}]`,msg:'invalid URN'});}return{ok:i.length==0,issues:i}; });
    this.registerValidator('bindings.contracts', m=>{ const i=[],p=m?.context?.protocolBindings||{};for(const k of Object.keys(p)){for(const[idx,x]of(p[k]||[]).entries()){const req=Array.isArray(x?.requires)?x.requires:[];const prov=Array.isArray(x?.provides)?x.provides:[];req.forEach((urn,ri)=>{if(!isURN(urn))i.push({p:`bindings.${k}[${idx}].requires[${ri}]`,msg:'invalid URN'});});prov.forEach((urn,pi)=>{if(!isURN(urn))i.push({p:`bindings.${k}[${idx}].provides[${pi}]`,msg:'invalid URN'});});}}return{ok:i.length==0,issues:i}; });
  }

  generateDocs(m){
    const lines=[], pb=m?.context?.protocolBindings||{}, G=m?.governance||{};
    lines.push(`# ${m.urn}`);
    lines.push(`**Element**: type=\`${m.element?.type}\`, intent=\`${m.element?.intent}\`, criticality=\`${m.element?.criticality}\``);
    lines.push(`\n## Governance\n- Owner: ${G.owner||'—'}\n- PII Handling: ${G.piiHandling}`);
    lines.push(`\n## Protocol Bindings`);
    const bindingKeys = Object.keys(pb).filter(k => pb[k].length > 0);
    if(bindingKeys.length === 0) lines.push('- (none)');
    for(const k of bindingKeys){ for(const x of pb[k]) lines.push(`- **${k.toUpperCase()}**: ${x.urn}${x.purpose?` (_${x.purpose}_)`:''}`); }
    return lines.join('\n');
  }
}

// ————————————————————————————————————————————————————————————————
// Factory + Catalog (Suite-Style)
// ————————————————————————————————————————————————————————————————
function createSemanticProtocol(manifestInput={}){
  const sp = new SemanticProtocolV32();
  const manifest = sp.createManifest(manifestInput);
  return Object.freeze({
    manifest: ()=>clone(manifest),
    validate: (names)=>sp.validate(manifest, names),
    query: (expr)=>sp.query(manifest, expr),
    diff: (other)=>sp.diff(manifest, other?.manifest?other.manifest():other),
    generateDocs: ()=>sp.generateDocs(manifest),
    set:(p,v)=>{ const m=clone(manifest); dset(m,p,v); return createSemanticProtocol(m); },
  });
}

function createSemanticCatalog(protocols = []) {
  const items = protocols.map(p => p.manifest());
  const _cosineSimilarity = (vA, vB) => { const dot=vA.reduce((s,a,i)=>s+a*vB[i],0),magA=Math.sqrt(vA.reduce((s,a)=>s+a*a,0)),magB=Math.sqrt(vB.reduce((s,b)=>s+b*b,0)); return (magA===0||magB===0)?0:dot/(magA*magB); };

  return Object.freeze({
    items: () => clone(items),
    find: (predicate) => items.filter(predicate),

    discoverRelationships: (threshold = 0.85) => {
      const suggestions = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const sim = _cosineSimilarity(items[i].semantics.features.vector, items[j].semantics.features.vector);
          if (sim >= threshold) suggestions.push({ from: items[i].urn, to: items[j].urn, similarity: sim });
        }
      }
      return suggestions;
    },
    // crossValidate, getSystemAccuracy, etc. could be added here
  });
}

if(typeof module!=='undefined') module.exports = { createSemanticProtocol, createSemanticCatalog };
