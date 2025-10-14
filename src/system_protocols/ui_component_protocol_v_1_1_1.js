/*
 * UI/Component Protocol — v1.1.1 (stand‑alone)
 * Minimal, self‑describing component manifest + helpers (React‑first generators; framework‑agnostic shape)
 *
 * Goals
 * - Mirror family ergonomics: manifest + validate + query + diff + generate
 * - Keep it tiny; add essentials only: state/flow sanity, a11y hints, data‑fetching consistency
 * - Zero deps; no external wiring
 */

// ————————————————————————————————————————————————————————————————
// Utilities (tiny, shared style)
// ————————————————————————————————————————————————————————————————
function jsonCanon(value){ if(value===null||typeof value!=='object') return JSON.stringify(value); if(Array.isArray(value)) return '['+value.map(jsonCanon).join(',')+']'; const k=Object.keys(value).sort(); return '{'+k.map(x=>JSON.stringify(x)+':'+jsonCanon(value[x])).join(',')+'}'; }
function dget(obj,path){ if(!path) return obj; const p=String(path).replace(/\[(\d+)\]/g,'.$1').split('.'); let cur=obj; for(const k of p){ if(cur==null) return undefined; cur=cur[k]; } return cur; }
function dset(obj,path,val){ const parts=String(path).split('.'); let cur=obj; while(parts.length>1){ const k=parts.shift(); if(!(k in cur)||typeof cur[k]!=='object') cur[k]={}; cur=cur[k]; } cur[parts[0]]=val; }
const clone = x => JSON.parse(JSON.stringify(x));
function hash(value){ const str=jsonCanon(value); let h=BigInt('0xcbf29ce484222325'); const p=BigInt('0x100000001b3'); for(let i=0;i<str.length;i++){ h^=BigInt(str.charCodeAt(i)); h=(h*p)&BigInt('0xFFFFFFFFFFFFFFFF'); } return 'fnv1a64-'+h.toString(16).padStart(16,'0'); }

// ————————————————————————————————————————————————————————————————
// Manifest shape (informative JSDoc)
// ————————————————————————————————————————————————————————————————
/**
 * @typedef {Object} UIManifest
 * @property {Object} component
 * @property {string} component.id
 * @property {string} component.name
 * @property {'atom'|'molecule'|'organism'|'template'|'page'} [component.type]
 * @property {'react'|'vue'|'svelte'|'web'} [component.framework]
 * @property {string} [component.version]
 * @property {Object} [design]
 * @property {string} [design.figma_url]
 * @property {Object<string,string>} [design.tokens] // e.g., { colorBg:'var(--bg)', radius:'8px' }
 * @property {Object} data
 * @property {Array<{name:string,type:'string'|'number'|'boolean'|'enum'|'object'|'array',required?:boolean,default?:any,description?:string,options?:any[]}>} [data.props]
 * @property {Object} [data.fetching] // optional async behavior
 * @property {string} [data.fetching.endpoint]
 * @property {string} [data.fetching.on_loading_state]
 * @property {string} [data.fetching.on_success_state]
 * @property {string} [data.fetching.on_error_state]
 * @property {Object} behavior
 * @property {Object.<string,{description?:string, associated_props?:string[]}>} behavior.states // e.g., idle/loading/success/error
 * @property {Array<{name:string, steps:Array<{interaction:string,target:string,outcome:string}>}>} [behavior.user_flows]
 * @property {Object} a11y
 * @property {{role?:string, label_prop?:string, describedby_prop?:string, keyboard_support?:('tab'|'enter'|'space'|'esc')[]}} [a11y.contract]
 * @property {Object} [metadata]
 * @property {string} [metadata.owner]
 * @property {string[]} [metadata.tags]
 */

