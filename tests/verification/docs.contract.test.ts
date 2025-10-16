import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('B3.8 — Documentation deliverables', () => {
  const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

  it('links to the region and modifier docs from the README', () => {
    const readmePath = resolve(projectRoot, 'README.md');
    const readmeContents = readFileSync(readmePath, 'utf8');

    expect(readmeContents).toMatch(/\(docs\/specs\/regions\.md\)/);
    expect(readmeContents).toMatch(/\(docs\/patterns\/modifier-purity\.md\)/);
    expect(readmeContents).toMatch(/scripts\/demo\/sprint03\.tsx/);
  });

  it('ships the sprint demo entry point in scripts/demo', () => {
    const demoPath = resolve(projectRoot, 'scripts/demo/sprint03.tsx');
    expect(
      existsSync(demoPath),
      'Expected scripts/demo/sprint03.tsx to exist for the Sprint 03 demo.'
    ).toBe(true);
  });
});
