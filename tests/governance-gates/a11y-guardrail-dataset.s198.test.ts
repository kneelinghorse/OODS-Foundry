import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadGuardrailConfig } from '../../tools/a11y/index.mjs';

import { loadGuardrails } from '../../scripts/tokens/color-guardrails.js';
import { loadGuardrails as sharedReader } from '../../tools/a11y/guardrails/read.mjs';

const csv = readFileSync(new URL('../../tools/a11y/guardrails/relative-color.csv', import.meta.url), 'utf8');
const headers = csv.trim().split('\n')[0].split(',');
async function parse(text: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'oods-a11y-dataset-'));
  try { const file = path.join(dir, 'checks.csv'); writeFileSync(file, text); return await loadGuardrailConfig(file); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
function change(row: number, field: string, value: string) {
  const lines = csv.trim().split('\n'), cells = lines[row].split(','); cells[headers.indexOf(field)] = value; lines[row] = cells.join(','); return lines.join('\n');
}

describe('the accessibility reader honors the typed palette dataset', () => {
  it('keeps all six relative-color obligations while palette rows retain their separate gate ownership', async () => {
    const rows = await parse(csv);
    expect(rows.map((row: any) => row.id)).toEqual(csv.trim().split('\n').slice(1, 7).map(line => line.split(',')[0]));
    expect(rows.every((row: any) => row.baseToken && row.derivedToken && row.contrastThreshold === 4.5)).toBe(true);
  });
  it('shares the exact reader and names the palette owner', async () => {
    expect(loadGuardrails).toBe(sharedReader);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const all = await loadGuardrails(path.resolve('tools/a11y/guardrails/relative-color.csv'));
      expect(all).toHaveLength(67);
      expect(await parse(csv)).toEqual(all.filter(row => row.checkType === 'relative-color'));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('61 palette rows are owned by tokens-validate'));
    } finally { log.mockRestore(); }
  });
  it.each(['Infinity', '-Infinity'])('rejects non-finite limit %s', async value => {
    await expect(parse(change(1, 'delta_l_min', value))).rejects.toThrow(/must be numeric/);
  });
  it('preserves datasets without the optional check_type column', async () => {
    const legacy = csv.trim().split('\n').slice(0, 7).map(line => line.split(',').slice(0, 14).join(',')).join('\n');
    expect(await parse(legacy)).toHaveLength(6);
  });
  it('rejects unknown types rather than silently dropping a misspelled check', async () => {
    await expect(parse(change(7, 'check_type', 'gmaut'))).rejects.toThrow(/unknown check_type/);
  });
  it.each(['base_token', 'derived_token'])('still rejects a relative-color row without %s', async field => {
    await expect(parse(change(1, field, ''))).rejects.toThrow(/missing/);
  });
  it.each(['source', 'target'])('rejects a palette row without its %s operand', async field => {
    await expect(parse(change(7, field, ''))).rejects.toThrow(/requires source and target/);
  });
  it('still rejects a nonnumeric relative-color limit', async () => {
    await expect(parse(change(1, 'delta_l_min', 'invalid'))).rejects.toThrow(/must be numeric/);
  });
  it('rejects malformed row widths', async () => {
    await expect(parse(csv.trim() + ',extra')).rejects.toThrow(/columns/);
  });
});
