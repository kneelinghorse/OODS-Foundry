import { refuseMovedAction, requireAction } from './action-moves.js';
import fs from 'node:fs';
import { draftTokens, type TokenDraftInput } from '../intake/tokens.js';
import { readIntake, stageIntake } from '../intake/stage.js';
import path from 'node:path';
import { deriveBrand, type BrandDerivation, type BrandDeriveHints } from '../lib/brand-derive.js';
import { deriveBrandFromCss } from '../lib/brand-derive-css.js';
import { ToolError } from '../errors/tool-error.js';
import { canRunTokenBuild, refreshTokenBundle, runTokenBuild } from '../lib/token-build.js';
import { knownBrands } from '../lib/brand-registry.js';
import { buildUserBrands, canBuildUserBrands } from '../lib/user-brands.js';
import { resetTokensCssCache } from '../render/document.js';
import {
  brandTemplate,
  brandWriteTarget,
  checkBrand,
  checkRecipe,
  type BrandFileReceipt,
  type BrandTemplate,
  type BrandTemplateSource,
  type BrandValidationReport,
} from '../lib/brand-template.js';

/**
 * brand.intake — s213-m05: a brand made from a team's tokens.
 *
 * template hands a team every slot of a brand with its meaning and a starting value (an existing brand's, optionally
 * with a preset over it); validate checks the filled documents and reports every problem, contrast included, writing
 * nothing; create writes a brand that passes into the brands folder and runs the token build, so the brand registry
 * (s213-m04) carries it at once. create never replaces a brand (change one with brand.apply), and a brand whose build
 * fails is removed again. s213-m06: with a team brands folder (OODS_BRANDS_DIR; the npm launcher sets it) the brand is
 * written there and built outside the runtime (lib/user-brands.ts); without one, into a source checkout's token package.
 */

/** s222-m01 (#2502 ruling 3): validate and create take a brand recipe in place of the documents. */
export type BrandIntakeInput =
  | ({ action:'draft' } & TokenDraftInput)
  | { action:'show'; draftId:string }
  | { action:'apply'; draftId:string; accept:true }
  | { action: 'derive'; tokens?: unknown; css?: string; cssPath?: string; hints?: BrandDeriveHints }
  | { action: 'template'; from?: BrandTemplateSource }
  | { action: 'validate'; brand_id?: string; documents?: unknown; recipe?: unknown }
  | { action: 'create'; brand_id: string; documents?: unknown; recipe?: unknown };

/** Exactly one of documents and recipe. */
function source(input: { documents?: unknown; recipe?: unknown }, action: string): 'documents' | 'recipe' {
  if ((input.documents === undefined) === (input.recipe === undefined)) {
    throw new ToolError('OODS-V001', `${action} takes documents (a filled template) or recipe (a brand recipe), one of the two.`, { field: 'documents' });
  }
  return input.recipe !== undefined ? 'recipe' : 'documents';
}

export type BrandIntakeOutput =
  | ({ action:'draft'; draftId:string; file:string } & ReturnType<typeof draftTokens>)
  | ({ action:'show'; draftId:string } & ReturnType<typeof draftTokens>)
  | BrandDerivation
  | ({ action: 'template' } & BrandTemplate)
  | ({ action: 'validate' } & BrandValidationReport)
  | {
    action: 'create';
    created: true;
    brand_id: string;
    /** The brands folder the files were written in (the team's, or the token package's in a source checkout). */
    folder: string;
    files: BrandFileReceipt[];
    build: { exitCode: number | null; durationMs: number };
    brands: string[];
    report: BrandValidationReport;
  };

/** Write the three files beside each other, then move each into place, so a failed write leaves no half brand. */
function writeBrand(folder: string, texts: Record<string, string>): void {
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  fs.mkdirSync(folder, { recursive: false });
  try {
    for (const [theme, text] of Object.entries(texts)) fs.writeFileSync(path.join(folder, `.${theme}.json.partial`), text, 'utf8');
    for (const theme of Object.keys(texts)) fs.renameSync(path.join(folder, `.${theme}.json.partial`), path.join(folder, `${theme}.json`));
  } catch (error) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw error;
  }
}

