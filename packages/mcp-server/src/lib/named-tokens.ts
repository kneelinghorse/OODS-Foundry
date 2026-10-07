import Color from 'colorjs.io';
export const NAMED_TOKENS_EXTENSION='org.oods.intake';
export const reservedTokenName=(name:string)=>/^--(?:theme-|oods-|cmp-|sys-|ref-|color-brand-|radius-brand-|font-brand-|viz-)/.test(name);
export type NamedTokens={variables:Record<string,string>;slots:Record<string,string>};
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const get=(root:any,slot:string):any=>slot.split('.').reduce((value,key)=>value?.[key],root);
export function tokenCss(type:string,value:any):string {
  if(type==='color'){
    const color=typeof value==='string'?new Color(value):object(value)&&Array.isArray(value.components)?new Color(value.colorSpace==='display-p3'?'p3':value.colorSpace,value.components.map((n:any)=>n==='none'?NaN:Number(n)) as [number,number,number],value.alpha??1):null;
    if(!color)throw new Error('Invalid color');return color.toString({precision:8});
  }
  if(type==='dimension'||type==='duration'){
    if(object(value)&&Number.isFinite(value.value)&&['px','rem','ms','s'].includes(value.unit))return `${value.value}${value.unit}`;
    if(typeof value==='string'&&/^-?(?:\d+(?:\.\d+)?|\.\d+)(px|rem|ms|s)$/.test(value))return value;
  }
  if(['number','fontWeight'].includes(type)&&typeof value==='number'&&Number.isFinite(value))return String(value);
  if(type==='fontFamily'){
    const values=Array.isArray(value)?value:typeof value==='string'?value.split(',').map(part=>part.trim().replace(/^["']|["']$/g,'')):[value];
    if(values.length && values.every(item=>typeof item==='string'&&/^[\w ,'-]+$/.test(item)))return values.map(item=>/^[\w-]+$/.test(item)?item:JSON.stringify(item)).join(', ');
  }
  if(type==='cubicBezier'&&Array.isArray(value)&&value.length===4&&value.every(Number.isFinite))return `cubic-bezier(${value.join(', ')})`;
  throw new Error(`Unsupported or invalid ${type||'untyped'} token value; no CSS emitted`);
}
/** Metadata can never bypass slot validation or inject CSS. The stored slot literal remains the grading input. */
export function namedTokens(document:unknown):NamedTokens|undefined {
  if(!object(document))return undefined;
  const value=document.$extensions?.[NAMED_TOKENS_EXTENSION];if(value===undefined)return undefined;
  if(!object(value)||!object(value.variables)||!object(value.slots))throw new Error('Named-token metadata needs variables and slots maps');
  for(const [variable,css] of Object.entries(value.variables))if(reservedTokenName(variable)||!/^--[A-Za-z_][A-Za-z0-9_-]*$/.test(variable)||typeof css!=='string'||/[;{}<>\n\r\\]/.test(css)||/url\s*\(|var\s*\(|!important/i.test(css))throw new Error(`Unsafe named token ${variable}`);
  for(const [slot,variable] of Object.entries(value.slots)) {
    const token=get(document,slot);
    if(typeof variable!=='string'||!Object.hasOwn(value.variables,variable)||!object(token)||!('$value' in token))throw new Error(`Named token refers to missing slot ${slot}`);
    if(tokenCss(token.$type,token.$value)!==value.variables[variable])throw new Error(`Named token ${variable} differs from validated slot ${slot}`);
  }
  return value as NamedTokens;
}
