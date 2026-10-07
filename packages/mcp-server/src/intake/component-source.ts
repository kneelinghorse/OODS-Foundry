/** Typed syntax inspection only. Project imports are data, never loaded or evaluated. */
import { parse } from '@babel/parser';
import { parse as parseSfc } from '@vue/compiler-sfc';
import path from 'node:path';
export type SourceProp = { type: string; required: boolean; values?: string[] };
export type SourceComponent = { file:string; export:string; props:Record<string,SourceProp>; elements:string[]; roles:string[]; primitives:string[]; variants:Record<string,string[]>; imports:string[]; unresolvedProps?:string[]; error?:string };
export function syntaxWalk(node: any, visit: (node:any)=>void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key,value] of Object.entries(node)) {
    if (['loc','tokens','comments','extra','parent'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child=>syntaxWalk(child,visit));
    else if (value && typeof value === 'object') syntaxWalk(value,visit);
  }
}
const name = (node:any):string => node?.name ?? node?.value ?? (['JSXMemberExpression', 'TSQualifiedName'].includes(node?.type) ? `${name(node.object ?? node.left)}.${name(node.property ?? node.right)}` : '');
export function inspectComponentSource(file:string, raw:string): SourceComponent[] {
  const vue = file.endsWith('.vue');
  const descriptor = vue ? parseSfc(raw, { filename:file }).descriptor : undefined;
  const code = descriptor ? [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n') : raw;
  const tree = parse(code, { sourceType:'module', plugins:['typescript','jsx'], errorRecovery:false });
  const declarations = new Map<string,any>(), exports = new Map<string,any>(), imports = new Map<string,string>();
  const register = (node:any) => {
    if (node?.type === 'VariableDeclaration') for (const item of node.declarations) { if (item.id?.name) declarations.set(item.id.name,item); }
    else if (node?.id?.name) declarations.set(node.id.name,node);
  };
  for (const node of tree.program.body as any[]) {
    register(node);
    if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) imports.set(specifier.local.name, String(node.source.value));
    if (node.type === 'ExportNamedDeclaration') {
      register(node.declaration);
      if (node.declaration?.type === 'VariableDeclaration') for (const item of node.declaration.declarations) exports.set(name(item.id),item);
      else if (node.declaration?.id?.name) exports.set(node.declaration.id.name,node.declaration);
      for (const specifier of node.specifiers) exports.set(name(specifier.exported),{ ref:name(specifier.local), from:node.source?.value });
    }
    if (node.type === 'ExportDefaultDeclaration') exports.set('default',node.declaration);
  }
  if (vue) { exports.clear(); exports.set('default', tree.program); }
  const results:SourceComponent[]=[];
  for (const [exported, root] of exports) {
    if (!vue && root?.type?.startsWith('TS')) continue;
    if (!vue && !/^[A-Z]/.test(exported) && exported !== 'default') continue;
    const result:SourceComponent={file,export:exported,props:{},elements:[],roles:[],primitives:[],variants:{},unresolvedProps:[],imports:[...new Set(imports.values())].sort()};
    const seen=new Set<any>(), visitedNames=new Set<string>();
    const prop = (node:any) => {
      const key=name(node.key); if (!key) return;
      const annotation=node.typeAnnotation?.typeAnnotation;
      const values=annotation?.type==='TSUnionType' ? annotation.types.flatMap((type:any)=> type.type==='TSLiteralType' ? [String(type.literal.value)] : []) : undefined;
      result.props[key]={type:annotation?.type ?? 'unknown',required:!node.optional,...(values?.length ? {values}: {})};
    };
    const follow=(node:any) => {
      if (!node || seen.has(node)) return; seen.add(node);
      if (node.ref && declarations.has(node.ref)) follow(declarations.get(node.ref));
      syntaxWalk(node, item=>{
        if (['Identifier','JSXIdentifier','TSTypeReference'].includes(item.type)) {
          const id=name(item.typeName ?? item);
          if (!visitedNames.has(id) && declarations.has(id)) {visitedNames.add(id);follow(declarations.get(id));}
        }
        if(item.type==='VariableDeclarator' && item.init?.type==='ConditionalExpression') for(const branch of [item.init.consequent,item.init.alternate]) if(branch.type==='StringLiteral')result.elements.push(branch.value);
        if (item.type==='TSPropertySignature' || item.type==='TSMethodSignature') prop(item);
        if (item.type==='JSXOpeningElement') {
          const tag=name(item.name); result.elements.push(tag);
          const imported=imports.get(tag.split('.')[0]); if(imported) result.primitives.push(`${imported}:${tag}`);
          for (const attr of item.attributes) if(name(attr.name)==='role' && attr.value?.value) result.roles.push(attr.value.value);
        }
        if (item.type==='ObjectProperty' && name(item.key)==='variants' && item.value.type==='ObjectExpression') {
          for (const variant of item.value.properties) if(variant.value?.type==='ObjectExpression') result.variants[name(variant.key)]=variant.value.properties.map((p:any)=>name(p.key)).filter(Boolean).sort();
        }
        if(item.type==='TSTypeReference' && !declarations.has(name(item.typeName)) && !/(?:HTMLAttributes|ComponentProps)/.test(name(item.typeName)))result.unresolvedProps!.push(`Imported or generic type ${name(item.typeName)} is not expanded by the file-only reader`);
        if(item.type==='TSTypeReference' && /(?:HTMLAttributes|ComponentProps)/.test(name(item.typeName))) {
          const literal=(item.typeParameters ?? item.typeArguments)?.params?.find((p:any)=>p.type==='TSLiteralType')?.literal?.value;
          if(literal) result.elements.push(String(literal));
          result.unresolvedProps!.push(`Inherited native props from ${name(item.typeName)}${literal?`<${literal}>`:''}`);
        }
      });
    };
    follow(root);
    if (descriptor?.template?.ast) syntaxWalk(descriptor.template.ast, item=>{
      if(typeof item.tag==='string') {
        result.elements.push(item.tag);
        const imported=imports.get(item.tag); if(imported)result.primitives.push(`${imported}:${item.tag}`);
        for(const attr of item.props ?? [])if(attr.name==='role' && attr.value?.content)result.roles.push(attr.value.content);
      }
    });
    for(const [key,values] of Object.entries(result.variants)) result.props[key]??={type:'variant',required:false,values};
    result.unresolvedProps=[...new Set(result.unresolvedProps)].sort();
    for(const key of ['elements','roles','primitives'] as const) result[key]=[...new Set(result[key])].sort();
    // A re-export carries no invented structure. Inventory keeps it so the reader can report it explicitly.
    if (!result.elements.length && root.from) result.error=`Re-export from ${root.from}; inspect the defining component for structural evidence.`;
    if(result.elements.length || result.error || Object.keys(result.props).length)results.push(result);
  }
  if(!results.length)results.push({file,export:path.basename(file).replace(/\.[^.]+$/,''),props:{},elements:[],roles:[],primitives:[],variants:{},imports:[],error:'No statically inspectable component export; types, helpers and re-exports alone do not prove a component.'});
  return results;
}
