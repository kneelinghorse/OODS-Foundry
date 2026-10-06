/**
 * s222-m02: the quickstart's Harbor brand is the first thing a new user validates and creates (packages/foundry
 * QUICKSTART.md), so it must pass brand_intake against the template this package ships. It went stale once: Sprint 222's
 * m01 grew the template to recipe roles and it still carried 0.3's slots, which the quickstart's validate call would have
 * refused. It is made from Harbor's recipe by brand_intake's own function, and this test holds both facts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { handle as intake } from '../../src/tools/brand.intake.js';
import { recipeDocuments } from '../../src/lib/brand-template.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const harbor = JSON.parse(fs.readFileSync(path.join(root, 'packages/foundry/quickstart/harbor.tokens.json'), 'utf8'));
const HARBOR_RECIPE = { neutralHue: 205, neutralChroma: 0.012, accentHue: 215, primary: 'accent', radius: 8, font: 'DM Sans' };

describe('s222-m02 the quickstart Harbor brand', () => {
  it('validates with no issues, as the quickstart walkthrough asks', async () => {
    const report = await intake({ action: 'validate', brand_id: 'Harbor', documents: harbor } as never) as { valid: boolean; issues: unknown[] };
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('is the documents Harbor\'s recipe makes, byte for byte, so it follows the template when the recipe roles grow', () => {
    expect(harbor).toEqual(recipeDocuments(HARBOR_RECIPE).documents);
  });
});
