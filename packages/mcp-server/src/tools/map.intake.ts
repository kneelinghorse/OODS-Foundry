import fs from 'node:fs';
import path from 'node:path';
import { draftComponents, type ComponentDraft, type ComponentIntakeSource } from '../intake/components.js';
import { IntakeFiles } from '../intake/files.js';
import { readIntake, stageIntake } from '../intake/stage.js';
import { hash } from '../importer/source.js';
import { applyIntakeMappings } from './map.create.js';
import { getMappingsPath } from './map.shared.js';
import { ToolError } from '../errors/tool-error.js';
export type MapIntakeInput = { action:'draft'; source:ComponentIntakeSource; externalSystem?:string } | { action:'show'; draftId:string } | { action:'apply'; draftId:string; accept:string[] };
export async function handle(input:MapIntakeInput) {
  try {
    if(input.action==='draft') {
      const draft=draftComponents(input.source,input.externalSystem);
      return {action:'draft',...stageIntake('components',draft),contentHash:draft.contentHash,counts:draft.counts,proposals:draft.proposals.map(({id,mapping,evidence,limitations})=>({id,component:mapping.substitution!.component,evidence,limitations})),warnings:draft.warnings};
    }
    const draft=readIntake<ComponentDraft>('components',input.draftId);
    if(input.action==='show')return {action:'show',draftId:input.draftId,...draft};
    if(!Array.isArray(input.accept)||!input.accept.length||new Set(input.accept).size!==input.accept.length)throw new Error('apply requires distinct explicitly accepted proposal ids');
    const accepted=draft.proposals.filter(proposal=>input.accept.includes(proposal.id));
    if(accepted.length!==input.accept.length)throw new Error('An accepted id is not in this draft');
    const source=new IntakeFiles(draft.source.project);
    for(const entry of draft.sources)if(hash(source.read(entry.file))!==entry.sha256)throw new Error(`${entry.file} changed; draft and review again`);
    const lock=getMappingsPath()+'.intake.lock';fs.mkdirSync(path.dirname(lock),{recursive:true});
    const fd=fs.openSync(lock,'wx',0o600), written:string[]=[], directories:string[]=[];
    try {
      const planned=new Map(accepted.flatMap(proposal=>proposal.files.map(file=>[file.path,file] as const)));
      for(const file of planned.values()) {
        const target=source.absolute(file.path,false), prior=source.has(file.path)?hash(source.read(file.path)):null;
        if(prior!==file.previousSha256)throw new Error(`${file.path} changed since the review; no adapter will be overwritten`);
        if(prior===hash(file.contents))continue;
        if(prior!==null)throw new Error(`Intake never overwrites existing adapters: ${file.path}`);
        const missing:string[]=[];let dir=path.dirname(target);while(!fs.existsSync(dir)){missing.push(dir);dir=path.dirname(dir);}
        fs.mkdirSync(path.dirname(target),{recursive:true});directories.push(...missing.reverse());
        fs.writeFileSync(target,file.contents,{flag:'wx'});written.push(target);
      }
      const result=applyIntakeMappings(accepted.map(proposal=>proposal.mapping));
      return {action:'apply',draftId:input.draftId,applied:true,...result,files:written};
    }catch(error){
      for(const file of written.reverse())fs.rmSync(file);
      for(const dir of directories.reverse())if(fs.existsSync(dir)&&!fs.readdirSync(dir).length)fs.rmdirSync(dir);
      throw error;
    }finally{fs.closeSync(fd);fs.rmSync(lock);}
  }catch(error){if(error instanceof ToolError)throw error;throw new ToolError('OODS-V219',`Component intake: ${error instanceof Error?error.message:String(error)}`);}
}
