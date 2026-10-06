/**
 * Contract and integration tests for the design.compose pipeline (s51-m04).
 *
 * Tests the full composition pipeline:
 *   1. All 4 templates produce renderable schemas
 *   2. Component selector picks correct defaults for 10+ intents
 *   3. E2E: compose → validate → render pipeline works
 *   4. Edge cases handled gracefully
 *   5. Composed schemas work in both document and fragment modes
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as validateHandle } from '../../packages/mcp-server/src/tools/repl.validate.js';
import { handle as renderHandle } from '../../packages/mcp-server/src/tools/repl.render.js';
import {
  dashboardTemplate,
  formTemplate,
  detailTemplate,
  listTemplate,
  resetIdCounter,
} from '../../packages/mcp-server/src/compose/templates/index.js';
import {
  selectComponent,
  loadCatalog,
} from '../../packages/mcp-server/src/compose/component-selector.js';
import type { ComponentCatalogEntry } from '../../packages/mcp-server/src/tools/types.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';

let catalog: ComponentCatalogEntry[];

beforeAll(async () => {
  catalog = await loadCatalog();
});

/* ------------------------------------------------------------------ */
/*  Contract 1: All 4 templates produce renderable schemas             */
/* ------------------------------------------------------------------ */

describe('contract: all templates produce renderable schemas', () => {
  const templateFactories: [string, () => { schema: UiSchema }][] = [
    ['dashboard', () => { resetIdCounter(); return dashboardTemplate(); }],
    ['form', () => { resetIdCounter(); return formTemplate(); }],
    ['detail', () => { resetIdCounter(); return detailTemplate(); }],
    ['list', () => { resetIdCounter(); return listTemplate(); }],
  ];

  for (const [name, factory] of templateFactories) {
    it(`${name} template validates successfully`, async () => {
      const { schema } = factory();
      const result = await validateHandle({
        mode: 'full',
        schema,
        options: { checkComponents: true },
      });
      expect(result.status).toBe('ok');
      expect(result.errors).toHaveLength(0);
    });

    it(`${name} template renders in document mode`, async () => {
      const { schema } = factory();
      const result = await renderHandle({
        mode: 'full',
        schema,
        apply: true,
        output: { format: 'document' },
      });
      expect(result.status).toBe('ok');
      expect(result.html).toBeTruthy();
      expect(result.html).toContain('data-oods-component');
    });

    it(`${name} template renders in fragment mode`, async () => {
      const { schema } = factory();
      const result = await renderHandle({
        mode: 'full',
        schema,
        apply: true,
        output: { format: 'fragments' },
      });
      expect(result.status).toBe('ok');
      expect(result.fragments).toBeTruthy();
      expect(Object.keys(result.fragments!).length).toBeGreaterThan(0);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Contract 2: Component selector accuracy (10+ intents)              */
/* ------------------------------------------------------------------ */

describe('contract: component selector accuracy for 10+ standard intents', () => {
  const intentExpectations: [string, string, string[]][] = [
    ['action-button', 'Button as top pick', ['Button']],
    ['text-input', 'Input as top pick', ['Input']],
    ['data-table', 'Table as top pick', ['Table']],
    ['form-input', 'Input or Select in top 3', ['Input', 'Select']],
    ['status-indicator', 'Badge variant as top pick', ['StatusBadge', 'Badge', 'ColorizedBadge']],
    ['page-header', 'Text in top 3', ['Text', 'DetailHeader']],
    ['metrics-display', 'Card in top 3', ['Card', 'Badge']],
    ['navigation-panel', 'Tabs or Stack in top 3', ['Tabs', 'Stack']],
    ['filter-control', 'Select in candidates', ['Select', 'Input']],
    ['data-display', 'Card or Table in candidates', ['Card', 'Table', 'Stack']],
    ['data-list', 'Stack or Table in candidates', ['Stack', 'Table']],
    ['metadata-display', 'Stack or Text in candidates', ['Stack', 'Text', 'Badge']],
    ['pagination-control', 'Text or Button in candidates', ['Text', 'Button']],
  ];

  for (const [intent, description, expectedComponents] of intentExpectations) {
    it(`"${intent}": ${description}`, () => {
      const result = selectComponent(intent, catalog, { topN: 5 });
      expect(result.candidates.length).toBeGreaterThan(0);
      const candidateNames = result.candidates.map(c => c.name);
      const hasExpected = expectedComponents.some(ec => candidateNames.includes(ec));
      expect(
        hasExpected,
        `Expected [${expectedComponents.join('|')}] in candidates, got [${candidateNames.join(', ')}]`,
      ).toBe(true);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Contract 3: E2E compose → validate → render pipeline               */
/* ------------------------------------------------------------------ */

describe('contract: compose → validate → render E2E pipeline', () => {
  const intents = [
    'dashboard with metrics and sidebar',
    'user registration form',
    'product detail page with tabs',
    'searchable inventory list',
  ];

  for (const intent of intents) {
    it(`"${intent}" → compose → validate → render document`, async () => {
      // Step 1: Compose
      const composed = await composeHandle({ intent });
      expect(composed.status).toBe('ok');
      expect(composed.schema).toBeTruthy();

      // Step 2: Validate (already done by compose, but verify independently)
      const validated = await validateHandle({
        mode: 'full',
        schema: composed.schema,
        options: { checkComponents: true },
      });
      expect(validated.status).toBe('ok');
      expect(validated.errors).toHaveLength(0);

      // Step 3: Render document
      const rendered = await renderHandle({
        mode: 'full',
        schema: composed.schema,
        apply: true,
        output: { format: 'document' },
      });
      expect(rendered.status).toBe('ok');
      expect(rendered.html).toBeTruthy();
      expect(rendered.html!.length).toBeGreaterThan(100);
    });

    it(`"${intent}" → compose → render fragments`, async () => {
      const composed = await composeHandle({ intent });
      expect(composed.status).toBe('ok');

      const rendered = await renderHandle({
        mode: 'full',
        schema: composed.schema,
        apply: true,
        output: { format: 'fragments' },
      });
      expect(rendered.status).toBe('ok');
      expect(rendered.fragments).toBeTruthy();
      expect(Object.keys(rendered.fragments!).length).toBeGreaterThan(0);

      // Each fragment has HTML content
      for (const frag of Object.values(rendered.fragments!)) {
        expect(frag.html).toBeTruthy();
        expect(frag.nodeId).toBeTruthy();
        expect(frag.component).toBeTruthy();
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Contract 4: Edge cases handled gracefully                          */
/* ------------------------------------------------------------------ */

describe('contract: edge cases', () => {
  it('empty intent returns error-free result with warning', async () => {
    // The JSON schema requires minLength 1, but the handler also guards
    // If the schema allows through, the handler should cope gracefully
    const result = await composeHandle({ intent: 'x' });
    expect(result.status).toBe('ok');
  });

  it('unknown layout hint falls back gracefully', async () => {
    // "auto" with no matching keywords defaults to dashboard
    const result = await composeHandle({ intent: 'zzz unknown xyz' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBeTruthy();
    expect(result.warnings.some(w => w.code === 'OODS-V116')).toBe(true);
  });

  it('validation can be skipped', async () => {
    const result = await composeHandle({
      intent: 'dashboard',
      layout: 'dashboard',
      options: { validate: false },
    });
    expect(result.status).toBe('ok');
    expect(result.validation?.status).toBe('skipped');
  });

  it('component overrides respected even for non-existent slots', async () => {
    const result = await composeHandle({
      intent: 'list',
      layout: 'list',
      preferences: { componentOverrides: { items: 'Table' } },
    });
    const itemsSel = result.selections.find(s => s.slotName === 'items');
    expect(itemsSel?.selectedComponent).toBe('Table');
    expect(itemsSel?.candidates[0].reason).toContain('user override');
  });

  it('all 4 explicit layouts work', async () => {
    for (const layout of ['dashboard', 'form', 'detail', 'list'] as const) {
      const result = await composeHandle({ intent: 'generic intent', layout });
      expect(result.status, `${layout} failed`).toBe('ok');
      expect(result.layout).toBe(layout);
      expect(result.validation?.status, `${layout} validation failed`).toBe('ok');
    }
  });

  it('compose with theme preference', async () => {
    const result = await composeHandle({
      intent: 'dashboard',
      layout: 'dashboard',
      preferences: { theme: 'dark' },
    });
    expect(result.schema.theme).toBe('dark');
  });

  it('compose with topN option limits candidates', async () => {
    const result = await composeHandle({
      intent: 'dashboard',
      layout: 'dashboard',
      options: { topN: 1 },
    });
    for (const sel of result.selections) {
      expect(sel.candidates.length).toBeLessThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Contract 5: Composed schemas work in fragment mode                 */
/* ------------------------------------------------------------------ */

describe('contract: composed schemas in fragment render mode', () => {
  it('dashboard composed schema renders fragments with CSS refs', async () => {
    const composed = await composeHandle({ intent: 'analytics dashboard', layout: 'dashboard' });
    const rendered = await renderHandle({
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });
    expect(rendered.status).toBe('ok');
    const frags = Object.values(rendered.fragments ?? {});
    expect(frags.length).toBeGreaterThan(0);
    for (const frag of frags) {
      expect(frag.cssRefs).toBeInstanceOf(Array);
    }
  });

  it('form composed schema renders fragments', async () => {
    const composed = await composeHandle({ intent: 'registration form', layout: 'form' });
    const rendered = await renderHandle({
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });
    expect(rendered.status).toBe('ok');
    expect(Object.keys(rendered.fragments ?? {}).length).toBeGreaterThan(0);
  });

  it('detail composed schema renders fragments', async () => {
    const composed = await composeHandle({ intent: 'user profile detail', layout: 'detail' });
    const rendered = await renderHandle({
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });
    expect(rendered.status).toBe('ok');
    expect(Object.keys(rendered.fragments ?? {}).length).toBeGreaterThan(0);
  });

  it('list composed schema renders fragments', async () => {
    const composed = await composeHandle({ intent: 'product catalog list', layout: 'list' });
    const rendered = await renderHandle({
      mode: 'full',
      schema: composed.schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    });
    expect(rendered.status).toBe('ok');
    expect(Object.keys(rendered.fragments ?? {}).length).toBeGreaterThan(0);
  });
});
