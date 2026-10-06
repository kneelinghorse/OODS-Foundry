import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { readInspectionEvidence } from './run-inspection.js';
import type { CompositionVersion } from './store.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await fs.rm(dir,{recursive:true,force:true}); });
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'s208-evidence-')); dirs.push(dir);
  const root = path.join(dir,'run'); await fs.mkdir(root);
  const bytes = '{"finding":"critical"}'; await fs.writeFile(path.join(root,'finding.json'),bytes);
  const manifest = JSON.stringify({run_id:'capture-a',hashes:{'finding.json':hash(bytes)}}); await fs.writeFile(path.join(root,'manifest.json'),manifest);
  const record = {runView:{runId:'capture-a',target:'target',runPath:root,manifestSha256:hash(manifest),evidence:[{locator:'finding.json',sha256:hash(bytes)}]}} as CompositionVersion;
  return {dir,root,bytes,record};
}
describe('capture evidence admission is rechecked when opened', () => {
  it('returns the exact attested bytes and refuses another operand, even inside the run', async () => {
    const f = await fixture(); expect((await readInspectionEvidence(f.record,'finding.json')).toString()).toBe(f.bytes);
    await fs.writeFile(path.join(f.root,'other.json'),f.bytes);
    await expect(readInspectionEvidence(f.record,'other.json')).rejects.toThrow('not attested');
    await expect(readInspectionEvidence(f.record,'../finding.json')).rejects.toThrow();
  });
  it('refuses missing and tampered evidence after the view was created', async () => {
    const f=await fixture(); await fs.writeFile(path.join(f.root,'finding.json'),'changed');
    await expect(readInspectionEvidence(f.record,'finding.json')).rejects.toThrow('SHA-256');
    await fs.unlink(path.join(f.root,'finding.json')); await expect(readInspectionEvidence(f.record,'finding.json')).rejects.toThrow();
  });
  it('refuses an escaped symlink even when the destination has the attested bytes', async () => {
    const f=await fixture(); const outside=path.join(f.dir,'outside.json'); await fs.writeFile(outside,f.bytes);
    await fs.unlink(path.join(f.root,'finding.json')); await fs.symlink(outside,path.join(f.root,'finding.json'));
    await expect(readInspectionEvidence(f.record,'finding.json')).rejects.toThrow('inside the capture');
  });
  it('refuses a substituted manifest even if it attests the new bytes', async () => {
    const f=await fixture(); const bytes='{"new":true}'; await fs.writeFile(path.join(f.root,'finding.json'),bytes);
    await fs.writeFile(path.join(f.root,'manifest.json'),JSON.stringify({run_id:'capture-a',hashes:{'finding.json':hash(bytes)}}));
    await expect(readInspectionEvidence(f.record,'finding.json')).rejects.toThrow('manifest changed');
  });
});