// ————————————————————————————————————————————————————————————————
// Validator registry
// ————————————————————————————————————————————————————————————————
const Validators = new Map();
function registerValidator(name, fn){ Validators.set(name, fn); }
function runValidators(manifest, selected=[]){ const names=selected.length?selected:Array.from(Validators.keys()); const results=names.map(n=>({name:n, ...(Validators.get(n)?.(manifest)||{ok:true})})); return { ok:results.every(r=>r.ok), results }; }

// Helpers
function stateNames(m){ return Object.keys(m?.behavior?.states||{}); }
function propMap(m){ const out=new Map(); for(const p of (m?.data?.props||[])) out.set(p.name,p); return out; }

// Built-ins
registerValidator('core.shape',(m)=>{ const issues=[]; if(!m?.component?.id) issues.push({path:'component.id',msg:'component.id required',level:'error'}); if(!m?.component?.name) issues.push({path:'component.name',msg:'component.name required',level:'error'}); if(!m?.behavior?.states||!Object.keys(m.behavior.states).length) issues.push({path:'behavior.states',msg:'at least one state required',level:'error'}); return { ok:issues.length===0, issues }; });

registerValidator('props.unique_types',(m)=>{ const issues=[]; const seen=new Set(); for(const p of (m?.data?.props||[])){ if(seen.has(p.name)) issues.push({path:`data.props.${p.name}`,msg:'duplicate prop name',level:'error'}); seen.add(p.name); if(!/^(string|number|boolean|enum|object|array)$/.test(p.type)) issues.push({path:`data.props.${p.name}.type`,msg:'invalid prop type',level:'error'}); } return { ok:issues.length===0, issues }; });

registerValidator('fetching.consistency',(m)=>{ const issues=[]; const f=m?.data?.fetching; if(!f) return {ok:true}; const states=new Set(stateNames(m)); for(const k of ['on_loading_state','on_success_state','on_error_state']) if(f[k] && !states.has(f[k])) issues.push({path:`data.fetching.${k}`,msg:`state '${f[k]}' not defined in behavior.states`,level:'error'}); if(!f.endpoint) issues.push({path:'data.fetching.endpoint',msg:'fetch endpoint required when fetching configured',level:'error'}); return { ok:issues.length===0, issues }; });

registerValidator('flows.referential',(m)=>{ const issues=[]; const states=new Set(stateNames(m)); for(const [i,flow] of (m?.behavior?.user_flows||[]).entries()){ for(const [j,step] of (flow.steps||[]).entries()){ if(step.outcome && !states.has(step.outcome)) issues.push({path:`behavior.user_flows[${i}].steps[${j}].outcome`,msg:`outcome '${step.outcome}' not a defined state`,level:'error'}); } } return { ok:issues.length===0, issues }; });

registerValidator('a11y.basic',(m)=>{ const issues=[]; const a=m?.a11y?.contract||{}; const props=propMap(m); if(a.label_prop && !props.has(a.label_prop)) issues.push({path:'a11y.contract.label_prop',msg:`label_prop '${a.label_prop}' not found in data.props`,level:'warn'}); if(a.describedby_prop && !props.has(a.describedby_prop)) issues.push({path:'a11y.contract.describedby_prop',msg:`describedby_prop '${a.describedby_prop}' not found`,level:'warn'}); return { ok:issues.length===0, issues }; });

// ————————————————————————————————————————————————————————————————
// Query language (:=: contains > < >= <=) + conveniences
// ————————————————————————————————————————————————————————————————
function query(manifest, expr){ const [rawPath,op,...rest]=String(expr).split(':'); const rhs=rest.join(':'); if(!rawPath||!op) return false; if(rawPath==='behavior.states'&&op==='contains') return stateNames(manifest).some(s=>s.includes(rhs)); if(rawPath==='data.props'&&op==='contains') return (manifest.data?.props||[]).some(p=>p.name.includes(rhs)); const lhs=dget(manifest,rawPath.replace(/\[(\d+)\]/g,'.$1')); switch(op){ case ':=:': return String(lhs)===rhs; case 'contains': return String(lhs??'').includes(rhs); case '>': return Number(lhs)>Number(rhs); case '<': return Number(lhs)<Number(rhs); case '>=': return Number(lhs)>=Number(rhs); case '<=': return Number(lhs)<=Number(rhs); default: return false; } }

