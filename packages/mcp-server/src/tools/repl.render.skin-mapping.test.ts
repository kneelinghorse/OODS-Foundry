import { describe, expect, it } from 'vitest';
import { handle as renderHandle } from './repl.render.js';
import { resolveTokenOverlay } from '../render/brand-overlay.js';
import { loadStyleLibrary } from '../render/style-library.js';
import { isToolError } from '../errors/tool-error.js';
import type { ReplRenderOutput, UiSchema } from '../schemas/generated.js';

// Colocated golden for the brand-contract A1 SKIN mapping (sprint-123). It proves the
// measured-colour skinOverlay path is REACHABLE and ADDITIVE, and folds in the m01 resolver
// assertions so they actually run in CI. This file lives in src/tools/ and so runs ONLY via the
// by-name vitest list in .github/workflows/ci.yml:582 (root coverage globs test/** not src/**) —
// it is appended there. CRITICAL assertion shape: every bare --sys-* name is ALWAYS present in the
// rendered html as a var() ref in DEFAULT_COMPONENT_CSS, so reachability/absence is asserted on the
// :root DEFINITION line ('name: <sentinel>;') with a sentinel value distinct from any default —
// NEVER not.toContain on a bare --sys- name (that floor is a phantom that would always red).

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    return isToolError(err) ? err.opiCode : `non-tool-error:${String(err)}`;
  }
  return undefined; // did not throw
};

const SCHEMA: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'skin-screen',
      component: 'Stack',
      children: [{ id: 'skin-button', component: 'Button', props: { label: 'Save' } }],
    },
  ],
};

// Render a document via the real handler with apply:true (the overlay wiring gate) and full CSS.
const renderDoc = (
  output: Record<string, unknown>,
  schema: UiSchema = SCHEMA,
): Promise<ReplRenderOutput> =>
  renderHandle({
    mode: 'full',
    schema,
    apply: true,
    output: { format: 'document', compact: false, ...output },
  } as never);

// Slice from the raw components <style> sink to end-of-document — both DEFAULT_COMPONENT_CSS and
// the appended overlay/skin :root blocks live here.
const componentsStyleOf = (html: string): string =>
  html.slice(html.indexOf('<style data-source="components">'));

describe('repl.render skin mapping (sprint-123 brand-contract A1)', () => {
  it('additive floor: an empty/absent skinOverlay is byte-identical to no overlay and pins no sentinel', async () => {
    const baseline = await renderDoc({});
    const emptyFloor = await renderDoc({ skinOverlay: {} });
    // An empty skin delta resolves to '' -> combined falls back to the (also empty) overlayBlock ->
    // no componentCss -> byte-identical document. This is the contract m02 promised.
    expect(emptyFloor.html).toBe(baseline.html);
    // The DEFINITION line + sentinel is what we assert absent; the bare name is a var() ref and is
    // always present, so we never not.toContain the bare --sys-surface-canvas.
    expect(baseline.html).not.toContain('--sys-surface-canvas: #abcdef');
  });

  it('reachability: each of the 4 logical keys emits its mapped --sys-* :root definition line', async () => {
    const result = await renderDoc({
      skinOverlay: {
        color: {
          surface: { default: '#aa0001' },
          brand: { primary: '#bb0002' },
          text: { default: '#cc0003', 'on-brand': '#dd0004' },
        },
      },
    });
    expect(result.status).toBe('ok');
    const css = componentsStyleOf(result.html as string);
    expect(css).toContain('  --sys-surface-canvas: #aa0001;');
    expect(css).toContain('  --sys-surface-interactive-primary-default: #bb0002;');
    expect(css).toContain('  --sys-text-primary: #cc0003;');
    expect(css).toContain('  --sys-text-on-interactive: #dd0004;');
  });

  it('an unmapped logical key fails loud with OODS-V140 (closed table, no silent drop)', async () => {
    await expect(
      renderDoc({ skinOverlay: { color: { brand: { secondary: '#000000' } } } }),
    ).rejects.toMatchObject({ opiCode: 'OODS-V140' });
  });

  it('name allowlist: every style-library RHS matches /^--(sys|ref)-[a-z0-9-]+$/ (unescaped-sink trust boundary)', () => {
    const NAME = /^--(sys|ref)-[a-z0-9-]+$/;
    const { mappings } = loadStyleLibrary();
    const targets = Object.values(mappings);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target).toMatch(NAME);
    }
  });

  it('the --oods- tokenOverlay path is UNREGRESSED: still emits --oods-* and still throws V136 on an unsafe value', () => {
    // Reachability of the token path is independent of the skin path (distinct resolver, distinct namespace).
    expect(resolveTokenOverlay({ size: { spacing: { sm: '10px' } } })).toContain(
      '  --oods-size-spacing-sm: 10px;',
    );
    // The value-sanitisation trust boundary still fires on the token path.
    expect(codeOf(() => resolveTokenOverlay({ color: { brand: '</style><script>' } }))).toBe(
      'OODS-V136',
    );
  });

  it('tokenOverlay-only output is byte-unchanged by the m02 skin concat refactor', async () => {
    const overlay = { size: { spacing: { sm: '10px' } } };
    const result = await renderDoc({ tokenOverlay: overlay }); // skinOverlay ABSENT
    const css = componentsStyleOf(result.html as string);
    // The exact :root block resolveTokenOverlay produces must appear byte-for-byte — the concat with
    // an absent skinBlock collapses to overlayBlock, so the token output is identical to pre-m02.
    expect(css).toContain(resolveTokenOverlay(overlay));
  });

  it('both overlays present: the --oods- and --sys- blocks both land in the components <style>', async () => {
    const result = await renderDoc({
      tokenOverlay: { size: { spacing: { sm: '10px' } } },
      skinOverlay: { color: { surface: { default: '#aa0001' } } },
    });
    const css = componentsStyleOf(result.html as string);
    expect(css).toContain('  --oods-size-spacing-sm: 10px;');
    expect(css).toContain('  --sys-surface-canvas: #aa0001;');
  });

  it('dark-theme pin: the skin --sys- override still emits under theme=dark (DARK_THEME_OVERRIDES remaps only --theme-*)', async () => {
    const darkSchema: UiSchema = { ...SCHEMA, theme: 'dark' };
    const result = await renderDoc(
      { skinOverlay: { color: { surface: { default: '#aa0001' } } } },
      darkSchema,
    );
    // Confirm we ARE in the dark document (else the pin assertion is vacuous).
    expect(result.html).toContain('data-theme="dark"');
    const css = componentsStyleOf(result.html as string);
    // The brand-skin pin intentionally overrides the dark cascade: dark only remaps --theme-* vars,
    // so the --sys-surface-canvas :root override is untouched and still emits.
    expect(css).toContain('  --sys-surface-canvas: #aa0001;');
  });
});