async function create(input: { brand_id: string; documents?: unknown; recipe?: unknown }): Promise<BrandIntakeOutput> {
  const from = source(input, 'create');
  const target = brandWriteTarget();
  if (target.kind === 'user' ? !canBuildUserBrands() : !canRunTokenBuild()) {
    throw new ToolError('OODS-N025', target.kind === 'user'
      ? 'Creating a brand needs the token build, and this runtime does not carry it; validate works here, and nothing was written.'
      : 'Creating a brand needs a brands folder (OODS_BRANDS_DIR; the npm launcher sets ~/.oods-foundry/brands) or a source checkout; validate works here, and nothing was written.',
      { tool: 'brand.intake', action: 'create', target: target.kind });
  }
  const { report, texts } = from === 'recipe'
    ? checkRecipe({ brandId: input.brand_id, recipe: input.recipe, requireId: true })
    : checkBrand({ brandId: input.brand_id, documents: input.documents, requireId: true });
  const taken = report.issues.find(issue => issue.rule === 'brand-id-taken');
  if (taken) throw new ToolError('OODS-C005', taken.message, { brand_id: input.brand_id, knownBrands: knownBrands() });
  if (!report.valid || !texts) {
    throw new ToolError('OODS-V216',
      `Brand "${input.brand_id}" was not created: ${report.issues.length} problem${report.issues.length === 1 ? '' : 's'}. ${report.issues.slice(0, 3).map(issue => issue.message).join(' ')}${report.issues.length > 3 ? ' …' : ''}`,
      { report });
  }

  const folder = path.join(target.folder, input.brand_id);
  writeBrand(folder, texts);
  let build: { exitCode: number | null; durationMs: number; commands: Array<{ stdout: string; stderr: string }> };
  try {
    build = target.kind === 'user' ? await buildUserBrands() : await runTokenBuild();
  } catch (error) {
    build = { exitCode: 1, durationMs: 0, commands: [{ stdout: '', stderr: error instanceof Error ? error.message : String(error) }] };
  }
  if (build.exitCode !== 0) {
    // The brands folder is put back as it was, so the next build does not fail on this brand. A team build that failed
    // never became active, so the one in use stays; a source checkout's package is rebuilt.
    fs.rmSync(folder, { recursive: true, force: true });
    const restore = target.kind === 'user' ? { exitCode: 0 } : await runTokenBuild();
    if (restore.exitCode === 0) await refreshTokenBundle();
    const tail = build.commands.map(command => command.stdout + command.stderr).join('\n').split('\n').slice(-40).join('\n');
    throw new ToolError('OODS-S022', `The token build failed (exit ${build.exitCode}) after brand "${input.brand_id}" was written, so it was removed.\n${tail}`, {
      brand_id: input.brand_id, build: { exitCode: build.exitCode }, restored: restore.exitCode === 0,
    });
  }
  await refreshTokenBundle();
  resetTokensCssCache();
  return {
    action: 'create',
    created: true,
    brand_id: input.brand_id,
    folder: target.folder,
    files: report.files!,
    build: { exitCode: build.exitCode, durationMs: build.durationMs },
    brands: knownBrands(),
    report,
  };
}

/** A staged brand draft, or a validation error naming the draftId (an unknown or altered draft is the caller's to fix). */
function reviewedDraft(draftId: string): ReturnType<typeof draftTokens> {
  try { return readIntake<ReturnType<typeof draftTokens>>('brand', draftId); }
  catch (error) { throw new ToolError('OODS-V001', error instanceof Error ? error.message : String(error), { field: 'draftId' }); }
}

async function execute(input: BrandIntakeInput): Promise<BrandIntakeOutput> {
  switch (input?.action) {
    case 'draft': {
      const draft = draftTokens(input);
      return { action:'draft', ...stageIntake('brand',draft), ...draft };
    }
    case 'show': return { action:'show',draftId:input.draftId,...reviewedDraft(input.draftId) };
    case 'apply': {
      if(input.accept !== true) throw new ToolError('OODS-V001','Brand intake requires explicit accept:true after reviewing show.');
      const draft = reviewedDraft(input.draftId);
      return create({brand_id:draft.brand_id,documents:draft.documents});
    }
    case 'derive': {
      if ([input.tokens, input.css, input.cssPath].filter(value => value !== undefined).length !== 1) throw new ToolError('OODS-V001', 'derive takes exactly one of tokens, css or cssPath.', { field: 'tokens' });
      if (input.tokens !== undefined) return deriveBrand(input.tokens, input.hints);
      let css = input.css;
      if (input.cssPath !== undefined) {
        if (!path.isAbsolute(input.cssPath)) throw new ToolError('OODS-V001', 'cssPath must be an absolute path.', { field: 'cssPath' });
        try { css = fs.readFileSync(input.cssPath, 'utf8'); }
        catch (error) { throw new ToolError('OODS-V001', `Cannot read CSS '${input.cssPath}': ${error instanceof Error ? error.message : String(error)}`, { field: 'cssPath' }); }
      }
      return deriveBrandFromCss(css!, input.hints);
    }
    case 'template':
      return { action: 'template', ...brandTemplate(input.from ?? {}) };
    case 'validate':
      return {
        action: 'validate',
        ...(source(input, 'validate') === 'recipe'
          ? checkRecipe({ brandId: input.brand_id, recipe: input.recipe })
          : checkBrand({ brandId: input.brand_id, documents: input.documents })).report,
      };
    case 'create':
      return create(input);
    default:
      throw new ToolError('OODS-V001', `Unknown action ${JSON.stringify((input as { action?: unknown })?.action)}; brand.intake takes derive, template, validate or create.`, { field: 'action' });
  }
}

export async function handle(input: BrandIntakeInput) {
  refuseMovedAction('brand.intake', input);
  return execute(input);
}

export async function readHandle(input: BrandIntakeInput) {
  requireAction(input, ['template', 'validate', 'derive', 'show'], 'brand_read');
  return execute(input);
}
