import { createHash } from 'node:crypto';
import Color from 'colorjs.io';
import { resolveTokenToColor } from '@oods/viz-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import type { GeneratedArtifact } from '../../packages/mcp-server/src/codegen/types.js';
import type { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PORT = 4477;
export const DEFAULT_STATE = path.join(os.tmpdir(), `oods-design-loop-${createHash('sha256').update(ROOT).digest('hex').slice(0, 10)}`);
export type Framework = 'react' | 'vue';
export type ComposeInput = Parameters<typeof compose>[0];
export type BrowserStep = { action: 'click' | 'fill' | 'select' | 'check'; selector: string; value?: string };
export interface RenderInput {
  compose: ComposeInput;
  framework?: Framework | 'both';
  theme?: 'light' | 'dark';
  /** A brand in the brand registry (s213-m04). */
  brand?: string;
  widths?: number[];
  output: string;
  model?: Record<string, unknown>;
  steps?: BrowserStep[];
  port?: number;
}
export const digest = (value: string | Buffer) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
export function relativeFile(root: string, file: string): string {
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`Unsafe relative file: ${file}`);
  return path.join(root, file);
}
export async function outputDirectory(output: string): Promise<string> {
  const resolved = path.resolve(output);
  // Resolve existing parents too, so symlinks cannot redirect receipts into canonical inputs.
  let parent = resolved;
  const tail: string[] = [];
  while (!(await fs.stat(parent).then(() => true, () => false))) { tail.unshift(path.basename(parent)); parent = path.dirname(parent); }
  const real = path.join(await fs.realpath(parent), ...tail);
  if (real.split(path.sep).includes('.oods') || /(?:^|\/)artifacts\/structured-data(?:\/|$)/.test(real)) {
    throw new Error('Receipts must not be written into a saved store or structured-data directory.');
  }
  return real;
}
export async function loopRequest(port: number, route: string, body?: unknown): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json() as any;
  if (!response.ok) throw new Error(result.error ?? `Design loop HTTP ${response.status}`);
  return result;
}
export interface CaptureRequest {
  theme: 'light' | 'dark'; brand: string;
  framework: Framework; artifact: GeneratedArtifact; schemaHash: string;
  compose: ComposeInput; model: Record<string, unknown>; steps: BrowserStep[];
  widths: number[]; output: string; sourceHead: string; timings: Record<string, number>;
}
let validate: ValidateFunction | undefined;
export async function validateReceipt(receipt: unknown): Promise<void> {
  validate ??= new Ajv({ allErrors: true }).compile(JSON.parse(await fs.readFile(new URL('./receipt.schema.json', import.meta.url), 'utf8')));
  if (!validate(receipt)) throw new Error(`Invalid design-loop receipt: ${JSON.stringify(validate.errors)}`);
}

/** Compare computed browser colors to the same sRGB scope used by chart rendering. */
export function verifyTheme(receipt: any): void {
  if (receipt.version !== '1.1') return;
  const hex = (value: string) => {
    const color = new Color(value);
    if (color.alpha !== 1) throw new Error('Theme surfaces must be opaque.');
    return '#' + color.to('srgb').coords.map(channel => Math.round(Math.max(0, Math.min(1, channel!)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const canvas = hex(resolveTokenToColor('--sys-surface-canvas', { theme: receipt.theme, brand: receipt.brand })!);
  for (const view of receipt.views) {
    if (hex(view.measurements.bodyBackground) !== canvas) throw new Error(`Body background does not match ${receipt.brand}/${receipt.theme} canvas at ${view.width}.`);
    for (const fill of view.measurements.chartCanvasFills) {
      if (hex(fill) !== canvas) throw new Error(`Chart canvas does not match ${receipt.brand}/${receipt.theme} at ${view.width}.`);
    }
  }
}