// ————————————————————————————————————————————————————————————————
// Normalize + Diff (structural + heuristics)
// ————————————————————————————————————————————————————————————————
function normalize(m){ const n=clone(m||{}); n.state_hash=hash(n.behavior?.states||{}); n.props_hash=hash(n.data?.props||[]); n.flow_hash=hash(n.behavior?.user_flows||[]); n.fetch_hash=hash(n.data?.fetching||{}); return n; }
function diff(a,b){ const A=normalize(a),B=normalize(b); const changes=[]; (function walk(p,va,vb){ if(JSON.stringify(va)===JSON.stringify(vb)) return; const isObj=v=>v&&typeof v==='object'; if(!isObj(va)||!isObj(vb)){ changes.push({path:p,from:va,to:vb}); return; } const keys=new Set([...Object.keys(va||{}),...Object.keys(vb||{})]); for(const k of keys) walk(p?`${p}.${k}`:k, va?.[k], vb?.[k]); })('',A,B); const breaking=[], significant=[]; for(const c of changes){ if(c.path==='props_hash') breaking.push({...c,reason:'props signature changed'}); if(c.path==='state_hash') significant.push({...c,reason:'states changed'}); if(c.path==='flow_hash') significant.push({...c,reason:'user flows changed'}); if(c.path==='fetch_hash') significant.push({...c,reason:'data fetching changed'}); } return { changes, breaking, significant }; }

// ————————————————————————————————————————————————————————————————
// Generators (React‑first; framework switch is easy to add)
// ————————————————————————————————————————————————————————————————
function renderDefaultValue(p){ if(p.default!==undefined) return ` = ${JSON.stringify(p.default)}`; return ''; }
function generateComponent(manifest,{ framework }={}){
  const fw = framework || manifest.component?.framework || 'react';
  const componentName = String(manifest.component?.name||'Component').replace(/\W+/g,'');
  const props = manifest.data?.props || [];
  const states = stateNames(manifest);
  const startState = states[0] || 'idle';
  const f = manifest.data?.fetching;
  if(fw==='react'){
    return `/**\n * Auto-generated React component: ${manifest.component?.name||'Component'}\n */\nimport React, { useState, useEffect } from 'react';\n\nexport default function ${componentName}({\n  ${props.map(p=>`${p.name}${renderDefaultValue(p)}`).join(',\n  ')}\n}){\n  const [currentState, setCurrentState] = useState('${startState}');\n  ${f?`const [data,setData] = useState(null);\n  const [error,setError] = useState(null);\n  useEffect(()=>{\n    let mounted=true;\n    setCurrentState('${f.on_loading_state||'loading'}');\n    (async()=>{\n      try{\n        const res = await fetch(${JSON.stringify(f.endpoint)});\n        const json = await res.json();\n        if(!mounted) return;\n        setData(json);\n        setCurrentState('${f.on_success_state||startState}');\n      }catch(e){ if(!mounted) return; setError(e); setCurrentState('${f.on_error_state||startState}'); }\n    })();\n    return ()=>{ mounted=false; };\n  },[]);`:''}\n  const classes = \`${componentName.toLowerCase()} state-\${currentState}\`;\n  return (\n    <div className={classes} role={${JSON.stringify(manifest.a11y?.contract?.role||'group')}} aria-label={${manifest.a11y?.contract?.label_prop?`String(${manifest.a11y.contract.label_prop})`:`undefined`}}>\n      {/* TODO: render based on props and state */}\n      {${f?'error && <pre data-testid="error">{String(error)}</pre>':'null'}}\n    </div>\n  );\n}`;
  }
  return `// Generator for framework '${fw}' not implemented.`;
}

