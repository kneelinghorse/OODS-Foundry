import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { handle as tokensBuildHandle } from '../../src/tools/tokens.build.js';

describe('tokens.build apply', () => {
  it('writes all token artifacts with compiled content', async () => {
    const result = await tokensBuildHandle({ brand: 'A', theme: 'light', apply: true });

    expect(result.artifacts).toHaveLength(5);

    const artifactsByName = new Map(
      result.artifacts.map((filePath) => [path.basename(filePath), filePath]),
    );

    const themePath = artifactsByName.get('tokens.light.json');
    const cssPath = artifactsByName.get('tokens.css');
    const tsPath = artifactsByName.get('tokens.ts');
    const tailwindPath = artifactsByName.get('tokens.tailwind.json');

    expect(themePath).toBeTruthy();
    expect(cssPath).toBeTruthy();
    expect(tsPath).toBeTruthy();
    expect(tailwindPath).toBeTruthy();

    const cssSize = fs.statSync(cssPath as string).size;
    expect(cssSize).toBeGreaterThan(40000);

    const tsSize = fs.statSync(tsPath as string).size;
    expect(tsSize).toBeGreaterThan(10000);

    const tailwindSize = fs.statSync(tailwindPath as string).size;
    expect(tailwindSize).toBeGreaterThan(10000);

    const themeSize = fs.statSync(themePath as string).size;
    expect(themeSize).toBeGreaterThan(10000);

    const payload = JSON.parse(fs.readFileSync(themePath as string, 'utf8')) as Record<string, unknown>;
    // Scoped payloads must never mislabel legacy A/light flat tokens.
    expect(payload).not.toHaveProperty('tokens');
    expect(payload).not.toHaveProperty('flat');
    expect(payload.cssVariables).toBeTruthy();

    const meta = payload.meta as Record<string, unknown> | undefined;
    expect(meta?.brand).toBe('A');
    expect(meta?.theme).toBe('light');
    expect(meta?.scope).toBe('requested');
    const scopedCss = fs.readFileSync(artifactsByName.get('tokens.scope.css')!, 'utf8');
    expect(scopedCss).toContain("[data-brand='A'][data-theme='light']");
    expect(scopedCss).not.toContain("[data-brand='B']");
  });
});
