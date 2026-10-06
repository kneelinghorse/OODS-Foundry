import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as generate } from '../../packages/mcp-server/src/tools/code.generate.js';
import { validateGeneratedArtifact } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';
import { seedPreviewModel } from '../../packages/mcp-server/src/codegen/preview-model.js';
import { seedSchema } from '../../packages/mcp-server/src/compose/workflow-assembler.js';
import { isKnownBrand } from '../../packages/mcp-server/src/lib/brand-registry.js';
import { DEFAULT_PORT, ROOT, digest, loopRequest, outputDirectory, validateReceipt, verifyTheme, writeJson, type RenderInput } from './common.js';

/** Composition/generation run in the caller so producer edits take effect without restarting consumers. */
export async function render(input: RenderInput) {
  const started = performance.now();
  const port = input.port ?? DEFAULT_PORT;
  await loopRequest(port, '/status'); // Fail before writing partial output if serve is stopped.
  const output = await outputDirectory(input.output);
  const widths = input.widths ?? [390, 820, 1440];
  if (!widths.length || widths.some(width => !Number.isInteger(width) || width < 200 || width > 3840)) throw new Error('Invalid capture widths.');
  const theme = input.theme ?? input.compose.preferences?.theme ?? 'light';
  const brand = input.brand ?? input.compose.preferences?.brand ?? 'A';
  if ((theme !== 'light' && theme !== 'dark') || !isKnownBrand(brand)) throw new Error('Unsupported render theme or brand.');
  const composition = await compose({ ...input.compose, preferences: { ...input.compose.preferences, theme, brand } });
  if (composition.status !== 'ok' || !composition.schema) throw new Error(`Composition failed: ${JSON.stringify(composition)}`);
  const composeMs = performance.now() - started;
  const schemaHash = digest(JSON.stringify(composition.schema));
  // The served preview (design.preview) and this loop share one seed policy.
  // The same seed source as design.preview: the object's workflow, or its list for a read-only object (s206-m01).
  const workflowSchema = input.compose.context !== 'workflow' && input.compose.object
    ? await seedSchema({ ...input.compose, object: input.compose.object }, compose)
    : undefined;
  const model = seedPreviewModel({ schema: composition.schema, context: input.compose.context ?? '', object: input.compose.object, workflowSchema, established: input.model });
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const receipts = [];
  for (const framework of input.framework && input.framework !== 'both' ? [input.framework] : ['react', 'vue'] as const) {
    const generationStarted = performance.now();
    const generated = await generate({ schema: composition.schema, framework, profile: 'build', options: { theme, brand } });
    if (generated.status !== 'ok' || !generated.artifact) throw new Error(`Generation failed: ${JSON.stringify(generated.errors)}`);
    const issues = validateGeneratedArtifact(generated.artifact);
    if (issues.length) throw new Error(issues.join('\n'));
    const receipt = await loopRequest(port, '/render', {
      framework, theme, brand, artifact: generated.artifact, schemaHash, compose: input.compose,
      model: { ...model, ...Object.fromEntries(['rows', 'events', 'collectionQuery'].filter(key => input.model && Object.hasOwn(input.model, key)).map(key => [key, input.model![key]])) }, steps: input.steps ?? [], widths,
      output: path.join(output, framework), sourceHead,
      timings: { composeMs, generateMs: performance.now() - generationStarted },
    });
    await validateReceipt(receipt);
    verifyTheme(receipt);
    receipts.push(receipt);
  }
  await writeJson(path.join(output, 'composition.json'), composition);
  const result = { schemaHash, receipts, durationMs: performance.now() - started };
  await writeJson(path.join(output, 'render.json'), result);
  return result;
}
