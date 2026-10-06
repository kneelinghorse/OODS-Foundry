import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import { checkBuiltScreen } from '../a11y/built-screen.js';
import type { GenericOutput } from './types.js';
import type { UiSchema } from '../schemas/generated.js';
import { ToolError } from '../errors/tool-error.js';

type A11yScanInput = { apply?: boolean; schema?: UiSchema };

export async function handle(input: A11yScanInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase, input.apply === true);
  const outDir = path.join(base, 'a11y.scan');
  const startedAt = new Date();
  const artifacts: string[] = [];
  const report = await checkBuiltScreen(input.schema);

  // Write artifact if apply=true
  if (input.apply) {
    const file = path.join(outDir, 'a11y-report.json');
    if (!withinAllowed(policy.artifactsBase, file)) throw new ToolError('OODS-S015', 'Path not allowed', { path: file });
    if (input.apply) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    artifacts.push(file);
  }

  const transcriptPath = input.apply ? writeTranscript(outDir, {
    tool: 'a11y.scan',
    input: { apply: input.apply, hasSchema: Boolean(input.schema) },
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  }) : undefined;
  const bundleIndexPath = transcriptPath ? writeBundleIndex(outDir, [transcriptPath, ...artifacts]) : undefined;

  return {
    artifacts,
    structuredData: report,
    ...(transcriptPath ? { transcriptPath, bundleIndexPath } : {}),
    preview: {
      summary: `Accessibility: ${report.summary.passed} declared pairs pass, ${report.summary.failed + report.summary.screenFindings} findings, ${report.summary.unmeasured} pairs unmeasured — ${report.summary.complianceStatus}.`,
      notes: report.notChecked.map(item => `Not checked: ${item}.`),
    },
  };
}
