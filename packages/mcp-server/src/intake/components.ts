import fs from 'node:fs';
import { parse } from '@babel/parser';
import { parse as parseSfc } from '@vue/compiler-sfc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentContracts } from '@oods/component-contracts';
import { canonical, hash } from '../importer/source.js';
import { IntakeFiles, intakePaths, intakeAlias, intakeModule } from './files.js';
import { inspectComponentSource, type SourceComponent } from './component-source.js';
import type { MapCreateInput } from '../tools/types.js';
export type ComponentIntakeSource = { project:string; format:'shadcn'|'storybook'; storybook?:string };
export type IntakeEvidence = { grade:'strong'|'medium'|'weak'; reason:string; source:string };
export type PlannedFile = { path:string; contents:string; previousSha256:string|null };
export type ComponentProposal = { id:string; mapping:MapCreateInput; evidence:IntakeEvidence[]; files:PlannedFile[]; sourceComponents:string[]; translations:Record<string,unknown>; limitations:string[] };
export type InventoryEntry = { kind:'component'|'prop'|'story'; id:string; status:'proposed'|'unmatched'; proposals:string[]; reason:string };
export type ComponentDraft = { source:ComponentIntakeSource; contentHash:string; sources:ReturnType<IntakeFiles['receipts']>; proposals:ComponentProposal[]; inventory:InventoryEntry[]; counts:Record<string,{total:number;proposed:number;unmatched:number}>; warnings:string[] };
const key=(component:SourceComponent)=>`${component.file}#${component.export}`;
const registryFile=()=>{const dir=path.dirname(fileURLToPath(import.meta.url)); const built=path.resolve(dir,'../registry/shadcn-adapters.json');return fs.existsSync(built)?built:path.resolve(dir,'../../registry/shadcn-adapters.json');};
const contracts=Object.values(componentContracts);
const propTypes=()=>JSON.parse(fs.readFileSync(path.join(path.dirname(registryFile()),'component-prop-types.v1.json'),'utf8')).components;
function incompatible(type:string, expected:string):boolean {
  const primitive=({TSBooleanKeyword:'boolean',TSNumberKeyword:'number',TSStringKeyword:'string'} as Record<string,string>)[type];
  if(!primitive || !/^(?:string|number|boolean)(?:$|[ |])/.test(expected))return false;
  return !expected.split(/\s*\|\s*/).includes(primitive);
}
export function draftComponents(source:ComponentIntakeSource, externalSystem='team'):ComponentDraft {
  const files=new IntakeFiles(source.project), paths=intakePaths(files);
  const manifest=files.has('package.json')?files.json('package.json'):{};
  const proposals:ComponentProposal[]=[], inventory:InventoryEntry[]=[], components:SourceComponent[]=[], warnings:string[]=[];
  const inspected=new Set<string>();
  const inspect=(file:string)=>{
    if(inspected.has(file))return; inspected.add(file);
    try{components.push(...inspectComponentSource(file,files.read(file)));}
    catch(error){components.push({file,export:'(unparsed)',props:{},elements:[],roles:[],primitives:[],variants:{},imports:[],error:String(error instanceof Error?error.message:error)});}
  };
  const add=(proposal:Omit<ComponentProposal,'id'>)=>{const result={...proposal,id:`mapping-${hash(canonical(proposal)).slice(0,24)}`};proposals.push(result);return result;};
  if(source.format==='shadcn') {
    const config=files.json('components.json'), alias=config.aliases?.ui;
    const framework=/shadcn-vue/.test(config.$schema??'') || typeof config.typescript==='boolean' ? 'vue':'react';
    if(typeof alias!=='string')throw new Error('components.json must declare aliases.ui');
    if(framework==='react' && (config.tsx!==true || !/^(?:base-|radix-|new-york$|default$)/.test(config.style??'')))throw new Error('React intake supports tsx:true with Radix or Base UI styles; React Aria adapters are not supported.');
    const folder=intakeAlias(paths,alias); if(!folder)throw new Error(`No project-relative TypeScript path resolves ${alias}; generated Nuxt paths must be present inside the supplied folder.`);
    for(const file of files.scan(folder))inspect(file);
    const catalog=JSON.parse(fs.readFileSync(registryFile(),'utf8'))[framework]??[];
    if(!catalog.length)warnings.push(`${framework} adapters are not present in this runtime.`);
    for(const item of catalog) {
      const used:SourceComponent[]=[], evidence:IntakeEvidence[]=[], missing:string[]=[];
      for(const dependency of item.registryDependencies as string[]) {
        const target=intakeAlias(paths,`${alias}/${dependency}`);
        let module:string;
        try {module=intakeModule(files,target!);inspect(module);}catch{missing.push(dependency);continue;}
        // A directory index may re-export SFCs or TSX; inventory every defining file in that directory.
        const candidates=components.filter(component=>component.file===module || component.file.startsWith(module.replace(/\/index\.[^/]+$/,'')+'/'));
        const adapterSource = framework === 'vue' ? parseSfc(item.files[0].content).descriptor.script!.content : item.files[0].content;
        const imported=parse(adapterSource,{sourceType:'module',plugins:['typescript','jsx']}).program.body.filter((node:any)=>node.type==='ImportDeclaration' && node.source.value.endsWith('/ui/'+dependency)).flatMap((node:any)=>node.specifiers.map((part:any)=>part.imported?.name??(part.type==='ImportDefaultSpecifier'?'default':null))).filter(Boolean);
        if(imported.some((name:string)=>!candidates.some(candidate=>candidate.export===name))){missing.push(`${dependency} (missing required named exports: ${imported.filter((name:string)=>!candidates.some(candidate=>candidate.export===name)).join(', ')})`);continue;}
        const structural=candidates.filter(component=>!component.error && (component.primitives.some(primitive=>/@radix-ui|radix-ui|@base-ui|reka-ui/.test(primitive)) || component.elements.some(element=>/^(button|input|textarea|label|div|span|nav|h[1-6])$/.test(element)) && (Object.keys(component.props).length>=2 || Object.keys(component.variants).length>0 || component.unresolvedProps?.some(entry=>entry.startsWith('Inherited native props')))));
        if(!structural.length){missing.push(`${dependency} (no typed native or primitive structure)`);continue;}
        used.push(...structural);
        evidence.push({grade:'medium',source:module,reason:`${dependency}: typed native elements or Radix/Base UI/Reka primitives; adapter supplies the OODS ${item.component} contract. This is structural evidence, not behavioral certification.`});
      }
      if(missing.length){warnings.push(`${item.component}: unavailable adapter prerequisites: ${missing.join(', ')}`);continue;}
      const component=contracts.find(contract=>contract.id===item.component);if(!component)throw new Error(`Adapter target ${item.component} is not shipped`);
      const suffix=framework==='vue'?'.vue':'.tsx', slug=item.name.replace(/^oods-/,''), module=`${config.aliases.components??alias.replace(/\/ui$/,'')}/oods/${slug}`;
      const target=intakeAlias(paths,module);if(!target)throw new Error(`No paths alias resolves planned adapter ${module}`);
      const content=item.files[0].content.replaceAll('@/registry/new-york-v4/ui/',`${alias}/`).replaceAll('@/components/ui/',`${alias}/`);
      const destination=target+suffix;
      files.absolute(destination,false);
      const previous=files.has(destination)?files.read(destination):null;
      if(previous!==null && previous!==content){warnings.push(`${item.component}: ${destination} already contains a different adapter; explicit manual review is required, so no overwrite is proposed.`);continue;}
      add({mapping:{externalSystem,externalComponent:`Oods${item.component}`,oodsTraits:[],substitution:{component:item.component,[framework]:{shadcn:{project:files.root,module:framework==='vue'?module+'.vue':module},export:framework==='vue'?'default':`Oods${item.component}`}}},evidence,files:[{path:destination,contents:content,previousSha256:previous===null?null:hash(previous)}],sourceComponents:[...new Set(used.map(key))].sort(),translations:item.component==='Button'?{intent:{name:'variant',values:{primary:'default',secondary:'secondary',danger:'destructive'}},onActivate:{name:'onClick'},via:'shipped adapter'}:{via:`shipped ${item.component} adapter; OODS props retain their names at the mapping boundary`},limitations:[item.description]});
    }
  } else {
    const directory=source.storybook??'.';
    const index=files.json(path.posix.join(directory,'index.json'));
    const manifestPath=path.posix.join(directory,'manifests/components.json');
    const componentManifest=files.has(manifestPath)?files.json(manifestPath):null;
    const entries=Object.values(componentManifest?.components??{}) as any[];
    for(let i=0;i<entries.length;i++)for(const [name,child] of Object.entries(entries[i].subcomponents??{}))entries.push({id:`${entries[i].id}/${name}`,name,...(child as object)});
    if(componentManifest && !componentManifest.components)warnings.push('Unsupported component manifest shape: missing components map; index inventory retained.');
    const typed=propTypes();
    for(const entry of entries) {
      const docgen=entry.reactDocgen??entry.vueDocgen??entry.component;
      const declared=docgen?.definedInFile??docgen?.filePath??entry.component?.path;
      inventory.push({kind:'component',id:`manifest:${entry.id??entry.name??'(unknown)'}`,status:'unmatched',proposals:[],reason:'Manifest entry retained; source structure and export must be verified before mapping.'});
      for(const prop of Object.keys(docgen?.props??{}))inventory.push({kind:'prop',id:`manifest:${entry.id??entry.name}.${prop}`,status:'unmatched',proposals:[],reason:'Manifest prop retained; declaration alone does not prove rendered behavior.'});
      if(typeof declared==='string') {
        try{inspect(intakeModule(files,path.isAbsolute(declared)?path.relative(files.root,declared):declared));}
        catch(error){warnings.push(`${entry.id??entry.name}: ${String(error instanceof Error?error.message:error)}`);}
      }
      // Docgen props are evidence but cannot prove an element or role on their own.
      if(!declared)warnings.push(`${entry.id??entry.name}: manifest has no local defining source; inventory only.`);
    }
    for(const entry of Object.values(index.entries??index.stories??{}) as any[]) {
      if(!entry || typeof entry!=='object')continue;
      inventory.push({kind:'story',id:String(entry.id??entry.title??entry.importPath),status:'unmatched',proposals:[],reason:componentManifest?'Story retained; linking to a structurally matched defining source requires its manifest entry.':'No component manifest; story names alone do not establish a component contract.'});
    }
    for(const entry of entries)for(const story of entry.stories??[])if(!inventory.some(item=>item.kind==='story'&&item.id===story.id))inventory.push({kind:'story',id:String(story.id??`${entry.id}/${story.name}`),status:'unmatched',proposals:[],reason:'Manifest story retained; no structural mapping established yet.'});
    for(const sourceComponent of components) {
      if(sourceComponent.error)continue;
      const matches=contracts.map(contract=>{
        const shared=contract.props.filter(prop=>Object.hasOwn(sourceComponent.props,prop));
        const required=(contract.requiredProps??[]).every(prop=>Object.hasOwn(sourceComponent.props,prop));
        const conflicting=shared.some(prop=>incompatible(sourceComponent.props[prop].type,typed[contract.id]?.[sourceComponent.file.endsWith('.vue')?'vue':'react']?.[prop]?.type??''));
        const structural=!conflicting && sourceComponent.elements.length>0 && shared.length>=Math.max(3,Math.ceil(contract.props.length*.65)) && required;
        return {contract,shared,structural};
      }).filter(match=>match.structural);
      if(matches.length!==1)continue;
      const {contract,shared}=matches[0];
      if(typeof manifest.name!=='string'||typeof manifest.version!=='string') {warnings.push(`${key(sourceComponent)}: matching structure but package.json lacks a package name and exact version for registration.`);continue;}
      const props=Object.fromEntries(shared.map(prop=>[prop,{name:prop}]));
      const proposal=add({mapping:{externalSystem,externalComponent:sourceComponent.export,oodsTraits:[],substitution:{component:contract.id,[sourceComponent.file.endsWith('.vue')?'vue':'react']:{package:manifest.name,version:manifest.version,localPath:files.root,export:sourceComponent.export,passthrough:false,props}}},evidence:[{grade:'medium',source:key(sourceComponent),reason:`Unique shipped contract with required props and ${shared.length} typed prop matches plus rendered elements ${sourceComponent.elements.join(', ')}. Package exports are checked at apply.`}],files:[],sourceComponents:[key(sourceComponent)],translations:props,limitations:['Static matching does not prove runtime behavior; inspect the existing component contract report after generation.']});
      for(const entry of inventory) {
        const doc=entries.find(value=>value.id===entry.id || entry.id===`manifest:${value.id}` || entry.id.startsWith(`manifest:${value.id}.`) || value.stories?.some((story:any)=>story.id===entry.id));
        if(doc && [doc.reactDocgen?.definedInFile,doc.vueDocgen?.filePath,doc.component?.definedInFile,doc.component?.path].some(file=>typeof file==='string' && path.resolve(files.root,file)===path.resolve(files.root,sourceComponent.file))){entry.status='proposed';entry.proposals.push(proposal.id);entry.reason='Manifest links this story to a structurally proposed component.';}
      }
    }
  }
  for(const component of components) {
    const related=proposals.filter(proposal=>proposal.sourceComponents.includes(key(component))), ids=related.map(proposal=>proposal.id);
    inventory.push({kind:'component',id:key(component),status:ids.length?'proposed':'unmatched',proposals:ids,reason:ids.length?'Used by a structurally supported mapping proposal.':component.error??'No unique supported shipped contract or adapter prerequisites; a name alone is insufficient.'});
    for(const [index,reason] of (component.unresolvedProps??[]).entries())inventory.push({kind:'prop',id:`${key(component)}.*${index}`,status:'unmatched',proposals:[],reason:`${reason}; the unresolved prop group is retained rather than inventing individual props.`});
    for(const prop of Object.keys(component.props).sort()) {
      const translated=related.filter(proposal=>Object.hasOwn(proposal.mapping.substitution?.react?.props??proposal.mapping.substitution?.vue?.props??{},prop) || proposal.files.length>0 && proposal.files.some(file=>new RegExp(file.path.endsWith('.vue') ? `(?:[,{]\\s*)${prop}\\s*:` : `(?:[<\\s])${prop}\\s*=`).test(file.contents)));
      inventory.push({kind:'prop',id:`${key(component)}.${prop}`,status:translated.length?'proposed':'unmatched',proposals:translated.map(proposal=>proposal.id),reason:translated.length?'Prop appears in the reviewed translation or adapter; its supported behavior is described in proposal limitations.':'No safe translation into the shipped contract; left unchanged on the team component.'});
    }
  }
  const counts=Object.fromEntries(['component','prop','story'].map(kind=>{const entries=inventory.filter(entry=>entry.kind===kind);return[kind,{total:entries.length,proposed:entries.filter(entry=>entry.status==='proposed').length,unmatched:entries.filter(entry=>entry.status==='unmatched').length}];}));
  return {source:{...source,project:files.root},contentHash:files.contentHash(),sources:files.receipts(),proposals,inventory,counts,warnings};
}