function generateStorybook(manifest){ const componentName=String(manifest.component?.name||'Component').replace(/\W+/g,''); const props=manifest.data?.props||[]; return `import ${componentName} from './${componentName}';\nexport default { title: '${manifest.component?.type||'Components'}/${componentName}', component: ${componentName} };\nconst Template = (args) => <${componentName} {...args} />;\nexport const Default = Template.bind({});\nDefault.args = { ${props.filter(p=>p.default!==undefined).map(p=>`${p.name}: ${JSON.stringify(p.default)}`).join(', ')} };\n${Object.entries(manifest.behavior?.states||{}).map(([n,c])=>`export const ${n[0].toUpperCase()+n.slice(1)} = Template.bind({});\n${n[0].toUpperCase()+n.slice(1)}.args = { ...Default.args, /* ${c.description||''} */ };`).join('\n')}`; }

function generateCypressTest(manifest){ const name=manifest.component?.name||'Component'; const flows=manifest.behavior?.user_flows||[]; if(!flows.length) return `// No user flows for ${name}`; return `describe('${name} User Flows',()=>{\n${flows.map(flow=>`  it('${flow.name}',()=>{\n    // cy.visit('/components/${name.toLowerCase()}');\n${(flow.steps||[]).map(s=>`    // cy.get('${s.target}').${s.interaction}(); // expect state → ${s.outcome}`).join('\n')}\n  });`).join('\n')}\n});`; }

// ————————————————————————————————————————————————————————————————
// Design System helper (mini catalog)
// ————————————————————————————————————————————————————————————————
function createDesignSystem(protocols=[]) { const items=protocols; const asManifests=()=>items.map(p=>p.manifest()); function find(expr){ return items.filter(p=>p.match(expr)); } function validateAll(names=[]){ return asManifests().map(m=>({ name:m.component?.name, ...runValidators(m,names) })); } return Object.freeze({ items, find, validateAll }); }

// ————————————————————————————————————————————————————————————————
// Protocol factory
// ————————————————————————————————————————————————————————————————
function createUIProtocol(manifestInput={}){ const manifest=clone(manifestInput); return Object.freeze({ manifest:()=>clone(manifest), validate:(names=[])=>runValidators(manifest,names), match:(expr)=>query(manifest,expr), diff:(other)=>diff(manifest, other?.manifest? other.manifest(): other), generateComponent:(opts)=>generateComponent(manifest,opts), generateStorybook:()=>generateStorybook(manifest), generateCypressTest:()=>generateCypressTest(manifest), set:(path,val)=>{ const m=clone(manifest); dset(m,path,val); return createUIProtocol(m); } }); }

// ————————————————————————————————————————————————————————————————
// Exports
// ————————————————————————————————————————————————————————————————
module.exports = { createUIProtocol, createDesignSystem, registerValidator, Validators };

// ————————————————————————————————————————————————————————————————
// Example (commented)
// ————————————————————————————————————————————————————————————————
/*
const button = createUIProtocol({
  component:{ id:'btn-01', name:'Primary Button', type:'atom', framework:'react', version:'1.1.0' },
  design:{ figma_url:'https://figma.com/file/...', tokens:{ colorBg:'var(--bg-primary)' } },
  data:{ props:[ {name:'label', type:'string', required:true}, {name:'disabled', type:'boolean', default:false} ], fetching:{ endpoint:'/api/demo', on_loading_state:'loading', on_success_state:'success', on_error_state:'error' } },
  behavior:{ states:{ idle:{ description:'Default' }, loading:{}, success:{}, error:{} }, user_flows:[ {name:'Click', steps:[{interaction:'click', target:'button', outcome:'loading'}]} ] },
  a11y:{ contract:{ role:'button', label_prop:'label', keyboard_support:['enter','space'] } },
});

console.log(button.validate());
console.log(button.match('behavior.states:contains:loading'));
console.log(button.generateComponent());
console.log(button.generateStorybook());
console.log(button.generateCypressTest());
*/
