import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESULT_STATE_TONE, SEVERITY_TONES } from '@oods/component-contracts';
import { enforceResultStateFamily } from '../../src/compose/result-state.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { ToolError } from '../../src/errors/tool-error.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

/**
 * s205-m03, traits/core/Assessable: a result state renders as its OWN visual family — never red, never green,
 * never scored — because the moment "needs review" looks like a failure someone reports it as one.
 *
 * Two halves. The composer pins every result chip to RESULT_STATE_TONE and refuses a component it cannot pin
 * (OODS-V211). And in every theme scope the pages actually render — brands A and B in light, dark and high
 * contrast — that tone resolves to colours no severity tone uses, read the way the page reads them: the preview
 * runtime's own stylesheet in Chromium with data-brand and data-theme set on the document.
 */
const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
// s213-m04: the page loads the token build's CSS, then the preview runtime's component CSS (the runtime no longer carries tokens).
const styles = `${fs.readFileSync(path.join(root, 'packages/tokens/dist/css/tokens.css'), 'utf8')}\n${fs.readFileSync(path.join(root, 'packages/mcp-bridge/dist/preview-runtime/styles.css'), 'utf8')}`;
const SCOPES = (['A', 'B'] as const).flatMap(brand => (['light', 'dark', 'hc'] as const).map(theme => ({ brand, theme })));
// positive and danger normalise to success and critical in the badge's tone table (components-react status.ts).
const SEVERITY = [...new Set(SEVERITY_TONES.map(tone => tone === 'positive' ? 'success' : tone === 'danger' ? 'critical' : tone))];

let browser: Browser;
let storeRoot: string;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });
beforeEach(() => { storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-result-')); vi.stubEnv('MCP_SCHEMA_STORE_ROOT', storeRoot); vi.stubEnv('MCP_SCHEMA_STORE_DIR', 'schemas'); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(storeRoot, { recursive: true, force: true }); });

const walk = (schema: UiSchema) => { const found: UiElement[] = []; const visit = (node: UiElement) => { found.push(node); node.children?.forEach(visit); }; schema.screens.forEach(visit); return found; };
const luminance = ([r, g, b]: number[]) => { const c = [r!, g!, b!].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const contrast = (a: number[], b: number[]) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };

describe('the result-state visual family (s205-m03)', () => {
  it('pins every result chip on Finding\'s screens to the result tone, in every context that shows one', async () => {
    const pinned: string[] = [];
    // s206-m01: Finding is read-only and composes no workflow; its three read screens are where a result chip shows.
    for (const context of ['card', 'list', 'detail'] as const) {
      const composed = await compose({ object: 'Finding', context, options: { transient: true, validate: false } });
      for (const node of walk(composed.schema)) {
        if (node.props?.statusField === 'result_state' || node.props?.field === 'result_state') {
          if (['StatusBadge', 'Badge'].includes(node.component)) { expect(node.props?.tone, `${context} ${node.id}`).toBe(RESULT_STATE_TONE); pinned.push(context); }
        }
      }
    }
    expect(new Set(pinned)).toEqual(new Set(['card', 'list', 'detail']));
  }, 120_000);

  it('overrides a severity tone an author put on a result chip, and refuses a component it cannot pin (OODS-V211)', () => {
    const schema = { version: '1.0.0', objectSchema: { result_state: { type: 'string', required: true, semanticType: 'assessment.result.state' } },
      screens: [{ id: 's', component: 'Stack', children: [{ id: 'chip', component: 'StatusBadge', props: { statusField: 'result_state', tone: 'critical' } }] }] } as unknown as UiSchema;
    expect(enforceResultStateFamily(schema)).toBe(1);
    expect(schema.screens[0]!.children![0]!.props!.tone).toBe(RESULT_STATE_TONE);
    const refused = { ...schema, screens: [{ id: 's', component: 'Stack', children: [{ id: 'banner', component: 'Banner', props: { field: 'result_state' } }] }] } as unknown as UiSchema;
    expect(() => enforceResultStateFamily(refused)).toThrow(ToolError);
    try { enforceResultStateFamily(refused); } catch (error) { expect((error as ToolError).toStructured()).toMatchObject({ code: 'OODS-V211', category: 'validation' }); }
  });

  it.each(SCOPES)('renders the result tone as a family no severity tone shares, with readable text, in $brand/$theme', async ({ brand, theme }) => {
    const page = await browser.newPage();
    try {
      await page.setContent(`<!doctype html><html data-brand="${brand}" data-theme="${theme}"><head><style>${styles}</style></head><body data-brand="${brand}" data-theme="${theme}"></body></html>`);
      // Colours are read back as the pixels the browser paints (oklch and system colours included), not as strings.
      const resolved: Record<string, { surface: number[]; text: number[]; border: number[] }> = await page.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        const paint = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3); };
        const resolve = token => { const probe = document.createElement('i'); probe.style.color = 'var(' + token + ')'; document.body.append(probe); return paint(getComputedStyle(probe).color); };
        const out = {};
        for (const tone of ${JSON.stringify([RESULT_STATE_TONE, ...SEVERITY])}) out[tone] = { surface: resolve('--sys-status-' + tone + '-surface'), text: resolve('--sys-status-' + tone + '-text'), border: resolve('--sys-status-' + tone + '-border') };
        return out;
      })()`);
      const result = resolved[RESULT_STATE_TONE]!;
      const triple = (tone: { surface: number[]; text: number[]; border: number[] }) => JSON.stringify([tone.surface, tone.text, tone.border]);
      // s222-m01/m02 (#2502 ruling 6): in high contrast every status family is Canvas and CanvasText (no chip is told apart
      // by colour there), so a result chip is told apart by its label and mark; light and dark keep distinct families.
      if (theme !== 'hc') for (const tone of SEVERITY) expect(triple(result), `${brand}/${theme}: the result family is ${tone}'s`).not.toBe(triple(resolved[tone]!));
      if (theme === 'hc') for (const tone of SEVERITY) expect(triple(result), `${brand}/hc: system colours`).toBe(triple(resolved[tone]!));
      if (theme !== 'hc') {
        // In light and dark no single colour is shared: a result chip cannot be read as a severity chip at a glance.
        for (const tone of SEVERITY) {
          expect(result.surface, `${brand}/${theme}: surface vs ${tone}`).not.toEqual(resolved[tone]!.surface);
          expect(result.text, `${brand}/${theme}: text vs ${tone}`).not.toEqual(resolved[tone]!.text);
        }
      }
      expect(contrast(result.text, result.surface), `${brand}/${theme}: result chip text contrast`).toBeGreaterThanOrEqual(4.5);
    } finally { await page.close(); }
  }, 60_000);
});
