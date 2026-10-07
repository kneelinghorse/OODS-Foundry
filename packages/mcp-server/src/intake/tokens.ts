import path from 'node:path';
import { NAMED_TOKENS_EXTENSION, tokenCss, reservedTokenName, type NamedTokens } from '../lib/named-tokens.js';
import { IntakeFiles } from './files.js';
import { brandTemplate, checkBrand, readBrandTemplate, type BrandDocuments } from '../lib/brand-template.js';
export type TokenIntakeSource={path:string;modes?:Partial<Record<'base'|'dark',string>>};
export type TokenDraftInput={source:TokenIntakeSource;brand_id:string;bindings?:Partial<Record<'base'|'dark',Record<string,string>>>;from?:{brand?:string;preset?:string}};
type Token={path:string;type:string;value:unknown;slot?:string;unsupported?:string};
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const flatten=(node:unknown,trail:string[]=[],inherited=''):Token[]=>!object(node)?[]:'$value' in node?[{path:trail.join('.'),type:node.$type??inherited,value:node.$value,slot:node.$extensions?.[NAMED_TOKENS_EXTENSION]?.slot,...(Object.hasOwn(node,'alpha')?{unsupported:'Source-specific alpha outside $value is unsupported; export standard DTCG color alpha before acceptance.'}:{})}]:Object.entries(node).flatMap(([key,child])=>key.startsWith('$')?[]:flatten(child,[...trail,key],node.$type??inherited));
const get=(root:any,slot:string):any=>slot.split('.').reduce((value,key)=>value?.[key],root);
function set(root:any,slot:string,value:any):void{const parts=slot.split('.');let at=root;for(const part of parts.slice(0,-1))at=at[part]??={};at[parts.at(-1)!]=value;}
export function draftTokens(input:TokenDraftInput) {
  if(!path.isAbsolute(input.source.path))throw new Error('Token source.path must be an absolute local file');
  const files=new IntakeFiles(path.dirname(input.source.path)),file=path.basename(input.source.path),raw=files.json(file);
  const template=brandTemplate(input.from??{}),documents=structuredClone(template.documents),catalogue=readBrandTemplate();
  const tokens=flatten(raw),byPath=new Map(tokens.map(token=>[token.path,token]));
  const inventory:Array<{path:string;theme:string;type:string;variable?:string;status:'preserved'|'unmatched';reason:string;slots:string[]}>=[];
  const evidence:Array<{theme:string;slot:string;source:string|null;grade:'strong'|'medium'|'weak';reason:string}>=[];
  const warnings:string[]=[];
  const resolve=(token:Token,seen=new Set<string>()):{type:string;value:unknown}=>{
    if(token.unsupported)throw new Error(token.unsupported);
    if(seen.has(token.path))throw new Error(`Alias cycle at ${token.path}`);seen.add(token.path);
    const alias=typeof token.value==='string'?/^\{([^{}]+)\}$/.exec(token.value):null;
    if(!alias)return{type:token.type,value:token.value};
    const target=byPath.get(alias[1]);if(!target)throw new Error(`Missing alias ${alias[1]}`);
    const resolved=resolve(target,seen);return{type:token.type||resolved.type,value:resolved.value};
  };
  const declaredModes=input.source.modes??(object(raw.light)&&object(raw.dark)?{base:'light',dark:'dark'}:{});
  for(const theme of ['base','dark'] as const) {
    const prefix=declaredModes[theme];
    const opposite=declaredModes[theme==='base'?'dark':'base'];
    const selected=tokens.filter(token=>prefix?token.path.startsWith(prefix+'.')||!Object.values(declaredModes).some(mode=>token.path.startsWith(mode+'.')):!opposite||!token.path.startsWith(opposite+'.'));
    const metadata:NamedTokens={variables:{},slots:{}};
    const usable=new Map<string,{token:Token;type:string;value:unknown;css:string;variable:string}>();
    for(const token of selected) {
      const relative=prefix&&token.path.startsWith(prefix+'.')?token.path.slice(prefix.length+1):token.path;
      const variable='--'+relative.replace(/\./g,'-');
      try {
        if(reservedTokenName(variable)||!/^--[A-Za-z_][A-Za-z0-9_-]*$/.test(variable))throw new Error('Token name is not a portable CSS custom property; rename or provide a supported export');
        const resolved=resolve(token),css=tokenCss(resolved.type,resolved.value);
        if(Object.hasOwn(metadata.variables,variable))throw new Error(`CSS name collision at ${variable}`);
        metadata.variables[variable]=css;usable.set(token.path,{token,...resolved,css,variable});
        inventory.push({path:token.path,theme,type:resolved.type,variable,status:'preserved',reason:'Typed value preserved as a scoped team custom property; aliases resolve inside this file.',slots:[]});
      }catch(error){inventory.push({path:token.path,theme,type:token.type,status:'unmatched',reason:String(error instanceof Error?error.message:error),slots:[]});}
    }
    for(const slot of catalogue.themes[theme].slots) {
      const explicit=input.bindings?.[theme]?.[slot.slot];
      const declared=[...usable.values()].filter(value=>value.token.slot===slot.slot);
      const existing=get(documents[theme],slot.slot);
      const equal=[...usable.values()].filter(value=>value.type===slot.type&&value.css===tokenCss(existing.$type,existing.$value));
      const selected=explicit?usable.get(explicit):declared.length===1?declared[0]:equal.length===1?equal[0]:undefined;
      if(selected&&selected.type===slot.type) {
        const fixed=catalogue.fixed.find(value=>value.theme===theme&&value.slot===slot.slot);
        if(fixed&&tokenCss(slot.type,fixed.value)!==selected.css){warnings.push(`${theme}.${slot.slot}: fixed slot cannot take ${selected.token.path}`);}
        else {
          set(documents[theme],slot.slot,{$type:slot.type,$value:fixed?.value??selected.css});metadata.slots[slot.slot]=selected.variable;
          inventory.find(entry=>entry.theme===theme&&entry.path===selected.token.path)!.slots.push(slot.slot);
          evidence.push({theme,slot:slot.slot,source:selected.token.path,grade:explicit||declared.length===1?'strong':'medium',reason:explicit?'Explicit caller binding and matching token type.':declared.length===1?'Declared semantic slot extension and matching token type.':'Unique typed value equal to this template slot; names did not decide.'});continue;
        }
      }else if(explicit)warnings.push(`${theme}.${slot.slot}: ${explicit} is missing, unsupported or has the wrong type`);
      evidence.push({theme,slot:slot.slot,source:null,grade:'weak',reason:`No unambiguous typed source for this slot; retained ${input.from?.brand??'A'} template value, explicitly part of whole-brand acceptance.`});
    }
    documents[theme].$extensions={[NAMED_TOKENS_EXTENSION]:metadata};
  }
  for(const token of tokens)if(!inventory.some(entry=>entry.path===token.path))inventory.push({path:token.path,theme:'unselected',type:token.type,status:'unmatched',reason:'Outside selected mode groups',slots:[]});
  for(const slot of catalogue.themes.hc.slots)evidence.push({theme:'hc',slot:slot.slot,source:null,grade:'weak',reason:'High-contrast template retained; source mode intake supports light and dark.'});
  const report=checkBrand({brandId:input.brand_id,documents,requireId:true}).report;
  return {brand_id:input.brand_id,source:input.source,contentHash:files.contentHash(),sources:files.receipts(),documents:documents as BrandDocuments,inventory,evidence,warnings,report,counts:{tokens:inventory.length,preserved:inventory.filter(entry=>entry.status==='preserved').length,unmatched:inventory.filter(entry=>entry.status==='unmatched').length,slots:evidence.length,bound:evidence.filter(entry=>entry.source!==null).length,fallback:evidence.filter(entry=>entry.source===null).length}};
}
