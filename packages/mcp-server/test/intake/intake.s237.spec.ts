import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { draftComponents } from '../../src/intake/components.js';
import { inspectComponentSource } from '../../src/intake/component-source.js';
import { handle as map } from '../../src/tools/map.js';
import { handle as brand } from '../../src/tools/brand.intake.js';
import { draftTokens } from '../../src/intake/tokens.js';
import { checkBrand, brandDocumentsFromFiles } from '../../src/lib/brand-template.js';
import { NAMED_TOKENS_EXTENSION, namedTokens } from '../../src/lib/named-tokens.js';
import { IntakeFiles } from '../../src/intake/files.js';
import { readIntake, stageIntake } from '../../src/intake/stage.js';
import { applyIntakeMappings } from '../../src/tools/map.create.js';
import { loadMappings } from '../../src/tools/map.shared.js';
import { getAjv } from '../../src/lib/ajv.js';
import mapSchema from '../../src/schemas/map.input.json' with {type:'json'};
import brandSchema from '../../src/schemas/brand.intake.input.json' with {type:'json'};
let folder:string;
const keys=['OODS_FOUNDRY_HOME','MCP_MAPPINGS_PATH'];
const prior=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
beforeEach(()=>{folder=fs.mkdtempSync(path.join(os.tmpdir(),'intake-'));process.env.OODS_FOUNDRY_HOME=path.join(folder,'home');process.env.MCP_MAPPINGS_PATH=path.join(folder,'mappings.json');});
afterEach(()=>{for(const key of keys){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}vi.restoreAllMocks();fs.rmSync(folder,{recursive:true,force:true});});
const write=(file:string,value:unknown)=>{fs.mkdirSync(path.dirname(path.join(folder,file)),{recursive:true});fs.writeFileSync(path.join(folder,file),typeof value==='string'?value:JSON.stringify(value));};
const button=`import * as React from 'react'; type Props = { content: string; intent?: 'primary'|'danger'; size?: 'sm'|'md'; disabled?: boolean; type?: 'button'|'submit' }; export function RenamedControl(props:Props) { return <button type={props.type} disabled={props.disabled}>{props.content}</button> }`;
const shadcn=()=>{
 write('components.json',{$schema:'https://ui.shadcn.com/schema.json',style:'radix-nova',tsx:true,tailwind:{css:'src/style.css'},aliases:{ui:'@/components/ui',components:'@/components'}});
 write('tsconfig.json','{ /* comments stay data */ "compilerOptions":{"paths":{"@/*":["src/*"]}} }');
 write('package.json',{name:'@team/ui',version:'1.0.0',exports:'./dist/index.js'});
 write('src/components/ui/button.tsx',`import * as React from 'react'; type Props={variant?:'default'|'destructive';size?:'sm'|'lg';disabled?:boolean};export function Button(props:Props){return <button disabled={props.disabled}/>}\nthrow new Error('PROJECT MUST NEVER RUN');`);
 write('src/style.css','@import "tailwindcss";');
};
it('retains typed props, primitive/element evidence and variants without executing project code',()=>{
 const parsed=inspectComponentSource('Control.tsx',button)[0];
 expect(parsed.export).toBe('RenamedControl');expect(parsed.props.intent.values).toEqual(['primary','danger']);expect(parsed.elements).toContain('button');
 const vue=inspectComponentSource('Control.vue',`<script setup lang="ts">defineProps<{disabled?:boolean;label:string}>()</script><template><button :disabled="disabled">{{label}}</button></template>`)[0];
 expect(vue.props.label.required).toBe(true);expect(vue.elements).toContain('button');
});
it('drafts deterministic structural shadcn mappings, keeps counts complete, and stages without applying',async()=>{
 shadcn();const network=vi.spyOn(globalThis,'fetch');
 const input={action:'draft' as const,source:{project:folder,format:'shadcn' as const}};
 const first:any=await map(input),second:any=await map(input);expect(first.draftId).toBe(second.draftId);
 const shown:any=await map({action:'show',draftId:first.draftId});
 expect(shown.proposals.map((p:any)=>p.mapping.substitution.component)).toContain('Button');
 expect(shown.proposals.find((p:any)=>p.mapping.substitution.component==='Button').translations.intent.values.danger).toBe('destructive');
 expect(shown.inventory.some((entry:any)=>entry.kind==='prop')).toBe(true);
 for(const value of Object.values(shown.counts) as any[])expect(value.total).toBe(value.proposed+value.unmatched);
 expect(fs.existsSync(path.join(folder,'src/components/oods/button.tsx'))).toBe(false);expect(loadMappings().mappings).toHaveLength(0);expect(network).not.toHaveBeenCalled();
 write('src/components/ui/button.tsx','export function Button(){return null}');
 await expect(map({action:'apply',draftId:first.draftId,accept:[shown.proposals[0].id]})).rejects.toThrow(/changed/);
 const changed=draftComponents(input.source);expect(changed.proposals).toHaveLength(0);
});
it('rolls adapter files back when existing mapping validation rejects an accepted batch',async()=>{
 shadcn();const draft:any=await map({action:'draft',source:{project:folder,format:'shadcn'}});
 await expect(map({action:'apply',draftId:draft.draftId,accept:[]})).rejects.toThrow(/explicitly accepted/);
 // No installed Tailwind runtime: draft works; the existing map validator refuses apply.
 await expect(map({action:'apply',draftId:draft.draftId,accept:[draft.proposals[0].id]})).rejects.toThrow();
 expect(fs.existsSync(path.join(folder,'src/components/oods/button.tsx'))).toBe(false);expect(loadMappings().mappings).toHaveLength(0);
});
it('uses Storybook docgen paths and structural props, and reports absent manifests and unresolved sources',()=>{
 write('package.json',{name:'@team/ui',version:'1.0.0'});write('src/Control.tsx',button);
 write('storybook/index.json',{v:5,entries:{a:{id:'control--default',title:'WrongName',type:'story'},b:{id:'unmapped--demo',title:'Button',type:'story'}}});
 write('storybook/manifests/components.json',{components:{control:{id:'control',name:'Anything',reactDocgen:{definedInFile:'src/Control.tsx',props:{intent:{required:false}}},stories:[{id:'control--default'}]},remote:{id:'remote',reactDocgen:{definedInFile:'../outside.tsx',props:{foreign:{}}}}}});
 const result=draftComponents({project:folder,format:'storybook',storybook:'storybook'});
 expect(result.proposals).toHaveLength(1);expect(result.proposals[0].mapping.substitution!.component).toBe('Button');
 expect(result.inventory.find(entry=>entry.id==='control--default')?.status).toBe('proposed');
 expect(result.inventory.find(entry=>entry.id==='unmapped--demo')?.status).toBe('unmatched');
 expect(result.inventory.find(entry=>entry.id==='manifest:remote')?.status).toBe('unmatched');
 expect(result.warnings.join(' ')).toMatch(/escapes/);
 fs.rmSync(path.join(folder,'storybook/manifests/components.json'));expect(draftComponents({project:folder,format:'storybook',storybook:'storybook'}).proposals).toHaveLength(0);
});
it('rejects traversal, symlink reads, oversized files and tampered staged drafts',()=>{
 write('inside.json',{});const source=new IntakeFiles(folder);
 expect(()=>source.read('../outside.json')).toThrow(/escapes/);
 fs.symlinkSync(path.join(folder,'inside.json'),path.join(folder,'link.json'));expect(()=>source.read('link.json')).toThrow(/symbolic/);
 write('large.json',' '.repeat(8*1024*1024+1));expect(()=>source.read('large.json')).toThrow(/exceeds/);
 const staged=stageIntake('components',{safe:true});fs.appendFileSync(staged.file,' ');expect(()=>readIntake('components',staged.draftId)).toThrow(/hash/);
});
it('registers complementary React/Vue implementations under one owner and refuses silent replacement',()=>{
 write('package.json',{name:'@team/ui',version:'1.0.0',type:'module',exports:'./dist/index.js'});write('dist/index.js','export function TeamButton() {}');
 const implementation={package:'@team/ui',version:'1.0.0',localPath:folder,export:'TeamButton'};
 applyIntakeMappings([{externalSystem:'team',externalComponent:'Button',oodsTraits:[],substitution:{component:'Button',react:implementation}}]);
 applyIntakeMappings([{externalSystem:'another',externalComponent:'ButtonVue',oodsTraits:[],substitution:{component:'Button',vue:implementation}}]);
 expect(loadMappings().mappings).toHaveLength(1);expect(loadMappings().mappings[0].substitution).toMatchObject({react:implementation,vue:implementation});
 expect(()=>applyIntakeMappings([{externalSystem:'team',externalComponent:'Button',oodsTraits:[],substitution:{component:'Button',react:{...implementation,export:'Missing'}}}])).toThrow(/already supplies/);
});
it('retains team token names and declared light/dark values through validated brand files',async()=>{
 write('tokens.json',{light:{team:{$type:'color',canvas:{$value:'#fff'},ink:{$value:'#0a0a0a'},alias:{$value:'{light.team.ink}'}}},dark:{team:{$type:'color',canvas:{$value:'#0a0a0a'},ink:{$value:'#fafafa'}}},bad:{$type:'mystery',$value:'bad'},cycle:{$type:'color',$value:'{cycle}'}});
 const input={action:'draft' as const,brand_id:'Intakebrand',source:{path:path.join(folder,'tokens.json')},bindings:{base:{'surface.canvas':'light.team.canvas','text.primary':'light.team.ink'},dark:{'surface.canvas':'dark.team.canvas','text.primary':'dark.team.ink'}}};
 const first:any=await brand(input),second:any=await brand(input);expect(first.draftId).toBe(second.draftId);
 expect(first.counts.tokens).toBe(first.counts.preserved+first.counts.unmatched);expect(first.inventory.find((entry:any)=>entry.path==='cycle').reason).toMatch(/cycle/);
 expect(first.report.valid,JSON.stringify(first.report.issues)).toBe(true);
 const checked=checkBrand({brandId:'Intakebrand',documents:first.documents,requireId:true});
 const saved=JSON.parse(checked.texts!.base);expect(saved.$extensions[NAMED_TOKENS_EXTENSION].slots['surface.canvas']).toBe('--team-canvas');
 expect(saved.$extensions[NAMED_TOKENS_EXTENSION].variables['--team-ink']).not.toBe(JSON.parse(checked.texts!.dark).$extensions[NAMED_TOKENS_EXTENSION].variables['--team-ink']);
 const roundtrip=brandDocumentsFromFiles('Intakebrand',Object.fromEntries(Object.entries(checked.texts!).map(([key,value])=>[key,JSON.parse(value)])) as any);
 expect(namedTokens(roundtrip.base)).toEqual(namedTokens(first.documents.base));
 await expect(brand({action:'apply',draftId:first.draftId,accept:false} as any)).rejects.toThrow(/explicit/);
});
it('cannot use token metadata to bypass contrast grading or inject CSS',()=>{
 write('tokens.json',{team:{$type:'color',white:{$value:'#fff'},black:{$value:'#000'}}});
 const draft=draftTokens({brand_id:'Brokenbrand',source:{path:path.join(folder,'tokens.json')},bindings:{base:{'surface.canvas':'team.white','text.primary':'team.white'}}});
 expect(draft.report.valid).toBe(false);expect(draft.report.issues.some(issue=>issue.rule==='contrast')).toBe(true);
 const doc=draft.documents.base as any;doc.$extensions[NAMED_TOKENS_EXTENSION].variables['--team-white']='red;}body{display:none';
 expect(checkBrand({brandId:'Brokenbrand',documents:draft.documents}).report.issues.some(issue=>issue.message.includes('Unsafe'))).toBe(true);
});
it('publishes strict input contracts for intake while preserving legacy map apply',()=>{
 const validate=getAjv().compile(mapSchema);
 expect(validate({action:'draft',source:{project:folder,format:'shadcn'}})).toBe(true);
 expect(validate({action:'apply',draftId:'components-'+'a'.repeat(64),accept:['mapping-a']})).toBe(true);
 expect(validate({action:'apply',draftId:'components-'+'a'.repeat(64)})).toBe(false);
 const validateBrand=getAjv().compile(brandSchema);expect(validateBrand({action:'apply',draftId:'brand-'+'b'.repeat(64),accept:true})).toBe(true);expect(validateBrand({action:'apply',draftId:'brand-'+'b'.repeat(64),accept:false})).toBe(false);
 // Intake starts from a registered template brand; reject unknown names at the public boundary.
 expect(validateBrand({action:'draft',brand_id:'Intakebrand',source:{path:path.join(folder,'tokens.json')},from:{brand:'A'}})).toBe(true);
 expect(validateBrand({action:'draft',brand_id:'Intakebrand',source:{path:path.join(folder,'tokens.json')},from:{brand:'Missingbrand'}})).toBe(false);
});

