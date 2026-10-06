import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentContracts, NUCLEUS_COMPONENT_IDS } from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';
import { COMPONENT_STYLE_IDS, SUPPORTED_COMPONENT_THEME_CELLS } from '../src/index.js';
import { SEMANTIC_BRIDGE } from '../../tokens/scripts/brand-bridge.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
// s222-m02 (#2502 ruling 11): components.css imports components-overlay.css (Switch and Dialog); the shipped stylesheet
// is both files, so a component styled only in the imported one still counts as covered.
// s223-m02 (#2527 ruling 11): and components-combobox.css (Combobox), imported the same way.
// s223-m02 (#2527 ruling 10): and components-segmented-control.css (SegmentedControl), imported the same way.
const css = ['src/components.css', 'src/components-overlay.css', 'src/components-combobox.css', 'src/components-segmented-control.css']
  .map(file => fs.readFileSync(path.join(packageRoot, file), 'utf8')).join('\n');
const breadthComponents = [
  'ArchiveSummary', 'ArchivePill', 'CancellationForm', 'CancellationBadge', 'PriceCardMeta',
  'OwnerBadge', 'OwnershipSummary', 'OwnershipMeta', 'TagSummary',
  'LabelCell', 'InlineLabel', 'FormLabelGroup', 'ClassificationBadge', 'ClassificationEditor',
  'DetailHeader', 'CardHeader', 'ColorSwatch', 'ColorizedBadge', 'VizAreaPreview',
  'ClassificationPanel', 'FilterPanel', 'PriceSummary',
  'AddressCollectionPanel', 'MembershipPanel', 'PreferencePanel', 'TagManager',
  'AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge', 'RoleBadgeList', 'TagPills',
  'AddressValidationTimeline', 'AuditEvent', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline',
  'AddressEditor', 'PreferenceEditor', 'RoleAssignmentForm', 'StatusSelector', 'TagInput', 'TemplatePicker',
] as const;

function colorTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  function visit(node: unknown, segments: string[]) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const record = node as Record<string, unknown>;
    if (record.$type === 'color' && typeof record.$value === 'string') {
      tokens.set(segments.join('.'), record.$value);
      return;
    }
    for (const [key, value] of Object.entries(record)) {
      if (!key.startsWith('$')) visit(value, [...segments, key]);
    }
  }
  visit(JSON.parse(fs.readFileSync(source, 'utf8')), []);
  return tokens;
}

function componentDeclarations(component: string): string {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.includes(`[data-oods-component='${component}']`))
    .map(([, , declarations]) => declarations)
    .join('\n');
}

