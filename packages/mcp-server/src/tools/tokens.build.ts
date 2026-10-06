import path from 'node:path';
import fs from 'node:fs';
import { canBuildUserBrands, compileTokenKit } from '../lib/user-brands.js';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type { TokensBuildInput, GenericOutput, ToolPreview, ArtifactDetail } from './types.js';
import { ToolError } from '../errors/tool-error.js';
import { assertKnownBrand, DEFAULT_BRAND } from '../lib/brand-registry.js';

async function compileOutputs(outDir: string) {
  if (!canBuildUserBrands()) {
    throw new ToolError('OODS-N011', 'tokens.build: the shipped compiler kit or its server dependency is missing.', {
      tool: 'tokens.build', dependency: 'token-compiler-kit', buildAttempted: false,
    });
  }
  const compilerRoot = fs.mkdtempSync(path.join(outDir, '.compiler-'));
  const started = Date.now();
  try {
    const commands = await compileTokenKit(compilerRoot);
    const build = { exitCode: commands.at(-1)?.exitCode ?? 1, commands, durationMs: Date.now() - started };
    if (build.exitCode !== 0) {
      const tail = commands.map(command => command.stdout + command.stderr).join('\n').split('\n').slice(-40).join('\n');
      throw new ToolError('OODS-S019', `Token build failed (exit ${build.exitCode}).\n${tail}`, { build });
    }
    const read = (file: string) => fs.readFileSync(path.join(compilerRoot, 'dist', file), 'utf8');
    return { css: read('css/tokens.css'), ts: read('ts/tokens.ts'), tailwind: read('tailwind/tokens.json'),
      scopes: JSON.parse(read('css-variables-by-scope.json')) as Record<string, Record<string, Record<string, string>>>, build };
  } finally { fs.rmSync(compilerRoot, { recursive: true, force: true }); }
}

function ensureAllowed(base: string, candidate: string): void {
  if (!withinAllowed(base, candidate)) {
    throw new ToolError('OODS-S015', `Path not allowed: ${candidate}`, { path: candidate });
  }
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
}

function recordArtifact(
  filePath: string,
  name: string,
  purpose: string,
  artifacts: string[],
  details: ArtifactDetail[],
): void {
  artifacts.push(filePath);
  try {
    const stat = fs.statSync(filePath);
    details.push({
      path: filePath,
      name,
      purpose,
      sha256: sha256File(filePath),
      sizeBytes: stat.size,
    });
  } catch {
    // ignore missing stats; verification will catch missing files
  }
}

export async function handle(input: TokensBuildInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase, input.apply === true);
  const outDir = path.join(base, 'tokens.build');
  const startedAt = new Date();
  const artifacts: string[] = [];
  const details: ArtifactDetail[] = [];
  let preview: ToolPreview | undefined;
  let structuredData: Record<string, unknown> | undefined;

  if (input.apply) fs.mkdirSync(outDir, { recursive: true });

  const brand = assertKnownBrand(input.brand ?? DEFAULT_BRAND, 'brand');
  const theme = input.theme ?? 'dark';
  if (!['light', 'dark', 'hc'].includes(theme)) {
    throw new ToolError('OODS-V001', `Unknown token scope ${brand}/${theme}.`, { brand, theme });
  }

  if (input.apply) {
    const outputs = await compileOutputs(outDir);

    const scopes = outputs.scopes;
    const variables = scopes[brand]?.[theme];
    if (!variables) throw new ToolError('OODS-V001', `Token scope ${brand}/${theme} was not built.`, { brand, theme });
    const tokensPayload = { cssVariables: variables, meta: { brand, theme, scope: 'requested' } };

    const themeFile = path.join(outDir, `tokens.${theme}.json`);
    ensureAllowed(policy.artifactsBase, themeFile);
    fs.writeFileSync(themeFile, JSON.stringify(tokensPayload, null, 2), 'utf8');
    recordArtifact(
      themeFile,
      `tokens.${theme}.json`,
      'Resolved variables for the requested brand and theme.',
      artifacts,
      details,
    );

    const scopeCss = `[data-brand='${brand}'][data-theme='${theme}'] {\n${Object.entries(variables).map(([name, value]) => `  ${name.replace(/^--oods-(sys|theme|ref|cmp)-/, '--$1-')}: ${value};`).join('\n')}\n}\n`;
    structuredData = { cssVariables: variables, css: scopeCss, json: tokensPayload, build: outputs.build };
    const scopeOut = path.join(outDir, 'tokens.scope.css');
    ensureAllowed(policy.artifactsBase, scopeOut);
    fs.writeFileSync(scopeOut, scopeCss, 'utf8');
    recordArtifact(scopeOut, 'tokens.scope.css', 'Resolved CSS variables for only the requested brand and theme.', artifacts, details);

    const cssOut = path.join(outDir, 'tokens.css');
    ensureAllowed(policy.artifactsBase, cssOut);
    fs.writeFileSync(cssOut, outputs.css, 'utf8');
    recordArtifact(cssOut, 'tokens.css', 'Compiled CSS custom properties.', artifacts, details);

    const tsOut = path.join(outDir, 'tokens.ts');
    ensureAllowed(policy.artifactsBase, tsOut);
    fs.writeFileSync(tsOut, outputs.ts, 'utf8');
    recordArtifact(tsOut, 'tokens.ts', 'Legacy default-scope TypeScript token map (A/light).', artifacts, details);

    const tailwindOut = path.join(outDir, 'tokens.tailwind.json');
    ensureAllowed(policy.artifactsBase, tailwindOut);
    fs.writeFileSync(tailwindOut, outputs.tailwind, 'utf8');
    recordArtifact(tailwindOut, 'tokens.tailwind.json', 'Legacy default-scope Tailwind token JSON (A/light).', artifacts, details);
  } else {
    const expected = [
      `tokens.${theme}.json`,
      'tokens.scope.css',
      'tokens.css',
      'tokens.ts',
      'tokens.tailwind.json',
    ];
    preview = {
      summary: `Preview only: would return ${expected.length} token artifact${expected.length === 1 ? '' : 's'} for brand ${brand} (${theme} theme).`,
      notes: expected.map((name) => `artifact: ${name}`),
      specimens: expected.map((name) => path.join(outDir, name)),
    };
  }

  const transcriptPath = input.apply ? writeTranscript(outDir, {
    tool: 'tokens.build',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  }) : undefined;
  const bundleIndexPath = transcriptPath ? writeBundleIndex(outDir, [transcriptPath, ...artifacts]) : undefined;
  return {
    artifacts,
    ...(transcriptPath ? { transcriptPath, bundleIndexPath } : {}),
    ...(preview ? { preview } : {}),
    ...(structuredData ? { structuredData } : {}),
    ...(details.length ? { artifactsDetail: details } : {}),
  };
}