it('does not infer a usable export from a component filename or a familiar style name',()=>{
 shadcn();write('src/components/ui/button.tsx',button);
 const draft=draftComponents({project:folder,format:'shadcn'});
 expect(draft.proposals).toHaveLength(0);expect(draft.warnings.join(' ')).toMatch(/missing required named exports/);
 write('components.json',{$schema:'https://ui.shadcn.com/schema.json',style:'aria-nova',tsx:true,aliases:{ui:'@/components/ui'}});
 expect(()=>draftComponents({project:folder,format:'shadcn'})).toThrow(/Aria/);
});
it('rejects config escapes before reading and keeps project configuration inert',()=>{
 shadcn();write('tsconfig.json',{'extends':'../private/tsconfig.json'});
 expect(()=>draftComponents({project:folder,format:'shadcn'})).toThrow(/escapes/);
 write('tsconfig.json','{compilerOptions: (() => { throw new Error("run") })()}');
 expect(()=>draftComponents({project:folder,format:'shadcn'})).toThrow(/Not JSON data/);
});
it('does not register part of a failing accepted mapping batch',()=>{
 write('package.json',{name:'@team/ui',version:'1.0.0',type:'module',exports:'./dist/index.js'});write('dist/index.js','export function TeamButton() {}');
 const source={package:'@team/ui',version:'1.0.0',localPath:folder,export:'TeamButton'};
 expect(()=>applyIntakeMappings([{externalSystem:'team',externalComponent:'Button',oodsTraits:[],substitution:{component:'Button',react:source}},{externalSystem:'team',externalComponent:'Card',oodsTraits:[],substitution:{component:'Card',react:{...source,export:'Missing'}}}])).toThrow(/export/);
 expect(loadMappings().mappings).toHaveLength(0);
});
it('counts reserved and colliding CSS names as unmatched without guessing a rename',()=>{
 write('tokens.json',{theme:{$type:'color',primary:{$value:'#000'}},team:{$type:'color',primary:{$value:'#000'}},'team-primary':{$type:'color',$value:'#fff'}});
 const draft=draftTokens({brand_id:'Namesbrand',source:{path:path.join(folder,'tokens.json')}});
 expect(draft.inventory.filter(entry=>entry.path==='theme.primary').every(entry=>entry.status==='unmatched')).toBe(true);
 expect(draft.inventory.find(entry=>entry.path==='team-primary')?.reason).toMatch(/collision/);
});
it('preserves the nonempty legacy trait-only mapping requirement',()=>{
 const validate=getAjv().compile(mapSchema);
 expect(validate({action:'create',externalSystem:'team',externalComponent:'Legacy',oodsTraits:[]})).toBe(false);
 expect(validate({action:'create',externalSystem:'team',externalComponent:'Legacy',oodsTraits:['Stateful']})).toBe(true);
});
it('emits named CSS aliases only for opted-in brands while retaining literal legacy output',async()=>{
 const {SEMANTIC_BRIDGE,renderBridgeBlock}=await import('../../../tokens/scripts/brand-bridge.mjs');
 const values=new Map(SEMANTIC_BRIDGE.map((entry:any)=>[entry.token?entry.token.replace('{brand}','Team'):`color.brand.Team.${entry.tokenPath}`,'#ffffff']));
 const legacy=renderBridgeBlock({brand:'Team',theme:'base'},values,['[data-brand="Team"]']);
 expect(legacy).toContain('--theme-surface-canvas: #ffffff;');expect(legacy).not.toContain('--team-canvas');
 const named=renderBridgeBlock({brand:'Team',theme:'base'},values,['[data-brand="Team"]'],{variables:{'--team-canvas':'#ffffff','--team-radius':'6px'},slots:{'surface.canvas':'--team-canvas','radius.control':'--team-radius'},namespaces:{'surface.canvas':'--color-brand-team-surface-canvas'}});
 expect(named).toContain('--color-brand-team-surface-canvas: var(--team-canvas);');expect(named).toContain('--team-canvas: #ffffff;');expect(named).toContain('--theme-surface-canvas: var(--team-canvas);');expect(named).toContain('--theme-radius-control: var(--team-radius);');
 expect(()=>renderBridgeBlock({brand:'Team',theme:'base'},values,['x'],{variables:{'--team':'red;}body{}'},slots:{}})).toThrow(/Invalid/);
});
it('refuses structural matches with incompatible typed control props and counts manifest-only stories',()=>{
 write('package.json',{name:'@team/ui',version:'1.0.0'});write('src/Control.tsx',button.replace('disabled?: boolean','disabled?: number'));
 write('storybook/index.json',{v:5,entries:{}});write('storybook/manifests/components.json',{components:{control:{id:'control',reactDocgen:{definedInFile:'src/Control.tsx'},stories:[{id:'control--only'}],subcomponents:{Unknown:{reactDocgen:{props:{odd:{}}}}}}}});
 const draft=draftComponents({project:folder,format:'storybook',storybook:'storybook'});
 expect(draft.proposals).toHaveLength(0);expect(draft.inventory.find(entry=>entry.id==='control--only')).toBeDefined();expect(draft.inventory.find(entry=>entry.id==='manifest:control/Unknown.odd')).toBeDefined();
});
it('reports imported and native prop groups without inventing their members',()=>{
 const source=inspectComponentSource('Panel.tsx',`import React from 'react';import type {ForeignProps} from './foreign';export function Panel(props:React.ComponentProps<'div'> & ForeignProps){return <div {...props}/>}`)[0];
 expect(source.props).toEqual({});expect(source.unresolvedProps).toEqual(expect.arrayContaining([expect.stringContaining('Inherited native props'),expect.stringContaining('ForeignProps')]));expect(source.elements).toContain('div');
});


it('reports vendor alpha modifiers and aliases to them instead of silently making a transparent token opaque',()=>{
 write('tokens.json',{color:{$type:'color',$value:{colorSpace:'srgb',components:[1,1,1]},alpha:0},alias:{$type:'color',$value:'{color}'},standard:{$type:'color',$value:{colorSpace:'srgb',components:[1,1,1],alpha:0}}});
 const draft=draftTokens({brand_id:'Alphabrand',source:{path:path.join(folder,'tokens.json')}});
 expect(draft.inventory.filter(entry=>['color','alias'].includes(entry.path)).every(entry=>entry.status==='unmatched'&&entry.reason.includes('Source-specific alpha'))).toBe(true);
 expect(draft.inventory.filter(entry=>entry.path==='standard').every(entry=>entry.status==='preserved')).toBe(true);
 expect(draft.counts.tokens).toBe(draft.counts.preserved+draft.counts.unmatched);
});