describe('Sprint 182 shared component style contract', () => {
  it('covers every nucleus component with token-driven CSS', () => {
    expect([...COMPONENT_STYLE_IDS].sort()).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    for (const id of COMPONENT_STYLE_IDS) {
      expect(css, id).toContain(`[data-oods-component='${id}']`);
    }
    expect(css).toContain('@import "@oods/tokens/css"');
    // The overlay sheet only reaches a consumer through this import (and the HTML renderer's inlined copy).
    expect(css).toContain('@import "./components-overlay.css"');
    expect(css).toContain('@import "./components-combobox.css"');
    expect(css).toContain('@import "./components-segmented-control.css"');
    expect(css).toMatch(/var\(--cmp-/);
  });

  it('binds the six declared brand/theme cells to real token sources', () => {
    const tokenRoot = path.join(repoRoot, 'packages/tokens/src/tokens');
    const systemTokens = new Map(
      ['text.json', 'surface.json', 'status.json'].flatMap((file) => (
        [...colorTokens(path.join(tokenRoot, 'base/system', file))]
      )),
    );
    expect(SUPPORTED_COMPONENT_THEME_CELLS).toHaveLength(6);
    for (const cell of SUPPORTED_COMPONENT_THEME_CELLS) {
      const tokenMode = cell.theme === 'light' ? 'base' : cell.theme;
      const source = path.join(tokenRoot, 'brands', cell.brand, `${tokenMode}.json`);
      expect(fs.existsSync(source), `${cell.brand}/${cell.theme}`).toBe(true);
      const brandTokens = colorTokens(source);
      for (const component of breadthComponents) {
        const declarations = componentDeclarations(component);
        for (const role of componentContracts[component].tokenRoles) {
          const detail = `${component}.${role} in ${cell.brand}/${cell.theme}`;
          const variable = `--cmp-${role.replaceAll('.', '-')}`;
          // A contract role must be consumed and bound, not merely mentioned in CSS.
          expect(declarations, detail).toContain(`var(${variable},`);
          const binding = declarations.match(new RegExp(`${variable}: var\\((--sys-[\\w-]+)\\);`));
          expect(binding, `${detail}: component-to-system binding`).not.toBeNull();
          const systemEntry = [...systemTokens].find(([name]) => `--${name.replaceAll('.', '-')}` === binding![1]);
          expect(systemEntry, `${detail}: real system color token`).toBeDefined();
          const reference = systemEntry![1].match(/^\{(theme\.[\w.-]+)\}$/);
          expect(reference, `${detail}: semantic token reference`).not.toBeNull();
          const semanticSlot = `--${reference![1].replaceAll('.', '-')}`;
          const bridge = SEMANTIC_BRIDGE.find((entry: { slot: string }) => entry.slot === semanticSlot);
          expect(bridge, `${detail}: active semantic bridge`).toBeDefined();
          const value = brandTokens.get(`color.brand.${cell.brand}.${bridge!.tokenPath}`);
          expect(value, `${detail}: resolved source value`).toBeTruthy();
          expect(value, `${detail}: no dangling alias`).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('s185-m02 keeps color labels visible beside decorative markers in hc and forced colors', () => {
    const labelSelectors = [
      ":where([data-oods-component='ColorSwatch']) > [data-oods-swatch-label]",
      ":where([data-oods-component='ColorizedBadge']) [data-oods-badge-label]",
    ];
    const labelRule = `${labelSelectors.join(',\n')} {\n  display: inline;\n  visibility: visible;\n  color: inherit;\n}`;
    expect(css).toContain(labelRule);
    for (const id of ['ColorSwatch', 'ColorizedBadge']) {
      expect(css).toMatch(new RegExp(
        `@media \\(forced-colors: active\\)[\\s\\S]*?\\[data-oods-component='${id}'\\][\\s\\S]*?forced-color-adjust: none;[\\s\\S]*?background: Canvas;[\\s\\S]*?color: CanvasText;`,
      ));
      expect(css).toMatch(new RegExp(
        `\\[data-theme='hc'\\] :where\\([^{}]*?\\[data-oods-component='${id}'\\][^{}]*?\\) \\{\\s*border-color: CanvasText;\\s*background: Canvas;\\s*color: CanvasText;`,
      ));
    }
    expect(css).toMatch(/\[data-oods-swatch-chip\],[\s\S]*?\[data-oods-badge-marker\] \{\s*border-color: CanvasText;\s*background: CanvasText;/);
  });

  it('s185-m02 exposes styled heading, supporting copy and a dimensioned empty preview frame', () => {
    for (const id of ['DetailHeader', 'CardHeader']) {
      expect(css).toContain(`[data-oods-component='${id}']) > :is(h1, h2, h3, h4, h5, h6)`);
    }
    for (const part of ['data-oods-subtitle', 'data-oods-metadata', 'data-oods-supporting', 'data-viz-preview-placeholder']) {
      expect(css).toContain(`> [${part}]`);
    }
    const frame = componentDeclarations('VizAreaPreview');
    expect(frame).toContain('inline-size: min(100%, var(--oods-viz-width, 640px));');
    expect(frame).toContain('min-block-size: var(--oods-viz-height, 360px);');
  });

  it('s202-m01 shows a placed chart\'s narrow render at 600px or less of figure width through a container query', () => {
    expect(css).toContain(":where([data-viz-rendered='true'][data-viz-narrow='true']) { container-type: inline-size; }");
    expect(css).toContain(':where([data-viz-svg-narrow]) { display: none; min-inline-size: 0; }');
    expect(css).toMatch(/@container \(max-width: 600px\) \{\s*:where\(\[data-viz-narrow='true'\]\) > \[data-viz-svg\] \{ display: none; \}\s*:where\(\[data-viz-narrow='true'\]\) > \[data-viz-svg-narrow\] \{ display: block; \}\s*\}/);
  });

  it('s182-m01a keeps shared high-contrast controls on matching system colors', () => {
    // s221-m02 (#2482 ruling 4): an hc rule may carry the zero-specificity limit that stops it at a panel setting
    // another theme; the rules themselves are unchanged.
    expect(css).toMatch(
      /\[data-oods-component='Button'\]\):disabled \{[\s\S]*?background: var\(--cmp-button-background-disabled, var\(--sys-surface-disabled, Canvas\)\);[\s\S]*?color: var\(--cmp-button-text-disabled, var\(--sys-text-disabled, GrayText\)\);/,
    );
    expect(css).toMatch(/\[data-theme='hc'\][\s\S]*?background: Canvas;[\s\S]*?color: CanvasText;/);
    expect(css).toMatch(/\[data-theme='hc'\] \.oods-field-error(?::not\(:where\([^{]*?\)\))? \{\s*color: CanvasText;/);
    expect(css).toMatch(
      /\[data-theme='hc'\][\s\S]*?\[data-oods-component='Button'\][\s\S]*?:not\(:disabled\)(?::not\(:where\([^{]*?\)\))? \{[\s\S]*?background: Highlight;[\s\S]*?color: HighlightText;/,
    );
    expect(css).toMatch(
      /\[data-theme='hc'\][\s\S]*?\[data-oods-component='Button'\][\s\S]*?:disabled(?::not\(:where\([^{]*?\)\))? \{[\s\S]*?background: Canvas;[\s\S]*?color: GrayText;/,
    );
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*?forced-color-adjust: none;/);
    // s222-m02 (#2502 ruling 11): the dismiss is a ghost icon button at the small control height, 28px (1.75rem).
    expect(css).toMatch(/\.oods-banner-dismiss \{[\s\S]*?inline-size: var\(--cmp-button-height-sm, 1\.75rem\);[\s\S]*?color: inherit;/);
  });

  // s221-m02 retired the component-level override this used to find; since s222-m01 the brand's own token carries it: the
  // recipe gives text on brand B's violet primary as pure white, the neutral's step 1.
  it('s182-m01b binds the measured Brand B light action foreground to pure white', () => {
    const tokens = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tokens/dist/css/tokens.css'), 'utf8');
    const block = tokens.match(/\[data-brand='B'\]\[data-theme='base'\],\n\[data-brand='B'\]\[data-theme='light'\] \{\n  --theme-surface-canvas[\s\S]*?\n\}/)?.[0] ?? '';
    expect(block).toContain('--theme-text-on-interactive: oklch(1 0 286);');
  });

  it('encodes the locked visual state vocabulary without consumer utility scanning', () => {
    for (const intent of ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger']) {
      expect(css, `Button intent=${intent}`).toContain(`[data-intent='${intent}']`);
    }
    for (const size of ['sm', 'md', 'lg']) {
      expect(css, `Button size=${size}`).toContain(
        `[data-oods-component='Button'])[data-size='${size}']`,
      );
      expect(css, `Tabs size=${size}`).toContain(
        `[data-oods-component='Tabs'])[data-size='${size}']`,
      );
      expect(css, `Text size=${size}`).toContain(
        `[data-oods-component='Text'])[data-size='${size}']`,
      );
    }
    for (const weight of ['regular', 'normal', 'medium', 'semibold']) {
      expect(css, `Text weight=${weight}`).toContain(`[data-weight='${weight}']`);
    }
    for (const density of ['compact', 'default', 'comfortable']) {
      expect(css, `Table density=${density}`).toContain(`[data-density='${density}']`);
    }
    expect(css).toMatch(/\[data-oods-component='Badge'\]\)\[data-emphasis='solid'\]/);
    expect(css).toMatch(/\[data-oods-component='Banner'\]\)\[data-emphasis='solid'\]/);
  });

  it('styles field controls without treating framework wrappers as native controls', () => {
    for (const selector of [
      "input[data-oods-component='Input']",
      "input[data-oods-component='DatePicker']",
      "select[data-oods-component='Select']",
      "textarea[data-oods-component='Textarea']",
    ]) {
      expect(css, selector).toContain(selector);
    }
    expect(css).not.toContain(
      ":where([data-oods-component='Input'], [data-oods-component='DatePicker']",
    );
  });
});

// s191-m03 A6: the visible border must contain the archive badge, not only the button.
it('gives archived collection cards one outer border while retaining their button', () => {
  expect(css).toContain("[data-oods-component='ArchivedRowOverlay'][data-archived='true']:has(> .oods-collection-row)");
  expect(css).toContain("[data-oods-component='ArchivedRowOverlay'][data-archived='true'] > .oods-collection-row { border: 0; background: transparent; }");
  const rule = css.match(/:has\(> \.oods-collection-row\) \{([^}]+)\}/)![1]!;
  expect(rule).toContain('border: 1px solid');
  expect(rule).toContain('box-sizing: border-box');
  expect(rule).toContain('padding-inline-end:');
});
